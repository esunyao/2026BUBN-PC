package cn.commonagora.world.memory

import cn.commonagora.world.shared.userId
import org.springframework.http.HttpStatus
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.web.bind.annotation.*

@RestController
@RequestMapping("/api/v1")
class MemoryController(private val service: MemoryService) {
    @GetMapping("/events/{eventId}/memory-index")
    fun index(@PathVariable eventId:String,@AuthenticationPrincipal jwt:Jwt)=service.index(eventId,jwt.userId())
    @GetMapping("/events/{eventId}/members")
    fun members(@PathVariable eventId:String,@AuthenticationPrincipal jwt:Jwt)=service.members(eventId,jwt.userId())
    @PostMapping("/events/{eventId}/members") @ResponseStatus(HttpStatus.CREATED)
    fun addMember(@PathVariable eventId:String,@AuthenticationPrincipal jwt:Jwt,@RequestBody request:AddMemberRequest)=service.addMember(eventId,jwt.userId(),request)
    @PostMapping("/events/{eventId}/contributions") @ResponseStatus(HttpStatus.CREATED)
    fun create(@PathVariable eventId:String,@AuthenticationPrincipal jwt:Jwt,@RequestBody request:ContributionRequest)=service.createContribution(eventId,jwt.userId(),request)
    @PatchMapping("/contributions/{id}")
    fun update(@PathVariable id:String,@AuthenticationPrincipal jwt:Jwt,@RequestBody request:ContributionPatch)=service.editContribution(id,jwt.userId(),request)
    @DeleteMapping("/contributions/{id}") @ResponseStatus(HttpStatus.NO_CONTENT)
    fun delete(@PathVariable id:String,@RequestParam version:Int,@AuthenticationPrincipal jwt:Jwt)=service.deleteContribution(id,jwt.userId(),version)
    @GetMapping("/events/{eventId}/discovery-feedback")
    fun feedback(@PathVariable eventId:String,@AuthenticationPrincipal jwt:Jwt)=service.feedback(eventId,jwt.userId())
    @PutMapping("/events/{eventId}/discovery-feedback")
    fun feedbackWrite(@PathVariable eventId:String,@AuthenticationPrincipal jwt:Jwt,@RequestBody request:FeedbackRequest)=service.putFeedback(eventId,jwt.userId(),request)
}
