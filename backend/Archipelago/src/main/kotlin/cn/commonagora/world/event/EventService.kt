package cn.commonagora.world.event

import cn.commonagora.world.shared.*
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.jdbc.core.JdbcTemplate
import cn.commonagora.world.memory.Moment
import cn.commonagora.world.memory.Scene
import tools.jackson.databind.ObjectMapper
import java.time.Instant
import java.util.UUID
import kotlin.math.*

@Service
@Transactional
class EventService(private val repository: EventRepository, private val jdbc: JdbcTemplate? = null, private val mapper: ObjectMapper? = null) : EventAccess {
    @Transactional(readOnly = true)
    fun list(userId: String): List<EventSummary> = repository.list(userId)
    fun create(userId: String, request: CreateEventRequest): EventSummary {
        if (request.type !in listOf("trip","longActivity")) bad("Invalid event type")
        val event = EventSummary(id(), validName(request.title ?: request.name ?: "", 100), System.currentTimeMillis())
        repository.insert(event, userId)
        if (jdbc != null && mapper != null) {
            val ownerName=jdbc.queryForObject("SELECT username FROM users WHERE id=?",String::class.java,userId) ?: "owner"
            val participantId=id();val sceneId=id();val momentId=id()
            jdbc.update("UPDATE events SET subtitle=?,event_type=? WHERE id=?","从这里开始，留下共同的记忆。",request.type,event.id)
            jdbc.update("INSERT INTO participants(id,event_id,name,initials,color,user_id) VALUES(?,?,?,?,?,?)",participantId,event.id,ownerName,ownerName.take(2),"#c77455",userId)
            jdbc.update("INSERT INTO event_members(event_id,user_id,participant_id,role) VALUES(?,?,?,'owner')",event.id,userId,participantId)
            jdbc.update("INSERT INTO memory_scenes(id,event_id,content) VALUES(?,?,?)",sceneId,event.id,mapper.writeValueAsString(Scene(sceneId,event.id,"第一章","添加属于你们的第一段回忆。",environment=mapOf("preset" to "neutral"))))
            jdbc.update("INSERT INTO memory_moments(id,event_id,scene_id,content) VALUES(?,?,?,?)",momentId,event.id,sceneId,mapper.writeValueAsString(Moment(momentId,sceneId,"最初的时刻",Instant.now().toString(),"今日","morning")))
        }
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
