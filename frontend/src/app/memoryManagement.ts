import type { MemoryData, MemoryManagementAction, EnvironmentRecipe } from '../shared/memoryTypes'

/** Mutate only after validating a complete command; application owns persistence and undo. */
export function manageMemory(
  data: MemoryData,
  eventId: string,
  viewerId: string,
  action: MemoryManagementAction,
  recipes: Record<string, EnvironmentRecipe>,
) {
  const chapter = data.events.find((e) => e.id === eventId)
  if (!chapter || !chapter.participantIds.includes(viewerId))
    throw new Error('请选择篇章中的记录者。')
  const scenes = data.scenes.filter((s) => s.eventId === eventId)
  const moments = data.moments.filter((m) => scenes.some((s) => s.id === m.sceneId))
  const clean = (value: string, max: number) => value.trim().slice(0, max)
  const title = (value: string) => {
    const text = clean(value, 100)
    if (!text) throw new Error('标题不能为空。')
    return text
  }
  const timestamp = (value: string) => {
    const date = Date.parse(value)
    if (!Number.isFinite(date)) throw new Error('请填写有效时间。')
    return new Date(date).toISOString()
  }
  const sort = () =>
    scenes.forEach((s) =>
      s.momentIds.sort(
        (a, b) =>
          Date.parse(data.moments.find((m) => m.id === a)!.startAt) -
          Date.parse(data.moments.find((m) => m.id === b)!.startAt),
      ),
    )
  switch (action.type) {
    case 'chapter': {
      chapter.title = title(action.title)
      chapter.subtitle = clean(action.subtitle, 1000)
      delete chapter.copySource
      break
    }
    case 'person': {
      const name = title(action.name)
      if (!/^#[\da-f]{6}$/i.test(action.color)) throw new Error('请选择有效颜色。')
      const person = action.id
        ? data.participants.find((p) => p.id === action.id && chapter.participantIds.includes(p.id))
        : undefined
      if (action.id && !person) throw new Error('记录者不属于这个篇章。')
      if (person) {
        person.displayName = name
        person.color = action.color
      } else {
        const id = crypto.randomUUID()
        data.participants.push({ id, displayName: name, color: action.color })
        chapter.participantIds.push(id)
      }
      break
    }
    case 'scene': {
      const name = title(action.title),
        recipe = recipes[action.preset]
      if (!recipe) throw new Error('请选择有效环境。')
      const scene = action.id ? scenes.find((s) => s.id === action.id) : undefined
      if (action.id && !scene) throw new Error('事件不属于这个篇章。')
      if (scene) {
        scene.title = name
        scene.subtitle = clean(action.subtitle, 1000)
        scene.environment = JSON.parse(JSON.stringify(recipe)) as EnvironmentRecipe
        delete scene.copySource
      } else {
        const id = crypto.randomUUID()
        data.scenes.push({
          id,
          eventId,
          title: name,
          subtitle: clean(action.subtitle, 1000),
          momentIds: [],
          environment: JSON.parse(JSON.stringify(recipe)) as EnvironmentRecipe,
        })
        chapter.sceneIds.push(id)
      }
      break
    }
    case 'moment': {
      const scene = scenes.find((s) => s.id === action.sceneId),
        name = title(action.title),
        startAt = timestamp(action.startAt)
      const moment = action.id
        ? moments.find((m) => m.id === action.id && m.sceneId === action.sceneId && !m.originGapId)
        : undefined
      if (!scene || (action.id && !moment)) throw new Error('请选择此篇章中的普通时刻。')
      if (!['morning', 'golden-hour', 'overcast', 'night', 'stage-warm'].includes(action.lighting))
        throw new Error('请选择有效光线。')
      const label = new Date(startAt).toLocaleString('zh-CN')
      if (moment) {
        moment.title = name
        moment.startAt = startAt
        moment.label = label
        moment.lighting = action.lighting
      } else {
        const id = crypto.randomUUID()
        data.moments.push({
          id,
          sceneId: scene.id,
          title: name,
          startAt,
          label,
          lighting: action.lighting,
          contributionIds: [],
        })
        scene.momentIds.push(id)
      }
      sort()
      break
    }
    case 'record': {
      const record = data.contributions.find(
        (c) => c.id === action.id && moments.some((m) => m.id === c.momentId),
      )
      const destination = moments.find((m) => m.id === action.momentId && !m.originGapId)
      if (!record || record.participantId !== viewerId)
        throw new Error('只能修改当前记录者自己的记录。')
      if (!destination || data.moments.find((m) => m.id === record.momentId)?.originGapId)
        throw new Error('空白片段请在记忆发现中编辑；普通记录可移动至篇章内的时刻。')
      if (!['private', 'event-members', 'public'].includes(action.visibility))
        throw new Error('请选择可见范围。')
      const time = action.time ? timestamp(action.time) : undefined
      const objects = [
        ...new Set(action.objects.map((v) => clean(v.normalize('NFKC'), 40)).filter(Boolean)),
      ].slice(0, 12)
      const tags = action.tagsConsent
        ? [...new Set(action.participantTags.filter((id) => chapter.participantIds.includes(id)))]
        : []
      if (record.momentId !== destination.id) {
        data.moments.forEach(
          (m) => (m.contributionIds = m.contributionIds.filter((id) => id !== record.id)),
        )
        destination.contributionIds.push(record.id)
        record.momentId = destination.id
        data.links = data.links
          .map((l) => ({
            ...l,
            contributionIds: l.contributionIds.filter((id) => id !== record.id),
          }))
          .filter((l) => l.contributionIds.length >= 2)
        data.pairs = data.pairs.filter(
          (p) => ![p.beforeContributionId, p.afterContributionId].includes(record.id),
        )
      }
      record.writtenText = action.text.slice(0, 2000)
      if (record.generatedCaption !== clean(action.generatedCaption, 500))
        record.captionSource = 'user'
      record.generatedCaption = clean(action.generatedCaption, 500)
      record.analysis = {
        ...record.analysis,
        sceneTags: record.analysis?.sceneTags ?? [],
        activities: record.analysis?.activities ?? [],
        objects,
        phaseTags: action.phase ? [action.phase] : [],
        source: 'user',
      }
      record.visibility = action.visibility
      record.participantTags = tags
      record.tagsConsent = action.tagsConsent
      if (time) record.timeEvidence = { start: time, precision: 'exact', source: 'user' } // Original EXIF remains capturedAt.
      record.isDemo = false
      break
    }
    case 'remove-record': {
      const record = data.contributions.find(
        (c) => c.id === action.id && moments.some((m) => m.id === c.momentId),
      )
      if (!record || record.participantId !== viewerId) throw new Error('只能移除自己的记录。')
      data.contributions = data.contributions.filter((c) => c.id !== record.id)
      data.moments.forEach(
        (m) => (m.contributionIds = m.contributionIds.filter((id) => id !== record.id)),
      )
      data.links = data.links
        .map((l) => ({ ...l, contributionIds: l.contributionIds.filter((id) => id !== record.id) }))
        .filter((l) => l.contributionIds.length >= 2)
      data.pairs = data.pairs.filter(
        (p) => ![p.beforeContributionId, p.afterContributionId].includes(record.id),
      )
      break
    }
    case 'pair': {
      const before = data.contributions.find((c) => c.id === action.before && c.kind === 'photo'),
        after = data.contributions.find((c) => c.id === action.after && c.kind === 'photo')
      const a = moments.find((m) => m.id === before?.momentId),
        b = moments.find((m) => m.id === after?.momentId)
      if (!before || !after || before.id === after.id || !a || !b || a.sceneId !== b.sceneId)
        throw new Error('请选择同一事件中的两张不同照片。')
      if ([before, after].some((c) => c.visibility === 'private' && c.participantId !== viewerId))
        throw new Error('无法关联不可见照片。')
      if (
        data.pairs.some(
          (p) => p.beforeContributionId === before.id && p.afterContributionId === after.id,
        )
      )
        throw new Error('这组对照已经存在。')
      data.pairs.push({
        id: crypto.randomUUID(),
        sceneId: a.sceneId,
        beforeContributionId: before.id,
        afterContributionId: after.id,
        comparisonMode: action.aligned ? 'wipe' : 'sideBySide',
      })
      break
    }
    case 'remove-pair': {
      data.pairs = data.pairs.filter(
        (p) => !(p.id === action.id && scenes.some((s) => s.id === p.sceneId)),
      )
      break
    }
  }
  const knownTimes = data.contributions
    .filter((c) => moments.some((m) => m.id === c.momentId))
    .flatMap((c) => {
      const t =
        c.timeEvidence?.precision !== 'unknown' ? Date.parse(c.timeEvidence?.start ?? '') : NaN
      return Number.isFinite(t) ? [t] : []
    })
  if (knownTimes.length) {
    chapter.startAt = new Date(Math.min(...knownTimes)).toISOString()
    chapter.endAt = new Date(Math.max(...knownTimes)).toISOString()
  }
}
