import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import type { Contribution, MemoryData, ViewMode, EnvironmentPreset } from '../shared/memoryTypes'
import { createMemoryDemo, presets } from './memoryDemo'
import { readMedia, storeMedia } from '../shared/lib/memoryStorage'
import { importPhotos } from '../features/import/importPhotos'

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
    page: 'home' as 'home' | 'event' | 'scene',
    themeOverride: '' as EnvironmentPreset | '',
  })
  const event = computed(() => data.value.events.find((e) => e.id === state.activeEventId))
  const scene = computed(() => data.value.scenes.find((s) => s.id === state.activeSceneId))
  const moments = computed(() =>
    (scene.value?.momentIds ?? [])
      .map((id) => data.value.moments.find((m) => m.id === id))
      .filter((m): m is NonNullable<typeof m> => !!m),
  )
  const moment = computed(() => moments.value.find((m) => m.id === state.activeMomentId))
  const current = computed(() =>
    data.value.contributions.filter((c) => c.momentId === state.activeMomentId),
  )
  const visible = computed(() =>
    current.value.filter(
      (c) => state.activeParticipantId === 'all' || c.participantId === state.activeParticipantId,
    ),
  )
  const active = computed(
    () =>
      data.value.contributions.find((c) => c.id === state.activeContributionId) ??
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
  const objectURLs = new Set<string>()
  let clock: ReturnType<typeof setInterval> | undefined
  function persist() {
    try {
      const archive = structuredClone(JSON.parse(JSON.stringify(data.value)) as MemoryData)
      archive.contributions.forEach((c) => {
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
        : `/events/${state.activeEventId}${state.page === 'scene' ? `/scenes/${state.activeSceneId}?moment=${state.activeMomentId}` : ''}`
    history[replace ? 'replaceState' : 'pushState']({}, '', path)
  }
  function navigate(
    page: 'home' | 'event' | 'scene',
    eventId = state.activeEventId,
    sceneId = state.activeSceneId,
  ) {
    state.isPlaying = false
    state.viewMode = 'scene'
    state.page = page
    state.activeEventId = eventId
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
      state.page = 'event'
      const s = data.value.scenes.find((s) => s.eventId === parts[1] && s.id === parts[3])
      if (s) {
        state.activeSceneId = s.id
        state.page = 'scene'
        const id = new URLSearchParams(location.search).get('moment')
        selectMoment(s.momentIds.includes(id ?? '') ? id! : (s.momentIds[0] ?? ''))
      }
    } else state.page = 'home'
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
        await storeMedia(fileId, input.file)
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
    const id = crypto.randomUUID(),
      sceneId = crypto.randomUUID(),
      momentId = crypto.randomUUID()
    data.value.events.push({
      id,
      title: title.trim(),
      subtitle: '从这里开始，留下共同的记忆。',
      type,
      isDemo: false,
      sceneIds: [sceneId],
      participantIds: data.value.participants.map((p) => p.id),
    })
    data.value.scenes.push({
      id: sceneId,
      eventId: id,
      title: '第一章',
      subtitle: '添加属于你们的第一段回忆。',
      momentIds: [momentId],
      environment: presets.neutral,
    })
    data.value.moments.push({
      id: momentId,
      sceneId,
      title: '最初的时刻',
      startAt: new Date().toISOString(),
      label: '今日',
      lighting: 'morning',
      contributionIds: [],
    })
    navigate('scene', id, sceneId)
    open('edit')
  }
  function exportArchive() {
    const archive: MemoryData = JSON.parse(JSON.stringify(data.value))
    archive.contributions.forEach((c) => {
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
  async function importArchive(file: File) {
    if (file.size > 2 * 1024 * 1024) throw new Error('存档不能超过 2 MB。')
    const parsed: unknown = JSON.parse(await file.text())
    if (!validateArchive(parsed)) throw new Error('存档格式或关联不正确，请使用本应用导出的 JSON。')
    parsed.scenes.forEach((s) => (s.environment = structuredClone(presets[s.environment.preset])))
    data.value = parsed
    await hydrate()
    navigate('home')
    notice.value = '存档已导入。'
  }
  async function hydrate() {
    for (const url of objectURLs) URL.revokeObjectURL(url)
    objectURLs.clear()
    for (const c of data.value.contributions)
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
    environmentRecipe,
    loading,
    notice,
    navigate,
    chooseMoment,
    open,
    jump,
    saveMemory,
    createEvent,
    exportArchive,
    importArchive,
  }
}
