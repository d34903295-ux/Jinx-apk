import { pipeline, env } from '@huggingface/transformers'

// Configuración para entorno navegador offline: usar Cache API y modelos remotos una vez
env.allowLocalModels = false
env.useBrowserCache = true

let embedder: any = null
let loadingPromise: Promise<any> | null = null

const DEFAULT_MODEL = 'Xenova/all-MiniLM-L6-v2'

async function getEmbedder(model = DEFAULT_MODEL) {
  if (embedder) return embedder
  if (loadingPromise) return loadingPromise

  loadingPromise = pipeline('feature-extraction', model, {
    progress_callback: (p: any) => {
      self.postMessage({
        type: 'progress',
        progress: typeof p.progress === 'number' ? p.progress : 0,
        status: p.status ?? 'Descargando modelo de embeddings...',
      })
    },
  }).then((res) => {
    embedder = res
    return res
  })

  return loadingPromise
}

self.onmessage = async (e: MessageEvent) => {
  const { type, id, payload } = e.data
  try {
    if (type === 'init') {
      await getEmbedder(payload?.model)
      self.postMessage({ type: 'ready', id })
    } else if (type === 'embed') {
      const extractor = await getEmbedder()
      const output = await extractor(payload.text, { pooling: 'mean', normalize: true })
      const vector = Array.from(output.data as Float32Array)
      self.postMessage({ type: 'embed_done', id, vector })
    } else if (type === 'embed_batch') {
      const extractor = await getEmbedder()
      const vectors: number[][] = []
      const texts: string[] = payload.texts
      for (let i = 0; i < texts.length; i++) {
        const output = await extractor(texts[i], { pooling: 'mean', normalize: true })
        vectors.push(Array.from(output.data as Float32Array))
        self.postMessage({
          type: 'batch_progress',
          id,
          current: i + 1,
          total: texts.length,
        })
      }
      self.postMessage({ type: 'embed_batch_done', id, vectors })
    }
  } catch (err) {
    self.postMessage({
      type: 'error',
      id,
      error: err instanceof Error ? err.message : String(err),
    })
  }
}
