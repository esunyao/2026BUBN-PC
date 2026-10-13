package cn.commonagora.world.memory

import cn.commonagora.world.shared.Gps

data class MemoryParticipant(val id:String,val displayName:String,val color:String,val userId:String?=null)
data class MemoryEvent(val id:String,val title:String,val subtitle:String="",val type:String="trip",val sceneIds:List<String> = emptyList(),val participantIds:List<String> = emptyList(),val isDemo:Boolean=false,val startAt:String?=null,val endAt:String?=null)
data class Scene(val id:String,val eventId:String,val title:String,val subtitle:String="",val momentIds:List<String> = emptyList(),val environment:Map<String,Any?> = mapOf("preset" to "neutral"))
data class Moment(val id:String,val sceneId:String,val title:String,val startAt:String,val label:String="",val lighting:String="morning",val contributionIds:List<String> = emptyList(),val endAt:String?=null,val originGapId:String?=null)
data class TimeEvidence(val start:String?=null,val end:String?=null,val precision:String="unknown",val source:String="user")
data class MediaAnalysis(val sceneTags:List<String> = emptyList(),val objects:List<String> = emptyList(),val activities:List<String> = emptyList(),val phaseTags:List<String>?=null,val summary:String?=null,val modelId:String?=null,val version:String?=null)
data class Contribution(val id:String,val momentId:String,val participantId:String,val kind:String,val writtenText:String?=null,val mood:List<String> = emptyList(),val isDemo:Boolean=false,val alt:String="",val visibility:String="event-members",val ownerUserId:String?=null,val version:Int=1,val photoId:String?=null,val thumbnailPhotoId:String?=null,val backgroundPhotoId:String?=null,val provenance:String?=null,val timeEvidence:TimeEvidence?=null,val capturedAt:Long?=null,val gps:Gps?=null,val thumbnailUrl:String?=null,val mediaUrl:String?=null,val fileId:String?=null,val participantTags:List<String>?=null,val tagsConsent:Boolean?=null,val analysis:MediaAnalysis?=null)
data class SharedMomentLink(val id:String,val momentIds:List<String>,val contributionIds:List<String>,val relation:String,val reason:String,val confidence:Double)
data class ThenNowPair(val id:String,val sceneId:String,val beforeContributionId:String,val afterContributionId:String,val comparisonMode:String)
data class MemoryData(val participants:List<MemoryParticipant> = emptyList(),val events:List<MemoryEvent> = emptyList(),val scenes:List<Scene> = emptyList(),val moments:List<Moment> = emptyList(),val contributions:List<Contribution> = emptyList(),val links:List<SharedMomentLink> = emptyList(),val pairs:List<ThenNowPair> = emptyList())
data class MemoryPermissions(val canManageMembers:Boolean,val isReadOnly:Boolean)
data class MemoryIndex(val data:MemoryData,val viewerParticipantId:String?,val permissions:MemoryPermissions,val revision:Long)
data class GapRequest(val sceneId:String,val originGapId:String,val originMomentIds:List<String>,val start:String,val end:String)
data class ContributionRequest(val id:String,val participantId:String,val kind:String,val momentId:String?=null,val gap:GapRequest?=null,val writtenText:String?=null,val mood:List<String> = emptyList(),val visibility:String="event-members",val alt:String="",val timeEvidence:TimeEvidence?=null,val capturedAt:Long?=null,val gps:Gps?=null,val photoId:String?=null,val thumbnailPhotoId:String?=null,val backgroundPhotoId:String?=null)
data class ContributionPatch(val version:Int,val momentId:String?=null,val participantId:String?=null,val writtenText:String?=null,val mood:List<String>?=null,val visibility:String?=null,val alt:String?=null,val timeEvidence:TimeEvidence?=null,val capturedAt:Long?=null,val gps:Gps?=null,val photoId:String?=null,val thumbnailPhotoId:String?=null,val backgroundPhotoId:String?=null)
data class Member(val userId:String,val username:String,val participantId:String,val role:String)
data class AddMemberRequest(val username:String)
data class FeedbackRequest(val findingId:String,val evidenceIds:List<String>,val status:String?=null,val favorite:Boolean=false)
data class Feedback(val status:String?=null,val favorite:Boolean=false)
data class ImportArchiveRequest(val requestId:String,val data:MemoryData)
data class ImportArchiveResponse(val eventIds:List<String>)
data class CopyDemoResponse(val eventId:String)
interface MemoryAccess {
 fun requireMember(eventId:String,userId:String)
 fun canReadPhoto(eventId:String,photoId:String,userId:String):Boolean
 fun assertAttachablePhoto(eventId:String,photoId:String,userId:String)
}
