package cn.commonagora.world.event

import cn.commonagora.world.shared.*
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.jdbc.core.RowMapper
import org.springframework.stereotype.Repository
import java.sql.ResultSet

@Repository
class EventRepository(private val jdbc: JdbcTemplate) {
    fun list(ownerId: String): List<EventSummary> = jdbc.query(
        "SELECT id,name,created_at FROM events WHERE owner_id=? ORDER BY created_at,id", eventMapper, ownerId)
    fun owned(eventId: String, ownerId: String): EventSummary? = jdbc.query(
        "SELECT id,name,created_at FROM events WHERE id=? AND owner_id=?", eventMapper, eventId, ownerId).firstOrNull()
    fun insert(event: EventSummary, ownerId: String) {
        jdbc.update("INSERT INTO events(id,owner_id,name,created_at) VALUES(?,?,?,?)", event.id, ownerId, event.name, event.createdAt)
    }
    fun participants(eventId: String): List<ParticipantDto> = jdbc.query(
        "SELECT id,name,initials,color FROM participants WHERE event_id=? ORDER BY rowid", participantMapper, eventId)
    fun hasParticipant(eventId: String, participantId: String): Boolean = jdbc.queryForObject(
        "SELECT COUNT(*) FROM participants WHERE event_id=? AND id=?", Int::class.java, eventId, participantId) == 1
    fun insertParticipant(eventId: String, participant: ParticipantDto) {
        jdbc.update("INSERT INTO participants(id,event_id,name,initials,color) VALUES(?,?,?,?,?)",
            participant.id, eventId, participant.name, participant.initials, participant.color)
    }
    fun islands(eventId: String): List<IslandDto> = jdbc.query(
        "SELECT id,name,slot,latitude,longitude FROM places WHERE event_id=? ORDER BY slot", islandMapper, eventId)
    fun nextSlot(eventId: String): Int = jdbc.queryForObject(
        "SELECT COALESCE(MAX(slot),-1)+1 FROM places WHERE event_id=?", Int::class.java, eventId)!!
    fun insertIsland(eventId: String, island: IslandDto, slot: Int) {
        jdbc.update("INSERT INTO places(id,event_id,name,slot,latitude,longitude) VALUES(?,?,?,?,?,?)",
            island.id, eventId, island.name, slot, island.gpsAnchor?.latitude, island.gpsAnchor?.longitude)
    }
    fun readyPhotos(eventId: String): List<PhotoDto> = jdbc.query(
        "SELECT * FROM photos WHERE event_id=? AND status='READY' ORDER BY import_order", PhotoRows.mapper, eventId)
    fun readyPhoto(eventId: String, photoId: String): PhotoDto? = jdbc.query(
        "SELECT * FROM photos WHERE event_id=? AND id=? AND status='READY'", PhotoRows.mapper, eventId, photoId).firstOrNull()
    fun placePhoto(eventId: String, photoId: String, islandId: String) {
        jdbc.update("UPDATE photos SET island_id=? WHERE event_id=? AND id=? AND status='READY'", islandId, eventId, photoId)
    }

    companion object {
        private val eventMapper = RowMapper { rs: ResultSet, _: Int -> EventSummary(rs.getString("id"), rs.getString("name"), rs.getLong("created_at")) }
        private val participantMapper = RowMapper { rs: ResultSet, _: Int ->
            ParticipantDto(rs.getString("id"), rs.getString("name"), rs.getString("initials"), rs.getString("color")) }
        private val islandMapper = RowMapper { rs: ResultSet, _: Int ->
            val slot = rs.getInt("slot")
            val gps = rs.getObject("latitude")?.let { Gps((it as Number).toDouble(), (rs.getObject("longitude") as Number).toDouble()) }
            IslandDto(rs.getString("id"), rs.getString("name"), slot % 10, position(slot), gps) }
        fun position(slot: Int): Point {
            val row = slot / 4
            val col = slot % 4
            return Point(230.0 + col * 320 + (row % 2) * 54, 180.0 + row * 240)
        }
    }
}
