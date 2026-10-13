package cn.commonagora.world.media

import cn.commonagora.world.config.StorageProperties
import cn.commonagora.world.shared.*
import org.springframework.http.HttpStatus
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.stereotype.Service
import org.springframework.transaction.support.TransactionTemplate
import java.time.Clock
import java.util.UUID
import java.util.concurrent.locks.ReentrantLock
import kotlin.concurrent.withLock

@Service
class MediaService(private val jdbc: JdbcTemplate, private val transaction: TransactionTemplate,
                   private val events: EventAccess, private val storage: StorageGateway,
                   private val properties: StorageProperties) {
    // Bounded lock stripes serialize confirmation of a photo without a growing lock registry.
    // The SQLite service is deployed as a single writer instance; replicas need a durable claim.
    private val confirmationLocks = Array(256) { ReentrantLock() }
    internal var clock: Clock = Clock.systemUTC()

    fun presign(eventId: String, userId: String, request: PresignRequest): PresignResponse {
        events.assertOwner(eventId, userId)
        events.assertParticipant(eventId, request.photographerId)
        validate(request)
        storage.requireAvailable()
        val id = UUID.randomUUID().toString()
        val prefix = "owners/$userId/events/$eventId"
        val stagingKey = "$prefix/staging/${UUID.randomUUID()}"
        val finalKey = "$prefix/photos/${UUID.randomUUID()}"
        val now = clock.millis()
        val expires = now + properties.uploadTtl.toMillis()
        val signed = storage.signUpload(stagingKey, request.contentType, properties.uploadTtl)
        transaction.executeWithoutResult {
            // Ownership and membership are rechecked after signing before inserting the intent.
            events.assertOwner(eventId, userId)
            events.assertParticipant(eventId, request.photographerId)
            val order = jdbc.queryForObject("SELECT COALESCE(MAX(import_order), -1) + 1 FROM photos WHERE event_id = ?",
                Int::class.java, eventId)!!
            jdbc.update("""INSERT INTO photos (id,event_id,photographer_id,filename,caption,content_type,
                declared_bytes,staging_key,object_key,upload_expires_at,status,latitude,longitude,captured_at,import_order,created_at)
                VALUES (?,?,?,?,?,?,?,?,?,?,'PENDING',?,?,?,?,?)""",
                id, eventId, request.photographerId, request.filename, request.caption, request.contentType,
                request.sizeBytes, stagingKey, finalKey, expires, request.gps?.latitude, request.gps?.longitude,
                request.capturedAt, order, now)
        }
        return PresignResponse(id, signed.url, signed.headers, expires)
    }

    fun confirm(eventId: String, userId: String, photoId: String): PhotoDto {
        events.assertOwner(eventId, userId)
        return confirmationLocks[(photoId.hashCode() and Int.MAX_VALUE) % confirmationLocks.size].withLock {
            val pending = photo(eventId, photoId)
            if (pending.status == "READY") return@withLock pending.dto
            if (clock.millis() >= pending.expiresAt) throw ApiException(HttpStatus.GONE, "Upload intent expired")
            storage.requireAvailable()
            val staged = storage.head(pending.stagingKey)
            validateObject(pending, staged)
            val sourceEtag = staged.etag?.takeIf { it.isNotBlank() }
                ?: throw ApiException(HttpStatus.SERVICE_UNAVAILABLE, "Photo storage is unavailable")
            val copiedEtag = storage.copy(pending.stagingKey, pending.objectKey, sourceEtag)
                ?.takeIf { it.isNotBlank() }
                ?: throw ApiException(HttpStatus.SERVICE_UNAVAILABLE, "Photo storage is unavailable")
            val finalized = storage.head(pending.objectKey)
            validateObject(pending, finalized)
            if (finalized.etag != copiedEtag) throw ApiException(HttpStatus.SERVICE_UNAVAILABLE, "Photo storage is unavailable")
            transaction.execute {
                events.assertOwner(eventId, userId)
                val current = photo(eventId, photoId)
                if (current.status == "READY") return@execute current.dto
                if (clock.millis() >= current.expiresAt) throw ApiException(HttpStatus.GONE, "Upload intent expired")
                val island = events.assignIsland(eventId, current.dto.gps)
                jdbc.update("UPDATE photos SET status='READY', verified_bytes=?, island_id=? WHERE id=? AND event_id=? AND status='PENDING'",
                    finalized.size, island?.id, photoId, eventId)
                photo(eventId, photoId).dto
            }!!
        }
    }

    fun download(eventId: String, userId: String, request: DownloadRequest): DownloadResponse {
        events.assertOwner(eventId, userId)
        if (request.photoIds.size !in 1..100) invalid("Request 1 to 100 photos")
        // Validate the whole request before signing any URL, including duplicates and foreign IDs.
        val photos = request.photoIds.map { id ->
            val found = photo(eventId, id)
            if (found.status != "READY") throw ApiException(HttpStatus.NOT_FOUND, "Photo was not found")
            found
        }
        storage.requireAvailable()
        val expires = clock.millis() + properties.downloadTtl.toMillis()
        return DownloadResponse(photos.map { DownloadUrl(it.dto.id, storage.signDownload(it.objectKey, properties.downloadTtl), expires) })
    }

    private fun validate(request: PresignRequest) {
        val extensions = when (request.contentType) {
            "image/jpeg" -> setOf("jpg", "jpeg")
            "image/png" -> setOf("png")
            "image/webp" -> setOf("webp")
            else -> invalid("Only JPEG, PNG and WebP photos are supported")
        }
        if (request.filename.isBlank() || request.filename.length > 255 ||
            request.filename.any { it == '/' || it == '\\' || it.isISOControl() } ||
            request.filename.substringAfterLast('.', "").lowercase() !in extensions) invalid("Filename must match the image type")
        if (request.sizeBytes <= 0 || request.sizeBytes > properties.maxFileBytes) invalid("Photo exceeds the allowed size")
        if (request.caption.length > 500 || request.capturedAt?.let { it < 0 } == true) invalid("Invalid photo metadata")
        request.gps?.let {
            if (!it.latitude.isFinite() || !it.longitude.isFinite() || it.latitude !in -90.0..90.0 ||
                it.longitude !in -180.0..180.0) invalid("Invalid GPS coordinates")
        }
    }

    private fun validateObject(pending: PhotoRecord, stored: StoredObject) {
        if (stored.size <= 0 || stored.size > properties.maxFileBytes || stored.size != pending.declaredBytes ||
            stored.contentType != pending.contentType) invalid("Uploaded photo does not match its declared type and size")
    }

    private fun photo(eventId: String, photoId: String): PhotoRecord = jdbc.query(
        "SELECT * FROM photos WHERE event_id=? AND id=?",
        { rs, index -> PhotoRecord(PhotoRows.mapper.mapRow(rs, index)!!, rs.getString("status"),
            rs.getString("content_type"), rs.getLong("declared_bytes"), rs.getString("staging_key"),
            rs.getString("object_key"), rs.getLong("upload_expires_at")) }, eventId, photoId
    ).singleOrNull() ?: throw ApiException(HttpStatus.NOT_FOUND, "Photo was not found")

    private fun invalid(message: String): Nothing = throw ApiException(HttpStatus.BAD_REQUEST, message)
    private data class PhotoRecord(val dto: PhotoDto, val status: String, val contentType: String,
                                   val declaredBytes: Long, val stagingKey: String, val objectKey: String, val expiresAt: Long)
}
