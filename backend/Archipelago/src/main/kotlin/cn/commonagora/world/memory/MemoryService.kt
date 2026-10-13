package cn.commonagora.world.memory

import cn.commonagora.world.shared.ApiException
import org.springframework.core.io.ClassPathResource
import org.springframework.http.HttpStatus
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import tools.jackson.databind.ObjectMapper
import java.time.Instant
import java.time.ZoneId
import java.util.UUID

@Service
class MemoryService(private val jdbc: JdbcTemplate, private val mapper: ObjectMapper) : MemoryAccess {
    private val demo: MemoryData by lazy {
        ClassPathResource("demo/memory-data.json").inputStream.use { mapper.readValue(it, MemoryData::class.java) }
    }
    private fun fail(status: HttpStatus, message: String): Nothing = throw ApiException(status, message)
    private fun <T> parse(content: String, type: Class<T>): T = mapper.readValue(content, type)
    private fun json(value: Any): String = mapper.writeValueAsString(value)
    private fun count(sql: String, vararg args: Any): Int = jdbc.queryForObject(sql, Int::class.java, *args) ?: 0
    private fun demoEvent(id: String) = demo.events.firstOrNull { it.id == id }

    override fun requireMember(eventId: String, userId: String) {
        if (count("SELECT count(*) FROM event_members WHERE event_id=? AND user_id=?", eventId, userId) == 0)
            fail(HttpStatus.NOT_FOUND, "Event was not found")
    }
    private fun member(eventId: String, userId: String): Member {
        requireMember(eventId, userId)
        return jdbc.query("SELECT m.user_id,u.username,m.participant_id,m.role FROM event_members m JOIN users u ON u.id=m.user_id WHERE m.event_id=? AND m.user_id=?",
            { rs, _ -> Member(rs.getString(1), rs.getString(2), rs.getString(3), rs.getString(4)) }, eventId, userId).single()
    }
    private fun isOwner(eventId: String, userId: String) =
        count("SELECT count(*) FROM event_members WHERE event_id=? AND user_id=? AND role='owner'", eventId, userId) == 1
    private fun visible(c: Contribution, userId: String) = c.visibility != "private" || c.ownerUserId == userId
    private fun validId(id: String) = id.length in 1..128 && Regex("[A-Za-z0-9_:.-]+").matches(id)

    fun listEvents(userId: String): List<Map<String, Any?>> {
        val owned = jdbc.query("SELECT e.id,e.name,e.subtitle,e.event_type,e.start_at,e.end_at,e.created_at FROM events e JOIN event_members m ON m.event_id=e.id WHERE m.user_id=? ORDER BY e.created_at,e.id",
            { rs, _ ->
                val id=rs.getString(1)
                mapOf<String,Any?>("id" to id,"name" to rs.getString(2),"title" to rs.getString(2),"subtitle" to rs.getString(3),"type" to rs.getString(4),"startAt" to rs.getString(5),"endAt" to rs.getString(6),"createdAt" to rs.getLong(7),"isDemo" to false,
                    "sceneIds" to jdbc.query("SELECT id FROM memory_scenes WHERE event_id=? ORDER BY rowid", { row, _ -> row.getString(1) },id),
                    "participantIds" to jdbc.query("SELECT id FROM participants WHERE event_id=? ORDER BY rowid", { row, _ -> row.getString(1) },id))
            },userId)
        return demo.events.map { e -> mapOf<String,Any?>("id" to e.id,"name" to e.title,"title" to e.title,"subtitle" to e.subtitle,"type" to e.type,"startAt" to e.startAt,"endAt" to e.endAt,"createdAt" to 0L,"isDemo" to true,"sceneIds" to e.sceneIds,"participantIds" to e.participantIds) } + owned
    }

    fun index(eventId: String, userId: String): MemoryIndex {
        demoEvent(eventId)?.let { e ->
            val scenes=demo.scenes.filter { it.eventId==eventId }
            val sceneIds=scenes.map { it.id }.toSet()
            val moments=demo.moments.filter { it.sceneId in sceneIds }
            val momentIds=moments.map { it.id }.toSet()
            val contributions=demo.contributions.filter { it.momentId in momentIds }
            val ids=contributions.map { it.id }.toSet()
            return MemoryIndex(MemoryData(demo.participants,listOf(e),scenes,moments,contributions,
                demo.links.filter { l -> l.momentIds.all { it in momentIds } && l.contributionIds.all { it in ids } },
                demo.pairs.filter { it.sceneId in sceneIds && it.beforeContributionId in ids && it.afterContributionId in ids }),
                "a",MemoryPermissions(false,true),0)
        }
        val current=member(eventId,userId)
        val event=jdbc.query("SELECT name,subtitle,event_type,start_at,end_at,revision FROM events WHERE id=?",
            { rs, _ -> MemoryEvent(eventId,rs.getString(1),rs.getString(2),rs.getString(3),startAt=rs.getString(4),endAt=rs.getString(5)) to rs.getLong(6) },eventId).single()
        val participants=jdbc.query("SELECT id,name,color,user_id FROM participants WHERE event_id=? ORDER BY rowid",
            { rs, _ -> MemoryParticipant(rs.getString(1),rs.getString(2),rs.getString(3),rs.getString(4)) },eventId)
        val scenes=jdbc.query("SELECT content FROM memory_scenes WHERE event_id=? ORDER BY rowid",
            { rs, _ -> parse(rs.getString(1),Scene::class.java) },eventId)
        val rawMoments=jdbc.query("SELECT content FROM memory_moments WHERE event_id=? ORDER BY rowid",
            { rs, _ -> parse(rs.getString(1),Moment::class.java) },eventId)
        val contributions=jdbc.query("SELECT content FROM contributions WHERE event_id=? ORDER BY rowid",
            { rs, _ -> parse(rs.getString(1),Contribution::class.java) },eventId).filter { visible(it,userId) }
        val visibleIds=contributions.map { it.id }.toSet()
        val moments=rawMoments.filter { it.originGapId==null || contributions.any { c -> c.momentId==it.id } }
            .map { m -> m.copy(contributionIds=contributions.filter { it.momentId==m.id }.map { it.id }) }
        val momentIds=moments.map { it.id }.toSet()
        val fullScenes=scenes.map { s -> s.copy(momentIds=moments.filter { it.sceneId==s.id }.sortedBy { it.startAt }.map { it.id }) }
        val links=jdbc.query("SELECT content FROM memory_links WHERE event_id=?",{ rs,_ -> parse(rs.getString(1),SharedMomentLink::class.java) },eventId)
            .filter { l -> l.momentIds.all { it in momentIds } && l.contributionIds.all { it in visibleIds } }
        val pairs=jdbc.query("SELECT content FROM memory_pairs WHERE event_id=?",{ rs,_ -> parse(rs.getString(1),ThenNowPair::class.java) },eventId)
            .filter { it.beforeContributionId in visibleIds && it.afterContributionId in visibleIds }
        return MemoryIndex(MemoryData(participants,listOf(event.first.copy(sceneIds=fullScenes.map { it.id },participantIds=participants.map { it.id })),fullScenes,moments,contributions,links,pairs),
            current.participantId,MemoryPermissions(current.role=="owner",false),event.second)
    }

    override fun canReadPhoto(eventId: String, photoId: String, userId: String): Boolean {
        requireMember(eventId,userId)
        if (count("SELECT count(*) FROM photos WHERE id=? AND event_id=? AND uploader_id=? AND status='READY'",photoId,eventId,userId)>0) return true
        return jdbc.query("SELECT visibility,owner_user_id FROM contributions WHERE event_id=? AND (photo_id=? OR thumbnail_photo_id=? OR background_photo_id=?)",
            { rs,_ -> rs.getString(1) to rs.getString(2) },eventId,photoId,photoId,photoId).any { it.first!="private" || it.second==userId }
    }
    override fun assertAttachablePhoto(eventId: String, photoId: String, userId: String) {
        requireMember(eventId,userId)
        if (count("SELECT count(*) FROM photos WHERE id=? AND event_id=? AND uploader_id=? AND status='READY'",photoId,eventId,userId)==0)
            fail(HttpStatus.NOT_FOUND,"Photo was not found")
    }
    private fun checkPhotoRefs(eventId:String,userId:String,c:ContributionRequest) {
        listOfNotNull(c.photoId,c.thumbnailPhotoId,c.backgroundPhotoId).forEach { assertAttachablePhoto(eventId,it,userId) }
        if (c.kind=="photo" && c.photoId==null) fail(HttpStatus.BAD_REQUEST,"Photo requires a confirmed upload")
    }

    fun members(eventId:String,userId:String):List<Member> {
        requireMember(eventId,userId)
        return jdbc.query("SELECT m.user_id,u.username,m.participant_id,m.role FROM event_members m JOIN users u ON u.id=m.user_id WHERE m.event_id=? ORDER BY m.rowid",
            { rs,_ -> Member(rs.getString(1),rs.getString(2),rs.getString(3),rs.getString(4)) },eventId)
    }
    @Transactional
    fun addMember(eventId:String,userId:String,request:AddMemberRequest):Member {
        if (!isOwner(eventId,userId)) fail(HttpStatus.NOT_FOUND,"Event was not found")
        val username=request.username.trim()
        val account=jdbc.query("SELECT id,username FROM users WHERE username=?",{ rs,_ -> rs.getString(1) to rs.getString(2) },username).singleOrNull()
            ?: fail(HttpStatus.NOT_FOUND,"Account was not found")
        val existing=jdbc.query("SELECT participant_id FROM event_members WHERE event_id=? AND user_id=?",{ rs,_ -> rs.getString(1) },eventId,account.first).singleOrNull()
        if (existing!=null) return Member(account.first,account.second,existing,"member")
        val participantId=UUID.randomUUID().toString()
        jdbc.update("INSERT INTO participants(id,event_id,name,initials,color,user_id) VALUES(?,?,?,?,?,?)",participantId,eventId,account.second,account.second.take(2),"#c77455",account.first)
        jdbc.update("INSERT INTO event_members(event_id,user_id,participant_id,role) VALUES(?,?,?,'member')",eventId,account.first,participantId)
        jdbc.update("UPDATE events SET revision=revision+1 WHERE id=?",eventId)
        return Member(account.first,account.second,participantId,"member")
    }

    private fun checkWrite(eventId:String,userId:String,request:ContributionRequest) {
        val current=member(eventId,userId)
        if (!validId(request.id) || request.participantId!=current.participantId || request.kind !in listOf("photo","note") || request.visibility !in listOf("private","event-members","public"))
            fail(HttpStatus.BAD_REQUEST,"Invalid contribution")
        if (request.writtenText?.length ?: 0 > 3000 || request.mood.size>8 || request.mood.any { it.length>60 } || request.alt.length>255)
            fail(HttpStatus.BAD_REQUEST,"Invalid contribution content")
        checkPhotoRefs(eventId,userId,request)
    }
    private fun momentEvent(momentId:String)=jdbc.query("SELECT event_id FROM memory_moments WHERE id=?",{ rs,_ -> rs.getString(1) },momentId).singleOrNull()
    private fun timestamp(value:String):Instant = try { Instant.parse(value) } catch (_:Exception) {
        try { java.time.OffsetDateTime.parse(value).toInstant() } catch (_:Exception) { fail(HttpStatus.BAD_REQUEST,"Invalid time") }
    }
    private fun resolveGap(eventId:String,userId:String,gap:GapRequest):String {
        if (!validId(gap.originGapId) || gap.originMomentIds.size!=2 || gap.start>=gap.end) fail(HttpStatus.BAD_REQUEST,"Invalid gap")
        val scene=jdbc.query("SELECT event_id FROM memory_scenes WHERE id=?",{ rs,_ -> rs.getString(1) },gap.sceneId).singleOrNull()
        if (scene!=eventId) fail(HttpStatus.NOT_FOUND,"Scene was not found")
        val existing=jdbc.query("SELECT id FROM memory_moments WHERE event_id=? AND origin_gap_id=?",{ rs,_ -> rs.getString(1) },eventId,gap.originGapId).singleOrNull()
        if (existing!=null) return existing
        val before=jdbc.query("SELECT content FROM memory_moments WHERE id=? AND event_id=?",{ rs,_ -> parse(rs.getString(1),Moment::class.java) },gap.originMomentIds[0],eventId).singleOrNull()
            ?: fail(HttpStatus.BAD_REQUEST,"Invalid gap anchors")
        val after=jdbc.query("SELECT content FROM memory_moments WHERE id=? AND event_id=?",{ rs,_ -> parse(rs.getString(1),Moment::class.java) },gap.originMomentIds[1],eventId).singleOrNull()
            ?: fail(HttpStatus.BAD_REQUEST,"Invalid gap anchors")
        if (before.sceneId!=gap.sceneId || after.sceneId!=gap.sceneId || before.originGapId!=null || after.originGapId!=null) fail(HttpStatus.BAD_REQUEST,"Invalid gap anchors")
        val current=index(eventId,userId).data
        val event=current.events.single()
        if (event.startAt==null || event.endAt==null) fail(HttpStatus.BAD_REQUEST,"Event has no trusted time range")
        val visible=current.contributions.filter { it.kind=="photo" && it.timeEvidence?.precision in listOf("exact","approximate") && it.timeEvidence?.source in listOf("exif","user","demo") && it.timeEvidence?.start!=null }
            .filter { photo -> current.moments.any { m -> m.id==photo.momentId && m.sceneId==gap.sceneId } }
            .filter { photo -> timestamp(photo.timeEvidence!!.start!!).let { it>=timestamp(event.startAt) && it<=timestamp(event.endAt) } }
            .distinctBy { timestamp(it.timeEvidence!!.start!!) }
            .sortedBy { timestamp(it.timeEvidence!!.start!!) }
        val pair=visible.zipWithNext().firstOrNull { (a,b) -> a.momentId==before.id && b.momentId==after.id }
            ?: fail(HttpStatus.BAD_REQUEST,"Gap anchors are not adjacent visible photos")
        val start=timestamp(gap.start);val end=timestamp(gap.end)
        val minutes=java.time.Duration.between(start,end).toMinutes()
        val dayA=start.atZone(ZoneId.of("Asia/Shanghai"));val dayB=end.atZone(ZoneId.of("Asia/Shanghai"))
        if (minutes !in 60..240 || dayA.toLocalDate()!=dayB.toLocalDate() || dayA.hour<7 || dayB.hour>22 ||
            gap.originGapId!="gap-${gap.sceneId}-${before.id}-${after.id}" ||
            start!=timestamp(pair.first.timeEvidence!!.start!!) || end!=timestamp(pair.second.timeEvidence!!.start!!))
            fail(HttpStatus.BAD_REQUEST,"Gap is outside the trusted range")
        if (count("SELECT count(*) FROM memory_moments WHERE event_id=? AND origin_gap_id IS NOT NULL",eventId)>=3) fail(HttpStatus.BAD_REQUEST,"Too many gap moments")
        val id=gap.originGapId
        val moment=Moment(id,gap.sceneId,"没有照片的时段",gap.start,"文字记忆","golden-hour",endAt=gap.end,originGapId=gap.originGapId)
        jdbc.update("INSERT INTO memory_moments(id,event_id,scene_id,origin_gap_id,content) VALUES(?,?,?,?,?)",id,eventId,gap.sceneId,gap.originGapId,json(moment))
        return id
    }
    @Transactional
    fun createContribution(eventId:String,userId:String,request:ContributionRequest):Contribution {
        checkWrite(eventId,userId,request)
        val fingerprint=json(request)
        val previous=jdbc.query("SELECT request_json,content FROM contributions WHERE id=?",{ rs,_ -> rs.getString(1) to rs.getString(2) },request.id).singleOrNull()
        if (previous!=null) {
            if (previous.first!=fingerprint) fail(HttpStatus.CONFLICT,"Contribution ID already exists")
            return parse(previous.second,Contribution::class.java)
        }
        val momentId=request.momentId ?: request.gap?.let { resolveGap(eventId,userId,it) } ?: fail(HttpStatus.BAD_REQUEST,"Moment required")
        if (momentEvent(momentId)!=eventId) fail(HttpStatus.NOT_FOUND,"Moment was not found")
        val contribution=Contribution(request.id,momentId,request.participantId,request.kind,request.writtenText,request.mood,false,request.alt,request.visibility,userId,1,
            request.photoId,request.thumbnailPhotoId,request.backgroundPhotoId,timeEvidence=request.timeEvidence,capturedAt=request.capturedAt,gps=request.gps)
        jdbc.update("INSERT INTO contributions(id,event_id,moment_id,participant_id,owner_user_id,version,visibility,photo_id,thumbnail_photo_id,background_photo_id,content,request_json) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
            request.id,eventId,momentId,request.participantId,userId,1,request.visibility,request.photoId,request.thumbnailPhotoId,request.backgroundPhotoId,json(contribution),fingerprint)
        jdbc.update("UPDATE events SET revision=revision+1 WHERE id=?",eventId)
        return contribution
    }

    private fun storedContribution(id:String):Pair<String,Contribution> = jdbc.query("SELECT event_id,content FROM contributions WHERE id=?",
        { rs,_ -> rs.getString(1) to parse(rs.getString(2),Contribution::class.java) },id).singleOrNull() ?: fail(HttpStatus.NOT_FOUND,"Contribution was not found")
    @Transactional
    fun editContribution(id:String,userId:String,patch:ContributionPatch):Contribution {
        val (eventId,old)=storedContribution(id)
        requireMember(eventId,userId)
        if (old.ownerUserId!=userId) fail(HttpStatus.NOT_FOUND,"Contribution was not found")
        if (old.version!=patch.version) fail(HttpStatus.CONFLICT,"Contribution changed; reload and try again")
        val participant=patch.participantId ?: old.participantId
        if (participant!=member(eventId,userId).participantId) fail(HttpStatus.BAD_REQUEST,"Invalid author")
        val targetMoment=patch.momentId ?: old.momentId
        if (!jdbc.queryForObject("SELECT EXISTS(SELECT 1 FROM memory_moments WHERE id=? AND event_id=?)",Int::class.java,targetMoment,eventId).let { it==1 }) fail(HttpStatus.BAD_REQUEST,"Invalid moment")
        listOfNotNull(patch.photoId,patch.thumbnailPhotoId,patch.backgroundPhotoId).forEach { assertAttachablePhoto(eventId,it,userId) }
        val updated=old.copy(momentId=targetMoment,participantId=participant,writtenText=patch.writtenText ?: old.writtenText,mood=patch.mood ?: old.mood,
            visibility=patch.visibility ?: old.visibility,alt=patch.alt ?: old.alt,timeEvidence=patch.timeEvidence ?: old.timeEvidence,
            capturedAt=patch.capturedAt ?: old.capturedAt,gps=patch.gps ?: old.gps,
            photoId=patch.photoId ?: old.photoId,thumbnailPhotoId=patch.thumbnailPhotoId ?: old.thumbnailPhotoId,
            backgroundPhotoId=patch.backgroundPhotoId ?: old.backgroundPhotoId,version=old.version+1)
        jdbc.update("UPDATE contributions SET moment_id=?,participant_id=?,version=?,visibility=?,photo_id=?,thumbnail_photo_id=?,background_photo_id=?,content=? WHERE id=? AND version=?",
            updated.momentId,updated.participantId,updated.version,updated.visibility,updated.photoId,updated.thumbnailPhotoId,updated.backgroundPhotoId,json(updated),id,old.version)
        jdbc.update("UPDATE events SET revision=revision+1 WHERE id=?",eventId)
        return updated
    }
    @Transactional
    fun deleteContribution(id:String,userId:String,version:Int) {
        val (eventId,old)=storedContribution(id)
        requireMember(eventId,userId)
        if (old.ownerUserId!=userId) fail(HttpStatus.NOT_FOUND,"Contribution was not found")
        if (old.version!=version) fail(HttpStatus.CONFLICT,"Contribution changed; reload and try again")
        jdbc.update("DELETE FROM contributions WHERE id=? AND version=?",id,version)
        jdbc.update("DELETE FROM memory_moments WHERE id=? AND origin_gap_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM contributions WHERE moment_id=?)",old.momentId,old.momentId)
        jdbc.update("UPDATE events SET revision=revision+1 WHERE id=?",eventId)
    }

    fun feedback(eventId:String,userId:String):Map<String,Feedback> {
        val table=if (demoEvent(eventId)!=null) "demo_discovery_feedback" else "discovery_feedback"
        if (table=="discovery_feedback") requireMember(eventId,userId)
        return jdbc.query("SELECT finding_id,content FROM $table WHERE event_id=? AND user_id=?",
            { rs,_ -> rs.getString(1) to parse(rs.getString(2),Feedback::class.java) },eventId,userId).toMap()
    }
    @Transactional
    fun putFeedback(eventId:String,userId:String,request:FeedbackRequest):Feedback {
        val table=if (demoEvent(eventId)!=null) "demo_discovery_feedback" else "discovery_feedback"
        if (table=="discovery_feedback") requireMember(eventId,userId)
        if (request.findingId.length !in 1..500 || request.evidenceIds.isEmpty() || request.evidenceIds.size>20 || request.status !in listOf(null,"confirmed","dismissed"))
            fail(HttpStatus.BAD_REQUEST,"Invalid discovery feedback")
        val visibleIds=index(eventId,userId).data.contributions.map { it.id }.toSet()
        if (!request.evidenceIds.all { it in visibleIds }) fail(HttpStatus.NOT_FOUND,"Discovery was not found")
        val value=Feedback(request.status,request.favorite)
        jdbc.update("INSERT INTO $table(event_id,user_id,finding_id,content,evidence_json) VALUES(?,?,?,?,?) ON CONFLICT(event_id,user_id,finding_id) DO UPDATE SET content=excluded.content,evidence_json=excluded.evidence_json",
            eventId,userId,request.findingId,json(value),json(request.evidenceIds))
        return value
    }

    fun archive(eventId:String,userId:String):MemoryData {
        if (demoEvent(eventId)!=null) fail(HttpStatus.NOT_FOUND,"Event was not found")
        return index(eventId,userId).data.copy(contributions=index(eventId,userId).data.contributions.map { it.copy(mediaUrl=null,thumbnailUrl=null) })
    }

    @Transactional
    fun importArchive(userId:String,request:ImportArchiveRequest):ImportArchiveResponse {
        if (request.requestId.length !in 1..100 || request.data.events.size !in 1..10) fail(HttpStatus.BAD_REQUEST,"Invalid archive")
        val fingerprint=json(request.data)
        val previous=jdbc.query("SELECT request_json,response_json FROM memory_requests WHERE user_id=? AND request_id=?",
            { rs,_ -> rs.getString(1) to rs.getString(2) },userId,request.requestId).singleOrNull()
        if (previous!=null) {
            if (previous.first!=fingerprint) fail(HttpStatus.CONFLICT,"Import ID already used")
            return parse(previous.second,ImportArchiveResponse::class.java)
        }
        val response=ImportArchiveResponse(request.data.events.map { source -> importEvent(userId,request.data,source) })
        jdbc.update("INSERT INTO memory_requests(user_id,request_id,request_json,response_json) VALUES(?,?,?,?)",userId,request.requestId,fingerprint,json(response))
        return response
    }
    @Transactional
    fun copyDemo(userId:String,requestId:String,demoEventId:String):CopyDemoResponse {
        val source=demoEvent(demoEventId) ?: fail(HttpStatus.NOT_FOUND,"Demo was not found")
        return CopyDemoResponse(importArchive(userId,ImportArchiveRequest(requestId,demo.copy(events=listOf(source)))).eventIds.single())
    }
    private fun importEvent(userId:String,sourceData:MemoryData,source:MemoryEvent):String {
        if (!validId(source.id) || source.title.length !in 1..100 || source.type !in listOf("trip","longActivity")) fail(HttpStatus.BAD_REQUEST,"Invalid archive event")
        val eventId=UUID.randomUUID().toString()
        jdbc.update("INSERT INTO events(id,owner_id,name,created_at,subtitle,event_type,start_at,end_at) VALUES(?,?,?,?,?,?,?,?)",
            eventId,userId,source.title,System.currentTimeMillis(),source.subtitle,source.type,source.startAt,source.endAt)
        val ownerName=jdbc.queryForObject("SELECT username FROM users WHERE id=?",String::class.java,userId) ?: "owner"
        val ownerParticipant=UUID.randomUUID().toString()
        jdbc.update("INSERT INTO participants(id,event_id,name,initials,color,user_id) VALUES(?,?,?,?,?,?)",ownerParticipant,eventId,ownerName,ownerName.take(2),"#c77455",userId)
        jdbc.update("INSERT INTO event_members(event_id,user_id,participant_id,role) VALUES(?,?,?,'owner')",eventId,userId,ownerParticipant)
        val personIds=mutableMapOf<String,String>()
        sourceData.participants.filter { it.id in source.participantIds }.forEach { p ->
            val id=UUID.randomUUID().toString();personIds[p.id]=id
            jdbc.update("INSERT INTO participants(id,event_id,name,initials,color) VALUES(?,?,?,?,?)",id,eventId,p.displayName.take(60),p.displayName.take(2),if(Regex("#[0-9a-fA-F]{6}").matches(p.color)) p.color else "#c77455")
        }
        val sceneIds=mutableMapOf<String,String>();val momentIds=mutableMapOf<String,String>();val contributionIds=mutableMapOf<String,String>()
        sourceData.scenes.filter { it.id in source.sceneIds }.forEach { s ->
            val id=UUID.randomUUID().toString();sceneIds[s.id]=id
            val preset=s.environment["preset"] as? String
            if (preset !in listOf("coastal","alpine","urban","ceremony","neutral")) fail(HttpStatus.BAD_REQUEST,"Invalid environment")
            jdbc.update("INSERT INTO memory_scenes(id,event_id,content) VALUES(?,?,?)",id,eventId,json(s.copy(id=id,eventId=eventId,momentIds=emptyList(),environment=mapOf("preset" to preset))))
        }
        sourceData.moments.filter { it.sceneId in sceneIds }.forEach { m ->
            val id=UUID.randomUUID().toString();momentIds[m.id]=id
            jdbc.update("INSERT INTO memory_moments(id,event_id,scene_id,origin_gap_id,content) VALUES(?,?,?,?,?)",id,eventId,sceneIds[m.sceneId],m.originGapId?.let { "import:$id" },json(m.copy(id=id,sceneId=sceneIds[m.sceneId]!!,contributionIds=emptyList(),originGapId=m.originGapId?.let { "import:$id" })))
        }
        sourceData.contributions.filter { it.momentId in momentIds }.forEach { c ->
            val id=UUID.randomUUID().toString();contributionIds[c.id]=id
            val participant=personIds[c.participantId] ?: ownerParticipant
            val photos=listOfNotNull(c.photoId,c.thumbnailPhotoId,c.backgroundPhotoId)
            val authorized=photos.all { canReadPhotoForImport(it,userId) }
            val copy=c.copy(id=id,momentId=momentIds[c.momentId]!!,participantId=participant,ownerUserId=userId,version=1,isDemo=false,
                photoId=if(authorized) c.photoId else null,thumbnailPhotoId=if(authorized) c.thumbnailPhotoId else null,backgroundPhotoId=if(authorized) c.backgroundPhotoId else null,
                mediaUrl=if(c.mediaUrl?.startsWith("/demo-assets/")==true) c.mediaUrl else null,
                thumbnailUrl=if(c.thumbnailUrl?.startsWith("/demo-assets/")==true) c.thumbnailUrl else null,
                participantTags=null,tagsConsent=null,provenance="unverified-import")
            jdbc.update("INSERT INTO contributions(id,event_id,moment_id,participant_id,owner_user_id,version,visibility,photo_id,thumbnail_photo_id,background_photo_id,content,request_json) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
                id,eventId,copy.momentId,participant,userId,1,copy.visibility,copy.photoId,copy.thumbnailPhotoId,copy.backgroundPhotoId,json(copy),"{}")
        }
        sourceData.links.filter { it.contributionIds.all { c -> c in contributionIds } && it.momentIds.all { m -> m in momentIds } }.forEach { l ->
            val id=UUID.randomUUID().toString();val value=l.copy(id=id,momentIds=l.momentIds.map { momentIds[it]!! },contributionIds=l.contributionIds.map { contributionIds[it]!! })
            jdbc.update("INSERT INTO memory_links(id,event_id,content) VALUES(?,?,?)",id,eventId,json(value))
        }
        sourceData.pairs.filter { it.sceneId in sceneIds && it.beforeContributionId in contributionIds && it.afterContributionId in contributionIds }.forEach { p ->
            val id=UUID.randomUUID().toString();val value=p.copy(id=id,sceneId=sceneIds[p.sceneId]!!,beforeContributionId=contributionIds[p.beforeContributionId]!!,afterContributionId=contributionIds[p.afterContributionId]!!)
            jdbc.update("INSERT INTO memory_pairs(id,event_id,scene_id,before_id,after_id,content) VALUES(?,?,?,?,?,?)",id,eventId,value.sceneId,value.beforeContributionId,value.afterContributionId,json(value))
        }
        return eventId
    }
    private fun canReadPhotoForImport(photoId:String,userId:String):Boolean =
        jdbc.query("SELECT event_id FROM photos WHERE id=? AND status='READY'",{ rs,_ -> rs.getString(1) },photoId).singleOrNull()?.let { event ->
            count("SELECT count(*) FROM photos WHERE id=? AND uploader_id=?",photoId,userId)>0 &&
                count("SELECT count(*) FROM event_members WHERE event_id=? AND user_id=?",event,userId)>0 && canReadPhoto(event,photoId,userId)
        } ?: false
}
