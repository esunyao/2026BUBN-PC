import type { Point } from '../types'

/** Fixed slots retain their coordinates as the trip grows. */
export function islandPosition(index: number): Point {
  const slot = Math.max(0, Math.floor(index))
  const row = Math.floor(slot / 4)
  const col = slot % 4
  return { x: 230 + col * 320 + (row % 2) * 54, y: 180 + row * 240 }
}
