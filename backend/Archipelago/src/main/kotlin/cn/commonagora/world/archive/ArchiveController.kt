package cn.commonagora.world.archive

import cn.commonagora.world.memory.*
import cn.commonagora.world.shared.userId
import jakarta.validation.Valid
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Size
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.web.bind.annotation.*

/** Metadata only. Image bodies travel directly between the browser and RustFS. */
@RestController
@RequestMapping("/api/v1/events")
class ArchiveController(private val memories: MemoryService) {
    @GetMapping("/{eventId}/archive")
    fun export(@PathVariable eventId: String, @AuthenticationPrincipal jwt: Jwt): MemoryData =
        memories.archive(eventId, jwt.userId())

    @PostMapping("/import")
    fun import(@AuthenticationPrincipal jwt: Jwt, @Valid @RequestBody request: ImportArchiveRequest): ImportArchiveResponse =
        memories.importArchive(jwt.userId(), request)

    @PostMapping("/from-demo")
    fun copyDemo(@AuthenticationPrincipal jwt: Jwt, @Valid @RequestBody request: CopyDemoRequest): CopyDemoResponse =
        memories.copyDemo(jwt.userId(), request.requestId, request.demoEventId)
}

data class CopyDemoRequest(
    @field:NotBlank @field:Size(max = 100) val requestId: String,
    @field:NotBlank @field:Size(max = 100) val demoEventId: String,
)
