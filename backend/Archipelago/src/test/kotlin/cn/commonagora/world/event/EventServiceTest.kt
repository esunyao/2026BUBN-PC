package cn.commonagora.world.event

import cn.commonagora.world.shared.*
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.io.TempDir
import org.springframework.dao.DataAccessException
import org.sqlite.SQLiteException
import org.springframework.http.HttpStatus
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.jdbc.datasource.DriverManagerDataSource
import org.springframework.jdbc.datasource.DataSourceTransactionManager
import org.springframework.transaction.support.TransactionTemplate
import java.nio.file.Path
import kotlin.test.*

class EventServiceTest {
    @TempDir lateinit var directory: Path
    private lateinit var jdbc: JdbcTemplate
    private lateinit var service: EventService
    private lateinit var transaction: TransactionTemplate
    private lateinit var url: String
    @BeforeEach
    fun setup() {
        url = "jdbc:sqlite:${directory.resolve("world.sqlite")}?foreign_keys=on"
        val dataSource = DriverManagerDataSource(url)
        jdbc = JdbcTemplate(dataSource)
        val sql = javaClass.getResource("/db/migration/V1__create_world.sql")!!.readText()
        sql.split(';').filter { it.isNotBlank() }.forEach { jdbc.execute(it) }
        jdbc.update("INSERT INTO users VALUES('owner','owner','hash',0),('other','other','hash',0)")
        service = EventService(EventRepository(jdbc))
        transaction = TransactionTemplate(DataSourceTransactionManager(dataSource))
    }
    private fun event(owner: String = "owner") = service.create(owner, CreateEventRequest("Trip"))
    private fun offset(meters: Double) = Gps(Math.toDegrees(meters / 6_371_000.0), 0.0)
    private fun assign(eventId: String, gps: Gps?) = transaction.execute { service.assignIsland(eventId, gps) }
    private fun error(status: HttpStatus, action: () -> Unit) {
        assertEquals(status, assertFailsWith<ApiException>(block = action).status)
    }
    private fun constraintFailure(action: () -> Unit) {
        val failure = assertFailsWith<DataAccessException>(block = action)
        val sqlite = generateSequence<Throwable>(failure) { it.cause }.filterIsInstance<SQLiteException>().first()
        assertEquals(19, sqlite.resultCode.code and 255, "SQLite must reject the constraint")
    }
    private fun photo(eventId: String, photographer: String, id: String, order: Int, ready: Boolean = true, gps: Gps? = null) {
        jdbc.update("""INSERT INTO photos(id,event_id,photographer_id,filename,caption,content_type,declared_bytes,verified_bytes,
            staging_key,object_key,upload_expires_at,status,latitude,longitude,import_order,created_at)
            VALUES(?,?,?,'image.jpg','','image/jpeg',1,1,?,?,9999999999999,?,?,?,?,0)""",
            id, eventId, photographer, "staging/$id", "objects/$id", if (ready) "READY" else "PENDING", gps?.latitude, gps?.longitude, order)
    }
    @Test
    fun `ownership hides event snapshot participants and placement`() {
        val e = event()
        val p = service.addParticipant(e.id, "owner", CreateParticipantRequest("小明", "#123456"))
        assertEquals("小明", p.initials)
        assertEquals(listOf(e), service.list("owner"))
        assertTrue(service.list("other").isEmpty())
        error(HttpStatus.NOT_FOUND) { service.snapshot(e.id, "other") }
        error(HttpStatus.NOT_FOUND) { service.snapshot("missing", "owner") }
        error(HttpStatus.NOT_FOUND) { service.addParticipant(e.id, "other", CreateParticipantRequest("Guest")) }
        error(HttpStatus.NOT_FOUND) { service.assertParticipant(event("other").id, p.id) }
        error(HttpStatus.NOT_FOUND) { service.placePhoto(e.id, "photo", "other", PlacementRequest(newPlaceName = "Place")) }
    }
    @Test
    fun `fixed anchors group 299 meters but not 301 and never drift`() {
        val e = event()
        val first = assign(e.id, offset(0.0))!!
        assertEquals(first.id, assign(e.id, offset(299.0))!!.id)
        assertNotEquals(first.id, assign(e.id, offset(301.0))!!.id)
        assertEquals(offset(0.0), service.snapshot(e.id, "owner").islands.first().gpsAnchor)
        assertNull(assign(e.id, null))
        error(HttpStatus.BAD_REQUEST) { assign(e.id, Gps(Double.NaN, 0.0)) }
        error(HttpStatus.BAD_REQUEST) { assign(e.id, Gps(0.0, Double.POSITIVE_INFINITY)) }
        error(HttpStatus.BAD_REQUEST) { assign(e.id, Gps(91.0, 0.0)) }
    }
    @Test
    fun `closest anchor wins and equal distances prefer oldest slot`() {
        val e = event()
        val a = assign(e.id, offset(0.0))!!
        val b = assign(e.id, offset(500.0))!!
        assertEquals(b.id, assign(e.id, offset(280.0))!!.id)
        // Identical explicit anchors are legal; ordered slots resolve exact ties.
        jdbc.update("UPDATE places SET latitude=0,longitude=0 WHERE id=?", b.id)
        assertEquals(a.id, assign(e.id, offset(10.0))!!.id)
    }
    @Test
    fun `fiftieth island preserves original positions and persists after reopen`() {
        val e = event()
        val first = assign(e.id, Gps(0.0, 0.0))!!
        repeat(49) { assign(e.id, Gps(0.0, (it + 1).toDouble())) }
        val snapshot = service.snapshot(e.id, "owner")
        assertEquals(50, snapshot.islands.size)
        assertEquals(first, snapshot.islands.first())
        assertEquals(Point(550.0, 3060.0), snapshot.islands.last().position)
        assertEquals(9, snapshot.islands.last().appearance)
        val reopened = EventService(EventRepository(JdbcTemplate(DriverManagerDataSource(url))))
        assertEquals(snapshot, reopened.snapshot(e.id, "owner"))
    }
    @Test
    fun `placement requires one target and snapshots preserve nullable metadata and READY ordering`() {
        val e = event()
        val p = service.addParticipant(e.id, "owner", CreateParticipantRequest("P"))
        photo(e.id, p.id, "later", 2, gps = Gps(1.0, 2.0))
        photo(e.id, p.id, "earlier", 0)
        photo(e.id, p.id, "pending", 1, ready = false)
        val snapshot = service.snapshot(e.id, "owner")
        assertEquals(listOf("earlier", "later"), snapshot.photos.map { it.id })
        assertNull(snapshot.photos.first().gps)
        assertNull(snapshot.photos.first().capturedAt)
        val placed = transaction.execute { service.placePhoto(e.id, "later", "owner", PlacementRequest(newPlaceName = "Beach")) }!!
        assertEquals(Gps(1.0, 2.0), service.snapshot(e.id, "owner").islands.single().gpsAnchor)
        assertEquals(placed.islandId, service.placePhoto(e.id, "earlier", "owner", PlacementRequest(islandId = placed.islandId)).islandId)
        error(HttpStatus.BAD_REQUEST) { service.placePhoto(e.id, "later", "owner", PlacementRequest()) }
        error(HttpStatus.BAD_REQUEST) { service.placePhoto(e.id, "later", "owner", PlacementRequest(placed.islandId, "Both")) }
        error(HttpStatus.BAD_REQUEST) { service.placePhoto(e.id, "later", "owner", PlacementRequest(newPlaceName = "  ")) }
        error(HttpStatus.NOT_FOUND) { service.placePhoto(e.id, "pending", "owner", PlacementRequest(islandId = placed.islandId)) }
        val otherIsland = assign(event("other").id, Gps(0.0, 0.0))!!
        error(HttpStatus.NOT_FOUND) { service.placePhoto(e.id, "later", "owner", PlacementRequest(islandId = otherIsland.id)) }
        constraintFailure {
            jdbc.update("UPDATE photos SET island_id=? WHERE id='later'", otherIsland.id)
        }
        val otherParticipant = service.addParticipant(event("other").id, "other", CreateParticipantRequest("Other"))
        constraintFailure {
            jdbc.update("UPDATE photos SET photographer_id=? WHERE id='later'", otherParticipant.id)
        }
        constraintFailure {
            jdbc.update("UPDATE photos SET longitude=NULL WHERE id='later'")
        }
        constraintFailure {
            jdbc.update("UPDATE places SET latitude=NULL WHERE id=?", placed.islandId)
        }
        constraintFailure {
            jdbc.update("UPDATE photos SET verified_bytes=NULL WHERE id='later'")
        }
    }
    @Test
    fun `allocation rolls back with caller transaction`() {
        val e = event()
        assertFailsWith<IllegalStateException> {
            transaction.execute { service.assignIsland(e.id, Gps(0.0, 0.0)); error("rollback") }
        }
        assertTrue(service.snapshot(e.id, "owner").islands.isEmpty())
    }
}
