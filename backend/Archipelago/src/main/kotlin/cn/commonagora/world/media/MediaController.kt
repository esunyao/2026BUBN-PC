package cn.commonagora.world.media

import cn.commonagora.world.shared.*
import jakarta.validation.Valid
import org.springframework.http.HttpStatus
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/api/v1/events/{eventId}/photos")
class MediaController(private val media: MediaService) {
    @PostMapping("/presign")
    @ResponseStatus(HttpStatus.CREATED)
    fun presign(@PathVariable eventId: String, @AuthenticationPrincipal jwt: Jwt,
                @Valid @RequestBody request: PresignRequest): PresignResponse = media.presign(eventId, jwt.userId(), request)

    @PostMapping("/{photoId}/confirm")
    fun confirm(@PathVariable eventId: String, @PathVariable photoId: String,
                @AuthenticationPrincipal jwt: Jwt): PhotoDto = media.confirm(eventId, jwt.userId(), photoId)

    @PostMapping("/download-urls")
    fun download(@PathVariable eventId: String, @AuthenticationPrincipal jwt: Jwt,
                 @Valid @RequestBody request: DownloadRequest): DownloadResponse = media.download(eventId, jwt.userId(), request)
}
