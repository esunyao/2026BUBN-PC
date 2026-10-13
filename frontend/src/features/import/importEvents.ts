import type { MemoryData, EnvironmentRecipe, Moment, Scene } from '../../shared/memoryTypes'
import { distanceMeters, validGps } from '../../shared/lib/geo'
import type { AnalyzedPhoto } from './photoAnalysis'
import type { EventCandidate } from './eventGrouping'

/** Build an independent patch, published only after all blobs are safely stored. */
export function buildImportedEvents(
  photos: AnalyzedPhoto[],
  groups: EventCandidate[],
  participantId: string,
  environment: EnvironmentRecipe,
): Pick<MemoryData, 'events' | 'scenes' | 'moments' | 'contributions'> {
  const patch: Pick<MemoryData, 'events' | 'scenes' | 'moments' | 'contributions'> = {
    events: [],
    scenes: [],
    moments: [],
    contributions: [],
  }
  const assigned = new Set<string>()
  for (const group of groups) {
    if (new Set(group.photoIds).size !== group.photoIds.length) throw new Error('照片分组重复。')
    const items = group.photoIds.map((id) => photos.find((p) => p.id === id))
    if (!items.length) continue
    if (items.some((p) => !p || p.duplicateOf || assigned.has(p.id)))
      throw new Error('照片分组重复或已失效，请重新整理。')
    const ordered = (items as AnalyzedPhoto[]).sort(
      (a, b) => (a.capturedAt ?? Infinity) - (b.capturedAt ?? Infinity),
    )
    const times = ordered
      .map((p) => p.capturedAt)
      .filter((t): t is number => t !== undefined && Number.isFinite(t))
    const start = times[0] ?? (group.manualStart ? Date.parse(group.manualStart) : NaN)
    if (!Number.isFinite(start)) throw new Error('请为没有拍摄时间的事件填写日期和时间。')
    if (!group.title.trim()) throw new Error('请填写事件名称。')
    const end = times.at(-1) ?? start
    const eventId = crypto.randomUUID()
    const scenes: Array<{ scene: Scene; anchor?: AnalyzedPhoto['gps']; last?: Moment }> = []
    for (const photo of ordered) {
      assigned.add(photo.id)
      const gps = validGps(photo.gps?.latitude, photo.gps?.longitude)
      let location = scenes.find((s) => gps && s.anchor && distanceMeters(gps, s.anchor) <= 300)
      if (!gps) location = scenes.find((s) => !s.anchor)
      if (!location) {
        const scene: Scene = {
          id: crypto.randomUUID(),
          eventId,
          title: gps ? `地点 ${scenes.filter((s) => s.anchor).length + 1}` : '位置待确认',
          subtitle: gps ? '按照片 GPS 固定锚点归组 · 300 米范围' : '照片缺少 GPS，不推断真实位置',
          momentIds: [],
          environment,
        }
        location = { scene, anchor: gps }
        scenes.push(location)
        patch.scenes.push(scene)
      }
      const timestamp = photo.capturedAt ?? start
      let moment = location.last
      if (
        !moment ||
        photo.capturedAt === undefined ||
        timestamp - Date.parse(moment.startAt) > 30 * 60000 ||
        moment.label === '时间待确认'
      ) {
        moment = {
          id: crypto.randomUUID(),
          sceneId: location.scene.id,
          title: photo.capturedAt === undefined ? '未标明时间的照片' : '共同的时刻',
          startAt: new Date(timestamp).toISOString(),
          label:
            photo.capturedAt === undefined
              ? '时间待确认'
              : new Date(timestamp).toLocaleString('zh-CN'),
          lighting: 'morning',
          contributionIds: [],
        }
        location.scene.momentIds.push(moment.id)
        patch.moments.push(moment)
        location.last = moment
      }
      if (photo.capturedAt !== undefined) moment.endAt = new Date(timestamp).toISOString()
      moment.contributionIds.push(photo.id)
      patch.contributions.push({
        id: photo.id,
        fileId: photo.id,
        originalFileId: photo.displayBlob ? photo.id + '-original' : undefined,
        generatedCaption: photo.generatedCaption,
        captionSource: photo.captionSource,
        kind: 'photo',
        mediaUrl: photo.url,
        momentId: moment.id,
        participantId,
        mood: [],
        isDemo: false,
        alt: photo.filename,
        capturedAt: photo.capturedAt,
        gps,
        visibility: 'event-members',
        timeEvidence:
          photo.capturedAt === undefined
            ? { precision: 'unknown', source: 'user' }
            : {
                start: new Date(timestamp).toISOString(),
                precision: photo.timeSource === 'exif' ? 'exact' : 'approximate',
                source: photo.timeSource === 'exif' ? 'exif' : 'user',
              },
      })
    }
    patch.events.push({
      id: eventId,
      title: group.title.trim(),
      subtitle: group.description?.trim() || '根据照片线索整理 · 已由你确认',
      copySource: group.copySource,
      type: group.type ?? 'trip',
      sceneIds: scenes.map((s) => s.scene.id),
      participantIds: [participantId],
      isDemo: false,
      startAt: new Date(start).toISOString(),
      endAt: new Date(end).toISOString(),
    })
  }
  if (!patch.events.length) throw new Error('请至少选择一张照片。')
  return patch
}
