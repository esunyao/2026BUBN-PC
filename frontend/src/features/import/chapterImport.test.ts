import { describe, expect, it } from 'vitest'
import { buildChapterImport } from './chapterImport'
import { chapterCandidates } from './chapterDrafts'
import type { AnalyzedPhoto } from './photoAnalysis'
import type { EnvironmentPreset, EnvironmentRecipe } from '../../shared/memoryTypes'
const recipe: EnvironmentRecipe = {
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
const recipes = Object.fromEntries(
  ['coastal', 'alpine', 'urban', 'ceremony', 'neutral'].map((id) => [
    id,
    { ...recipe, preset: id },
  ]),
) as Record<EnvironmentPreset, EnvironmentRecipe>
const photo = (id: string, capturedAt?: number, embedding?: number[]): AnalyzedPhoto => ({
  id,
  filename: id + '.jpg',
  file: new File(['test'], id + '.jpg'),
  url: 'blob:' + id,
  timeSource: capturedAt === undefined ? 'unknown' : 'exif',
  capturedAt,
  embedding,
})
describe('chapter first automatic import', () => {
  it('keeps related photos in one chapter event and preserves singletons separately', () => {
    const t = new Date(2026, 9, 13, 9).getTime()
    const photos = [photo('a', t), photo('b', t + 10 * 60000), photo('c', t + 24 * 3600000)]
    const patch = buildChapterImport(
      photos,
      chapterCandidates(photos),
      'chapter',
      'person',
      recipes,
    )
    expect(patch.scenes).toHaveLength(1)
    expect(patch.scenes[0]?.eventId).toBe('chapter')
    expect(patch.contributions.map((c) => c.id)).toEqual(['a', 'b'])
    expect(patch.pendingPhotos[0]?.id).toBe('c')
    expect(patch.pendingPhotos[0]?.eventId).toBe('chapter')
  })
  it('can organize visually related photos without inventing a capture date', () => {
    const photos = [
      photo('a', undefined, [1, 0]),
      photo('b', undefined, [1, 0]),
      photo('c', undefined, [0, 1]),
    ]
    const patch = buildChapterImport(
      photos,
      chapterCandidates(photos),
      'chapter',
      'person',
      recipes,
    )
    expect(patch.scenes).toHaveLength(1)
    expect(patch.pendingPhotos).toHaveLength(1)
    expect(
      patch.contributions.every(
        (c) => c.timeEvidence?.precision === 'unknown' && c.capturedAt === undefined,
      ),
    ).toBe(true)
    expect(patch.moments.every((m) => m.label === '时间待确认')).toBe(true)
  })
  it('rejects missing or double-assigned photos before publishing and retains original HEIC references', () => {
    const photos = [
      photo('a'),
      { ...photo('b'), displayBlob: new Blob(['jpeg'], { type: 'image/jpeg' }) },
    ]
    expect(() => buildChapterImport(photos, [], 'chapter', 'person', recipes)).toThrow('还有照片')
    expect(() =>
      buildChapterImport(
        photos,
        [{ id: 'g', title: 'x', photoIds: ['a', 'a'], needsReview: true, reasons: [] }],
        'chapter',
        'person',
        recipes,
      ),
    ).toThrow('重复')
    const patch = buildChapterImport(
      photos,
      [
        {
          id: 'g',
          title: '海岸光影',
          photoIds: ['a', 'b'],
          needsReview: true,
          reasons: [],
          description: '海边照片',
          copySource: 'deepseek',
        },
      ],
      'chapter',
      'person',
      recipes,
    )
    expect(patch.scenes[0]?.environment.preset).toBe('coastal')
    expect(patch.scenes[0]?.copySource).toBe('deepseek')
    expect(patch.contributions[1]?.originalFileId).toBe('b-original')
    expect(patch.contributions[1]?.writtenText).toBeUndefined()
  })
})
