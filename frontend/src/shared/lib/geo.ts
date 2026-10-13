import type { Gps, Island } from '../types'

export function validGps(latitude: unknown, longitude: unknown): Gps | undefined {
  if (
    typeof latitude !== 'number' ||
    typeof longitude !== 'number' ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    Math.abs(latitude) > 90 ||
    Math.abs(longitude) > 180
  )
    return undefined
  return { latitude, longitude }
}

export function distanceMeters(a: Gps, b: Gps): number {
  const radians = (degrees: number) => (degrees * Math.PI) / 180
  const deltaLatitude = radians(b.latitude - a.latitude)
  const deltaLongitude = radians(b.longitude - a.longitude)
  const value =
    Math.sin(deltaLatitude / 2) ** 2 +
    Math.cos(radians(a.latitude)) *
      Math.cos(radians(b.latitude)) *
      Math.sin(deltaLongitude / 2) ** 2
  return 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, value))))
}

/** Anchors never move: a nearby intermediate photo cannot extend a group. */
export function nearestIsland(gps: Gps, islands: Island[], radius = 300): Island | undefined {
  let closest: Island | undefined
  let minimum = radius
  for (const island of islands) {
    if (!island.gpsAnchor) continue
    const distance = distanceMeters(gps, island.gpsAnchor)
    if (distance <= minimum && (!closest || distance < minimum)) {
      closest = island
      minimum = distance
    }
  }
  return closest
}
