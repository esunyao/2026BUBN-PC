import { createServer } from '../../frontend/node_modules/vite/dist/node/index.js'
import { writeFile } from 'node:fs/promises'
const server = await createServer({ root: '../../frontend', configFile: false, server: { middlewareMode: true }, appType: 'custom' })
try {
  const { createMemoryDemo } = await server.ssrLoadModule('/src/app/memoryDemo.ts')
  const data = createMemoryDemo()
  data.scenes = data.scenes.map(scene => ({ ...scene, environment: { preset: scene.environment.preset } }))
  for (const c of data.contributions) {
    for (const field of ['mediaUrl', 'thumbnailUrl']) {
      if (c[field] && !/^\/demo-assets\/[0-9]+(?:-thumb)?\.jpg$/.test(c[field])) throw new Error('Unexpected demo asset')
    }
  }
  await writeFile('src/main/resources/demo/memory-data.json', JSON.stringify(data, null, 2) + '\n', 'utf8')
} finally { await server.close() }
