import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick } from 'vue'
import { createMemoryDemo } from './memoryDemo'
import { useMemories, validateArchive } from './useMemories'

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal('window', { addEventListener: vi.fn(), removeEventListener: vi.fn() })
  vi.stubGlobal('history', { pushState: vi.fn(), replaceState: vi.fn() })
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => {
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('memory presentation state', () => {
  it('keeps the same contribution through view changes and graph jumps', () => {
    const scope = effectScope()
    scope.run(() => {
      const app = useMemories()
      app.data.value = createMemoryDemo()
      app.navigate('scene', 'hailing', 'coast')
      app.state.activeParticipantId = 'b'
      app.open('shared', 'coast-sunset-1')
      expect(app.state.activeMomentId).toBe('coast-sunset')
      app.jump(app.data.value.contributions.find((c) => c.id === 'mountain-walk-2')!)
      expect(app.state.activeSceneId).toBe('mountain')
      expect(app.state.activeMomentId).toBe('mountain-walk')
      expect(app.state.viewMode).toBe('focus')
    })
    scope.stop()
  })
  it('plays deterministic ticks at both speeds', async () => {
    const scope = effectScope()
    const app = scope.run(() => useMemories())!
    app.data.value = createMemoryDemo()
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
    scope.stop()
  })
  it('validates an exported archive without browser storage', () => {
    const archive = createMemoryDemo()
    expect(validateArchive(archive)).toBe(true)
    expect(validateArchive({ ...archive, events: [{ ...archive.events[0], sceneIds: ['missing'] }] })).toBe(false)
  })
})
