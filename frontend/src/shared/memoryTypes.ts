export type Provenance = 'exif' | 'user' | 'vision-model' | 'demo'
export interface TimeEvidence {
  start?: string
  end?: string
  precision: 'exact' | 'approximate' | 'date-only' | 'unknown'
  source: Provenance
}
export interface MediaAnalysis {
  sceneTags: string[]
  objects: string[]
  activities: string[]
  phaseTags?: string[]
  summary?: string
  modelId?: string
  version?: string
}
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
  startAt?: string
  endAt?: string
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
  endAt?: string
  originGapId?: string
  id: string
  sceneId: string
  title: string
  startAt: string
  label: string
  lighting: EnvironmentRecipe['lighting']
  contributionIds: string[]
}
export interface Contribution {
  visibility?: 'private' | 'event-members' | 'public'
  participantTags?: string[]
  tagsConsent?: boolean
  timeEvidence?: TimeEvidence
  analysis?: MediaAnalysis
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
