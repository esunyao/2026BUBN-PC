import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { createMemoryDemo, presets } from './memoryDemo'
import { validateArchive } from './useMemories'

describe('hero demo integrity', () => {
  it('links both journeys to real locally credited assets and consistent owners', () => {
    const d = createMemoryDemo()
    expect(validateArchive(d)).toBe(true)
    const manifest = JSON.parse(readFileSync('public/demo-assets/manifest.json', 'utf8')) as Array<{
      local: string
    }>
    for (const c of d.contributions) {
      expect(d.moments.find((m) => m.id === c.momentId)?.contributionIds).toContain(c.id)
      expect(manifest.some((asset) => asset.local === c.mediaUrl)).toBe(true)
      expect(existsSync(`public${c.mediaUrl}`)).toBe(true)
    }
    for (const event of d.events)
      expect(
        d.contributions.filter((c) =>
          d.moments.some((m) => m.id === c.momentId && event.sceneIds.includes(m.sceneId)),
        ).length,
      ).toBeGreaterThanOrEqual(10)
    for (const preset of Object.values(presets))
      expect(existsSync(`public${preset.surfaceTexture}`)).toBe(true)
  })
  it('preserves distinct authors at sunset and on stage with honest comparisons', () => {
    const d = createMemoryDemo()
    for (const id of ['coast-sunset', 'stage-show']) {
      const link = d.links.find((l) => l.momentIds.includes(id))!
      const photos = d.contributions.filter((c) => link.contributionIds.includes(c.id))
      expect(new Set(photos.map((c) => c.participantId)).size).toBe(3)
      expect(new Set(photos.map((c) => c.mediaUrl)).size).toBe(photos.length)
    }
    expect(d.pairs.every((pair) => pair.comparisonMode === 'sideBySide')).toBe(true)
    const stage = d.pairs.find((p) => p.sceneId === 'stage')!
    const momentAt = (id: string) =>
      Date.parse(
        d.moments.find((m) => m.id === d.contributions.find((c) => c.id === id)?.momentId)!.startAt,
      )
    expect(
      momentAt(stage.afterContributionId) - momentAt(stage.beforeContributionId),
    ).toBeGreaterThan(60 * 86400000)
  })
  it('rejects broken references, duplicate ids, CSS injection and unsupported media', () => {
    expect(validateArchive(null)).toBe(false)
    for (const mutate of [
      (d: ReturnType<typeof createMemoryDemo>) => {
        d.contributions[0]!.momentId = 'missing'
      },
      (d: ReturnType<typeof createMemoryDemo>) => {
        d.moments.push(d.moments[0]!)
      },
      (d: ReturnType<typeof createMemoryDemo>) => {
        d.contributions[0]!.mediaUrl = 'javascript:alert(1)'
      },
      (d: ReturnType<typeof createMemoryDemo>) => {
        Object.assign(d.scenes[0]!.environment, { preset: '__proto__' })
      },
      (d: ReturnType<typeof createMemoryDemo>) => {
        Object.assign(d.contributions[0]!, { gps: { latitude: 'x' } })
      },
    ]) {
      const d = createMemoryDemo()
      mutate(d)
      expect(validateArchive(d)).toBe(false)
    }
  })
})
