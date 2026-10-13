import { computed, nextTick, ref, watch } from 'vue'
import type { useMemories } from './useMemories'
import { discover } from '../features/discovery/engine'
import type { DiscoveryFeedback, DiscoveryFinding } from '../features/discovery/types'
import { auth } from './useAuth'
import { online } from './onlineRepository'
export function useDiscovery(app: ReturnType<typeof useMemories>) {
  const feedback = ref<Record<string, DiscoveryFeedback>>({})
  watch(
    () => app.state.activeEventId,
    async (eventId) => {
      if (!eventId || !auth.account) return
      try {
        const saved = await online.feedback(eventId)
        feedback.value = Object.fromEntries(Object.entries(saved).map(([id, value]) => [`${app.state.currentViewerId}:${id}`, value]))
      } catch (error) { app.notice.value = error instanceof Error ? error.message : '发现反馈读取失败。' }
    },
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
  async function mark(f: DiscoveryFinding, action: 'confirm' | 'hide' | 'favorite' | 'restore') {
    const key = `${app.state.currentViewerId}:${f.id}`,
      previous = feedback.value[key] ?? {}
    const next: DiscoveryFeedback = {
      ...previous,
      ...(action === 'favorite'
        ? { favorite: !previous.favorite }
        : {
            status:
              action === 'hide' ? 'dismissed' : action === 'confirm' ? 'confirmed' : undefined,
          }),
    }
    try {
      await online.putFeedback(app.state.activeEventId, { findingId: f.id, evidenceIds: f.evidenceIds, status: next.status, favorite: next.favorite === true })
      feedback.value[key] = next
    } catch (error) { app.notice.value = error instanceof Error ? error.message : '发现反馈保存失败。'; return }
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
    if (app.permissions.value?.isReadOnly) throw new Error('请先复制示例，再补写记忆。')
    if (!text.trim() || text.trim().length > 500) throw new Error('请写入 1–500 字。')
    const existing = app.data.value.contributions.find((c) => c.id === id)
    if (existing && existing.ownerUserId !== auth.account?.id)
      throw new Error('只能编辑当前身份自己的文字。')
    const c = {
      id: existing?.id ?? crypto.randomUUID(),
      ...(existing ? { momentId: existing.momentId } : { gap: { sceneId: f.sceneIds[0], originGapId: f.gapId, originMomentIds: f.originMomentIds ?? [], start: f.timeRange.start, end: f.timeRange.end } }),
      participantId: app.state.currentViewerId,
      kind: 'note' as const,
      writtenText: text,
      mood: mood ? [mood] : [],
      isDemo: false,
      alt: '文字记忆',
      visibility,
      timeEvidence: { ...f.timeRange, source: 'user' as const },
      version: existing?.version ?? 0,
    }
    if (existing) await online.editContribution(c.id, c)
    else await online.addContribution(app.state.activeEventId, c)
    await app.reloadEvent(app.state.activeEventId)
    app.notice.value = '原文已保存；这个片段可以由其他参与者继续补写。'
    return app.data.value.contributions.find((item) => item.id === c.id)!
  }
  async function removeNote(id: string) {
    const c = app.data.value.contributions.find((c) => c.id === id)
    if (!c || c.ownerUserId !== auth.account?.id || c.kind !== 'note') return
    try {
      await online.removeContribution(id, c.version ?? 0)
      await app.reloadEvent(app.state.activeEventId)
    } catch (error) { app.notice.value = error instanceof Error ? error.message : '删除失败。'; return }
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
