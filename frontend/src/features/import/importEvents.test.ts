import { describe, expect, it } from 'vitest'
import { buildImportedEvents } from './importEvents'
import type { AnalyzedPhoto } from './photoAnalysis'
import type { EventCandidate } from './eventGrouping'
import type { EnvironmentRecipe } from '../../shared/memoryTypes'
const environment: EnvironmentRecipe = {
  preset: 'neutral',
  lighting: 'morning',
  palette: { base: '', paper: '', ink: '', accent: '', overlay: '' },
  surfaceTexture: '',
  props: [],
  blurPx: 0,
  vignette: 0,
  grainOpacity: 0,
  parallaxStrength: 0,
}
const start = new Date(2026, 9, 13, 9).getTime()
const item = (id: string, extra: Partial<AnalyzedPhoto> = {}): AnalyzedPhoto => ({
  id,
  filename: id + '.jpg',
  url: 'blob:' + id,
  file: new File(['x'], id + '.jpg'),
  capturedAt: start,
  timeSource: 'exif',
  ...extra,
})
const group = (photoIds: string[], extra: Partial<EventCandidate> = {}): EventCandidate => ({
  id: 'group',
  title: 'A real trip',
  photoIds,
  reasons: [],
  needsReview: true,
  ...extra,
})
describe('publishing reviewed event candidates', () => {
  it('preserves source and authors while separating locations and 30 minute moments', () => {
    const photos = [
      item('a', { gps: { latitude: 22, longitude: 113 } }),
      item('b', {
        gps: { latitude: 22.0001, longitude: 113 },
        capturedAt: start + 60 * 60000,
        timeSource: 'user',
      }),
      item('c'),
    ]
    const patch = buildImportedEvents(photos, [group(['a', 'b', 'c'])], 'person', environment)
    expect(patch.events[0]?.participantIds).toEqual(['person'])
    expect(patch.scenes).toHaveLength(2)
    expect(patch.moments).toHaveLength(3)
    expect(patch.contributions.find((c) => c.id === 'b')?.timeEvidence?.source).toBe('user')
    expect(patch.contributions.map((c) => c.fileId)).toEqual(['a', 'c', 'b'])
    expect(photos[0]?.id).toBe('a')
  })
  it('requires a manually supplied event date without inventing EXIF for unknown photos', () => {
    const photos = [item('a', { capturedAt: undefined, timeSource: 'unknown' })]
    expect(() => buildImportedEvents(photos, [group(['a'])], 'person', environment)).toThrow('日期')
    const patch = buildImportedEvents(
      photos,
      [group(['a'], { manualStart: '2026-10-13T09:00' })],
      'person',
      environment,
    )
    expect(patch.contributions[0]?.timeEvidence?.precision).toBe('unknown')
    expect(patch.contributions[0]?.capturedAt).toBeUndefined()
  })
  it('rejects duplicate assignments or stale IDs before publishing any patch', () => {
    const photos = [item('a')]
    expect(() => buildImportedEvents(photos, [group(['a', 'a'])], 'person', environment)).toThrow()
    expect(() => buildImportedEvents(photos, [group(['missing'])], 'person', environment)).toThrow()
    expect(() => buildImportedEvents(photos, [group([])], 'person', environment)).toThrow()
  })
})
