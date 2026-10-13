import * as exifr from 'exifr'
import type { ImportResult, Island, Photo } from '../../shared/types'
import { nearestIsland, validGps } from '../../shared/lib/geo'
import { islandPosition } from '../../shared/lib/layout'
import { filenameCaption } from '../../shared/lib/photoFormat'
import { heicPreview, isHeicFile } from './heicPreview'

async function verifyImage(url: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const image = new Image()
    image.onload = () => (image.naturalWidth > 0 ? resolve() : reject(new Error('图片无法显示')))
    image.onerror = () => reject(new Error('文件损坏或浏览器无法显示'))
    image.src = url
  })
}

export async function importPhotos(
  files: File[],
  photographerId: string,
  existingIslands: Island[],
  startOrder: number,
): Promise<ImportResult> {
  const result: ImportResult = { photos: [], islands: [], failures: [] }
  for (const [index, file] of files.entries()) {
    let url: string | undefined
    try {
      if (
        !/\.(jpe?g|png|webp|heic|heif)$/i.test(file.name) ||
        (file.type &&
          ![
            'image/jpeg',
            'image/png',
            'image/webp',
            'image/heic',
            'image/heif',
            'image/heic-sequence',
            'image/heif-sequence',
            'application/octet-stream',
          ].includes(file.type))
      ) {
        throw new Error('请选择 JPEG、PNG、WebP 或 HEIC 图片')
      }
      const displayBlob = isHeicFile(file) ? await heicPreview(file) : undefined
      url = URL.createObjectURL(displayBlob ?? file)
      await verifyImage(url)
      // A displayable picture remains usable when metadata is absent or unreadable.
      const metadata = await exifr.parse(file).catch(() => undefined)
      const gps = validGps(metadata?.latitude, metadata?.longitude)
      const rawDate: unknown = metadata?.DateTimeOriginal
      const capturedAt =
        rawDate instanceof Date && Number.isFinite(rawDate.getTime())
          ? rawDate.getTime()
          : undefined
      let island: Island | undefined
      if (gps) {
        island = nearestIsland(gps, [...existingIslands, ...result.islands])
        if (!island) {
          const islandIndex = existingIslands.length + result.islands.length
          island = {
            id: crypto.randomUUID(),
            name: '旅途地点 ' + (islandIndex + 1),
            gpsAnchor: gps,
            position: islandPosition(islandIndex),
            appearance: islandIndex % 10,
          }
          result.islands.push(island)
        }
      }
      const photo: Photo = {
        id: crypto.randomUUID(),
        url,
        filename: file.name,
        caption: filenameCaption(file.name),
        photographerId,
        islandId: island?.id ?? null,
        importOrder: startOrder + index,
        source: 'import',
        ...(displayBlob ? { displayBlob } : {}),
        ...(gps ? { gps } : {}),
        ...(capturedAt === undefined ? {} : { capturedAt }),
      }
      result.photos.push(photo)
    } catch (error) {
      if (url) URL.revokeObjectURL(url)
      result.failures.push(file.name + '：' + (error instanceof Error ? error.message : '导入失败'))
    }
  }
  return result
}
