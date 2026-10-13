import { presets } from './memoryDemo'
import { jsonBody, request } from '../shared/lib/api'
import type { Contribution, MemoryData, MemoryEvent } from '../shared/memoryTypes'

export interface MemoryIndex {
  data: MemoryData
  viewerParticipantId: string
  permissions: { canManageMembers: boolean; isReadOnly: boolean }
  revision: number
}
export interface EventSummary extends MemoryEvent { name?: string; createdAt?: number }
export interface Member { userId: string; username: string; participantId: string; role: string }
interface UrlItem { photoId: string; url: string; expiresAt: number }

export const online = {
  events: () => request<EventSummary[]>('/events'),
  index: (id: string) => request<MemoryIndex>(`/events/${encodeURIComponent(id)}/memory-index`),
  create: (title: string, type: MemoryEvent['type']) => request<EventSummary>('/events', { method: 'POST', ...jsonBody({ title, type }) }),
  members: (id: string) => request<Member[]>(`/events/${encodeURIComponent(id)}/members`),
  addMember: (id: string, username: string) => request<Member>(`/events/${encodeURIComponent(id)}/members`, { method: 'POST', ...jsonBody({ username }) }),
  addContribution: (id: string, contribution: Record<string, unknown>) => request<Contribution>(`/events/${encodeURIComponent(id)}/contributions`, { method: 'POST', ...jsonBody(contribution) }),
  editContribution: (id: string, value: Record<string, unknown>) => request<Contribution>(`/contributions/${encodeURIComponent(id)}`, { method: 'PATCH', ...jsonBody(value) }),
  removeContribution: (id: string, version: number) => request<void>(`/contributions/${encodeURIComponent(id)}?version=${version}`, { method: 'DELETE' }),
  feedback: (id: string) => request<Record<string, { status?: 'confirmed' | 'dismissed'; favorite?: boolean }>>(`/events/${encodeURIComponent(id)}/discovery-feedback`),
  putFeedback: (id: string, value: { findingId: string; evidenceIds: string[]; status?: string; favorite: boolean }) => request(`/events/${encodeURIComponent(id)}/discovery-feedback`, { method: 'PUT', ...jsonBody(value) }),
  presign: (id: string, data: Record<string, unknown>) => request<{ photoId: string; uploadUrl: string; headers: Record<string, string> }>(`/events/${encodeURIComponent(id)}/photos/presign`, { method: 'POST', ...jsonBody(data) }),
  confirm: (id: string, photoId: string) => request(`/events/${encodeURIComponent(id)}/photos/${encodeURIComponent(photoId)}/confirm`, { method: 'POST' }),
  urls: (id: string, photoIds: string[]) => request<{ urls: UrlItem[] }>(`/events/${encodeURIComponent(id)}/photos/download-urls`, { method: 'POST', ...jsonBody({ photoIds }) }),
  archive: (id: string) => request<MemoryData>(`/events/${encodeURIComponent(id)}/archive`),
  import: (data: MemoryData) => request<{ eventIds: string[] }>('/events/import', { method: 'POST', ...jsonBody({ requestId: crypto.randomUUID(), data }) }),
  copyDemo: (demoEventId: string) => request<{ eventId: string }>('/events/from-demo', { method: 'POST', ...jsonBody({ requestId: crypto.randomUUID(), demoEventId }) }),
}

export function normalizeIndex(index: MemoryIndex): MemoryIndex {
  index.data.scenes.forEach((scene) => {
    const preset = scene.environment?.preset
    scene.environment = structuredClone(presets[preset && Object.hasOwn(presets, preset) ? preset : 'neutral'])
  })
  return index
}

export function combineIndexes(indexes: MemoryIndex[]): MemoryData {
  const unique = <T extends { id: string }>(arrays: T[][]): T[] => [...new Map(arrays.flat().map((row) => [row.id, row])).values()]
  return {
    participants: unique(indexes.map((i) => i.data.participants)),
    events: unique(indexes.map((i) => i.data.events)),
    scenes: unique(indexes.map((i) => i.data.scenes)),
    moments: unique(indexes.map((i) => i.data.moments)),
    contributions: unique(indexes.map((i) => i.data.contributions)),
    links: unique(indexes.map((i) => i.data.links)),
    pairs: unique(indexes.map((i) => i.data.pairs)),
  }
}
