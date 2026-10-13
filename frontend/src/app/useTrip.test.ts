import { describe, expect, it, vi } from 'vitest'
import { useTrip } from './useTrip'

describe('single trip state', () => {
  it('filters photos without changing fixed island positions', () => {
    const trip = useTrip()
    const positions = trip.islands.value.map((island) => ({
      ...island.position,
    }))
    trip.activeParticipantIds.value = ['lin']
    expect(trip.visiblePhotos.value.every((photo) => photo.photographerId === 'lin')).toBe(true)
    trip.activeParticipantIds.value = []
    expect(trip.visiblePhotos.value).toEqual([])
    expect(trip.islands.value.map((island) => island.position)).toEqual(positions)
  })

  it('places an unassigned import into an existing or new place', () => {
    const trip = useTrip()
    trip.addImport({
      islands: [],
      failures: [],
      photos: [
        {
          id: 'new',
          url: 'blob:sample',
          filename: 'test.jpg',
          caption: '',
          photographerId: 'lin',
          islandId: null,
          importOrder: 0,
          source: 'import',
        },
      ],
    })
    trip.placePhoto({ photoId: 'new', islandId: 'island-2' })
    expect(trip.photos.value.find((photo) => photo.id === 'new')?.islandId).toBe('island-2')
    trip.placePhoto({
      photoId: 'new',
      islandId: null,
      newPlaceName: ' 新码头 ',
    })
    expect(trip.islands.value.at(-1)?.name).toBe('新码头')
    expect(trip.photos.value.at(-1)?.islandId).toBe(trip.islands.value.at(-1)?.id)
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    trip.cleanupObjectURLs()
    expect(revoke).toHaveBeenCalledWith('blob:sample')
    revoke.mockRestore()
  })
})
