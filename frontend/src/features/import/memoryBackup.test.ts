import { describe, expect, it } from 'vitest'
import { createMemoryDemo } from '../../app/memoryDemo'
import { unpackMemoryBackup, portableMetadata } from './memoryBackup'
import type { FullMemoryBackup } from './memoryBackup'
describe('portable full photo backup', () => {
  const fixture = () => {
    const data = createMemoryDemo(),
      c = data.contributions[0]!
    c.fileId = 'preview'
    c.originalFileId = 'heic-original'
    c.mediaUrl = 'blob:temporary'
    delete c.thumbnailUrl
    return {
      format: 'shared-memories-full-v1',
      savedAt: '2026-10-13',
      data: portableMetadata(data),
      media: [
        { id: 'preview', mime: 'image/jpeg', bytes: btoa('preview bytes') },
        { id: 'heic-original', mime: 'image/heic', bytes: btoa('original HEIC bytes') },
      ],
    } satisfies FullMemoryBackup
  }
  it('restores both preview and original under fresh keys, without temporary URLs', async () => {
    const archive = fixture(),
      restored = unpackMemoryBackup(archive),
      c = restored.data.contributions[0]!
    expect(c.mediaUrl).toBeUndefined()
    expect(c.fileId).not.toBe('preview')
    expect(c.originalFileId).not.toBe('heic-original')
    expect(await restored.files.find((f) => f.id === c.originalFileId)!.file.text()).toBe(
      'original HEIC bytes',
    )
    expect(archive.data.contributions[0]?.fileId).toBe('preview')
  })
  it('rejects incomplete, duplicate and unrelated embedded media before any storage mutation', () => {
    const missing = fixture()
    missing.media.pop()
    expect(() => unpackMemoryBackup(missing)).toThrow('缺少')
    const repeated = fixture()
    repeated.media.push(repeated.media[0]!)
    expect(() => unpackMemoryBackup(repeated)).toThrow('重复')
    const foreign = fixture()
    foreign.media[0]!.id = 'foreign'
    expect(() => unpackMemoryBackup(foreign)).toThrow('无效')
  })
})
