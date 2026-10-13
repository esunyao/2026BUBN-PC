package cn.commonagora.world.event

import cn.commonagora.world.shared.*
import jakarta.validation.Valid
import org.springframework.http.HttpStatus
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/api/v1/events")
class EventController(private val service: EventService, private val memories: cn.commonagora.world.memory.MemoryService) {
    @GetMapping
    fun list(@AuthenticationPrincipal jwt: Jwt) = memories.listEvents(jwt.userId())
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    fun create(@AuthenticationPrincipal jwt: Jwt, @Valid @RequestBody request: CreateEventRequest) = service.create(jwt.userId(), request)
    @GetMapping("/{eventId}")
    fun snapshot(@PathVariable eventId: String, @AuthenticationPrincipal jwt: Jwt) = service.snapshot(eventId, jwt.userId())
    @PostMapping("/{eventId}/participants")
    @ResponseStatus(HttpStatus.CREATED)
    fun addParticipant(@PathVariable eventId: String, @AuthenticationPrincipal jwt: Jwt,
                       @Valid @RequestBody request: CreateParticipantRequest) = service.addParticipant(eventId, jwt.userId(), request)
    @PatchMapping("/{eventId}/photos/{photoId}/placement")
    fun placePhoto(@PathVariable eventId: String, @PathVariable photoId: String, @AuthenticationPrincipal jwt: Jwt,
                   @Valid @RequestBody request: PlacementRequest) = service.placePhoto(eventId, photoId, jwt.userId(), request)
}
