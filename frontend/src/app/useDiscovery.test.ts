import { afterEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick } from 'vue'
import { useMemories } from './useMemories'
import { useDiscovery } from './useDiscovery'
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})
describe('missing piece collaboration', () => {
  it('persists two separate original notes, prevents editing others, and restores the gap after deletion', async () => {
    const saved = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => saved.get(key) ?? null,
      setItem: (key: string, value: string) => saved.set(key, value),
    })
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const scope = effectScope(),
      app = scope.run(() => useMemories())!,
      discovery = scope.run(() => useDiscovery(app))!
    app.state.activeEventId = 'hailing'
    app.state.activeSceneId = 'coast'
    const gap = discovery.findings.value.find((f) => f.type === 'missing_piece')!
    expect(gap).toBeDefined()
    const first = await discovery.saveGap(gap, 'A 写下的原文', '平静', 'private')
    await nextTick()
    app.state.currentViewerId = 'b'
    expect(app.moments.value.some((m) => m.originGapId === gap.gapId)).toBe(false)
    expect(discovery.findings.value.find((f) => f.id === gap.id)?.evidenceIds).not.toContain(
      first.id,
    )
    await expect(
      discovery.saveGap(gap, '不能编辑 A', '', 'event-members', first.id),
    ).rejects.toThrow('只能编辑')
    const second = await discovery.saveGap(gap, 'B 留下的另一份文字', '', 'event-members')
    await nextTick()
    expect(app.data.value.moments.filter((m) => m.originGapId === gap.gapId)).toHaveLength(1)
    const restored = scope.run(() => useMemories())!
    expect(restored.data.value.contributions.find((c) => c.id === first.id)?.writtenText).toBe(
      'A 写下的原文',
    )
    expect(restored.data.value.contributions.find((c) => c.id === second.id)?.writtenText).toBe(
      'B 留下的另一份文字',
    )
    discovery.removeNote(first.id)
    expect(app.data.value.contributions.some((c) => c.id === first.id)).toBe(true)
    discovery.removeNote(second.id)
    app.state.currentViewerId = 'a'
    discovery.removeNote(first.id)
    expect(app.data.value.moments.some((m) => m.originGapId === gap.gapId)).toBe(false)
    expect(discovery.findings.value.find((f) => f.id === gap.id)?.evidenceIds).toHaveLength(2)
    scope.stop()
  })
})
