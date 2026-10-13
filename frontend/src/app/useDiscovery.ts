import { computed, nextTick, ref, watch } from 'vue'
import type { useMemories } from './useMemories'
import { discover } from '../features/discovery/engine'
import type { DiscoveryFeedback, DiscoveryFinding } from '../features/discovery/types'
export function useDiscovery(app: ReturnType<typeof useMemories>) {
  const feedback = ref<Record<string, DiscoveryFeedback>>({})
  try {
    const saved: unknown = JSON.parse(localStorage.getItem('memory-discovery-feedback') ?? '{}')
    if (saved && typeof saved === 'object')
      for (const [key, value] of Object.entries(saved))
        if (value && typeof value === 'object') {
          const item = value as DiscoveryFeedback
          feedback.value[key] = {
            status: ['confirmed', 'dismissed'].includes(item.status ?? '')
              ? item.status
              : undefined,
            favorite: item.favorite === true,
          }
        }
  } catch {
    app.notice.value = '发现反馈无法读取，已使用默认状态。'
  }
  watch(
    feedback,
    (value) => {
      try {
        localStorage.setItem('memory-discovery-feedback', JSON.stringify(value))
      } catch {
        app.notice.value = '发现反馈未能保存，请检查浏览器存储权限。'
      }
    },
    { deep: true },
  )
  const showHidden = ref(false)
  const findings = computed(() =>
    discover(
      app.data.value,
      app.state.activeEventId,
      app.state.currentViewerId,
      feedback.value,
      showHidden.value,
    ),
  )
  const selected = computed(() => findings.value.find((f) => f.id === app.state.selectedFindingId))
  const count = (eventId: string) =>
    discover(app.data.value, eventId, app.state.currentViewerId, feedback.value).length
  let origin: { state: typeof app.state; scroll: number } | undefined
  function enter(eventId = app.state.activeEventId) {
    origin = { state: { ...app.state }, scroll: window.scrollY }
    app.syncURL(true)
    app.state.isPlaying = false
    app.state.page = 'discover'
    app.state.activeEventId = eventId
    app.state.selectedFindingId = ''
    app.state.viewMode = 'scene'
    if (app.state.activeParticipantId !== 'all')
      app.state.currentViewerId = app.state.activeParticipantId
    app.syncURL()
    window.scrollTo(0, 0)
  }
  async function back() {
    if (origin) {
      Object.assign(app.state, origin.state, {
        isPlaying: false,
        viewMode: 'scene',
        selectedFindingId: '',
      })
      app.syncURL()
      await nextTick()
      window.scrollTo(0, origin.scroll)
      origin = undefined
    } else app.navigate('event')
  }
  function select(id: string) {
    app.state.selectedFindingId = id
    app.syncURL()
  }
  function close() {
    app.state.selectedFindingId = ''
    app.syncURL(true)
  }
  function mark(f: DiscoveryFinding, action: 'confirm' | 'hide' | 'favorite' | 'restore') {
    const key = `${app.state.currentViewerId}:${f.id}`,
      previous = feedback.value[key] ?? {}
    feedback.value[key] = {
      ...previous,
      ...(action === 'favorite'
        ? { favorite: !previous.favorite }
        : {
            status:
              action === 'hide' ? 'dismissed' : action === 'confirm' ? 'confirmed' : undefined,
          }),
    }
    if (action === 'hide') close()
  }
  async function saveGap(
    f: DiscoveryFinding,
    text: string,
    mood: string,
    visibility: 'private' | 'event-members',
    id?: string,
  ) {
    if (!f.gapId || !f.timeRange?.start || !f.timeRange.end || !f.sceneIds[0])
      throw new Error('这个空白片段缺少可信的时间范围。')
    if (!text.trim() || text.trim().length > 500) throw new Error('请写入 1–500 字。')
    const scene = app.data.value.scenes.find((s) => s.id === f.sceneIds[0])!
    let moment = app.data.value.moments.find((m) => m.originGapId === f.gapId)
    if (!moment) {
      moment = {
        id: f.gapId,
        originGapId: f.gapId,
        sceneId: scene.id,
        title: '没有照片的时段',
        label: `${f.timeRange.start.slice(11, 16)}—${f.timeRange.end.slice(11, 16)} · 文字记忆`,
        startAt: f.timeRange.start,
        endAt: f.timeRange.end,
        lighting: 'golden-hour',
        contributionIds: [],
      }
      app.data.value.moments.push(moment)
      scene.momentIds.push(moment.id)
      scene.momentIds.sort(
        (a, b) =>
          Date.parse(app.data.value.moments.find((m) => m.id === a)!.startAt) -
          Date.parse(app.data.value.moments.find((m) => m.id === b)!.startAt),
      )
    }
    const existing = app.data.value.contributions.find((c) => c.id === id)
    if (existing && existing.participantId !== app.state.currentViewerId)
      throw new Error('只能编辑当前身份自己的文字。')
    const c = {
      id: existing?.id ?? crypto.randomUUID(),
      momentId: moment.id,
      participantId: app.state.currentViewerId,
      kind: 'note' as const,
      writtenText: text,
      mood: mood ? [mood] : [],
      isDemo: false,
      alt: '文字记忆',
      visibility,
      timeEvidence: { ...f.timeRange, source: 'user' as const },
    }
    if (existing) app.data.value.contributions[app.data.value.contributions.indexOf(existing)] = c
    else {
      app.data.value.contributions.push(c)
      moment.contributionIds.push(c.id)
    }
    app.notice.value = '原文已保存；这个片段可以由其他参与者继续补写。'
    return c
  }
  function removeNote(id: string) {
    const c = app.data.value.contributions.find((c) => c.id === id)
    if (!c || c.participantId !== app.state.currentViewerId || c.kind !== 'note') return
    app.data.value.contributions = app.data.value.contributions.filter((c) => c.id !== id)
    app.data.value.moments.forEach(
      (m) => (m.contributionIds = m.contributionIds.filter((value) => value !== id)),
    )
    const empty = app.data.value.moments.filter((m) => m.originGapId && !m.contributionIds.length)
    app.data.value.moments = app.data.value.moments.filter((m) => !empty.includes(m))
    app.data.value.scenes.forEach(
      (s) => (s.momentIds = s.momentIds.filter((id) => !empty.some((m) => m.id === id))),
    )
    app.notice.value = '你的文字已删除；原空白片段仍保留，方便继续补写。'
  }
  return {
    feedback,
    showHidden,
    findings,
    selected,
    count,
    enter,
    back,
    select,
    close,
    mark,
    saveGap,
    removeNote,
  }
}
