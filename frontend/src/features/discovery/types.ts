import type {
  MemoryData,
  Contribution,
  MediaAnalysis,
  TimeEvidence,
} from '../../shared/memoryTypes'
export type DiscoveryType =
  | 'shared_moment'
  | 'unseen_moment'
  | 'missing_piece'
  | 'then_now'
  | 'memory_thread'
  | 'behind_spotlight'
export interface DiscoveryFinding {
  id: string
  eventId: string
  type: DiscoveryType
  title: string
  description: string
  evidenceIds: string[]
  participantIds: string[]
  sceneIds: string[]
  timeRange?: TimeEvidence
  reasonCodes: string[]
  reason: string
  confidenceBand: 'high' | 'medium' | 'low'
  provenance: 'rule' | 'user' | 'demo' | 'server'
  detectorId: string
  status: 'suggested' | 'confirmed' | 'dismissed'
  gapId?: string
  originMomentIds?: string[]
  pairId?: string
}
export interface IndexedContribution extends Contribution {
  eventId: string
  sceneId: string
  time: TimeEvidence
}
export interface DiscoveryContext {
  data: MemoryData
  eventId: string
  viewerId: string
  contributions: IndexedContribution[]
  byMoment: Map<string, IndexedContribution[]>
  byScene: Map<string, IndexedContribution[]>
  settings: { gapMinutes: number; maxGapMinutes: number; maxGaps: number }
}
export interface DiscoveryDetector {
  id: string
  detect(context: DiscoveryContext): DiscoveryFinding[]
}
export interface DiscoveryFeedback {
  status?: 'confirmed' | 'dismissed'
  favorite?: boolean
}
export interface ImageAnalysisProvider {
  analyze(
    images: Array<{ id: string; thumbnailUrl: string }>,
    context: { eventId: string; signal?: AbortSignal },
  ): Promise<Array<{ contributionId: string; analysis: MediaAnalysis }>>
}
