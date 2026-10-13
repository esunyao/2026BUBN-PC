import type { MemoryData } from '../../shared/memoryTypes'

export interface FullMemoryBackup {
  format: 'shared-memories-full-v1'
  savedAt: string
  data: MemoryData
  media: Array<{ id: string; mime: string; bytes: string }>
}
const LIMIT = 100 * 1024 * 1024
const allowedMime = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'image/heic-sequence',
  'image/heif-sequence',
  'application/octet-stream',
])
export function portableMetadata(data: MemoryData): MemoryData {
  const copy = JSON.parse(JSON.stringify(data)) as MemoryData
  for (const c of [...copy.contributions, ...(copy.pendingPhotos ?? [])]) {
    if (c.fileId) {
      delete c.mediaUrl
      delete c.thumbnailUrl
    }
  }
  return copy
}
export async function packMemoryBackup(
  data: MemoryData,
  read: (id: string) => Promise<Blob | undefined>,
): Promise<FullMemoryBackup> {
  const metadata = portableMetadata(data)
  const ids = new Set(
    [...metadata.contributions, ...(metadata.pendingPhotos ?? [])].flatMap((c) =>
      [c.fileId, c.originalFileId].filter((id): id is string => !!id),
    ),
  )
  const media: FullMemoryBackup['media'] = []
  let bytes = 0
  for (const id of ids) {
    const blob = await read(id)
    if (!blob) throw new Error('有原图在此浏览器缺失，无法生成完整备份；可先导出文字与配置。')
    bytes += blob.size
    if (bytes > LIMIT)
      throw new Error('完整备份目前支持总图片大小不超过100 MB；请保留原相册，并导出文字与配置。')
    const mime = blob.type || 'application/octet-stream'
    if (!allowedMime.has(mime)) throw new Error('存在无法备份的图片类型。')
    const encoded = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result).split(',')[1]!)
      reader.onerror = () => reject(new Error('图片备份读取失败。'))
      reader.readAsDataURL(blob)
    })
    media.push({ id, mime, bytes: encoded })
  }
  return {
    format: 'shared-memories-full-v1',
    savedAt: new Date().toISOString(),
    data: metadata,
    media,
  }
}
/** Decode into fresh keys so restoration cannot overwrite media used by the previous archive. */
export function unpackMemoryBackup(backup: FullMemoryBackup): {
  data: MemoryData
  files: Array<{ id: string; file: Blob }>
} {
  if (!Array.isArray(backup.media) || backup.media.length > 2000)
    throw new Error('备份图片列表不正确。')
  const data = portableMetadata(backup.data)
  const required = new Set(
    [...data.contributions, ...(data.pendingPhotos ?? [])].flatMap((c) =>
      [c.fileId, c.originalFileId].filter((id): id is string => !!id),
    ),
  )
  const remap = new Map<string, string>(),
    files: Array<{ id: string; file: Blob }> = []
  let total = 0
  for (const item of backup.media) {
    if (
      !item ||
      typeof item.id !== 'string' ||
      !required.has(item.id) ||
      remap.has(item.id) ||
      !allowedMime.has(item.mime) ||
      typeof item.bytes !== 'string' ||
      item.bytes.length > 42 * 1024 * 1024 ||
      !/^[A-Za-z0-9+/]*={0,2}$/.test(item.bytes)
    )
      throw new Error('备份包含无效或重复图片。')
    const raw = atob(item.bytes)
    total += raw.length
    if (total > LIMIT) throw new Error('备份原图超过100 MB。')
    const bytes = new Uint8Array(raw.length)
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
    const id = crypto.randomUUID()
    remap.set(item.id, id)
    files.push({ id, file: new Blob([bytes], { type: item.mime }) })
  }
  if (required.size !== remap.size) throw new Error('备份缺少引用的原图或预览。')
  for (const c of [...data.contributions, ...(data.pendingPhotos ?? [])]) {
    if (c.fileId) c.fileId = remap.get(c.fileId)!
    if (c.originalFileId) c.originalFileId = remap.get(c.originalFileId)!
  }
  return { data, files }
}
