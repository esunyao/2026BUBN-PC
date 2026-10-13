import type { Contribution, MemoryData, TimeEvidence } from '../../shared/memoryTypes'
import type {
  DiscoveryContext,
  DiscoveryDetector,
  DiscoveryFeedback,
  DiscoveryFinding,
  DiscoveryType,
  IndexedContribution,
} from './types'
const validTime = (time: TimeEvidence) =>
  ['exact', 'approximate'].includes(time.precision) &&
  typeof time.start === 'string' &&
  Number.isFinite(Date.parse(time.start ?? '')) &&
  ['exif', 'user', 'demo'].includes(time.source)
const key = (type: string, scope: string, ids: string[]) =>
  `${type}:${scope}:${[...ids].sort().join('~')}`
export function isVisible(
  c: Pick<Contribution, 'visibility' | 'participantId'>,
  viewer: string,
  members: string[],
): boolean {
  return (
    c.visibility === 'public' ||
    c.participantId === viewer ||
    (c.visibility !== 'private' && members.includes(viewer))
  )
}
export function indexMemory(
  data: MemoryData,
  eventId: string,
  viewerId: string,
  settings = { gapMinutes: 60, maxGapMinutes: 240, maxGaps: 3 },
): DiscoveryContext {
  const event = data.events.find((e) => e.id === eventId)
  const sceneMap = new Map(data.scenes.filter((s) => s.eventId === eventId).map((s) => [s.id, s]))
  const momentMap = new Map(
    data.moments.filter((m) => sceneMap.has(m.sceneId)).map((m) => [m.id, m]),
  )
  const contributions: IndexedContribution[] = []
  const byMoment = new Map<string, IndexedContribution[]>(),
    byScene = new Map<string, IndexedContribution[]>()
  for (const c of data.contributions) {
    const m = momentMap.get(c.momentId)
    if (!m || !isVisible(c, viewerId, event?.participantIds ?? [])) continue
    const time: TimeEvidence =
      c.timeEvidence ??
      (c.capturedAt
        ? { start: new Date(c.capturedAt).toISOString(), precision: 'exact', source: 'exif' }
        : { precision: 'unknown', source: c.isDemo ? 'demo' : 'user' })
    const item = { ...c, eventId, sceneId: m.sceneId, time }
    contributions.push(item)
    byMoment.set(m.id, [...(byMoment.get(m.id) ?? []), item])
    byScene.set(m.sceneId, [...(byScene.get(m.sceneId) ?? []), item])
  }
  return { data, eventId, viewerId, contributions, byMoment, byScene, settings }
}
function finding(
  ctx: DiscoveryContext,
  type: DiscoveryType,
  scope: string,
  evidence: IndexedContribution[],
  title: string,
  reason: string,
  codes: string[],
  time?: TimeEvidence,
): DiscoveryFinding {
  return {
    id: key(
      type,
      scope,
      evidence.map((c) => c.id),
    ),
    eventId: ctx.eventId,
    type,
    title,
    description: reason,
    evidenceIds: evidence.map((c) => c.id),
    participantIds: [...new Set(evidence.map((c) => c.participantId))],
    sceneIds: [...new Set(evidence.map((c) => c.sceneId))],
    timeRange: time,
    reasonCodes: codes,
    reason,
    confidenceBand: evidence.every((c) => validTime(c.time)) ? 'high' : 'medium',
    provenance: evidence.every((c) => c.isDemo) ? 'demo' : 'rule',
    detectorId: type,
    status: 'suggested',
  }
}
export const sameMomentDetector: DiscoveryDetector = {
  id: 'same_moment',
  detect(ctx) {
    const results: DiscoveryFinding[] = []
    const visible = new Map(ctx.contributions.map((c) => [c.id, c]))
    for (const link of ctx.data.links) {
      // If any curated evidence is inaccessible, do not reveal the existence or author count.
      if (!link.contributionIds.length || link.contributionIds.some((id) => !visible.has(id)))
        continue
      const photos = link.contributionIds
        .map((id) => visible.get(id)!)
        .filter((c) => c.kind === 'photo')
      if (
        new Set(photos.map((c) => c.contentHash ?? c.mediaUrl)).size < 2 ||
        new Set(photos.map((c) => c.participantId)).size < 2 ||
        new Set(photos.map((c) => c.sceneId)).size !== 1
      )
        continue
      if (!photos.every((c) => validTime(c.time))) continue
      const times = photos.map((c) => Date.parse(c.time.start!))
      if (Math.max(...times) - Math.min(...times) > 15 * 60000) continue
      results.push(
        finding(
          ctx,
          'shared_moment',
          link.id,
          photos,
          '同一个时刻，不同人的记录',
          link.reason,
          ['SAME_SCENE', 'TIME_OVERLAP', 'CURATED_LINK'],
          photos[0]?.time,
        ),
      )
    }
    // New local contributions share a user-assigned moment; compare only trusted timestamps.
    for (const [momentId, records] of ctx.byMoment) {
      const photos = records.filter((c) => c.kind === 'photo' && validTime(c.time))
      const own = photos.find((c) => c.participantId === ctx.viewerId)
      const other = photos.find(
        (c) =>
          c.participantId !== ctx.viewerId &&
          own &&
          (c.contentHash ?? c.mediaUrl) !== (own.contentHash ?? own.mediaUrl) &&
          Math.abs(Date.parse(own.time.start!) - Date.parse(c.time.start!)) <= 15 * 60000,
      )
      if (
        !own ||
        !other ||
        own.mediaUrl === other.mediaUrl ||
        results.some((f) => f.evidenceIds.includes(own.id) && f.evidenceIds.includes(other.id))
      )
        continue
      if (Math.abs(Date.parse(own.time.start!) - Date.parse(other.time.start!)) > 15 * 60000)
        continue
      results.push(
        finding(
          ctx,
          'shared_moment',
          momentId,
          [own, other],
          '同一窗口中的两个视角',
          '同一个手动指定的时刻，可信时间相近；这不是同一秒的断言。',
          ['SAME_SCENE', 'TIME_OVERLAP'],
          own.time,
        ),
      )
    }
    return results
  },
}
export const unseenDetector: DiscoveryDetector = {
  id: 'unseen',
  detect(ctx) {
    return sameMomentDetector.detect(ctx).flatMap((shared) => {
      const records = shared.evidenceIds.map((id) => ctx.contributions.find((c) => c.id === id)!)
      const own = records.find((c) => c.participantId === ctx.viewerId)
      if (!own) return []
      return records
        .filter(
          (c) =>
            c.participantId !== ctx.viewerId &&
            (c.contentHash ?? c.mediaUrl) !== (own.contentHash ?? own.mediaUrl),
        )
        .slice(0, 1)
        .map((other) => {
          const tagged = other.tagsConsent === true && other.participantTags?.includes(ctx.viewerId)
          const f = finding(
            ctx,
            'unseen_moment',
            `${own.momentId}-${ctx.viewerId}`,
            [own, other],
            tagged
              ? '你被自愿标注在另一人的照片中'
              : `在你的相册之外：${ctx.data.moments.find((m) => m.id === other.momentId)?.title ?? '另一张照片'}`,
            '判据是上传归属：这一张由另一位参与者上传。我们并不知道你现实中是否看过它。' +
              (tagged ? '身份来自经同意的用户标注，未使用人脸识别。' : ''),
            ['SAME_SCENE', 'TIME_OVERLAP', 'OTHER_OWNER', ...(tagged ? ['TAGGED_PERSON'] : [])],
            shared.timeRange,
          )
          f.reason += ` ${shared.reason}`
          return f
        })
    })
  },
}
function localParts(iso: string) {
  const date = new Date(Date.parse(iso) + 8 * 3600000)
  return { day: date.toISOString().slice(0, 10), hour: date.getUTCHours() }
}
export const gapDetector: DiscoveryDetector = {
  id: 'gap',
  detect(ctx) {
    const event = ctx.data.events.find((e) => e.id === ctx.eventId)
    if (!event?.startAt || !event.endAt) return []
    const start = Date.parse(event.startAt),
      end = Date.parse(event.endAt)
    if (!Number.isFinite(start) || !Number.isFinite(end)) return []
    const results: DiscoveryFinding[] = []
    for (const [sceneId, records] of ctx.byScene) {
      const byTime = new Map<number, IndexedContribution>()
      for (const c of records)
        if (c.kind === 'photo' && validTime(c.time)) {
          const timestamp = Date.parse(c.time.start!)
          if (timestamp >= start && timestamp <= end && !byTime.has(timestamp))
            byTime.set(timestamp, c)
        }
      const sorted = [...byTime.entries()].sort((a, b) => a[0] - b[0])
      for (let i = 1; i < sorted.length; i++) {
        const [a, before] = sorted[i - 1]!,
          [b, after] = sorted[i]!
        const minutes = (b - a) / 60000,
          pa = localParts(before.time.start!),
          pb = localParts(after.time.start!)
        if (
          minutes < ctx.settings.gapMinutes ||
          minutes > ctx.settings.maxGapMinutes ||
          pa.day !== pb.day ||
          pa.hour < 7 ||
          pb.hour > 22
        )
          continue
        const gapId = `gap-${sceneId}-${before.momentId}-${after.momentId}`
        const f = finding(
          ctx,
          'missing_piece',
          gapId,
          [before, after],
          '这段时间，没有照片记录',
          '相邻的同日可信记录之间相隔约 ' +
            Math.round(minutes) +
            ' 分钟。没有照片不代表发生了重要事情；这只是一个可选择补写的记录间隙。',
          ['BOUNDED_EVENT', 'GAP_BETWEEN_RECORDS', 'SAME_DAY'],
          {
            start: before.time.start,
            end: after.time.start,
            precision: 'approximate',
            source: before.isDemo && after.isDemo ? 'demo' : 'user',
          },
        )
        f.id = `missing_piece:${gapId}`
        f.gapId = gapId
        f.originMomentIds = [before.momentId, after.momentId]
        // Include only visible saved notes; their words and author counts cannot leak private data.
        const notes = ctx.contributions.filter(
          (c) => ctx.data.moments.find((m) => m.id === c.momentId)?.originGapId === gapId,
        )
        f.evidenceIds.push(...notes.map((c) => c.id))
        f.participantIds = [...new Set([...f.participantIds, ...notes.map((c) => c.participantId)])]
        results.push(f)
      }
    }
    return results
      .sort(
        (a, b) =>
          Date.parse(a.timeRange!.end!) -
          Date.parse(a.timeRange!.start!) -
          (Date.parse(b.timeRange!.end!) - Date.parse(b.timeRange!.start!)),
      )
      .slice(0, ctx.settings.maxGaps)
  },
}
export const evolutionDetector: DiscoveryDetector = {
  id: 'scene_evolution',
  detect(ctx) {
    return ctx.data.pairs.flatMap((pair) => {
      const before = ctx.contributions.find((c) => c.id === pair.beforeContributionId),
        after = ctx.contributions.find((c) => c.id === pair.afterContributionId)
      if (
        !before ||
        !after ||
        before.sceneId !== after.sceneId ||
        !validTime(before.time) ||
        !validTime(after.time) ||
        Date.parse(before.time.start!) === Date.parse(after.time.start!)
      )
        return []
      const f = finding(
        ctx,
        'then_now',
        pair.id,
        [before, after],
        '时间，让这一章有了变化',
        '来自同一手工关联场景的两个阶段。' +
          (pair.comparisonMode === 'sideBySide'
            ? '机位不同，采用并排对照。' +
              (before.isDemo || after.isDemo ? 'Demo 不代表同一地点实拍。' : '')
            : '已明确标为同构图对比。'),
        ['SAME_SCENE', 'DIFFERENT_PHASE'],
        {
          start: before.time.start,
          end: after.time.start,
          precision: 'approximate',
          source: before.isDemo && after.isDemo ? 'demo' : 'user',
        },
      )
      f.pairId = pair.id
      return [f]
    })
  },
}
export const backstageDetector: DiscoveryDetector = {
  id: 'backstage',
  detect(ctx) {
    const before = ctx.contributions.find((c) => c.analysis?.phaseTags?.includes('planning'))
    const after = ctx.contributions.find((c) => c.analysis?.phaseTags?.includes('performance'))
    return before && after
      ? [
          finding(
            ctx,
            'behind_spotlight',
            ctx.eventId,
            [before, after],
            '掌声之前',
            '依据用户或 Demo 的筹备 / 演出阶段标注回看准备与演出，不推断个人劳动贡献或情绪。',
            ['MANUAL_PHASE_TAGS', 'SAME_EVENT'],
          ),
        ]
      : []
  },
}
export const threadDetector: DiscoveryDetector = {
  id: 'object_thread',
  detect(ctx) {
    const tags = new Map<string, IndexedContribution[]>()
    const generic = new Set([
      'person',
      'people',
      'human',
      'face',
      '人物',
      '人',
      '人脸',
      '照片',
      'image',
      'photo',
    ])
    for (const c of ctx.contributions) {
      if (c.kind !== 'photo' || (!c.isDemo && c.analysis?.source !== 'user')) continue
      for (const tag of new Set(
        (c.analysis?.objects ?? [])
          .slice(0, 12)
          .map((t) => t.normalize('NFKC').trim().toLowerCase().slice(0, 40)),
      )) {
        if (!tag || generic.has(tag)) continue
        tags.set(tag, [...(tags.get(tag) ?? []), c])
      }
    }
    const results: DiscoveryFinding[] = []
    for (const [tag, records] of [...tags].sort(([a], [b]) => a.localeCompare(b))) {
      const evidence = [...new Map(records.map((c) => [c.sceneId, c])).values()].slice(0, 4)
      if (
        evidence.length < 2 ||
        new Set(evidence.map((c) => c.contentHash ?? c.mediaUrl ?? c.id)).size < 2
      )
        continue
      const f = finding(
        ctx,
        'memory_thread',
        tag,
        evidence,
        `沿着「${tag}」再走一遍`,
        '不同事件中出现了相同的物品或道具标注。它们可能属于同一条线索，仍需你确认；没有自动推断人物身份。',
        ['EXPLICIT_OBJECT_TAG', 'CROSS_SCENE'],
      )
      f.provenance = evidence.every((c) => c.isDemo) ? 'demo' : 'user'
      f.confidenceBand = 'medium'
      results.push(f)
      if (results.length >= 8) break
    }
    return results
  },
}
export const registry: DiscoveryDetector[] = [
  sameMomentDetector,
  unseenDetector,
  gapDetector,
  evolutionDetector,
  backstageDetector,
  threadDetector,
]
export function discover(
  data: MemoryData,
  eventId: string,
  viewerId: string,
  feedback: Record<string, DiscoveryFeedback> = {},
  includeDismissed = false,
  settings?: DiscoveryContext['settings'],
): DiscoveryFinding[] {
  const ctx = indexMemory(data, eventId, viewerId, settings)
  const unique = new Map<string, DiscoveryFinding>()
  for (const detector of registry)
    for (const f of detector.detect(ctx)) {
      if (f.evidenceIds.some((id) => !ctx.contributions.some((c) => c.id === id))) continue
      const signature = f.gapId
        ? `${f.type}:${f.gapId}`
        : key(f.type, f.sceneIds.sort().join(','), f.evidenceIds)
      if (unique.has(signature)) continue
      const mark = feedback[`${viewerId}:${f.id}`]
      f.status = mark?.status ?? f.status
      if (f.status !== 'dismissed' || includeDismissed) unique.set(signature, f)
    }
  const score = (f: DiscoveryFinding) =>
    (f.type === 'unseen_moment' ? 100 : f.type === 'missing_piece' ? 90 : 50) +
    (f.confidenceBand === 'high' ? 10 : 0) +
    (f.participantIds.includes(viewerId) ? 5 : 0)
  return [...unique.values()].sort((a, b) => score(b) - score(a) || a.id.localeCompare(b.id))
}
