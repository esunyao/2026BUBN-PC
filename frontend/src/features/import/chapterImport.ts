import type {
  Contribution,
  EnvironmentPreset,
  EnvironmentRecipe,
  Moment,
  PendingPhoto,
  Scene,
} from '../../shared/memoryTypes'
import type { AnalyzedPhoto } from './photoAnalysis'
import type { EventCandidate } from './eventGrouping'

export function suggestedPreset(text: string): EnvironmentPreset {
  if (/舞台|晚会|演出|后台|ceremony|stage/i.test(text)) return 'ceremony'
  if (/海边|海岸|沙滩|海水|coast|beach/i.test(text)) return 'coastal'
  if (/山|森林|草地|松树|mountain|forest/i.test(text)) return 'alpine'
  if (/城市|街道|建筑|都市|city|urban/i.test(text)) return 'urban'
  return 'neutral'
}
/** Scene is an event inside the user's chapter; singletons stay outside its event shelf. */
export function buildChapterImport(
  photos: AnalyzedPhoto[],
  groups: EventCandidate[],
  chapterId: string,
  personId: string,
  recipes: Record<EnvironmentPreset, EnvironmentRecipe>,
) {
  const patch = {
    scenes: [] as Scene[],
    moments: [] as Moment[],
    contributions: [] as Contribution[],
    pendingPhotos: [] as PendingPhoto[],
  }
  const seen = new Set<string>()
  const base = (photo: AnalyzedPhoto) => ({
    id: photo.id,
    fileId: photo.id,
    originalFileId: photo.displayBlob ? photo.id + '-original' : undefined,
    contentHash: photo.hash,
    mediaUrl: photo.url,
    participantId: personId,
    mood: [],
    isDemo: false,
    alt: photo.filename,
    capturedAt: photo.capturedAt,
    gps: photo.gps,
    generatedCaption: photo.generatedCaption,
    captionSource: photo.captionSource,
    visibility: 'event-members' as const,
    timeEvidence:
      photo.capturedAt === undefined
        ? { precision: 'unknown' as const, source: 'user' as const }
        : {
            start: new Date(photo.capturedAt).toISOString(),
            precision: photo.timeSource === 'exif' ? ('exact' as const) : ('approximate' as const),
            source: photo.timeSource === 'exif' ? ('exif' as const) : ('user' as const),
          },
  })
  for (const group of groups) {
    const items = group.photoIds.map((id) => photos.find((p) => p.id === id))
    if (
      items.some((p) => !p || p.duplicateOf || seen.has(p.id)) ||
      new Set(group.photoIds).size !== group.photoIds.length
    )
      throw new Error('事件包含重复或失效的照片，请重新整理。')
    const ordered = (items as AnalyzedPhoto[]).sort(
      (a, b) => (a.capturedAt ?? Infinity) - (b.capturedAt ?? Infinity),
    )
    for (const p of ordered) seen.add(p.id)
    if (ordered.length < 2) {
      for (const photo of ordered)
        patch.pendingPhotos.push({
          ...base(photo),
          eventId: chapterId,
          reason: '暂未找到可靠的同行照片，原图保留在待整理区。',
        })
      continue
    }
    const scene: Scene = {
      id: crypto.randomUUID(),
      eventId: chapterId,
      title: group.title.trim() || '一段共同记录',
      subtitle: group.description ?? '',
      copySource: group.copySource,
      momentIds: [],
      environment: recipes[suggestedPreset(group.title + ' ' + (group.description ?? ''))],
    }
    patch.scenes.push(scene)
    let current: Moment | undefined
    for (const photo of ordered) {
      if (
        !current ||
        photo.capturedAt === undefined ||
        current.label === '时间待确认' ||
        photo.capturedAt - Date.parse(current.startAt) > 30 * 60000
      ) {
        const timestamp =
          photo.capturedAt ??
          ordered.find((p) => p.capturedAt !== undefined)?.capturedAt ??
          Date.now()
        current = {
          id: crypto.randomUUID(),
          sceneId: scene.id,
          title: photo.capturedAt === undefined ? '未标明时间的画面' : '共同的时刻',
          startAt: new Date(timestamp).toISOString(),
          label:
            photo.capturedAt === undefined
              ? '时间待确认'
              : new Date(timestamp).toLocaleString('zh-CN'),
          lighting:
            photo.capturedAt === undefined
              ? 'overcast'
              : new Date(timestamp).getHours() >= 19
                ? 'night'
                : new Date(timestamp).getHours() >= 16
                  ? 'golden-hour'
                  : 'morning',
          contributionIds: [],
        }
        patch.moments.push(current)
        scene.momentIds.push(current.id)
      }
      if (photo.capturedAt !== undefined) current.endAt = new Date(photo.capturedAt).toISOString()
      current.contributionIds.push(photo.id)
      patch.contributions.push({ ...base(photo), momentId: current.id, kind: 'photo' })
    }
  }
  if (photos.some((p) => !p.duplicateOf && !seen.has(p.id)))
    throw new Error('还有照片未进入事件或待整理区。')
  return patch
}
