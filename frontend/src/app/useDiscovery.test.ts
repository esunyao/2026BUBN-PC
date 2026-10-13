import { afterEach, describe, expect, it, vi } from 'vitest'
import { effectScope } from 'vue'
import { createMemoryDemo } from './memoryDemo'
import { useMemories } from './useMemories'
import { useDiscovery } from './useDiscovery'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})
describe('discovery over authorized memory data', () => {
  it('keeps the sample gap visible in the presentation layer', () => {
    vi.stubGlobal('window', { addEventListener: vi.fn(), removeEventListener: vi.fn() })
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const scope = effectScope()
    scope.run(() => {
      const app = useMemories()
      app.data.value = createMemoryDemo()
      app.state.activeEventId = 'hailing'
      app.state.activeSceneId = 'coast'
      const discovery = useDiscovery(app)
      expect(discovery.findings.value.some((f) => f.type === 'missing_piece')).toBe(true)
    })
    scope.stop()
  })
})
