import { describe, expect, it } from 'vitest'
import { createMemoryDemo } from '../../app/memoryDemo'
import {
  discover,
  gapDetector,
  indexMemory,
  unseenDetector,
  evolutionDetector,
  sameMomentDetector,
} from './engine'

describe('discovery evidence and privacy', () => {
  it('detects distinct close-time owners without claiming real-world novelty or face identity', () => {
    const d = createMemoryDemo(),
      f = unseenDetector.detect(indexMemory(d, 'hailing', 'a'))
    expect(f.length).toBeGreaterThan(0)
    for (const finding of f) {
      expect(finding.evidenceIds.length).toBe(2)
      expect(finding.title).not.toContain('标注')
      expect(finding.reason).toContain('现实中是否看过')
    }
    const c = d.contributions.find((c) => c.id === 'coast-sunset-1')!
    c.participantTags = ['a']
    c.tagsConsent = true
    expect(
      unseenDetector
        .detect(indexMemory(d, 'hailing', 'a'))
        .some((f) => f.reasonCodes.includes('TAGGED_PERSON')),
    ).toBe(true)
    c.tagsConsent = false
    expect(
      unseenDetector
        .detect(indexMemory(d, 'hailing', 'a'))
        .some((f) => f.reasonCodes.includes('TAGGED_PERSON')),
    ).toBe(false)
  })
  it('rejects same owner, unknown times and distant timestamps', () => {
    const d = createMemoryDemo()
    d.contributions.forEach((c) => (c.participantId = 'a'))
    expect(unseenDetector.detect(indexMemory(d, 'hailing', 'a'))).toEqual([])
    const unknown = createMemoryDemo()
    unknown.contributions.forEach(
      (c) => (c.timeEvidence = { precision: 'unknown', source: 'user' }),
    )
    expect(sameMomentDetector.detect(indexMemory(unknown, 'hailing', 'a'))).toEqual([])
    const distant = createMemoryDemo()
    distant.contributions.forEach((c) => {
      if (c.participantId !== 'a')
        c.timeEvidence = { start: '2026-09-01T10:00:00+08:00', precision: 'exact', source: 'user' }
    })
    expect(unseenDetector.detect(indexMemory(distant, 'hailing', 'a'))).toEqual([])
  })
  it('finds bounded same-day gaps once and excludes unknown, out-of-range and cross-day records', () => {
    const d = createMemoryDemo(),
      ctx = indexMemory(d, 'hailing', 'a'),
      result = gapDetector.detect(ctx)
    expect(result.some((f) => f.gapId === 'gap-coast-coast-sunset-coast-evening')).toBe(true)
    expect(result.length).toBeLessThanOrEqual(3)
    expect(gapDetector.detect(ctx).map((f) => f.id)).toEqual(result.map((f) => f.id))
    const outside = createMemoryDemo()
    outside.events[0]!.endAt = '2026-08-16T10:00:00+08:00'
    expect(gapDetector.detect(indexMemory(outside, 'hailing', 'a'))).toEqual([])
    const unknown = createMemoryDemo()
    unknown.contributions.forEach(
      (c) => (c.timeEvidence = { precision: 'unknown', source: 'user' }),
    )
    expect(gapDetector.detect(indexMemory(unknown, 'hailing', 'a'))).toEqual([])
    for (const f of gapDetector.detect(indexMemory(d, 'gala', 'a')))
      expect(f.timeRange?.start?.slice(0, 10)).toBe(f.timeRange?.end?.slice(0, 10))
  })
  it('does not expose private evidence or author counts to another viewer', () => {
    const d = createMemoryDemo(),
      hidden = d.contributions.find((c) => c.id === 'coast-sunset-1')!
    hidden.visibility = 'private'
    const a = discover(d, 'hailing', 'a'),
      b = discover(d, 'hailing', 'b')
    expect(a.some((f) => f.evidenceIds.includes(hidden.id))).toBe(false)
    expect(b.some((f) => f.evidenceIds.includes(hidden.id))).toBe(true)
    expect(discover(d, 'hailing', 'stranger')).toEqual([])
    const pair = d.contributions.find((c) => c.id === 'coast-sunset-0')!
    pair.visibility = 'private'
    expect(evolutionDetector.detect(indexMemory(d, 'hailing', 'b')).length).toBe(0)
  })
  it('uses stable feedback keys across reruns and never mixes viewers', () => {
    const d = createMemoryDemo(),
      a = discover(d, 'hailing', 'a'),
      f = a[0]!
    const feedback = { [`a:${f.id}`]: { status: 'dismissed' as const } }
    expect(discover(d, 'hailing', 'a', feedback).some((v) => v.id === f.id)).toBe(false)
    expect(discover(d, 'hailing', 'a', feedback, true).find((v) => v.id === f.id)?.status).toBe(
      'dismissed',
    )
    for (const viewer of ['a', 'b', 'c', 'a'])
      for (const item of discover(d, 'hailing', viewer).filter((f) => f.type === 'unseen_moment'))
        expect(item.participantIds).toContain(viewer)
  })
})
