import { computed, onScopeDispose, ref, watch, type Ref } from 'vue'
import type { Photo } from '../../shared/types'

export function useReplay(
  photos: Ref<Photo[]>,
  navigateTo: (id: string) => Promise<boolean>,
  onPhoto: (photo: Photo) => void,
) {
  const duration = 120
  const progress = ref(0)
  const isPlaying = ref(false)
  const orderedPhotos = computed(() =>
    photos.value
      .filter((photo) => photo.islandId !== null)
      .sort((a, b) => {
        if (a.capturedAt !== undefined && b.capturedAt !== undefined)
          return a.capturedAt - b.capturedAt || a.importOrder - b.importOrder
        if (a.capturedAt !== undefined) return -1
        if (b.capturedAt !== undefined) return 1
        return a.importOrder - b.importOrder
      }),
  )
  const currentIndex = computed(() =>
    Math.min(
      orderedPhotos.value.length - 1,
      Math.floor((progress.value / duration) * orderedPhotos.value.length),
    ),
  )
  const currentPhoto = computed(() => orderedPhotos.value[currentIndex.value] ?? null)
  let frame = 0
  let lastFrame = 0
  let shownIndex = -1
  let generation = 0

  async function focusCurrent() {
    const photo = currentPhoto.value
    if (!photo || shownIndex === currentIndex.value) return
    shownIndex = currentIndex.value
    const token = ++generation
    const arrived = photo.islandId ? await navigateTo(photo.islandId) : true
    if (token !== generation) return
    if (arrived) onPhoto(photo)
  }

  function tick(now: number) {
    if (!isPlaying.value) return
    progress.value = Math.min(duration, progress.value + (now - lastFrame) / 1000)
    lastFrame = now
    void focusCurrent()
    if (progress.value >= duration) {
      pause()
      return
    }
    frame = requestAnimationFrame(tick)
  }

  function pause() {
    isPlaying.value = false
    cancelAnimationFrame(frame)
    generation++
    shownIndex = -1
  }

  function play() {
    if (!orderedPhotos.value.length || isPlaying.value) return
    if (progress.value >= duration) progress.value = 0
    isPlaying.value = true
    lastFrame = performance.now()
    void focusCurrent()
    frame = requestAnimationFrame(tick)
  }

  function seek(value: number) {
    generation++
    progress.value = Math.max(0, Math.min(duration, value))
    lastFrame = performance.now()
    shownIndex = -1
    void focusCurrent()
  }

  watch(orderedPhotos, () => {
    pause()
    progress.value = 0
  })
  onScopeDispose(pause)
  return {
    duration,
    progress,
    isPlaying,
    orderedPhotos,
    currentPhoto,
    play,
    pause,
    seek,
  }
}
