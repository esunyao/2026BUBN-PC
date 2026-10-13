# Online integration contract

Implementation contract for the current Hero and Discovery frontend. This is a specification until verified.

## Wire format

- `/api/v1/events` returns an array of summaries: existing `id/name/createdAt`, plus `title/subtitle/type/isDemo/sceneIds/participantIds/startAt?/endAt?`. Creation accepts `title` (or legacy `name`) and `type`; it initializes a scene and moment.
- `GET /events/{id}/memory-index` returns `{data, viewerParticipantId, permissions: {canManageMembers, isReadOnly}, revision}`. `data` matches frontend MemoryData; scene environment can be `{preset}` because the adapter expands trusted local presets. `participants` include optional `userId`.
- Contributions retain frontend fields and add `ownerUserId`, `version`, `photoId?`, `thumbnailPhotoId?`, `backgroundPhotoId?`, `provenance?`. Real media URLs are hydrated through signed download requests; server demo URLs must be whitelisted `/demo-assets/` paths. Ownership is independent of photographer labels.
- Contribution create: `{id, momentId?, gap?: {sceneId, originGapId, originMomentIds, start, end}, participantId, kind, writtenText?, mood, visibility, alt, timeEvidence?, capturedAt?, gps?, photoId?, thumbnailPhotoId?, backgroundPhotoId?}`. IDs supplied by clients make retry idempotent. `kind` is photo or note. Owner is always JWT subject.
- Contribution patch: same mutable fields with `version`; delete requires `?version=N`. Writes return the updated contribution. Read the index afterward to refresh associations. Conflicts return 409.
- `GET /events/{id}/members` returns `[{userId,username,participantId,role}]`; POST accepts `{username}` and returns a member. Creator only adds; accounts bind to event-specific participant IDs.
- `GET /events/{id}/discovery-feedback` returns `{[findingId]: {status?: 'confirmed'|'dismissed',favorite:boolean}}`. PUT accepts `{findingId,evidenceIds,status?:'confirmed'|'dismissed',favorite:boolean}` and returns the saved feedback; viewer comes from JWT. All evidence must remain visible.
- Archive GET returns MemoryData without transient URLs. POST `/events/import` accepts `{requestId,data}` and returns `{eventIds}`. Import remaps IDs, retains unverified display labels and assigns ownership to importer; validated accessible photo references may be reused, others become explicit missing-photo placeholders. POST `/events/from-demo` accepts `{requestId,demoEventId}` and returns `{eventId}`.
- Read-only demo event IDs are the existing frontend fixture IDs. Authenticated event listing includes these templates. Demo writes require copying first. No per-browser business persistence.

## Boundaries

- New graph storage uses Flyway V2+; V1 remains unchanged. Add users email/credential_scheme, event metadata, participants user mapping, photos uploader_id, and graph/member/feedback tables. Backfill old rows without losing objects.
- The memory module owns graph, membership and contribution permissions. Expose `MemoryAccess.requireMember(eventId,userId)`, `canReadPhoto(eventId,photoId,userId)` and `assertAttachablePhoto(eventId,photoId,userId)` for media. Media network operations remain outside database transactions.
- Legacy event/photo endpoints remain usable but must not expose other authors' private contributions. New media presign/confirm require event membership and upload ownership; direct downloads require graph visibility or own unlinked upload.
- Demo fixture at `src/main/resources/demo/memory-data.json`, generated from the existing frontend demo. Memory index serves controlled fixture data; archive/copy uses the same graph import service.
- SHA-256 UTF-8 password digest, lowercase 64 hex, BCrypt at rest; scheme `sha256-v1`. Username and email uniqueness. Auth agent owns auth/config; graph agent owns all migrations.
- No real model calls, anonymous public reads, local archive restoration, token localStorage, branch creation, push or merge.
