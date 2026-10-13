import { distanceMeters, validGps } from '../../shared/lib/geo'

export interface GroupPhoto {
  id: string
  filename: string
  capturedAt?: number
  gps?: { latitude: number; longitude: number }
  embedding?: number[]
  hash?: string
  duplicateOf?: string
}
export interface EventCandidate {
  id: string
  title: string
  photoIds: string[]
  reasons: string[]
  needsReview: boolean
  manualStart?: string
}
export interface GroupingOptions {
  gapHours: number
  radiusKm: number
  similarity: number
}
export const defaultGrouping: GroupingOptions = { gapHours: 3, radiusKm: 30, similarity: 0.8 }
export function cosine(a?: number[], b?: number[]): number | undefined {
  if (!a?.length || a.length !== b?.length || !b) return undefined
  let dot = 0,
    aa = 0,
    bb = 0
  for (let i = 0; i < a.length; i++) {
    if (!Number.isFinite(a[i]) || !Number.isFinite(b[i])) return undefined
    dot += a[i]! * b[i]!
    aa += a[i]! ** 2
    bb += b[i]! ** 2
  }
  return aa && bb ? Math.max(-1, Math.min(1, dot / Math.sqrt(aa * bb))) : undefined
}
/** Stable chronological grouping. Fixed representative prevents a visual/GPS chain merging trips. */
export function groupPhotos(photos: GroupPhoto[], options = defaultGrouping): EventCandidate[] {
  const gapHours = Math.max(0.25, Math.min(12, options.gapHours))
  const radiusKm = Math.max(0.1, Math.min(100, options.radiusKm))
  const similarity = Math.max(0.5, Math.min(0.99, options.similarity))
  const known = photos
    .filter((p) => !p.duplicateOf && Number.isFinite(p.capturedAt))
    .sort((a, b) => a.capturedAt! - b.capturedAt! || a.id.localeCompare(b.id))
  const groups: Array<{ candidate: EventCandidate; anchor: GroupPhoto; last: GroupPhoto }> = []
  for (const photo of known) {
    let match: (typeof groups)[number] | undefined
    let evidence: string[] = []
    for (const group of groups) {
      const { anchor, last } = group
      // Calendar boundaries and a 12h total span constrain transitive time chaining.
      if (
        new Date(photo.capturedAt!).toDateString() !==
          new Date(anchor.capturedAt!).toDateString() ||
        photo.capturedAt! - last.capturedAt! > gapHours * 3600000 ||
        photo.capturedAt! - anchor.capturedAt! > 12 * 3600000
      )
        continue
      const aGps = validGps(anchor.gps?.latitude, anchor.gps?.longitude)
      const pGps = validGps(photo.gps?.latitude, photo.gps?.longitude)
      const distance = aGps && pGps ? distanceMeters(aGps, pGps) : undefined
      const visual = cosine(anchor.embedding, photo.embedding)
      if (distance !== undefined && distance > radiusKm * 1000) continue
      // With no common location, genuinely dissimilar images should be separate suggestions.
      if (distance === undefined && visual !== undefined && visual < similarity) continue
      match = group
      evidence = [
        '同日且相邻拍摄时间接近',
        ...(distance === undefined
          ? ['缺少共同位置，需确认事件']
          : [`距首张定位照片约 ${(distance / 1000).toFixed(1)} km`]),
        ...(visual === undefined
          ? ['未使用画面识别']
          : [visual >= similarity ? '画面特征相似' : '画面不同，时间与位置支持同一活动']),
      ]
      break
    }
    if (match) {
      match.candidate.photoIds.push(photo.id)
      match.candidate.reasons = [...new Set([...match.candidate.reasons, ...evidence])]
      match.candidate.needsReview ||= evidence.includes('缺少共同位置，需确认事件')
      match.last = photo
    } else {
      const date = new Date(photo.capturedAt!).toLocaleDateString('zh-CN')
      groups.push({
        anchor: photo,
        last: photo,
        candidate: {
          id: photo.id,
          title: `${date} · 事件 ${groups.length + 1}`,
          photoIds: [photo.id],
          reasons: ['以首张照片的拍摄时间为起点'],
          needsReview: true,
        },
      })
    }
  }
  const result = groups.map((g) => g.candidate)
  for (const photo of photos.filter((p) => !p.duplicateOf && !Number.isFinite(p.capturedAt))) {
    result.push({
      id: photo.id,
      title: '待确认时间 · ' + photo.filename,
      photoIds: [photo.id],
      reasons: ['没有可信拍摄时间，不用文件修改日期代替', '请补充时间或手动移入事件'],
      needsReview: true,
    })
  }
  return result
}
