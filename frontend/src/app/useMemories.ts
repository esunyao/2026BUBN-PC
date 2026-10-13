import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import type {
  Contribution,
  MemoryData,
  ViewMode,
  EnvironmentPreset,
  SharedMomentLink,
} from '../shared/memoryTypes'
import { createMemoryDemo, presets } from './memoryDemo'
import { readMedia, storeMedia, storeMediaBatch } from '../shared/lib/memoryStorage'
import type { AnalyzedPhoto } from '../features/import/photoAnalysis'
import type { EventCandidate } from '../features/import/eventGrouping'
import { buildChapterImport } from '../features/import/chapterImport'
import { isVisible } from '../features/discovery/engine'
import { importPhotos } from '../features/import/importPhotos'
import { manageMemory } from './memoryManagement'
import type { MemoryManagementAction } from '../shared/memoryTypes'
import {
  packMemoryBackup,
  unpackMemoryBackup,
  portableMetadata,
} from '../features/import/memoryBackup'
import type { FullMemoryBackup } from '../features/import/memoryBackup'

const STORAGE = 'shared-memories-v1'
export function validateArchive(value: unknown): value is MemoryData {
  if (!value || typeof value !== 'object') return false
  const d = value as MemoryData
  if (
    !['participants', 'events', 'scenes', 'moments', 'contributions', 'links', 'pairs'].every(
      (key) => Array.isArray((d as unknown as Record<string, unknown>)[key]),
    )
  )
    return false
  const unique = (rows: Array<{ id: string }>) =>
    rows.every((r) => r && typeof r.id === 'string' && /^[\w-]+$/.test(r.id)) &&
    new Set(rows.map((r) => r.id)).size === rows.length
  if (
    ![d.participants, d.events, d.scenes, d.moments, d.contributions, d.links, d.pairs].every(
      unique,
    )
  )
    return false
  const ids = (rows: Array<{ id: string }>) => new Set(rows.map((r) => r.id))
  const people = ids(d.participants),
    events = ids(d.events),
    scenes = ids(d.scenes),
    moments = ids(d.moments),
    contributions = ids(d.contributions)
  const validMediaMeta = (c: Partial<Contribution>) =>
    (c.generatedCaption === undefined || typeof c.generatedCaption === 'string') &&
    (c.originalFileId === undefined || typeof c.originalFileId === 'string') &&
    (c.contentHash === undefined ||
      (typeof c.contentHash === 'string' && /^[a-f0-9]{64}$/.test(c.contentHash))) &&
    (c.visibility === undefined || ['private', 'event-members', 'public'].includes(c.visibility)) &&
    (c.tagsConsent === undefined || typeof c.tagsConsent === 'boolean')
  const pending = d.pendingPhotos ?? []
  if (
    !Array.isArray(pending) ||
    !unique(pending) ||
    pending.some(
      (p) =>
        !validMediaMeta(p) ||
        !events.has(p.eventId) ||
        !people.has(p.participantId) ||
        contributions.has(p.id) ||
        typeof p.alt !== 'string' ||
        typeof p.reason !== 'string' ||
        !Array.isArray(p.mood) ||
        p.mood.some((m) => typeof m !== 'string') ||
        (p.fileId !== undefined && typeof p.fileId !== 'string') ||
        (p.originalFileId !== undefined && typeof p.originalFileId !== 'string') ||
        (p.capturedAt !== undefined && !Number.isFinite(p.capturedAt)) ||
        (p.mediaUrl && !/^\/demo-assets\/[\w.-]+$/.test(p.mediaUrl)),
    )
  )
    return false
  return (
    d.participants.every(
      (p) => typeof p.displayName === 'string' && /^#[\da-f]{6}$/i.test(p.color),
    ) &&
    d.events.every(
      (e) =>
        typeof e.title === 'string' &&
        typeof e.subtitle === 'string' &&
        ['trip', 'longActivity'].includes(e.type) &&
        Array.isArray(e.sceneIds) &&
        e.sceneIds.every((id) => scenes.has(id)) &&
        Array.isArray(e.participantIds) &&
        e.participantIds.every((id) => people.has(id)),
    ) &&
    d.scenes.every(
      (s) =>
        events.has(s.eventId) &&
        typeof s.title === 'string' &&
        Array.isArray(s.momentIds) &&
        s.momentIds.every((id) => moments.has(id)) &&
        s.environment &&
        Object.hasOwn(presets, s.environment.preset),
    ) &&
    d.moments.every(
      (m) =>
        scenes.has(m.sceneId) &&
        typeof m.title === 'string' &&
        typeof m.label === 'string' &&
        Number.isFinite(Date.parse(m.startAt)) &&
        Array.isArray(m.contributionIds) &&
        m.contributionIds.every((id) => contributions.has(id)),
    ) &&
    d.contributions.every(
      (c) =>
        validMediaMeta(c) &&
        moments.has(c.momentId) &&
        people.has(c.participantId) &&
        ['photo', 'note'].includes(c.kind) &&
        typeof c.alt === 'string' &&
        (c.writtenText === undefined || typeof c.writtenText === 'string') &&
        Array.isArray(c.mood) &&
        c.mood.every((m) => typeof m === 'string') &&
        (!c.mediaUrl || /^\/demo-assets\/[\w.-]+$/.test(c.mediaUrl)) &&
        (!c.thumbnailUrl || /^\/demo-assets\/[\w.-]+$/.test(c.thumbnailUrl)) &&
        (c.fileId === undefined || typeof c.fileId === 'string') &&
        (c.capturedAt === undefined || Number.isFinite(c.capturedAt)) &&
        (!c.analysis ||
          [
            c.analysis.sceneTags,
            c.analysis.objects,
            c.analysis.activities,
            ...(c.analysis.phaseTags ? [c.analysis.phaseTags] : []),
          ].every(
            (items) => Array.isArray(items) && items.every((item) => typeof item === 'string'),
          )) &&
        (!c.timeEvidence ||
          (['exact', 'approximate', 'date-only', 'unknown'].includes(c.timeEvidence.precision) &&
            ['exif', 'user', 'demo', 'vision-model'].includes(c.timeEvidence.source) &&
            (c.timeEvidence.start === undefined ||
              (typeof c.timeEvidence.start === 'string' &&
                Number.isFinite(Date.parse(c.timeEvidence.start)))) &&
            (c.timeEvidence.end === undefined ||
              (typeof c.timeEvidence.end === 'string' &&
                Number.isFinite(Date.parse(c.timeEvidence.end)))))) &&
        (!c.participantTags ||
          (Array.isArray(c.participantTags) && c.participantTags.every((id) => people.has(id)))) &&
        (!c.visibility || ['private', 'event-members', 'public'].includes(c.visibility)) &&
        (!c.gps || (Number.isFinite(c.gps.latitude) && Number.isFinite(c.gps.longitude))),
    ) &&
    d.links.every(
      (l) =>
        Array.isArray(l.momentIds) &&
        l.momentIds.every((id) => moments.has(id)) &&
        Array.isArray(l.contributionIds) &&
        l.contributionIds.every((id) => contributions.has(id)) &&
        typeof l.reason === 'string' &&
        Number.isFinite(l.confidence),
    ) &&
    d.pairs.every(
      (p) =>
        scenes.has(p.sceneId) &&
        contributions.has(p.beforeContributionId) &&
        contributions.has(p.afterContributionId) &&
        ['wipe', 'sideBySide'].includes(p.comparisonMode),
    )
  )
}
export function useMemories() {
  const data = ref<MemoryData>(createMemoryDemo())
  const notice = ref(''),
    loading = ref(true)
  try {
    const saved = localStorage.getItem(STORAGE)
    if (saved) {
      const parsed: unknown = JSON.parse(saved)
      if (validateArchive(parsed)) data.value = parsed
      else notice.value = '本地存档格式无法读取，已打开示例。'
    }
  } catch {
    notice.value = '无法读取本地存档；当前仍可体验示例。'
  }
  data.value.pendingPhotos ??= []
  const latest = createMemoryDemo()
  for (const e of data.value.events.filter((e) => e.isDemo)) {
    const seed = latest.events.find((v) => v.id === e.id)
    if (!seed) continue
    e.startAt ??= seed.startAt
    e.endAt ??= seed.endAt
    for (const sceneId of e.sceneIds) {
      const existingScene = data.value.scenes.find((s) => s.id === sceneId),
        seedScene = latest.scenes.find((s) => s.id === sceneId)
      if (!existingScene || !seedScene) continue
      for (const id of seedScene.momentIds)
        if (!existingScene.momentIds.includes(id)) {
          existingScene.momentIds.push(id)
          const m = latest.moments.find((m) => m.id === id)!
          data.value.moments.push(m)
          data.value.contributions.push(...latest.contributions.filter((c) => c.momentId === id))
          data.value.links.push(...latest.links.filter((l) => l.momentIds.includes(id)))
        }
      existingScene.momentIds.sort(
        (a, b) =>
          Date.parse(data.value.moments.find((m) => m.id === a)!.startAt) -
          Date.parse(data.value.moments.find((m) => m.id === b)!.startAt),
      )
    }
  }
  for (const c of data.value.contributions.filter((c) => c.isDemo)) {
    const seed = latest.contributions.find((v) => v.id === c.id)
    if (seed) {
      c.timeEvidence ??= seed.timeEvidence
      c.analysis ??= seed.analysis
      c.visibility ??= 'event-members'
    }
  }
  // Recipes are trusted local presets; uploaded JSON cannot inject CSS or URLs.
  data.value.scenes.forEach((s) => (s.environment = structuredClone(presets[s.environment.preset])))
  const state = reactive({
    activeEventId: '',
    activeSceneId: '',
    activeMomentId: '',
    activeParticipantId: 'all',
    viewMode: 'scene' as ViewMode,
    activeContributionId: '',
    isPlaying: false,
    playbackSpeed: 1,
    currentViewerId: 'a',
    selectedFindingId: '',
    photoCursor: 0,
    page: 'home' as 'home' | 'event' | 'scene' | 'discover',
    themeOverride: '' as EnvironmentPreset | '',
  })
  const event = computed(() => data.value.events.find((e) => e.id === state.activeEventId))
  const scene = computed(() => data.value.scenes.find((s) => s.id === state.activeSceneId))
  const moments = computed(() =>
    (scene.value?.momentIds ?? [])
      .map((id) => data.value.moments.find((m) => m.id === id))
      .filter(
        (m): m is NonNullable<typeof m> =>
          !!m &&
          (!m.originGapId ||
            data.value.contributions.some(
              (c) =>
                c.momentId === m.id &&
                isVisible(c, state.currentViewerId, event.value?.participantIds ?? []),
            )),
      ),
  )
  const moment = computed(() => moments.value.find((m) => m.id === state.activeMomentId))
  const current = computed(() =>
    data.value.contributions.filter(
      (c) =>
        c.momentId === state.activeMomentId &&
        isVisible(c, state.currentViewerId, event.value?.participantIds ?? []),
    ),
  )
  const visible = computed(() =>
    current.value.filter(
      (c) => state.activeParticipantId === 'all' || c.participantId === state.activeParticipantId,
    ),
  )
  const active = computed(
    () =>
      current.value.find((c) => c.id === state.activeContributionId) ??
      visible.value.find((c) => c.kind === 'photo'),
  )
  const link = computed<SharedMomentLink | undefined>(() => {
    const curated = data.value.links.find(
      (l) =>
        l.contributionIds.includes(active.value?.id ?? '') &&
        l.momentIds.includes(state.activeMomentId) &&
        l.contributionIds.every((id) => current.value.some((c) => c.id === id)),
    )
    if (curated) return curated
    const anchor = active.value
    if (
      !anchor ||
      anchor.kind !== 'photo' ||
      !['exif', 'user', 'demo'].includes(anchor.timeEvidence?.source ?? '') ||
      !['exact', 'approximate'].includes(anchor.timeEvidence?.precision ?? '')
    )
      return
    const time = Date.parse(anchor.timeEvidence?.start ?? '')
    if (!Number.isFinite(time)) return
    const seen = new Set<string>([anchor.participantId])
    const photos = [
      anchor,
      ...current.value.filter((c) => {
        if (
          c.kind !== 'photo' ||
          seen.has(c.participantId) ||
          (anchor.contentHash && c.contentHash === anchor.contentHash) ||
          c.mediaUrl === anchor.mediaUrl ||
          !['exact', 'approximate'].includes(c.timeEvidence?.precision ?? '') ||
          !['exif', 'user', 'demo'].includes(c.timeEvidence?.source ?? '')
        )
          return false
        const difference = Math.abs(Date.parse(c.timeEvidence?.start ?? '') - time)
        if (!Number.isFinite(difference) || difference > 15 * 60000) return false
        seen.add(c.participantId)
        return true
      }),
    ]
    if (photos.length < 2) return
    return {
      id: `local-${state.activeMomentId}`,
      momentIds: [state.activeMomentId],
      contributionIds: photos.map((c) => c.id),
      relation: 'sameMoment',
      reason: '用户收录到同一时刻、可信时间相差不超过15分钟的不同记录者视角。',
      confidence: 0.75,
    }
  })
  const activePairId = ref('')
  const scenePairs = computed(() =>
    data.value.pairs.filter(
      (p) =>
        p.sceneId === state.activeSceneId &&
        [p.beforeContributionId, p.afterContributionId].every((id) =>
          data.value.contributions.some(
            (c) =>
              c.id === id && isVisible(c, state.currentViewerId, event.value?.participantIds ?? []),
          ),
        ),
    ),
  )
  const pair = computed(
    () => scenePairs.value.find((p) => p.id === activePairId.value) ?? scenePairs.value[0],
  )
  const managementUndo = ref<MemoryData>()
  function manage(action: MemoryManagementAction) {
    const previous = JSON.parse(JSON.stringify(data.value)) as MemoryData
    manageMemory(data.value, state.activeEventId, state.currentViewerId, action, presets)
    managementUndo.value = previous
    if (!data.value.contributions.some((c) => c.id === state.activeContributionId))
      state.activeContributionId = ''
    notice.value = '修改已保存，可撤销上一步。'
  }
  async function undoManagement() {
    if (!managementUndo.value) return
    data.value = managementUndo.value
    managementUndo.value = undefined
    await hydrate()
    if (state.activeEventId && !data.value.events.some((e) => e.id === state.activeEventId))
      navigate('home')
    notice.value = '已撤销上一步编辑。'
  }
  const environmentRecipe = computed(() => ({
    ...(state.themeOverride
      ? presets[state.themeOverride]
      : (scene.value?.environment ?? presets.neutral)),
    lighting: moment.value?.lighting ?? 'golden-hour',
    backgroundPhotoId: visible.value.find((c) => c.mediaUrl)?.id,
  }))
  const objectURLs = new Set<string>()
  let clock: ReturnType<typeof setInterval> | undefined
  function persist() {
    try {
      const archive = structuredClone(JSON.parse(JSON.stringify(data.value)) as MemoryData)
      ;[...archive.contributions, ...(archive.pendingPhotos ?? [])].forEach((c) => {
        if (c.fileId) delete c.mediaUrl
      })
      localStorage.setItem(STORAGE, JSON.stringify(archive))
    } catch {
      notice.value = '存储空间不足或浏览器禁止保存；请导出文字备份。'
    }
  }
  watch(data, persist, { deep: true })
  function selectMoment(id: string) {
    const m = data.value.moments.find((item) => item.id === id)
    if (!m) return
    const s = data.value.scenes.find((item) => item.id === m.sceneId)
    if (!s) return
    state.activeSceneId = s.id
    state.activeEventId = s.eventId
    state.activeMomentId = id
    state.activeContributionId = ''
    state.page = 'scene'
  }
  function syncURL(replace = false) {
    const path =
      state.page === 'home'
        ? '/'
        : `/events/${state.activeEventId}${state.page === 'discover' ? `/discover${state.selectedFindingId ? '?finding=' + encodeURIComponent(state.selectedFindingId) : ''}` : state.page === 'scene' ? `/scenes/${state.activeSceneId}?moment=${state.activeMomentId}` : ''}`
    history[replace ? 'replaceState' : 'pushState']({ memoryView: { ...state } }, '', path)
  }
  function navigate(
    page: 'home' | 'event' | 'scene' | 'discover',
    eventId = state.activeEventId,
    sceneId = state.activeSceneId,
  ) {
    state.isPlaying = false
    state.viewMode = 'scene'
    state.page = page
    state.activeEventId = eventId
    const members = data.value.events.find((e) => e.id === eventId)?.participantIds
    if (members?.length && !members.includes(state.currentViewerId))
      state.currentViewerId = members[0]!
    state.themeOverride = ''
    if (page === 'scene') {
      const s = data.value.scenes.find((s) => s.id === sceneId)
      if (s?.momentIds[0]) selectMoment(s.momentIds[s.id === 'coast' ? 2 : 0] ?? s.momentIds[0])
      else {
        state.activeSceneId = sceneId
        state.activeMomentId = ''
      }
    }
    syncURL()
  }
  function restoreURL() {
    const parts = location.pathname.split('/').filter(Boolean)
    state.isPlaying = false
    state.viewMode = 'scene'
    if (parts[0] === 'events' && data.value.events.some((e) => e.id === parts[1])) {
      state.activeEventId = parts[1]!
      const members = data.value.events.find((e) => e.id === parts[1])!.participantIds
      if (members.length && !members.includes(state.currentViewerId))
        state.currentViewerId = members[0]!
      state.page = parts[2] === 'discover' ? 'discover' : 'event'
      state.selectedFindingId = new URLSearchParams(location.search).get('finding') ?? ''
      const s = data.value.scenes.find((s) => s.eventId === parts[1] && s.id === parts[3])
      if (s) {
        state.activeSceneId = s.id
        state.page = 'scene'
        const id = new URLSearchParams(location.search).get('moment')
        selectMoment(s.momentIds.includes(id ?? '') ? id! : (s.momentIds[0] ?? ''))
      }
    } else state.page = 'home'
    const saved = history.state?.memoryView
    if (saved && saved.page === state.page && saved.activeEventId === state.activeEventId) {
      state.activeParticipantId = saved.activeParticipantId ?? 'all'
      state.activeContributionId = saved.activeContributionId ?? ''
      state.themeOverride = saved.themeOverride ?? ''
      state.currentViewerId = saved.currentViewerId ?? 'a'
      state.photoCursor = saved.photoCursor ?? 0
    }
  }
  function chooseMoment(id: string) {
    state.isPlaying = false
    selectMoment(id)
    syncURL(true)
  }
  function open(mode: ViewMode, id?: string) {
    state.isPlaying = false
    if (id) state.activeContributionId = id
    state.viewMode = mode
  }
  function jump(c: Contribution) {
    selectMoment(c.momentId)
    state.activeContributionId = c.id
    state.activeParticipantId = 'all'
    state.viewMode = 'focus'
    syncURL()
  }
  watch(
    () => [state.isPlaying, state.playbackSpeed],
    () => {
      clearInterval(clock)
      if (state.isPlaying)
        clock = setInterval(() => {
          const index = moments.value.findIndex((m) => m.id === state.activeMomentId)
          const next = moments.value[index + 1]
          if (!next) {
            state.isPlaying = false
            return
          }
          selectMoment(next.id)
          syncURL(true)
        }, 3500 / state.playbackSpeed)
    },
  )
  async function saveMemory(input: {
    id?: string
    momentId: string
    participantId: string
    text: string
    mood: string
    file?: File
  }) {
    const m = data.value.moments.find((m) => m.id === input.momentId)
    if (!m || !data.value.participants.some((p) => p.id === input.participantId))
      throw new Error('请选择有效的人物和时刻。')
    if (!input.text.trim() && !input.file && !input.id)
      throw new Error('请留下文字或选择一张照片。')
    const existing = data.value.contributions.find((c) => c.id === input.id)
    if (existing && existing.participantId !== state.currentViewerId)
      throw new Error('只能编辑当前记录者自己的贡献。')
    const c: Contribution = existing
      ? { ...existing }
      : {
          id: crypto.randomUUID(),
          kind: 'note',
          momentId: m.id,
          participantId: input.participantId,
          alt: '本地上传照片',
          mood: [],
          isDemo: false,
        }
    if (input.file) {
      if (input.file.size > 12 * 1024 * 1024) throw new Error('请使用小于 12 MB 的照片。')
      const result = await importPhotos([input.file], input.participantId, [], 0)
      const photo = result.photos[0]
      if (!photo) throw new Error(result.failures[0] ?? '无法读取图片')
      try {
        const fileId = crypto.randomUUID()
        await storeMedia(fileId, photo.displayBlob ?? input.file)
        if (photo.displayBlob) {
          c.originalFileId = fileId + '-original'
          await storeMedia(c.originalFileId, input.file)
        }
        c.fileId = fileId
      } catch {
        URL.revokeObjectURL(photo.url)
        throw new Error('照片保存失败，请检查浏览器存储空间。文字尚未提交。')
      }
      if (c.mediaUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(c.mediaUrl)
        objectURLs.delete(c.mediaUrl)
      }
      delete c.thumbnailUrl
      c.mediaUrl = photo.url
      objectURLs.add(photo.url)
      c.kind = 'photo'
      c.alt = photo.filename
      c.gps = photo.gps
      c.capturedAt = photo.capturedAt
    }
    c.momentId = m.id
    c.participantId = input.participantId
    c.writtenText = input.text
    c.mood = input.mood ? [input.mood] : []
    c.isDemo = false
    c.visibility ??= 'event-members'
    if (input.file || c.kind === 'note' || !c.timeEvidence)
      c.timeEvidence =
        c.capturedAt !== undefined
          ? {
              start: new Date(c.capturedAt).toISOString(),
              precision: input.file ? 'exact' : (c.timeEvidence?.precision ?? 'exact'),
              source: input.file ? 'exif' : (c.timeEvidence?.source ?? 'exif'),
            }
          : c.kind === 'photo'
            ? { precision: 'unknown', source: 'user' }
            : { start: m.startAt, end: m.endAt, precision: 'approximate', source: 'user' }
    managementUndo.value = JSON.parse(JSON.stringify(data.value)) as MemoryData
    if (existing) {
      data.value.links.forEach((link) => {
        if (!link.momentIds.includes(c.momentId))
          link.contributionIds = link.contributionIds.filter((id) => id !== c.id)
      })
      data.value.moments.forEach(
        (m) => (m.contributionIds = m.contributionIds.filter((id) => id !== c.id)),
      )
      data.value.contributions[data.value.contributions.findIndex((v) => v.id === c.id)] = c
    } else data.value.contributions.push(c)
    m.contributionIds.push(c.id)
    selectMoment(m.id)
    state.activeContributionId = c.id
    state.activeParticipantId = input.participantId
    state.viewMode = 'scene'
    syncURL(true)
    notice.value = '已保存在这个浏览器中。'
  }
  function createEvent(title: string, type: 'trip' | 'longActivity') {
    managementUndo.value = JSON.parse(JSON.stringify(data.value)) as MemoryData
    const id = crypto.randomUUID()
    data.value.events.push({
      id,
      title: title.trim(),
      subtitle: '导入照片，让这一段经历展开。',
      type,
      isDemo: false,
      sceneIds: [],
      participantIds: data.value.participants.map((p) => p.id),
    })
    navigate('event', id)
    open('import-photos')
  }
  function exportArchive() {
    // JSON contains metadata; photo blobs remain in IndexedDB.
    const archive: MemoryData = JSON.parse(JSON.stringify(data.value))
    ;[...archive.contributions, ...(archive.pendingPhotos ?? [])].forEach((c) => {
      if (c.fileId) delete c.mediaUrl
    })
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(archive, null, 2)], { type: 'application/json' }),
    )
    const a = document.createElement('a')
    a.href = url
    a.download = 'shared-memories.json'
    a.click()
    URL.revokeObjectURL(url)
    notice.value = '文字与配置已导出；本地照片保留在此浏览器，未包含在 JSON 中。'
  }
  async function exportFullArchive() {
    notice.value = '正在读取原图，生成完整备份…'
    const backup = await packMemoryBackup(data.value, readMedia)
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(backup)], { type: 'application/json' }),
    )
    const a = document.createElement('a')
    a.href = url
    a.download = `shared-memories-full-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    notice.value = '完整备份已生成，包含原图、HEIC预览、待整理照片和文字。请妥善保存。'
  }
  async function saveImportedEvents(
    photos: AnalyzedPhoto[],
    groups: EventCandidate[],
    participantId: string,
  ) {
    const chapter = data.value.events.find((e) => e.id === state.activeEventId)
    if (!chapter) throw new Error('请先创建或选择篇章。')
    if (!chapter.participantIds.includes(participantId)) throw new Error('请选择此篇章的记录者。')
    if (!photos.length) throw new Error('没有可读取的图片，请检查格式或重新选择。')
    const selected = photos.filter((p) => !p.duplicateOf)
    const patch = buildChapterImport(selected, groups, chapter.id, participantId, presets)
    const urls = new Map(selected.map((p) => [p.id, URL.createObjectURL(p.displayBlob ?? p.file)]))
    try {
      await storeMediaBatch(
        selected.flatMap((p) => [
          { id: p.id, file: p.displayBlob ?? p.file },
          ...(p.displayBlob ? [{ id: p.id + '-original', file: p.file }] : []),
        ]),
      )
    } catch {
      urls.forEach((url) => URL.revokeObjectURL(url))
      throw new Error('浏览器空间不足或照片保存失败；本次整理未提交，请重试或减少图片。')
    }
    for (const photo of [...patch.contributions, ...patch.pendingPhotos])
      photo.mediaUrl = urls.get(photo.id)
    const replacing = new Set(selected.map((p) => p.id))
    for (const photo of data.value.pendingPhotos ?? [])
      if (replacing.has(photo.id) && photo.mediaUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(photo.mediaUrl)
        objectURLs.delete(photo.mediaUrl)
      }
    urls.forEach((url) => objectURLs.add(url))
    const times = [
      ...data.value.contributions.filter((c) =>
        data.value.moments.some((m) => m.id === c.momentId && chapter.sceneIds.includes(m.sceneId)),
      ),
      ...patch.contributions,
    ]
      .map((c) => {
        const time = Date.parse(c.timeEvidence?.start ?? '')
        return c.timeEvidence?.precision !== 'unknown' && Number.isFinite(time)
          ? time
          : c.timeEvidence
            ? undefined
            : c.capturedAt
      })
      .filter((t): t is number => t !== undefined)
      .sort((a, b) => a - b)
    managementUndo.value = portableMetadata(data.value)
    data.value = {
      ...data.value,
      events: data.value.events.map((e) =>
        e.id === chapter.id
          ? {
              ...e,
              sceneIds: [...e.sceneIds, ...patch.scenes.map((s) => s.id)],
              startAt: times.length ? new Date(times[0]!).toISOString() : e.startAt,
              endAt: times.length ? new Date(times.at(-1)!).toISOString() : e.endAt,
            }
          : e,
      ),
      scenes: [...data.value.scenes, ...patch.scenes],
      moments: [...data.value.moments, ...patch.moments],
      contributions: [...data.value.contributions, ...patch.contributions],
      pendingPhotos: [
        ...(data.value.pendingPhotos ?? []).filter((p) => !replacing.has(p.id)),
        ...patch.pendingPhotos,
      ],
    }
    state.currentViewerId = participantId
    navigate('event', chapter.id)
    notice.value = `已生成 ${patch.scenes.length} 个事件，${patch.pendingPhotos.length} 张照片保留在待整理区。`
  }
  async function pendingImportFiles(personId: string) {
    const records = (data.value.pendingPhotos ?? []).filter(
      (p) => p.eventId === state.activeEventId && p.participantId === personId,
    )
    const result = []
    for (const p of records) {
      const blob = await readMedia(p.originalFileId ?? p.fileId ?? '').catch(() => undefined)
      if (blob)
        result.push({
          id: p.id,
          file: new File([blob], p.alt, { type: blob.type }),
          capturedAt: p.capturedAt,
          gps: p.gps,
          timeSource: p.timeEvidence?.source === 'exif' ? ('exif' as const) : ('user' as const),
        })
    }
    return result
  }
  function placePendingPhoto(id: string, sceneId: string) {
    const p = data.value.pendingPhotos?.find(
      (p) => p.id === id && p.eventId === state.activeEventId,
    )
    if (!p) return
    if (p.participantId !== state.currentViewerId) throw new Error('只能整理自己的照片。')
    if (
      sceneId !== 'new' &&
      !data.value.scenes.some((s) => s.id === sceneId && s.eventId === p.eventId)
    )
      throw new Error('请选择此篇章中的事件。')
    managementUndo.value = JSON.parse(JSON.stringify(data.value)) as MemoryData
    let scene = data.value.scenes.find((s) => s.id === sceneId && s.eventId === p.eventId)
    if (sceneId === 'new') {
      scene = {
        id: crypto.randomUUID(),
        eventId: p.eventId,
        title: '一张照片的故事',
        subtitle: '由你从待整理区单独收录。',
        momentIds: [],
        environment: presets.neutral,
      }
      data.value.scenes.push(scene)
      data.value.events.find((e) => e.id === p.eventId)!.sceneIds.push(scene.id)
    }
    if (!scene) throw new Error('请选择此篇章中的事件。')
    const timestamp = p.capturedAt ?? Date.now()
    const moment = {
      id: crypto.randomUUID(),
      sceneId: scene.id,
      title: '收录的照片',
      startAt: new Date(timestamp).toISOString(),
      label:
        p.capturedAt === undefined ? '时间待确认' : new Date(timestamp).toLocaleString('zh-CN'),
      lighting: 'overcast' as const,
      contributionIds: [p.id],
    }
    data.value.moments.push(moment)
    scene.momentIds.push(moment.id)
    scene.momentIds.sort(
      (a, b) =>
        Date.parse(data.value.moments.find((m) => m.id === a)!.startAt) -
        Date.parse(data.value.moments.find((m) => m.id === b)!.startAt),
    )
    const { eventId: _eventId, reason: _reason, ...photo } = p
    void _eventId
    void _reason
    data.value.contributions.push({ ...photo, kind: 'photo', momentId: moment.id })
    data.value.pendingPhotos = data.value.pendingPhotos!.filter((photo) => photo.id !== id)
    const e = data.value.events.find((e) => e.id === p.eventId)!
    const known = data.value.contributions
      .filter((c) =>
        data.value.moments.some((m) => m.id === c.momentId && e.sceneIds.includes(m.sceneId)),
      )
      .flatMap((c) => {
        const t = Date.parse(c.timeEvidence?.start ?? '')
        return Number.isFinite(t) && c.timeEvidence?.precision !== 'unknown' ? [t] : []
      })
    if (known.length) {
      e.startAt = new Date(Math.min(...known)).toISOString()
      e.endAt = new Date(Math.max(...known)).toISOString()
    }
    notice.value = '照片已收录到事件，原文件仍保留。'
  }
  async function importArchive(file: File) {
    if (file.size > 140 * 1024 * 1024) throw new Error('完整备份不能超过 140 MB。')
    const value: unknown = JSON.parse(await file.text())
    const full =
      value &&
      typeof value === 'object' &&
      'format' in value &&
      value.format === 'shared-memories-full-v1'
        ? (value as FullMemoryBackup)
        : undefined
    const parsed: unknown = full ? full.data : value
    if (!full && file.size > 2 * 1024 * 1024) throw new Error('文字存档不能超过2 MB。')
    if (!validateArchive(parsed) || JSON.stringify(parsed).length > 2 * 1024 * 1024)
      throw new Error('存档格式或关联不正确，请使用本应用导出的 JSON。')
    let restored = parsed
    if (full) {
      const contents = unpackMemoryBackup(full)
      await storeMediaBatch(contents.files)
      restored = contents.data
    }
    managementUndo.value = portableMetadata(data.value)
    restored.scenes.forEach((s) => (s.environment = structuredClone(presets[s.environment.preset])))
    data.value = restored
    await hydrate()
    navigate('home')
    notice.value = full ? '完整备份已恢复；如需撤销，打开篇章整理。' : '存档已导入。'
  }
  async function hydrate() {
    for (const url of objectURLs) URL.revokeObjectURL(url)
    objectURLs.clear()
    for (const c of [...data.value.contributions, ...(data.value.pendingPhotos ?? [])])
      if (c.fileId) {
        try {
          const blob = await readMedia(c.fileId)
          if (blob) {
            c.mediaUrl = URL.createObjectURL(blob)
            objectURLs.add(c.mediaUrl)
          } else {
            delete c.mediaUrl
            notice.value = '部分照片未在此浏览器找到，请在编辑中重新选择文件。'
          }
        } catch {
          delete c.mediaUrl
          notice.value = '本地照片无法读取，文字仍然保留。'
        }
      }
  }
  onMounted(async () => {
    restoreURL()
    window.addEventListener('popstate', restoreURL)
    await hydrate()
    loading.value = false
  })
  onBeforeUnmount(() => {
    clearInterval(clock)
    window.removeEventListener('popstate', restoreURL)
    objectURLs.forEach((url) => URL.revokeObjectURL(url))
  })
  return {
    data,
    state,
    event,
    scene,
    moment,
    moments,
    current,
    visible,
    active,
    link,
    pair,
    scenePairs,
    activePairId,
    manage,
    managementUndo,
    undoManagement,
    environmentRecipe,
    loading,
    notice,
    navigate,
    chooseMoment,
    open,
    jump,
    saveMemory,
    syncURL,
    createEvent,
    saveImportedEvents,
    pendingImportFiles,
    placePendingPhoto,
    exportArchive,
    exportFullArchive,
    importArchive,
  }
}
