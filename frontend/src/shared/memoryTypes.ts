export type EnvironmentPreset = 'coastal' | 'alpine' | 'urban' | 'ceremony' | 'neutral'
export interface EnvironmentRecipe {
  preset: EnvironmentPreset
  lighting: 'morning' | 'golden-hour' | 'overcast' | 'night' | 'stage-warm'
  backgroundPhotoId?: string
  palette: { base: string; paper: string; ink: string; accent: string; overlay: string }
  surfaceTexture: string
  props: Array<{
    assetId: string
    anchor: 'tl' | 'tr' | 'bl' | 'br'
    scale: number
    opacity: number
    rotation: number
  }>
  blurPx: number
  vignette: number
  grainOpacity: number
  parallaxStrength: number
}
export interface MemoryParticipant {
  id: string
  displayName: string
  color: string
}
export interface MemoryEvent {
  id: string
  title: string
  subtitle: string
  type: 'trip' | 'longActivity'
  sceneIds: string[]
  participantIds: string[]
  isDemo: boolean
}
export interface Scene {
  id: string
  eventId: string
  title: string
  subtitle: string
  momentIds: string[]
  environment: EnvironmentRecipe
}
export interface Moment {
  id: string
  sceneId: string
  title: string
  startAt: string
  label: string
  lighting: EnvironmentRecipe['lighting']
  contributionIds: string[]
}
export interface Contribution {
  id: string
  momentId: string
  participantId: string
  kind: 'photo' | 'note'
  thumbnailUrl?: string
  mediaUrl?: string
  writtenText?: string
  mood: string[]
  isDemo: boolean
  alt: string
  capturedAt?: number
  gps?: { latitude: number; longitude: number }
  fileId?: string
}
export interface SharedMomentLink {
  id: string
  momentIds: string[]
  contributionIds: string[]
  relation: 'sameMoment' | 'sameScene' | 'sameEvent'
  reason: string
  confidence: number
}
export interface ThenNowPair {
  id: string
  sceneId: string
  beforeContributionId: string
  afterContributionId: string
  comparisonMode: 'wipe' | 'sideBySide'
}
export interface MemoryData {
  participants: MemoryParticipant[]
  events: MemoryEvent[]
  scenes: Scene[]
  moments: Moment[]
  contributions: Contribution[]
  links: SharedMomentLink[]
  pairs: ThenNowPair[]
}
export type ViewMode =
  'scene' | 'focus' | 'shared' | 'then-now' | 'constellation' | 'edit' | 'create'
