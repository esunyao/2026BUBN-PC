import { onScopeDispose, ref, type Ref } from 'vue'
import type { Island, Point } from '../shared/types'

const SPEED = 190
const RX = 111
const RY = 48
const dock = (island: Island): Point => ({ x: island.position.x, y: island.position.y + 72 })
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y)

function intersects(a: Point, b: Point, island: Island): boolean {
  const center = { x: island.position.x, y: island.position.y + 6 }
  if (
    Math.max(a.x, b.x) < center.x - RX ||
    Math.min(a.x, b.x) > center.x + RX ||
    Math.max(a.y, b.y) < center.y - RY ||
    Math.min(a.y, b.y) > center.y + RY
  )
    return false
  const ax = (a.x - center.x) / RX
  const ay = (a.y - center.y) / RY
  const dx = (b.x - a.x) / RX
  const dy = (b.y - a.y) / RY
  const t = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / (dx * dx + dy * dy || 1)))
  return (ax + t * dx) ** 2 + (ay + t * dy) ** 2 < 1
}

/** Visibility graph around eight safe sea points per relevant island. */
function route(start: Point, target: Point, islands: Island[]): Point[] {
  const clear = (a: Point, b: Point) => !islands.some((island) => intersects(a, b, island))
  if (clear(start, target)) return [target]
  const nearby = islands.filter(
    (island) =>
      island.position.x >= Math.min(start.x, target.x) - 400 &&
      island.position.x <= Math.max(start.x, target.x) + 400 &&
      island.position.y >= Math.min(start.y, target.y) - 300 &&
      island.position.y <= Math.max(start.y, target.y) + 300,
  )
  const nodes: Point[] = [start, target]
  for (const island of nearby) {
    for (let step = 0; step < 8; step++) {
      const angle = (step * Math.PI) / 4
      nodes.push({
        x: island.position.x + Math.cos(angle) * 139,
        y: island.position.y + 6 + Math.sin(angle) * 69,
      })
    }
  }
  const costs = nodes.map(() => Infinity)
  const previous = nodes.map(() => -1)
  const visited = new Set<number>()
  costs[0] = 0
  for (let iteration = 0; iteration < nodes.length; iteration++) {
    let current = -1
    let minimum = Infinity
    for (let index = 0; index < nodes.length; index++) {
      if (!visited.has(index) && (costs[index] ?? Infinity) < minimum) {
        minimum = costs[index] ?? Infinity
        current = index
      }
    }
    if (current === -1) break
    if (current === 1) {
      const result: Point[] = []
      let cursor = 1
      while (cursor > 0) {
        const node = nodes[cursor]
        if (!node) break
        result.unshift(node)
        cursor = previous[cursor] ?? -1
      }
      return result
    }
    visited.add(current)
    const origin = nodes[current]
    if (!origin) continue
    for (let index = 1; index < nodes.length; index++) {
      const next = nodes[index]
      if (!next || visited.has(index)) continue
      const cost = minimum + distance(origin, next)
      if (cost < (costs[index] ?? Infinity) && clear(origin, next)) {
        costs[index] = cost
        previous[index] = current
      }
    }
  }
  return []
}

export function useNavigation(islands: Ref<Island[]>, onArrive: (id: string) => void) {
  const position = ref<Point>(islands.value[0] ? dock(islands.value[0]) : { x: 230, y: 252 })
  const heading = ref(0)
  const isMoving = ref(false)
  let manual: Point = { x: 0, y: 0 }
  let points: Point[] = []
  let targetId: string | null = null
  let lastArrivedId: string | null = islands.value[0]?.id ?? null
  let complete: ((arrived: boolean) => void) | null = null
  let frame = 0
  let previousTime = 0
  const reducedMotion =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

  function cancelTask() {
    complete?.(false)
    complete = null
    points = []
    targetId = null
  }

  function arrive(id: string) {
    lastArrivedId = id
    const resolve = complete
    complete = null
    points = []
    targetId = null
    isMoving.value = false
    onArrive(id)
    resolve?.(true)
  }

  function tick(time: number) {
    frame = 0
    const dt = previousTime ? Math.min((time - previousTime) / 1000, 0.05) : 0
    previousTime = time
    const destination = points[0]
    const manualLength = Math.hypot(manual.x, manual.y)
    if (manualLength > 0) {
      const amount = SPEED * dt
      const desired = {
        x: position.value.x + manual.x * amount,
        y: position.value.y + manual.y * amount,
      }
      const safe = (point: Point) =>
        !islands.value.some((island) => intersects(position.value, point, island))
      if (safe(desired)) position.value = desired
      else {
        const horizontal = { x: desired.x, y: position.value.y }
        const vertical = { x: position.value.x, y: desired.y }
        if (safe(horizontal)) position.value = horizontal
        else if (safe(vertical)) position.value = vertical
      }
      heading.value = (Math.atan2(manual.y, manual.x) * 180) / Math.PI
      const island = islands.value.find((item) => distance(position.value, dock(item)) < 22)
      if (island && island.id !== lastArrivedId) arrive(island.id)
      if (!island) lastArrivedId = null
      isMoving.value = true
    } else if (destination) {
      const remaining = distance(position.value, destination)
      const amount = SPEED * dt
      heading.value =
        (Math.atan2(destination.y - position.value.y, destination.x - position.value.x) * 180) /
        Math.PI
      if (remaining <= Math.max(amount, 1)) {
        position.value = { ...destination }
        points.shift()
        if (!points.length && targetId) arrive(targetId)
      } else {
        position.value = {
          x: position.value.x + ((destination.x - position.value.x) / remaining) * amount,
          y: position.value.y + ((destination.y - position.value.y) / remaining) * amount,
        }
      }
      isMoving.value = points.length > 0
    } else isMoving.value = false
    if (manualLength > 0 || points.length) frame = requestAnimationFrame(tick)
    else previousTime = 0
  }

  function startFrame() {
    if (!frame) frame = requestAnimationFrame(tick)
  }

  function stop() {
    cancelTask()
    manual = { x: 0, y: 0 }
    isMoving.value = false
    cancelAnimationFrame(frame)
    frame = 0
    previousTime = 0
  }

  function setManualVector(vector: Point) {
    const length = Math.hypot(vector.x, vector.y)
    if (length > 0) cancelTask()
    manual = length ? { x: vector.x / length, y: vector.y / length } : { x: 0, y: 0 }
    isMoving.value = length > 0 || points.length > 0
    if (isMoving.value) startFrame()
  }

  function navigateTo(id: string): Promise<boolean> {
    stop()
    const island = islands.value.find((item) => item.id === id)
    if (!island) return Promise.resolve(false)
    const destination = dock(island)
    if (reducedMotion || distance(position.value, destination) < 2) {
      position.value = destination
      arrive(id)
      return Promise.resolve(true)
    }
    points = route(position.value, destination, islands.value)
    if (!points.length) return Promise.resolve(false)
    targetId = id
    isMoving.value = true
    const promise = new Promise<boolean>((resolve) => {
      complete = resolve
    })
    startFrame()
    return promise
  }

  onScopeDispose(stop)
  return { position, heading, isMoving, navigateTo, setManualVector, stop }
}
