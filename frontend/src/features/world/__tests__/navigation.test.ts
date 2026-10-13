import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, ref } from 'vue'
import { useNavigation } from '../../../navigation/useNavigation'
import { islandPosition } from '../../../shared/lib/layout'
import type { Island, Point } from '../../../shared/types'

let frames = new Map<number, FrameRequestCallback>()
let nextFrame = 0
let time = 0
const scopes: ReturnType<typeof effectScope>[] = []

function step() {
  time += 50
  const pending = [...frames.values()]
  frames.clear()
  pending.forEach((callback) => callback(time))
}

function trip(count = 10) {
  return ref<Island[]>(
    Array.from({ length: count }, (_, index) => ({
      id: 'island-' + index,
      name: 'Island ' + index,
      appearance: index % 10,
      position: islandPosition(index),
    })),
  )
}

function setup(count = 10) {
  const islands = trip(count)
  const arrived = vi.fn()
  const scope = effectScope()
  scopes.push(scope)
  const navigation = scope.run(() => useNavigation(islands, arrived))!
  return { islands, arrived, ...navigation }
}

function seaSafe(point: Point, islands: Island[]) {
  return islands.every(
    (island) =>
      ((point.x - island.position.x) / 111) ** 2 + ((point.y - island.position.y - 6) / 48) ** 2 >=
      1,
  )
}

beforeEach(() => {
  frames = new Map()
  nextFrame = 0
  time = 0
  vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) })
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    frames.set(++nextFrame, callback)
    return nextFrame
  })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id))
})
afterEach(() => {
  scopes.splice(0).forEach((scope) => scope.stop())
  vi.unstubAllGlobals()
})

describe('island layout and sea navigation', () => {
  it('keeps all existing slots stable when the archipelago expands to 50 islands', () => {
    const before = trip().value.map((island) => island.position)
    const expanded = trip(50).value
    expect(expanded.slice(0, 10).map((island) => island.position)).toEqual(before)
    expect(
      new Set(expanded.map((island) => island.position.x + ',' + island.position.y)).size,
    ).toBe(50)
  })

  it('visits every island without crossing an island body', async () => {
    const nav = setup()
    for (const island of nav.islands.value) {
      const journey = nav.navigateTo(island.id)
      for (let frame = 0; frame < 2000 && nav.isMoving.value; frame++) {
        step()
        expect(seaSafe(nav.position.value, nav.islands.value)).toBe(true)
      }
      expect(await journey).toBe(true)
      expect(nav.position.value).toEqual({ x: island.position.x, y: island.position.y + 72 })
    }
    expect(nav.arrived).toHaveBeenCalledTimes(10)
  })

  it('routes across an expanded 50-island map', async () => {
    const nav = setup(50)
    const journey = nav.navigateTo('island-49')
    for (let frame = 0; frame < 2000 && nav.isMoving.value; frame++) {
      step()
      expect(seaSafe(nav.position.value, nav.islands.value)).toBe(true)
    }
    expect(await journey).toBe(true)
    expect(nav.arrived).toHaveBeenCalledWith('island-49')
  })

  it('cancels an automatic trip on manual input and normalizes diagonal speed', async () => {
    const nav = setup()
    const journey = nav.navigateTo('island-3')
    nav.setManualVector({ x: 1, y: 1 })
    expect(await journey).toBe(false)
    const start = { ...nav.position.value }
    step()
    step()
    expect(Math.hypot(nav.position.value.x - start.x, nav.position.value.y - start.y)).toBeCloseTo(
      9.5,
    )
    expect(nav.arrived).not.toHaveBeenCalled()
    nav.setManualVector({ x: 0, y: 0 })
    step()
    expect(nav.isMoving.value).toBe(false)
    expect(frames.size).toBe(0)
  })

  it('blocks manual travel into a coast and cancels prior click tasks', async () => {
    const nav = setup()
    nav.setManualVector({ x: 0, y: -1 })
    for (let frame = 0; frame < 50; frame++) {
      step()
      expect(seaSafe(nav.position.value, nav.islands.value)).toBe(true)
    }
    nav.stop()
    const first = nav.navigateTo('island-8')
    const second = nav.navigateTo('island-3')
    expect(await first).toBe(false)
    nav.stop()
    expect(await second).toBe(false)
    expect(frames.size).toBe(0)
  })

  it('arrives immediately when reduced motion is requested', async () => {
    vi.stubGlobal('window', { matchMedia: () => ({ matches: true }) })
    const nav = setup()
    expect(await nav.navigateTo('island-4')).toBe(true)
    expect(nav.arrived).toHaveBeenCalledWith('island-4')
    expect(frames.size).toBe(0)
  })
})
