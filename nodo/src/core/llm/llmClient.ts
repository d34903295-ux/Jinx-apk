import type {
  ChatCompletionMessageParam,
  InitProgressReport,
  WebWorkerMLCEngine,
} from '@mlc-ai/web-llm'

/**
 * API del LLM para la UI. Singleton observable (usar con useSyncExternalStore).
 * WebLLM se importa de forma dinámica para que el arranque de la app sea ligero.
 */

export type LLMStatus = 'idle' | 'loading' | 'ready' | 'generating' | 'error'

export interface LoadProgress {
  /** 0..1 */
  progress: number
  text: string
  timeElapsed: number
}

export interface LLMState {
  status: LLMStatus
  modelId: string | null
  progress: LoadProgress | null
  error: string | null
}

type Listener = () => void

const loadWebLLM = () => import('@mlc-ai/web-llm')

function toMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  return String(err)
}

class LLMClient {
  private engine: WebWorkerMLCEngine | null = null
  private loadingPromise: Promise<void> | null = null
  private loadingModelId: string | null = null
  private state: LLMState = { status: 'idle', modelId: null, progress: null, error: null }
  private listeners = new Set<Listener>()

  // Funciones flecha para poder pasarlas directamente a useSyncExternalStore.
  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getState = (): LLMState => this.state

  private set(patch: Partial<LLMState>): void {
    this.state = { ...this.state, ...patch }
    this.listeners.forEach((l) => l())
  }

  /**
   * Descarga (si hace falta) y carga un modelo. La primera vez descarga desde internet y
   * WebLLM guarda los archivos en la Cache API; después carga desde caché, sin red.
   * Si una descarga se corta, al reintentar se reutilizan los fragmentos ya guardados.
   */
  load(modelId: string, onProgress?: (p: LoadProgress) => void): Promise<void> {
    if (this.state.modelId === modelId && this.state.status === 'ready') return Promise.resolve()
    if (this.loadingPromise && this.loadingModelId === modelId) return this.loadingPromise

    const run = async () => {
      this.set({
        status: 'loading',
        modelId,
        progress: { progress: 0, text: '', timeElapsed: 0 },
        error: null,
      })
      const callback = (report: InitProgressReport) => {
        const p: LoadProgress = {
          progress: report.progress,
          text: report.text,
          timeElapsed: report.timeElapsed,
        }
        this.set({ progress: p })
        onProgress?.(p)
      }
      try {
        const webllm = await loadWebLLM()
        if (!this.engine) {
          const worker = new Worker(new URL('./llm.worker.ts', import.meta.url), { type: 'module' })
          this.engine = await webllm.CreateWebWorkerMLCEngine(worker, modelId, {
            initProgressCallback: callback,
          })
        } else {
          this.engine.setInitProgressCallback(callback)
          await this.engine.reload(modelId)
        }
        this.set({ status: 'ready', progress: null })
      } catch (err) {
        this.set({ status: 'error', progress: null, error: toMessage(err) })
        throw err
      }
    }

    this.loadingModelId = modelId
    this.loadingPromise = run().finally(() => {
      this.loadingPromise = null
      this.loadingModelId = null
    })
    return this.loadingPromise
  }

  /** Genera una respuesta en streaming. Devuelve el texto completo al terminar o al detener. */
  async generate(
    messages: ChatCompletionMessageParam[],
    onToken: (fullText: string) => void,
  ): Promise<string> {
    if (!this.engine || this.state.status !== 'ready') {
      throw new Error('El modelo todavía no está cargado.')
    }
    this.set({ status: 'generating' })
    let full = ''
    try {
      const chunks = await this.engine.chat.completions.create({
        messages,
        stream: true,
        temperature: 0.7,
      })
      for await (const chunk of chunks) {
        const delta = chunk.choices[0]?.delta?.content ?? ''
        if (delta) {
          full += delta
          onToken(full)
        }
      }
      return full
    } finally {
      this.set({ status: 'ready' })
    }
  }

  /** Detiene la generación en curso (el stream termina con lo generado hasta ahora). */
  stop(): void {
    this.engine?.interruptGenerate()
  }

  async isCached(modelId: string): Promise<boolean> {
    const webllm = await loadWebLLM()
    return webllm.hasModelInCache(modelId)
  }

  async deleteModel(modelId: string): Promise<void> {
    const webllm = await loadWebLLM()
    if (this.state.modelId === modelId && this.engine) {
      await this.engine.unload()
      this.set({ status: 'idle', modelId: null, progress: null })
    }
    await webllm.deleteModelAllInfoInCache(modelId)
  }
}

export const llm = new LLMClient()
