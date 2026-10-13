import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Island } from '../../shared/types'
import { distanceMeters, nearestIsland, validGps } from '../../shared/lib/geo'
import { importPhotos } from './importPhotos'

const mocks = vi.hoisted(() => ({ parse: vi.fn() }))
vi.mock('exifr', () => ({ parse: mocks.parse }))

const gpsAt = (meters: number) => ({
  latitude: ((meters / 6371000) * 180) / Math.PI,
  longitude: 0,
})
const islandAt = (meters: number, id = 'anchor'): Island => ({
  id,
  name: id,
  appearance: 0,
  position: { x: 0, y: 0 },
  gpsAnchor: gpsAt(meters),
})

afterEach(() => {
  vi.unstubAllGlobals()
  mocks.parse.mockReset()
})

describe('GPS grouping with fixed anchors', () => {
  it('accepts 299 metres and rejects 301 metres', () => {
    const island = islandAt(0)
    expect(distanceMeters(gpsAt(0), gpsAt(299))).toBeCloseTo(299, 5)
    expect(nearestIsland(gpsAt(299), [island])?.id).toBe('anchor')
    expect(nearestIsland(gpsAt(301), [island])).toBeUndefined()
  })

  it('chooses the closest matching island and rejects invalid coordinates', () => {
    expect(nearestIsland(gpsAt(240), [islandAt(0, 'a'), islandAt(280, 'b')])?.id).toBe('b')
    expect(validGps(Number.NaN, 0)).toBeUndefined()
    expect(validGps(0, 181)).toBeUndefined()
    expect(validGps(0, 0)).toEqual({ latitude: 0, longitude: 0 })
  })
})

function mockImage() {
  vi.stubGlobal(
    'Image',
    class {
      naturalWidth = 100
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      set src(_url: string) {
        queueMicrotask(() => this.onload?.())
      }
    },
  )
}

describe('photo batches', () => {
  it('keeps repeated photos and does not extend an anchor through intermediate photos', async () => {
    mockImage()
    mocks.parse
      .mockResolvedValueOnce(gpsAt(0))
      .mockResolvedValueOnce(gpsAt(299))
      .mockResolvedValueOnce(gpsAt(598))
      .mockResolvedValueOnce(gpsAt(0))
    const files = ['first.jpg', 'near.jpg', 'further.jpg', 'again.jpg'].map(
      (name) => new File(['image'], name, { type: 'image/jpeg' }),
    )
    const result = await importPhotos(files, 'person', [], 0)
    expect(result.failures).toEqual([])
    expect(result.islands).toHaveLength(2)
    expect(result.photos).toHaveLength(4)
    expect(result.photos[0]?.islandId).toBe(result.photos[1]?.islandId)
    expect(result.photos[0]?.islandId).toBe(result.photos[3]?.islandId)
    expect(result.photos[2]?.islandId).not.toBe(result.photos[0]?.islandId)
    expect(result.islands[0]?.gpsAnchor).toEqual(gpsAt(0))
    for (const photo of result.photos) URL.revokeObjectURL(photo.url)
  })

  it('retains missing metadata honestly and continues after an unsupported file', async () => {
    mockImage()
    mocks.parse.mockRejectedValue(new Error('No EXIF'))
    const result = await importPhotos(
      [
        new File(['bad'], 'notes.txt', { type: 'text/plain' }),
        new File(['image'], 'memory.png', { type: 'image/png' }),
      ],
      'photographer',
      [],
      10,
    )
    expect(result.failures).toHaveLength(1)
    expect(result.photos).toHaveLength(1)
    expect(result.photos[0]).toMatchObject({
      photographerId: 'photographer',
      islandId: null,
      importOrder: 11,
    })
    expect(result.photos[0]).not.toHaveProperty('capturedAt')
    expect(result.photos[0]).not.toHaveProperty('gps')
    for (const photo of result.photos) URL.revokeObjectURL(photo.url)
  })

  it('rejects undecodable images while continuing the rest of the batch', async () => {
    let attempts = 0
    vi.stubGlobal(
      'Image',
      class {
        naturalWidth = 100
        onload: (() => void) | null = null
        onerror: (() => void) | null = null
        set src(_url: string) {
          const fail = attempts++ === 0
          queueMicrotask(() => (fail ? this.onerror?.() : this.onload?.()))
        }
      },
    )
    mocks.parse.mockResolvedValue({
      DateTimeOriginal: new Date('2026-05-01T12:00:00Z'),
    })
    const result = await importPhotos(
      ['broken.jpg', 'good.jpg'].map((name) => new File(['image'], name, { type: 'image/jpeg' })),
      'person',
      [],
      0,
    )
    expect(result.failures).toHaveLength(1)
    expect(result.photos).toHaveLength(1)
    expect(result.photos[0]?.capturedAt).toBe(new Date('2026-05-01T12:00:00Z').getTime())
    for (const photo of result.photos) URL.revokeObjectURL(photo.url)
  })
})
