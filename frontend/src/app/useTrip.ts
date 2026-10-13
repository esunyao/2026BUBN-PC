import { computed, ref } from 'vue'
import type { ImportResult, PlacePhotoRequest } from '../shared/types'
import { islandPosition } from '../shared/lib/layout'
import { createDemoTrip } from './demoTrip'

export function useTrip() {
  const demo = createDemoTrip()
  const islands = ref(demo.islands)
  const photos = ref(demo.photos)
  const participants = ref(demo.participants)
  const activeParticipantIds = ref(participants.value.map((person) => person.id))
  const selectedIslandId = ref<string | null>(null)
  const visiblePhotos = computed(() =>
    photos.value.filter((photo) => activeParticipantIds.value.includes(photo.photographerId)),
  )
  const selectedIsland = computed(
    () => islands.value.find((island) => island.id === selectedIslandId.value) ?? null,
  )
  const selectedPhotos = computed(() =>
    visiblePhotos.value.filter((photo) => photo.islandId === selectedIslandId.value),
  )

  function addImport(result: ImportResult) {
    const known = new Set(islands.value.map((island) => island.id))
    for (const island of result.islands) {
      if (!known.has(island.id)) {
        islands.value.push({
          ...island,
          position: islandPosition(islands.value.length),
        })
        known.add(island.id)
      }
    }
    const photoIds = new Set(photos.value.map((photo) => photo.id))
    for (const photo of result.photos) {
      if (!photoIds.has(photo.id)) {
        photos.value.push({ ...photo, importOrder: photos.value.length })
        photoIds.add(photo.id)
      }
    }
  }

  function placePhoto(request: PlacePhotoRequest) {
    const photo = photos.value.find((item) => item.id === request.photoId)
    if (!photo) return
    if (request.newPlaceName?.trim()) {
      const id = `place-${crypto.randomUUID()}`
      islands.value.push({
        id,
        name: request.newPlaceName.trim(),
        appearance: islands.value.length % 10,
        position: islandPosition(islands.value.length),
        gpsAnchor: photo.gps,
      })
      photo.islandId = id
    } else {
      photo.islandId =
        request.islandId && islands.value.some((island) => island.id === request.islandId)
          ? request.islandId
          : null
    }
  }

  function cleanupObjectURLs() {
    for (const photo of photos.value)
      if (photo.url.startsWith('blob:')) URL.revokeObjectURL(photo.url)
  }

  return {
    islands,
    photos,
    participants,
    activeParticipantIds,
    selectedIslandId,
    visiblePhotos,
    selectedIsland,
    selectedPhotos,
    addImport,
    placePhoto,
    cleanupObjectURLs,
  }
}
