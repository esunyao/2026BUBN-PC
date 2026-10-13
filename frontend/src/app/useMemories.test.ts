import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick } from 'vue'
import { useMemories } from './useMemories'

beforeEach(() => {
  vi.useFakeTimers()
  const saved = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => saved.get(key) ?? null,
    setItem: (key: string, value: string) => saved.set(key, value),
  })
  vi.stubGlobal('history', { pushState: vi.fn(), replaceState: vi.fn() })
  vi.spyOn(console, 'warn').mockImplementation(() => {}) // composable tested in an effect scope, without a DOM mount
})
afterEach(() => {
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('unified memory session', () => {
  it('retains moment across lens and overlay changes, then jumps from graph to the same contribution', () => {
    const scope = effectScope()
    scope.run(() => {
      const app = useMemories()
      app.navigate('scene', 'hailing', 'coast')
      app.state.activeParticipantId = 'b'
      app.open('shared', 'coast-sunset-1')
      expect(app.state.activeMomentId).toBe('coast-sunset')
      expect(app.active.value?.participantId).toBe('b')
      app.jump(app.data.value.contributions.find((c) => c.id === 'mountain-walk-2')!)
      expect(app.state.activeSceneId).toBe('mountain')
      expect(app.state.activeMomentId).toBe('mountain-walk')
      expect(app.active.value?.id).toBe('mountain-walk-2')
      expect(app.state.viewMode).toBe('focus')
    })
    scope.stop()
  })
  it('plays deterministic ticks at 1x and 2x and stops at the end', async () => {
    const scope = effectScope()
    const app = scope.run(() => useMemories())!
    app.navigate('scene', 'hailing', 'coast')
    app.chooseMoment('coast-morning')
    app.state.isPlaying = true
    await nextTick()
    await vi.advanceTimersByTimeAsync(3500)
    expect(app.state.activeMomentId).toBe('coast-afternoon')
    app.state.playbackSpeed = 2
    await nextTick()
    await vi.advanceTimersByTimeAsync(1750)
    expect(app.state.activeMomentId).toBe('coast-sunset')
    await vi.advanceTimersByTimeAsync(1750)
    expect(app.state.activeMomentId).toBe('coast-evening')
    await vi.advanceTimersByTimeAsync(1750)
    expect(app.state.isPlaying).toBe(false)
    scope.stop()
  })
  it('saves exact text, reassigns the original author and moment without stale membership', async () => {
    const scope = effectScope(),
      app = scope.run(() => useMemories())!
    app.navigate('scene', 'hailing', 'coast')
    await app.saveMemory({
      id: 'coast-sunset-0',
      momentId: 'coast-morning',
      participantId: 'c',
      text: '  我的原文\n第二行  ',
      mood: '期待',
    })
    await nextTick()
    expect(
      app.active.value?.writtenText ??
        app.visible.value.find((c) => c.id === 'coast-sunset-0')?.writtenText,
    ).toBe('  我的原文\n第二行  ')
    expect(
      app.data.value.moments.find((m) => m.id === 'coast-sunset')?.contributionIds,
    ).not.toContain('coast-sunset-0')
    expect(app.data.value.moments.find((m) => m.id === 'coast-morning')?.contributionIds).toContain(
      'coast-sunset-0',
    )
    const restored = scope.run(() => useMemories())!
    expect(
      restored.data.value.contributions.find((c) => c.id === 'coast-sunset-0')?.writtenText,
    ).toBe('  我的原文\n第二行  ')
    scope.stop()
  })
})
