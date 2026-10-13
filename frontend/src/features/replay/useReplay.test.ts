import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, ref } from 'vue'
import type { Photo } from '../../shared/types'
import { useReplay } from './useReplay'

const photo = (id: string, islandId: string | null, capturedAt?: number): Photo => ({
  id,
  islandId,
  capturedAt,
  url: 'demo.webp',
  filename: 'demo.webp',
  caption: id,
  photographerId: 'lin',
  importOrder: Number(id),
  source: 'demo',
})

beforeEach(() => vi.stubGlobal('cancelAnimationFrame', vi.fn()))
afterEach(() => vi.unstubAllGlobals())

describe('trip replay', () => {
  it('waits for a photo to be placed before including it in the route', () => {
    const photos = ref([photo('1', 'a', 100), photo('2', null)])
    const scope = effectScope()
    const replay = scope.run(() =>
      useReplay(
        photos,
        async () => true,
        () => {},
      ),
    )!
    expect(replay.orderedPhotos.value.map((item) => item.id)).toEqual(['1'])
    photos.value[1]!.islandId = 'b'
    expect(replay.orderedPhotos.value.map((item) => item.id)).toEqual(['1', '2'])
    scope.stop()
  })

  it('keeps repeated places in time order and appends missing timestamps', () => {
    const scope = effectScope()
    const replay = scope.run(() =>
      useReplay(
        ref([photo('3', 'a'), photo('2', 'a', 200), photo('1', 'b', 100)]),
        async () => true,
        () => {},
      ),
    )!
    expect(replay.orderedPhotos.value.map((item) => item.id)).toEqual(['1', '2', '3'])
    scope.stop()
  })

  it('ignores a pending arrival after manual pause or a newer seek', async () => {
    const arrivals: Array<(arrived: boolean) => void> = []
    const navigate = vi.fn(() => new Promise<boolean>((resolve) => arrivals.push(resolve)))
    const focus = vi.fn()
    const scope = effectScope()
    const replay = scope.run(() =>
      useReplay(ref([photo('1', 'a', 100), photo('2', 'b', 200)]), navigate, focus),
    )!
    replay.seek(0)
    replay.pause()
    arrivals[0]!(true)
    await Promise.resolve()
    expect(focus).not.toHaveBeenCalled()
    replay.seek(0)
    replay.seek(90)
    arrivals[1]!(true)
    arrivals[2]!(true)
    await Promise.resolve()
    expect(focus).toHaveBeenCalledTimes(1)
    expect(focus.mock.calls[0]![0].id).toBe('2')
    scope.stop()
  })

  it('advances one 120 second clock even while navigation is pending', () => {
    let tick: FrameRequestCallback = () => {}
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      tick = callback
      return 1
    })
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
    const scope = effectScope()
    const replay = scope.run(() =>
      useReplay(
        ref([photo('1', 'a', 100)]),
        () => new Promise(() => {}),
        () => {},
      ),
    )!
    const before = performance.now()
    replay.play()
    tick(before + 120_100)
    expect(replay.progress.value).toBe(120)
    expect(replay.isPlaying.value).toBe(false)
    scope.stop()
  })
})
