/** Future backend adapter. No request, credential or inferred private sentiment in demo mode. */
export async function analyzeMedia(file: Blob): Promise<{
  enabled: false
  mode: 'manual'
  byteLength: number
  suggestedEnvironment: null
}> {
  return { enabled: false, mode: 'manual', byteLength: file.size, suggestedEnvironment: null }
}
