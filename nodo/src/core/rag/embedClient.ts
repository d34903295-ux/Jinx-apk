export interface EmbedProgress {
  progress: number
  status: string
}

class EmbedClient {
  private worker: Worker | null = null
  private callbacks = new Map<string, { resolve: (val: any) => void; reject: (err: any) => void }>()
  private onBatchProgressMap = new Map<string, (done: number, total: number) => void>()
  private initListeners = new Set<(p: EmbedProgress) => void>()
  private isReady = false
  private initPromise: Promise<void> | null = null

  private getWorker(): Worker {
    if (!this.worker) {
      this.worker = new Worker(new URL('./embed.worker.ts', import.meta.url), { type: 'module' })
      this.worker.onmessage = (e: MessageEvent) => {
        const { type, id, vector, vectors, progress, status, current, total, error } = e.data

        if (type === 'progress') {
          this.initListeners.forEach((fn) => fn({ progress, status }))
          return
        }

        if (type === 'ready') {
          this.isReady = true
        }

        if (type === 'batch_progress' && id && this.onBatchProgressMap.has(id)) {
          this.onBatchProgressMap.get(id)?.(current, total)
          return
        }

        if (id && this.callbacks.has(id)) {
          const { resolve, reject } = this.callbacks.get(id)!
          this.callbacks.delete(id)
          this.onBatchProgressMap.delete(id)

          if (type === 'error') {
            reject(new Error(error ?? 'Error en Web Worker de embeddings'))
          } else if (type === 'embed_done') {
            resolve(vector)
          } else if (type === 'embed_batch_done') {
            resolve(vectors)
          } else if (type === 'ready') {
            resolve(true)
          }
        }
      }
    }
    return this.worker
  }

  onInitProgress(callback: (p: EmbedProgress) => void): () => void {
    this.initListeners.add(callback)
    return () => this.initListeners.delete(callback)
  }

  async init(): Promise<void> {
    if (this.isReady) return
    if (this.initPromise) return this.initPromise

    const id = `init_${Date.now()}`
    const worker = this.getWorker()

    this.initPromise = new Promise<void>((resolve, reject) => {
      this.callbacks.set(id, {
        resolve: () => {
          this.isReady = true
          resolve()
        },
        reject,
      })
      worker.postMessage({ type: 'init', id })
    })

    return this.initPromise
  }

  async embed(text: string): Promise<Float32Array> {
    await this.init()
    const id = `embed_${Date.now()}_${Math.random()}`
    const worker = this.getWorker()

    return new Promise<Float32Array>((resolve, reject) => {
      this.callbacks.set(id, {
        resolve: (raw: number[]) => resolve(new Float32Array(raw)),
        reject,
      })
      worker.postMessage({ type: 'embed', id, payload: { text } })
    })
  }

  async embedBatch(
    texts: string[],
    onProgress?: (done: number, total: number) => void
  ): Promise<Float32Array[]> {
    if (texts.length === 0) return []
    await this.init()
    const id = `batch_${Date.now()}_${Math.random()}`
    const worker = this.getWorker()

    if (onProgress) {
      this.onBatchProgressMap.set(id, onProgress)
    }

    return new Promise<Float32Array[]>((resolve, reject) => {
      this.callbacks.set(id, {
        resolve: (rawList: number[][]) => resolve(rawList.map((r) => new Float32Array(r))),
        reject,
      })
      worker.postMessage({ type: 'embed_batch', id, payload: { texts } })
    })
  }
}

export const embedder = new EmbedClient()
