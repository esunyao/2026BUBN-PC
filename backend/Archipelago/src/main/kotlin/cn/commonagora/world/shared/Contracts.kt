package cn.commonagora.world.shared

import jakarta.validation.Valid
import jakarta.validation.constraints.*

data class Gps(@field:DecimalMin("-90") @field:DecimalMax("90") val latitude: Double,
               @field:DecimalMin("-180") @field:DecimalMax("180") val longitude: Double)
data class Point(val x: Double, val y: Double)
data class EventSummary(val id: String, val name: String, val createdAt: Long)
data class ParticipantDto(val id: String, val name: String, val initials: String, val color: String)
data class IslandDto(val id: String, val name: String, val appearance: Int, val position: Point, val gpsAnchor: Gps?)
data class PhotoDto(val id: String, val filename: String, val caption: String, val photographerId: String,
                    val islandId: String?, val gps: Gps?, val capturedAt: Long?, val importOrder: Int,
                    val source: String = "import")
data class EventSnapshot(val event: EventSummary, val participants: List<ParticipantDto>,
                         val islands: List<IslandDto>, val photos: List<PhotoDto>)
data class CreateEventRequest(val name: String? = null, val title: String? = null, val type: String = "trip")
data class CreateParticipantRequest(@field:NotBlank @field:Size(max = 60) val name: String,
                                    @field:Pattern(regexp = "#[0-9a-fA-F]{6}") val color: String = "#c77455")
data class PlacementRequest(val islandId: String? = null, @field:Size(max = 100) val newPlaceName: String? = null)
data class PresignRequest(@field:NotBlank val photographerId: String,
                          @field:NotBlank @field:Size(max = 255) val filename: String,
                          @field:NotBlank val contentType: String,
                          @field:Positive val sizeBytes: Long,
                          @field:Size(max = 500) val caption: String = "",
                          @field:Valid val gps: Gps? = null, @field:PositiveOrZero val capturedAt: Long? = null)
data class PresignResponse(val photoId: String, val uploadUrl: String, val headers: Map<String, String>, val expiresAt: Long)
data class DownloadRequest(@field:Size(min = 1, max = 100) val photoIds: List<String>)
data class DownloadUrl(val photoId: String, val url: String, val expiresAt: Long)
data class DownloadResponse(val urls: List<DownloadUrl>)

/** Implemented by event; media uses this boundary without accessing another owner's event. */
interface EventAccess {
    fun assertOwner(eventId: String, userId: String): EventSummary
    fun assertParticipant(eventId: String, participantId: String)
    /** Caller supplies the transaction; allocates a stable slot only when no fixed anchor matches. */
    fun assignIsland(eventId: String, gps: Gps?): IslandDto?
}
