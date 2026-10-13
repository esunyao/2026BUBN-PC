export interface Point {
  x: number
  y: number
}

export interface Gps {
  latitude: number
  longitude: number
}

export interface Participant {
  id: string
  name: string
  initials: string
  color: string
}

export interface Island {
  id: string
  name: string
  appearance: number
  position: Point
  gpsAnchor?: Gps
}

export interface Photo {
  id: string
  url: string
  filename: string
  caption: string
  photographerId: string
  islandId: string | null
  gps?: Gps
  capturedAt?: number
  importOrder: number
  source: 'demo' | 'import'
}

export type Theme = 'day' | 'night'

export interface ImportResult {
  photos: Photo[]
  islands: Island[]
  failures: string[]
}

export interface PlacePhotoRequest {
  photoId: string
  islandId: string | null
  newPlaceName?: string
}
