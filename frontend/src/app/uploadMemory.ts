import { online } from './onlineRepository'
import { importPhotos } from '../features/import/importPhotos'

async function scaled(file: File, width: number, suffix: string): Promise<File> {
  const image = await createImageBitmap(file)
  try {
    const scale = Math.min(1, width / image.width)
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(image.width * scale))
    canvas.height = Math.max(1, Math.round(image.height * scale))
    canvas.getContext('2d')!.drawImage(image, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((item) => item ? resolve(item) : reject(new Error('无法生成照片预览。')), 'image/webp', 0.78))
    return new File([blob], `${file.name}-${suffix}.webp`, { type: 'image/webp' })
  } finally { image.close() }
}

async function put(eventId: string, participantId: string, file: File, gps?: {latitude: number;longitude: number}, capturedAt?: number): Promise<string> {
  const signed = await online.presign(eventId, { photographerId: participantId, filename: file.name, contentType: file.type, sizeBytes: file.size, gps, capturedAt })
  const uploaded = await fetch(signed.uploadUrl, { method: 'PUT', headers: signed.headers, body: file })
  if (!uploaded.ok) throw new Error(`照片上传失败（${uploaded.status}），请检查对象存储 CORS 配置。`)
  await online.confirm(eventId, signed.photoId)
  return signed.photoId
}

export async function uploadMemory(eventId: string, participantId: string, file: File) {
  if (file.size > 12 * 1024 * 1024) throw new Error('请使用小于 12 MB 的照片。')
  const result = await importPhotos([file], participantId, [], 0)
  const parsed = result.photos[0]
  if (!parsed) throw new Error(result.failures[0] ?? '无法读取图片。')
  URL.revokeObjectURL(parsed.url)
  const photoId = await put(eventId, participantId, file, parsed.gps, parsed.capturedAt)
  const thumbnailPhotoId = await put(eventId, participantId, await scaled(file, 240, 'thumbnail'))
  const backgroundPhotoId = await put(eventId, participantId, await scaled(file, 360, 'background'))
  return { photoId, thumbnailPhotoId, backgroundPhotoId, gps: parsed.gps, capturedAt: parsed.capturedAt }
}
