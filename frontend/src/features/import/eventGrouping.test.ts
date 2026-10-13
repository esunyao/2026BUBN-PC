import { describe, expect, it } from 'vitest'
import { cosine, groupPhotos, type GroupPhoto } from './eventGrouping'
const time = new Date(2026, 9, 13, 9).getTime()
const photo = (id: string, hours: number, extra: Partial<GroupPhoto> = {}): GroupPhoto => ({
  id,
  filename: id + '.jpg',
  capturedAt: time + hours * 3600000,
  ...extra,
})
describe('event candidates from independent evidence', () => {
  it('uses time and nearby GPS while allowing different views of the same event', () => {
    const groups = groupPhotos([
      photo('a', 0, { gps: { latitude: 22, longitude: 113 }, embedding: [1, 0] }),
      photo('b', 1, { gps: { latitude: 22.001, longitude: 113 }, embedding: [0, 1] }),
    ])
    expect(groups).toHaveLength(1)
    expect(groups[0]?.reasons).toContain('画面不同，时间与位置支持同一活动')
  })
  it('does not merge visually identical images across dates, large time gaps or distant GPS', () => {
    const base = { embedding: [1, 0], gps: { latitude: 22, longitude: 113 } }
    expect(groupPhotos([photo('a', 0, base), photo('b', 24, base)])).toHaveLength(2)
    expect(groupPhotos([photo('a', 0, base), photo('b', 4, base)])).toHaveLength(2)
    expect(
      groupPhotos([
        photo('a', 0, base),
        photo('b', 1, { ...base, gps: { latitude: 30, longitude: 120 } }),
      ]),
    ).toHaveLength(2)
  })
  it('uses visual differences when GPS is missing but leaves unknown times for human review', () => {
    expect(
      groupPhotos([photo('a', 0, { embedding: [1, 0] }), photo('b', 1, { embedding: [0, 1] })]),
    ).toHaveLength(2)
    const groups = groupPhotos([
      { id: 'x', filename: 'unknown.jpg', embedding: [1, 0] },
      photo('a', 0, { embedding: [1, 0] }),
    ])
    expect(groups).toHaveLength(2)
    expect(groups[1]?.needsReview).toBe(true)
  })
  it('does not grow clusters through moving location anchors or unbounded time chains', () => {
    const gps = (longitude: number) => ({ latitude: 0, longitude })
    expect(
      groupPhotos([
        photo('a', 0, { gps: gps(0) }),
        photo('b', 1, { gps: gps(0.2) }),
        photo('c', 2, { gps: gps(0.4) }),
      ]),
    ).toHaveLength(2)
    expect(
      groupPhotos(
        Array.from({ length: 7 }, (_, i) =>
          photo(String(i), i * 2.5, { capturedAt: time - 3 * 3600000 + i * 2.5 * 3600000 }),
        ),
      ),
    ).toHaveLength(2)
  })
  it('uses the first available GPS even if the first photo has no location', () => {
    const photos = [
      photo('a', 0, { embedding: [1, 0] }),
      photo('b', 1, { embedding: [1, 0], gps: { latitude: 22, longitude: 113 } }),
      photo('c', 2, { embedding: [1, 0], gps: { latitude: 30, longitude: 120 } }),
    ]
    expect(groupPhotos(photos)).toHaveLength(2)
  })
  it('skips byte-identical duplicates and has deterministic results regardless of file order', () => {
    const items = [photo('b', 1), photo('a', 0), photo('copy', 0, { duplicateOf: 'a' })]
    expect(groupPhotos(items)).toEqual(groupPhotos([...items].reverse()))
    expect(groupPhotos(items)[0]?.photoIds).toEqual(['a', 'b'])
    expect(cosine([0, 0], [0, 0])).toBeUndefined()
    expect(cosine([1, NaN], [1, 0])).toBeUndefined()
  })
})
