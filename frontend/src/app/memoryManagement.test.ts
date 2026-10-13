import { describe, expect, it } from 'vitest'
import { createMemoryDemo, presets } from './memoryDemo'
import { manageMemory } from './memoryManagement'
import { discover, threadDetector, indexMemory } from '../features/discovery/engine'

describe('local memory management', () => {
  it('moves only owned records, removes stale comparisons and preserves original EXIF', () => {
    const d = createMemoryDemo(),
      c = d.contributions.find((c) => c.id === 'coast-sunset-0')!,
      original = c.capturedAt
    const action = {
      type: 'record' as const,
      id: c.id,
      momentId: 'mountain-walk',
      text: '我的文字',
      generatedCaption: '',
      objects: ['红背包', '红背包'],
      phase: '',
      visibility: 'event-members' as const,
      participantTags: ['b'],
      tagsConsent: false,
      time: '2026-08-16T12:30:00+08:00',
    }
    const before = JSON.stringify(d)
    expect(() => manageMemory(d, 'hailing', 'b', action, presets)).toThrow('自己的记录')
    expect(JSON.stringify(d)).toBe(before)
    manageMemory(d, 'hailing', 'a', action, presets)
    expect(c.capturedAt).toBe(original)
    expect(c.timeEvidence?.source).toBe('user')
    expect(c.participantTags).toEqual([])
    expect(d.moments.find((m) => m.id === 'coast-sunset')?.contributionIds).not.toContain(c.id)
    expect(d.moments.find((m) => m.id === 'mountain-walk')?.contributionIds).toContain(c.id)
    expect(
      d.pairs.some((p) => [p.beforeContributionId, p.afterContributionId].includes(c.id)),
    ).toBe(false)
  })
  it('requires same-event photos for comparisons, with explicit alignment opt-in', () => {
    const d = createMemoryDemo()
    d.pairs = []
    expect(() =>
      manageMemory(
        d,
        'hailing',
        'a',
        { type: 'pair', before: 'coast-morning-0', after: 'mountain-walk-0', aligned: true },
        presets,
      ),
    ).toThrow()
    manageMemory(
      d,
      'hailing',
      'a',
      { type: 'pair', before: 'coast-morning-0', after: 'coast-sunset-0', aligned: false },
      presets,
    )
    expect(d.pairs[0]?.comparisonMode).toBe('sideBySide')
  })
  it('discovers explicit cross-event objects without revealing private evidence or inventing identities', () => {
    const d = createMemoryDemo()
    for (const id of ['coast-morning-0', 'mountain-walk-1']) {
      const c = d.contributions.find((c) => c.id === id)!
      c.isDemo = false
      c.analysis = { source: 'user', sceneTags: [], activities: [], objects: ['红背包', 'person'] }
    }
    const threads = threadDetector.detect(indexMemory(d, 'hailing', 'a'))
    expect(threads).toHaveLength(1)
    expect(threads[0]?.sceneIds).toHaveLength(2)
    expect(threads[0]?.provenance).toBe('user')
    d.contributions.find((c) => c.id === 'mountain-walk-1')!.visibility = 'private'
    expect(discover(d, 'hailing', 'a').filter((f) => f.type === 'memory_thread')).toEqual([])
  })
})
