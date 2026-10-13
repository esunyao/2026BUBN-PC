import { groupPhotos, cosine, defaultGrouping, type EventCandidate } from './eventGrouping'
import { distanceMeters } from '../../shared/lib/geo'
import type { AnalyzedPhoto } from './photoAnalysis'

export function chapterCandidates(photos: AnalyzedPhoto[]): EventCandidate[] {
  const known = groupPhotos(
    photos.filter((p) => Number.isFinite(p.capturedAt)),
    defaultGrouping,
  )
  const unknown: EventCandidate[] = []
  for (const photo of photos.filter((p) => !p.duplicateOf && !Number.isFinite(p.capturedAt))) {
    const group = unknown.find((g) => {
      const first = photos.find((p) => p.id === g.photoIds[0])!
      const visual = cosine(first.embedding, photo.embedding)
      const nearby = first.gps && photo.gps && distanceMeters(first.gps, photo.gps) <= 300
      return (
        (visual !== undefined && visual >= 0.86) ||
        (nearby && (visual === undefined || visual >= 0.75))
      )
    })
    if (group) group.photoIds.push(photo.id)
    else
      unknown.push({
        id: photo.id,
        title: '未标明日期的片段',
        photoIds: [photo.id],
        reasons: ['时间未知，根据画面或位置线索整理'],
        needsReview: true,
      })
  }
  return [...known, ...unknown]
}
export function localDraft(group: EventCandidate, photos: AnalyzedPhoto[], chapterTitle: string) {
  const items = photos.filter((p) => group.photoIds.includes(p.id))
  const times = items
    .map((p) => p.capturedAt)
    .filter((t): t is number => t !== undefined && Number.isFinite(t))
    .sort((a, b) => a - b)
  const date =
    times[0] === undefined
      ? '未标明日期'
      : new Date(times[0]).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })
  const title = `${date} · ${chapterTitle.slice(0, 12)}的片段`
  return {
    ...group,
    title,
    description: `这 ${items.length} 张照片被整理在同一段记录里。${times.length ? `拍摄时间从 ${new Date(times[0]!).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })} 到 ${new Date(times.at(-1)!).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}。` : '照片没有可信拍摄时间。'}循着画面，重新浏览这段篇章。`,
    copySource: 'local' as const,
  }
}
async function thumbnail(url: string): Promise<string> {
  const image = new Image()
  image.src = url
  await image.decode()
  const scale = Math.min(1, 512 / Math.max(image.naturalWidth, image.naturalHeight))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('无法准备缩略图')
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/jpeg', 0.55)
}
export async function generateChapterCopy(
  groups: EventCandidate[],
  photos: AnalyzedPhoto[],
  chapterTitle: string,
  signal: AbortSignal,
  progress: (message: string) => void,
  useAI = true,
) {
  const drafts = groups.map((g) => localDraft(g, photos, chapterTitle)) as EventCandidate[]
  let failures = 0
  if (!useAI) return { groups: drafts, failures }
  const events = drafts.filter((g) => g.photoIds.length >= 2)
  for (let index = 0; index < events.length; index += 12) {
    if (signal.aborted) throw new DOMException('Cancelled', 'AbortError')
    progress(
      `正在用 DeepSeek 写事件标题 ${index + 1}–${Math.min(index + 12, events.length)} / ${events.length}…`,
    )
    const batch = events.slice(index, index + 12)
    try {
      const materials = await Promise.all(
        batch.map(async (group) => {
          const selected = [...new Set([group.photoIds[0]!, group.photoIds.at(-1)!])]
          const first = photos.find((p) => p.id === group.photoIds[0])!
          return {
            id: group.id,
            count: group.photoIds.length,
            date:
              first.capturedAt === undefined
                ? '未知日期'
                : new Date(first.capturedAt).toLocaleDateString('zh-CN'),
            samples: await Promise.all(
              selected.map(async (id) => ({
                id,
                image: await thumbnail(photos.find((p) => p.id === id)!.url),
              })),
            ),
          }
        }),
      )
      const response = await fetch('/api/frontend/chapter-copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chapterTitle, groups: materials }),
        signal: AbortSignal.any([signal, AbortSignal.timeout(50000)]),
      })
      if (!response.ok) throw new Error('生成失败')
      const result = (await response.json()) as {
        output?: {
          groups?: Array<{
            id: string
            title: string
            description: string
            captions?: Array<{ id: string; text: string }>
          }>
        }
      }
      if (!Array.isArray(result.output?.groups)) throw new Error('返回格式错误')
      for (const group of batch) {
        const output = result.output.groups.find((g) => g.id === group.id)
        if (
          !output ||
          typeof output.title !== 'string' ||
          !output.title.trim() ||
          output.title.length > 80 ||
          typeof output.description !== 'string' ||
          !output.description.trim() ||
          output.description.length > 500
        ) {
          failures++
          continue
        }
        group.title = output.title
        group.description = output.description
        group.copySource = 'deepseek'
        for (const caption of output.captions ?? []) {
          const photo = photos.find((p) => p.id === caption.id && group.photoIds.includes(p.id))
          if (
            photo &&
            typeof caption.text === 'string' &&
            caption.text.trim() &&
            caption.text.length <= 300
          ) {
            photo.generatedCaption = caption.text
            photo.captionSource = 'deepseek'
          }
        }
      }
    } catch {
      if (signal.aborted) throw new DOMException('Cancelled', 'AbortError')
      failures += batch.length
    }
  }
  return { groups: drafts, failures }
}
