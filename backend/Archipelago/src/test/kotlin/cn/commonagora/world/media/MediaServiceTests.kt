package cn.commonagora.world.media

import cn.commonagora.world.config.StorageProperties
import cn.commonagora.world.shared.*
import io.mockk.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.io.TempDir
import org.springframework.http.HttpStatus
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.jdbc.datasource.DataSourceTransactionManager
import org.springframework.jdbc.datasource.DriverManagerDataSource
import org.springframework.transaction.support.TransactionSynchronizationManager
import org.springframework.transaction.support.TransactionTemplate
import java.nio.file.Path
import java.time.Clock
import java.time.Instant
import java.time.ZoneOffset
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import kotlin.test.*

class MediaServiceTests {
    @TempDir lateinit var directory: Path
    private lateinit var jdbc: JdbcTemplate
    private lateinit var events: EventAccess
    private lateinit var storage: StorageGateway
    private lateinit var service: MediaService
    private val now = 1_800_000_000_000L
    private val properties = StorageProperties(enabled = true, endpoint = "http://127.0.0.1:9000",
        publicEndpoint = "http://127.0.0.1:9000", accessKey = "test", secretKey = "test", bucket = "test")
    private val request = PresignRequest("participant", "image.jpg", "image/jpeg", 42, gps = Gps(30.0, 120.0))

    @BeforeEach
    fun setup() {
        val datasource = DriverManagerDataSource("jdbc:sqlite:${directory.resolve("media.db")}")
        jdbc = JdbcTemplate(datasource)
        val migration = javaClass.getResource("/db/migration/V1__create_world.sql")!!.readText()
        migration.split(';').filter { it.isNotBlank() }.forEach { jdbc.execute(it) }
        jdbc.update("INSERT INTO users VALUES ('owner','name','hash',0)")
        jdbc.update("INSERT INTO events VALUES ('event','owner','Trip',0)")
        jdbc.update("INSERT INTO events VALUES ('other-event','owner','Other Trip',0)")
        jdbc.update("INSERT INTO participants VALUES ('participant','event','P','P','#123456')")
        events = mockk()
        every { events.assertOwner("event", "owner") } returns EventSummary("event", "Trip", 0)
        every { events.assertOwner("other-event", "owner") } returns EventSummary("other-event", "Other Trip", 0)
        every { events.assertParticipant("event", "participant") } just Runs
        every { events.assignIsland(any(), any()) } answers {
            assertTrue(TransactionSynchronizationManager.isActualTransactionActive())
            null
        }
        storage = mockk()
        every { storage.requireAvailable() } just Runs
        every { storage.signUpload(any(), any(), any()) } answers {
            assertFalse(TransactionSynchronizationManager.isActualTransactionActive())
            UploadSignature("https://public.example/upload", mapOf("Content-Type" to secondArg()))
        }
        every { storage.head(any()) } answers {
            assertFalse(TransactionSynchronizationManager.isActualTransactionActive())
            StoredObject(42, "image/jpeg", "\"etag\"")
        }
        every { storage.copy(any(), any(), any()) } answers {
            assertFalse(TransactionSynchronizationManager.isActualTransactionActive())
            "\"etag\""
        }
        every { storage.signDownload(any(), any()) } returns "https://public.example/download"
        service = MediaService(jdbc, TransactionTemplate(DataSourceTransactionManager(datasource)), events, storage, properties)
        service.clock = Clock.fixed(Instant.ofEpochMilli(now), ZoneOffset.UTC)
    }

    @Test
    fun `presign records pending intent with independent random keys and reserves order`() {
        val first = service.presign("event", "owner", request)
        val second = service.presign("event", "owner", request.copy(gps = null, capturedAt = null))
        assertEquals(now + 300_000, first.expiresAt)
        assertNotEquals(first.photoId, second.photoId)
        assertEquals(listOf(0, 1), jdbc.queryForList("SELECT import_order FROM photos ORDER BY import_order", Int::class.java))
        val row = jdbc.queryForMap("SELECT * FROM photos WHERE id=?", first.photoId)
        assertEquals("PENDING", row["status"])
        assertTrue(row["staging_key"].toString().startsWith("owners/owner/events/event/staging/"))
        assertTrue(row["object_key"].toString().startsWith("owners/owner/events/event/photos/"))
        assertNotEquals(row["staging_key"], row["object_key"])
    }

    @Test
    fun `invalid type extension size and finite GPS are rejected before signing`() {
        listOf(request.copy(contentType = "image/gif"), request.copy(filename = "picture.png"),
            request.copy(filename = "../picture.jpg"), request.copy(sizeBytes = 0),
            request.copy(sizeBytes = 20L * 1024 * 1024 + 1), request.copy(gps = Gps(Double.NaN, 0.0)),
            request.copy(gps = Gps(0.0, Double.POSITIVE_INFINITY)), request.copy(capturedAt = -1)).forEach {
            assertStatus(HttpStatus.BAD_REQUEST) { service.presign("event", "owner", it) }
        }
        verify(exactly = 0) { storage.signUpload(any(), any(), any()) }
    }

    @Test
    fun `non owner or wrong participant gets no signed URL`() {
        every { events.assertOwner("event", "intruder") } throws ApiException(HttpStatus.NOT_FOUND, "Event not found")
        every { events.assertParticipant("event", "foreign-person") } throws ApiException(HttpStatus.NOT_FOUND, "Participant not found")
        assertStatus(HttpStatus.NOT_FOUND) { service.presign("event", "intruder", request) }
        assertStatus(HttpStatus.NOT_FOUND) { service.presign("event", "owner", request.copy(photographerId = "foreign-person")) }
        verify(exactly = 0) { storage.signUpload(any(), any(), any()) }
    }

    @Test
    fun `confirm verifies source and final before READY and is idempotent when offline`() {
        val id = service.presign("event", "owner", request).photoId
        val photo = service.confirm("event", "owner", id)
        assertEquals(42L, jdbc.queryForObject("SELECT verified_bytes FROM photos WHERE id=?", Long::class.java, id))
        assertEquals("READY", jdbc.queryForObject("SELECT status FROM photos WHERE id=?", String::class.java, id))
        every { storage.requireAvailable() } throws ApiException(HttpStatus.SERVICE_UNAVAILABLE, "Offline")
        assertEquals(photo, service.confirm("event", "owner", id))
        verify(exactly = 2) { storage.head(any()) }
        verify(exactly = 1) { storage.copy(any(), any(), "\"etag\"") }
        verify(exactly = 1) { events.assignIsland("event", request.gps) }
    }

    @Test
    fun `failed final HEAD leaves pending and retry assigns island once`() {
        val id = service.presign("event", "owner", request).photoId
        every { storage.head(match { it.contains("/photos/") }) } returns StoredObject(41, "image/jpeg", "\"etag\"")
        assertStatus(HttpStatus.BAD_REQUEST) { service.confirm("event", "owner", id) }
        assertEquals("PENDING", jdbc.queryForObject("SELECT status FROM photos WHERE id=?", String::class.java, id))
        verify(exactly = 0) { events.assignIsland(any(), any()) }
        every { storage.head(match { it.contains("/photos/") }) } returns StoredObject(42, "image/jpeg", "\"etag\"")
        service.confirm("event", "owner", id)
        verify(exactly = 1) { events.assignIsland(any(), any()) }
    }

    @Test
    fun `source mismatch does not copy and missing source remains pending`() {
        val id = service.presign("event", "owner", request).photoId
        every { storage.head(any()) } returns StoredObject(42, "image/png", "\"etag\"")
        assertStatus(HttpStatus.BAD_REQUEST) { service.confirm("event", "owner", id) }
        every { storage.head(any()) } throws ApiException(HttpStatus.NOT_FOUND, "Missing")
        assertStatus(HttpStatus.NOT_FOUND) { service.confirm("event", "owner", id) }
        verify(exactly = 0) { storage.copy(any(), any(), any()) }
    }

    @Test
    fun `final ETag mismatch and copy failure do not publish photo`() {
        val id = service.presign("event", "owner", request).photoId
        every { storage.head(match { it.contains("/photos/") }) } returns StoredObject(42, "image/jpeg", "\"changed\"")
        assertStatus(HttpStatus.SERVICE_UNAVAILABLE) { service.confirm("event", "owner", id) }
        every { storage.copy(any(), any(), any()) } throws ApiException(HttpStatus.SERVICE_UNAVAILABLE, "Offline")
        assertStatus(HttpStatus.SERVICE_UNAVAILABLE) { service.confirm("event", "owner", id) }
        verify(exactly = 0) { events.assignIsland(any(), any()) }
        assertStatus(HttpStatus.NOT_FOUND) { service.download("event", "owner", DownloadRequest(listOf(id))) }
    }

    @Test
    fun `expired pending and cross event photo do not touch storage`() {
        val id = service.presign("event", "owner", request).photoId
        service.clock = Clock.fixed(Instant.ofEpochMilli(now + 300_000), ZoneOffset.UTC)
        assertStatus(HttpStatus.GONE) { service.confirm("event", "owner", id) }
        assertStatus(HttpStatus.NOT_FOUND) { service.confirm("other-event", "owner", id) }
        verify(exactly = 0) { storage.head(any()) }
    }

    @Test
    fun `download validates full group before signing any URL`() {
        val ready = service.presign("event", "owner", request).photoId
        service.confirm("event", "owner", ready)
        val pending = service.presign("event", "owner", request).photoId
        assertStatus(HttpStatus.NOT_FOUND) { service.download("event", "owner", DownloadRequest(listOf(ready, pending))) }
        assertStatus(HttpStatus.NOT_FOUND) { service.download("other-event", "owner", DownloadRequest(listOf(ready))) }
        assertStatus(HttpStatus.BAD_REQUEST) { service.download("event", "owner", DownloadRequest(emptyList())) }
        verify(exactly = 0) { storage.signDownload(any(), any()) }
        val response = service.download("event", "owner", DownloadRequest(listOf(ready)))
        assertEquals(now + 900_000, response.urls.single().expiresAt)
        verify(exactly = 1) { storage.signDownload(match { it.contains("/photos/") }, properties.downloadTtl) }
    }

    @Test
    fun `concurrent confirms serialize remote copy and island assignment`() {
        val id = service.presign("event", "owner", request).photoId
        val entered = CountDownLatch(1)
        val release = CountDownLatch(1)
        every { storage.copy(any(), any(), any()) } answers {
            entered.countDown()
            assertTrue(release.await(5, TimeUnit.SECONDS))
            "\"etag\""
        }
        val pool = Executors.newFixedThreadPool(2)
        try {
            val first = pool.submit<PhotoDto> { service.confirm("event", "owner", id) }
            assertTrue(entered.await(5, TimeUnit.SECONDS))
            val second = pool.submit<PhotoDto> { service.confirm("event", "owner", id) }
            release.countDown()
            assertEquals(first.get(5, TimeUnit.SECONDS), second.get(5, TimeUnit.SECONDS))
            verify(exactly = 1) { storage.copy(any(), any(), any()) }
            verify(exactly = 1) { events.assignIsland(any(), any()) }
        } finally {
            release.countDown()
            pool.shutdownNow()
        }
    }

    private fun assertStatus(status: HttpStatus, action: () -> Any?) {
        assertEquals(status, assertFailsWith<ApiException> { action() }.status)
    }
}
