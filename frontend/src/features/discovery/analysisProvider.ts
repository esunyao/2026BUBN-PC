import type { ImageAnalysisProvider } from './types'
import type { MemoryData } from '../../shared/memoryTypes'
/** Reads explicit demo annotations only. It does not inspect an uploaded image. */
export class MockVisionAnalysisProvider implements ImageAnalysisProvider {
  constructor(private data: MemoryData) {}
  async analyze(
    images: Array<{ id: string; thumbnailUrl: string }>,
    context: { eventId: string; signal?: AbortSignal },
  ) {
    if (context.signal?.aborted) throw new DOMException('Cancelled', 'AbortError')
    return images.flatMap((image) => {
      const c = this.data.contributions.find(
        (c) =>
          c.id === image.id &&
          c.isDemo &&
          this.data.scenes.some(
            (s) =>
              s.eventId === context.eventId &&
              this.data.moments.some((m) => m.id === c.momentId && m.sceneId === s.id),
          ),
      )
      return c?.analysis
        ? [
            {
              contributionId: c.id,
              analysis: JSON.parse(JSON.stringify(c.analysis)) as typeof c.analysis,
            },
          ]
        : []
    })
  }
}
