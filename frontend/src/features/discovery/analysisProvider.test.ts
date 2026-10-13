import { expect, it } from 'vitest'
import { reactive } from 'vue'
import { createMemoryDemo } from '../../app/memoryDemo'
import { MockVisionAnalysisProvider } from './analysisProvider'
it('returns cloned demo annotations only for the requested event, and supports cancellation', async () => {
  const data = reactive(createMemoryDemo()),
    provider = new MockVisionAnalysisProvider(data)
  const images = [
    { id: 'coast-sunset-0', thumbnailUrl: '/demo-assets/35754189-thumb.jpg' },
    { id: 'stage-show-0', thumbnailUrl: '/demo-assets/167587-thumb.jpg' },
  ]
  const result = await provider.analyze(images, { eventId: 'hailing' })
  expect(result.map((item) => item.contributionId)).toEqual(['coast-sunset-0'])
  result[0]!.analysis.sceneTags.push('external-edit')
  expect(
    data.contributions.find((c) => c.id === 'coast-sunset-0')?.analysis?.sceneTags,
  ).not.toContain('external-edit')
  data.contributions.find((c) => c.id === 'coast-sunset-0')!.isDemo = false
  expect(await provider.analyze(images, { eventId: 'hailing' })).toEqual([])
  const abort = new AbortController()
  abort.abort()
  await expect(
    provider.analyze(images, { eventId: 'hailing', signal: abort.signal }),
  ).rejects.toThrow('Cancelled')
})
