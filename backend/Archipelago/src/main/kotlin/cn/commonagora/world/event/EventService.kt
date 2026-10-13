package cn.commonagora.world.event

import cn.commonagora.world.shared.*
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.util.UUID
import kotlin.math.*

@Service
@Transactional
class EventService(private val repository: EventRepository) : EventAccess {
    @Transactional(readOnly = true)
    fun list(userId: String): List<EventSummary> = repository.list(userId)
    fun create(userId: String, request: CreateEventRequest): EventSummary {
        val event = EventSummary(id(), validName(request.name, 100), System.currentTimeMillis())
        repository.insert(event, userId)
        return event
    }
    @Transactional(readOnly = true)
    override fun assertOwner(eventId: String, userId: String): EventSummary = repository.owned(eventId, userId) ?: missing()
    @Transactional(readOnly = true)
    override fun assertParticipant(eventId: String, participantId: String) {
        if (!repository.hasParticipant(eventId, participantId)) missing()
    }
    @Transactional(readOnly = true)
    fun snapshot(eventId: String, userId: String): EventSnapshot = EventSnapshot(
        assertOwner(eventId, userId), repository.participants(eventId), repository.islands(eventId), repository.readyPhotos(eventId))
    fun addParticipant(eventId: String, userId: String, request: CreateParticipantRequest): ParticipantDto {
        assertOwner(eventId, userId)
        val name = validName(request.name, 60)
        if (!Regex("#[0-9a-fA-F]{6}").matches(request.color)) bad("Invalid participant color")
        val initials = name.codePoints().limit(2).toArray().let { String(it, 0, it.size) }
        val participant = ParticipantDto(id(), name, initials, request.color)
        repository.insertParticipant(eventId, participant)
        return participant
    }
    // REQUIRED joins the media confirmation transaction; fixed anchors never move.
    override fun assignIsland(eventId: String, gps: Gps?): IslandDto? {
        gps ?: return null
        validateGps(gps)
        val closest = repository.islands(eventId).mapNotNull { island ->
            island.gpsAnchor?.let { anchor -> island to distance(anchor, gps) }
        }.filter { it.second <= 300.0 }.minByOrNull { it.second }
        return closest?.first ?: newIsland(eventId, "地点 ${repository.nextSlot(eventId) + 1}", gps)
    }
    fun placePhoto(eventId: String, photoId: String, userId: String, request: PlacementRequest): PhotoDto {
        assertOwner(eventId, userId)
        if ((request.islandId == null) == (request.newPlaceName == null)) bad("Provide exactly one islandId or newPlaceName")
        val photo = repository.readyPhoto(eventId, photoId) ?: missing()
        val island = request.islandId?.let { islandId -> repository.islands(eventId).firstOrNull { it.id == islandId } ?: missing() }
            ?: newIsland(eventId, validName(request.newPlaceName!!, 100), photo.gps)
        repository.placePhoto(eventId, photoId, island.id)
        return photo.copy(islandId = island.id)
    }
    private fun newIsland(eventId: String, name: String, gps: Gps?): IslandDto {
        gps?.let(::validateGps)
        val slot = repository.nextSlot(eventId)
        val island = IslandDto(id(), name, slot % 10, EventRepository.position(slot), gps)
        repository.insertIsland(eventId, island, slot)
        return island
    }
    private fun validName(value: String, max: Int): String = value.trim().also {
        if (it.isEmpty() || it.length > max) bad("Name must contain 1–$max characters")
    }
    private fun validateGps(gps: Gps) {
        if (!gps.latitude.isFinite() || !gps.longitude.isFinite() || gps.latitude !in -90.0..90.0 || gps.longitude !in -180.0..180.0) bad("Invalid GPS coordinates")
    }
    private fun id() = UUID.randomUUID().toString()
    private fun missing(): Nothing = throw ApiException(HttpStatus.NOT_FOUND, "Resource not found")
    private fun bad(message: String): Nothing = throw ApiException(HttpStatus.BAD_REQUEST, message)
    private fun distance(a: Gps, b: Gps): Double {
        val lat1 = Math.toRadians(a.latitude)
        val lat2 = Math.toRadians(b.latitude)
        val dLat = lat2 - lat1
        val dLon = Math.toRadians(b.longitude - a.longitude)
        val h = sin(dLat / 2).pow(2) + cos(lat1) * cos(lat2) * sin(dLon / 2).pow(2)
        return 6_371_000.0 * 2 * asin(sqrt(h.coerceIn(0.0, 1.0)))
    }
}
