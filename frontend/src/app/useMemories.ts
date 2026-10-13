import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import type { Contribution, MemoryData, ViewMode, EnvironmentPreset } from '../shared/memoryTypes'
import { presets } from './memoryDemo'
import { isVisible } from '../features/discovery/engine'
import { auth } from './useAuth'
import { online, normalizeIndex, combineIndexes, type MemoryIndex } from './onlineRepository'
import { uploadMemory } from './uploadMemory'
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
  const data = ref<MemoryData>({ participants: [], events: [], scenes: [], moments: [], contributions: [], links: [], pairs: [] })
  const notice = ref(''),
    loading = ref(true)
  const indexes = new Map<string, MemoryIndex>()
  const urlTimers = new Map<string, ReturnType<typeof setTimeout>>()
  const permissions = computed(() => indexes.get(state.activeEventId)?.permissions)
  async function signedUrls(eventId: string, index: MemoryIndex) {
    clearTimeout(urlTimers.get(eventId))
    const contributions = index.data.contributions
    const ids = [...new Set(contributions.flatMap((c) => [c.photoId, c.thumbnailPhotoId, c.backgroundPhotoId].filter((id): id is string => !!id)))]
    let earliestExpiry = Number.POSITIVE_INFINITY
    for (let i = 0; i < ids.length; i += 100) {
      const response = await online.urls(eventId, ids.slice(i, i + 100))
      for (const item of response.urls) earliestExpiry = Math.min(earliestExpiry, item.expiresAt)
      const urls = new Map(response.urls.map((item) => [item.photoId, item.url]))
      contributions.forEach((c) => {
        if (c.photoId && urls.has(c.photoId)) c.mediaUrl = urls.get(c.photoId)
        if (c.thumbnailPhotoId && urls.has(c.thumbnailPhotoId)) c.thumbnailUrl = urls.get(c.thumbnailPhotoId)
      })
    }
    if (Number.isFinite(earliestExpiry)) {
      const delay = Math.max(10_000, earliestExpiry - Date.now() - 60_000)
      urlTimers.set(eventId, setTimeout(() => {
        if (!auth.account || !indexes.has(eventId)) return
        void signedUrls(eventId, index).then(() => { data.value = combineIndexes([...indexes.values()]) })
          .catch((error) => { notice.value = error instanceof Error ? error.message : '照片地址刷新失败。' })
      }, delay))
    }
  }
  async function loadOnline() {
    loading.value = true
    try {
      const events = await online.events()
      const loaded = await Promise.all(events.map(async (e) => {
        const index = normalizeIndex(await online.index(e.id))
        if (!e.isDemo) await signedUrls(e.id, index)
        return [e.id, index] as const
      }))
      indexes.clear()
      loaded.forEach(([id, index]) => indexes.set(id, index))
      data.value = combineIndexes(loaded.map(([, index]) => index))
      restoreURL()
      if (state.activeEventId) state.currentViewerId = indexes.get(state.activeEventId)?.viewerParticipantId ?? 'a'
    } catch (error) {
      notice.value = error instanceof Error ? error.message : '无法加载线上记忆。'
      throw error
    } finally { loading.value = false }
  }
  async function reloadEvent(id: string) {
    const index = normalizeIndex(await online.index(id))
    if (!index.permissions.isReadOnly) await signedUrls(id, index)
    indexes.set(id, index)
    data.value = combineIndexes([...indexes.values()])
  }
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
  const link = computed(() =>
    data.value.links.find(
      (l) =>
        l.contributionIds.includes(active.value?.id ?? '') &&
        l.momentIds.includes(state.activeMomentId),
    ),
  )
  const pair = computed(() => data.value.pairs.find((p) => p.sceneId === state.activeSceneId))
  const environmentRecipe = computed(() => ({
    ...(state.themeOverride
      ? presets[state.themeOverride]
      : (scene.value?.environment ?? presets.neutral)),
    lighting: moment.value?.lighting ?? 'golden-hour',
    backgroundPhotoId: visible.value.find((c) => c.mediaUrl)?.id,
  }))
  let clock: ReturnType<typeof setInterval> | undefined
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
    state.currentViewerId = indexes.get(eventId)?.viewerParticipantId ?? state.currentViewerId
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
      state.currentViewerId = indexes.get(state.activeEventId)?.viewerParticipantId ?? 'a'
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
    const scene = data.value.scenes.find((s) => s.id === m?.sceneId)
    if (!m || !scene || !data.value.participants.some((p) => p.id === input.participantId))
      throw new Error('请选择有效的人物和时刻。')
    if (indexes.get(scene.eventId)?.permissions.isReadOnly) throw new Error('请先复制示例，再留下你的记忆。')
    if (!input.text.trim() && !input.file && !input.id)
      throw new Error('请留下文字或选择一张照片。')
    const existing = data.value.contributions.find((c) => c.id === input.id)
    if (existing && existing.ownerUserId !== auth.account?.id) throw new Error('只能编辑自己的贡献。')
    const uploaded = input.file ? await uploadMemory(scene.eventId, input.participantId, input.file) : undefined
    const c: Contribution = {
      ...(existing ?? {}),
      id: existing?.id ?? crypto.randomUUID(),
      kind: uploaded ? 'photo' : (existing?.kind ?? 'note'),
      momentId: m.id,
      participantId: input.participantId,
      ownerUserId: auth.account?.id,
      isDemo: false,
      alt: input.file?.name ?? existing?.alt ?? '文字记忆',
      writtenText: input.text,
      mood: input.mood ? [input.mood] : [],
      visibility: existing?.visibility ?? 'event-members',
      ...(uploaded ?? {}),
    }
    if (input.file) {
      c.gps = uploaded?.gps
      c.capturedAt = uploaded?.capturedAt
    }
    c.timeEvidence = c.capturedAt
      ? { start: new Date(c.capturedAt).toISOString(), precision: 'exact', source: 'exif' }
      : { start: m.startAt, end: m.endAt, precision: 'approximate', source: 'user' }
    const payload = { ...c, version: existing?.version ?? 0 }
    if (existing) await online.editContribution(c.id, payload)
    else await online.addContribution(scene.eventId, payload)
    await reloadEvent(scene.eventId)
    selectMoment(m.id)
    state.activeContributionId = c.id
    state.activeParticipantId = input.participantId
    state.viewMode = 'scene'
    syncURL(true)
    notice.value = '已保存到共同记忆。'
  }
  async function createEvent(title: string, type: 'trip' | 'longActivity') {
    const created = await online.create(title, type)
    await reloadEvent(created.id)
    const sceneId = indexes.get(created.id)?.data.events[0]?.sceneIds[0]
    navigate('scene', created.id, sceneId)
    open('edit')
  }
  async function copyDemo(eventId: string) {
    const copied = await online.copyDemo(eventId)
    await reloadEvent(copied.eventId)
    navigate('event', copied.eventId)
    notice.value = '示例已复制为你的线上篇章。'
  }
  async function addMember(username: string) {
    if (!state.activeEventId) throw new Error('请先打开一个事件。')
    await online.addMember(state.activeEventId, username)
    await reloadEvent(state.activeEventId)
    notice.value = '参与者已加入事件。'
  }
  async function exportArchive() {
    const archives = await Promise.all(data.value.events.filter((e) => !e.isDemo).map((e) => online.archive(e.id)))
    const archive = combineIndexes(archives.map((item) => ({ data: item, viewerParticipantId: '', permissions: { canManageMembers: false, isReadOnly: false }, revision: 0 })))
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(archive, null, 2)], { type: 'application/json' }),
    )
    const a = document.createElement('a')
    a.href = url
    a.download = 'shared-memories.json'
    a.click()
    URL.revokeObjectURL(url)
    notice.value = '线上存档已导出；JSON 不包含照片字节。'
  }
  async function importArchive(file: File) {
    if (file.size > 2 * 1024 * 1024) throw new Error('存档不能超过 2 MB。')
    const parsed: unknown = JSON.parse(await file.text())
    if (!validateArchive(parsed)) throw new Error('存档格式或关联不正确，请使用本应用导出的 JSON。')
    await online.import(parsed)
    await loadOnline()
    navigate('home')
    notice.value = '存档已导入线上篇章。'
  }
  window.addEventListener('popstate', restoreURL)
  onBeforeUnmount(() => {
    clearInterval(clock)
    for (const timer of urlTimers.values()) clearTimeout(timer)
    window.removeEventListener('popstate', restoreURL)
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
    environmentRecipe,
    loading,
    notice,
    permissions,
    loadOnline,
    reloadEvent,
    copyDemo,
    addMember,
    navigate,
    chooseMoment,
    open,
    jump,
    saveMemory,
    syncURL,
    createEvent,
    exportArchive,
    importArchive,
  }
}
