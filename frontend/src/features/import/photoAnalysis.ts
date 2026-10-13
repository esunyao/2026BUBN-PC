import { importPhotos } from './importPhotos'
import type { GroupPhoto } from './eventGrouping'
import type { ImageEmbedder } from '@mediapipe/tasks-vision'

export interface AnalyzedPhoto extends GroupPhoto {
  file: File
  url: string
  timeSource: 'exif' | 'user' | 'unknown'
  visualSource?: string
}
export const visualModel = 'MobileNetV3 Small 0.75 / MediaPipe 1'
export async function loadVisualModel(): Promise<ImageEmbedder> {
  const { FilesetResolver, ImageEmbedder } = await import('@mediapipe/tasks-vision')
  const files = await FilesetResolver.forVisionTasks('/models/vision-wasm')
  return ImageEmbedder.createFromOptions(files, {
    baseOptions: { modelAssetPath: '/models/mobilenet_v3_small.tflite', delegate: 'CPU' },
    runningMode: 'IMAGE',
    l2Normalize: true,
  })
}
export async function embedPhoto(model: ImageEmbedder, url: string): Promise<number[]> {
  const image = new Image()
  image.src = url
  await image.decode()
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 224
  const context = canvas.getContext('2d')
  if (!context) throw new Error('浏览器不支持图片分析')
  // Letterboxing preserves aspect ratio rather than stretching faces or scenery.
  const scale = Math.min(224 / image.naturalWidth, 224 / image.naturalHeight)
  const width = image.naturalWidth * scale,
    height = image.naturalHeight * scale
  context.fillStyle = '#808080'
  context.fillRect(0, 0, 224, 224)
  context.drawImage(image, (224 - width) / 2, (224 - height) / 2, width, height)
  const values = model.embed(canvas).embeddings[0]?.floatEmbedding
  if (!values?.length) throw new Error('图片特征为空')
  return Array.from(values)
}
export async function analyzePhotos(
  files: File[],
  personId: string,
  useVision: boolean,
  signal: AbortSignal,
  progress: (message: string) => void,
): Promise<{ photos: AnalyzedPhoto[]; failures: string[] }> {
  if (files.length > 60 || files.reduce((sum, f) => sum + f.size, 0) > 120 * 1024 * 1024)
    throw new Error('每批最多 60 张、合计 120 MB，请分批整理。')
  const photos: AnalyzedPhoto[] = [],
    failures: string[] = []
  let model: ImageEmbedder | undefined
  try {
    if (useVision) {
      progress('正在加载本地画面分析模型…')
      try {
        model = await loadVisualModel()
      } catch {
        failures.push('画面分析不可用，本批继续按时间与位置整理。')
      }
    }
    const hashes = new Map<string, string>()
    for (const [index, file] of files.entries()) {
      if (signal.aborted) throw new DOMException('Cancelled', 'AbortError')
      progress(`正在整理 ${index + 1} / ${files.length}：${file.name}`)
      if (file.size > 12 * 1024 * 1024) {
        failures.push(file.name + '：超过 12 MB')
        continue
      }
      const result = await importPhotos([file], personId, [], index)
      failures.push(...result.failures)
      const photo = result.photos[0]
      if (!photo) continue
      const item: AnalyzedPhoto = {
        ...photo,
        file,
        timeSource: photo.capturedAt === undefined ? 'unknown' : 'exif',
      }
      photos.push(item) // Own URL before any cancellable or fallible work.
      try {
        const bytes = await crypto.subtle.digest('SHA-256', await file.arrayBuffer())
        item.hash = Array.from(new Uint8Array(bytes), (n) => n.toString(16).padStart(2, '0')).join(
          '',
        )
        item.duplicateOf = hashes.get(item.hash)
        if (!item.duplicateOf) hashes.set(item.hash, item.id)
      } catch {
        /* Hashing failure never prevents importing a usable image. */
      }
      if (model && !item.duplicateOf) {
        try {
          item.embedding = await embedPhoto(model, item.url)
          item.visualSource = visualModel
        } catch {
          failures.push(file.name + '：画面分析失败，仍保留时间和位置')
        }
      }
      await new Promise<void>((resolve) => setTimeout(resolve, 0))
    }
    if (signal.aborted) throw new DOMException('Cancelled', 'AbortError')
    return { photos, failures }
  } catch (error) {
    photos.forEach((p) => URL.revokeObjectURL(p.url))
    throw error
  } finally {
    model?.close()
  }
}
