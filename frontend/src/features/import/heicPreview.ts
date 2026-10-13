export const isHeicFile = (file: File) =>
  /\.(heic|heif)$/i.test(file.name) || /^image\/(heic|heif)/.test(file.type)
export async function heicPreview(file: File): Promise<Blob> {
  const { heicTo } = await import('heic-to')
  return heicTo({ blob: file, type: 'image/jpeg', quality: 0.88 })
}
