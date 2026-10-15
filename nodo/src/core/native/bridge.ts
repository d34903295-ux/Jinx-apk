/** Puente con el motor nativo (llama.cpp) vía NodoNative (JavascriptInterface). */

export interface NativeModelInfo {
  id: string
  label: string
  language: string
  fileName: string
  sizeMB: number
  ramMB: number
  recommended: boolean
  state: 'none' | 'downloading' | 'paused' | 'ready' | 'active' | 'error'
  downloadedMB: number
  totalMB: number
  format?: 'litertlm' | 'gguf'
  backend?: 'GPU' | 'CPU'
  verifying?: boolean
  speedMBs?: number
  etaSec?: number
  error?: string
  isImporting?: boolean
}

export interface GenerationStats {
  promptTokens: number
  generatedTokens: number
  ttftMs: number
  totalTimeMs: number
  tokensPerSecond: number
  backend: string
}

export interface NodoNative {
  openModels(): void
  openAgent(): void
  activeNativeModel(): string
  modelsJson(): string
  startDownload(id: string): string
  pauseDownload(): string
  resumeDownload(id: string): string
  cancelDownload(): string
  importModelFile(id: string): string
  cancelImport(): string
  deleteModel(id: string): string
  setActiveModel(id: string): string
  setActiveNativeModel(id: string): string
  getDeviceSpecs(): string
  generate(prompt: string, maxTokens: number, cbId: string): string
  stopGenerate(): string
  agentTask(task: string, cbId: string): string
  stopAgent(): string
  freeSpaceMB(): number
  totalRamMB(): number
  isIgnoringBattery(): boolean
  requestBatteryExemption(): string
  hasLocationPermission(): boolean
  hasCameraPermission(): boolean
  openAppSettings(): string
  consumeSharedText(): string
  shareText(title: string, text: string): string
  getEnginePrefs(): string
  setEnginePrefs(nCtx: number, nThreads: number): string
  voskState(): string
  downloadVoskModel(): string
  hasMicPermission(): boolean
  startDictation(cbId: string): string
  stopDictation(): string
  haptic(kind: string): string
}

declare global {
  interface Window {
    NodoNative?: NodoNative
    __nodoCb?: (cbId: string, kind: string, text: string) => void
    __nodoDictation?: (cbId: string, kind: string, text: string) => void
    __nodoOnImportComplete?: (modelId: string, success: boolean, err: string | null) => void
  }
}

export function hasNative(): boolean {
  return typeof window !== 'undefined' && !!window.NodoNative
}

export function listNativeModels(): NativeModelInfo[] {
  if (!hasNative()) return []
  try {
    return JSON.parse(window.NodoNative!.modelsJson()) as NativeModelInfo[]
  } catch {
    return []
  }
}

export function activeNativeModel(): string {
  if (!hasNative()) return ''
  try {
    return window.NodoNative!.activeNativeModel()
  } catch {
    return ''
  }
}

export function setActiveNativeModel(id: string): boolean {
  if (!hasNative()) return false
  try {
    window.NodoNative!.setActiveNativeModel(id)
    return true
  } catch {
    return false
  }
}

export interface DeviceSpecs {
  totalRamMB: number
  freeSpaceMB: number
  bigCores: number
  totalCores: number
  recommendedCtx: number
  recommendedThreads: number
}

export function getDeviceSpecs(): DeviceSpecs | null {
  if (!hasNative()) return null
  try {
    const raw = window.NodoNative!.getDeviceSpecs()
    return JSON.parse(raw) as DeviceSpecs
  } catch {
    return null
  }
}

type Cb = (kind: 'start' | 'token' | 'done' | 'error' | 'step' | 'stats', text: string) => void
const callbacks = new Map<string, Cb>()
let seq = 0

function ensureDispatcher() {
  if (!window.__nodoCb) {
    window.__nodoCb = (cbId, kind, text) => {
      const cb = callbacks.get(cbId)
      if (!cb) return
      cb(kind as 'start' | 'token' | 'done' | 'error' | 'step' | 'stats', text)
      if (kind === 'done' || kind === 'error') callbacks.delete(cbId)
    }
  }
}

/** Generación con streaming. Devuelve función para cancelar. */
export function nativeGenerate(
  prompt: string,
  maxTokens: number,
  onEvent: Cb,
): () => void {
  ensureDispatcher()
  const cbId = `g${Date.now()}_${seq++}`
  callbacks.set(cbId, onEvent)
  if (!hasNative()) {
    callbacks.delete(cbId)
    onEvent('error', 'Sin motor nativo. Instala la app en Android para ejecutar el modelo local.')
    return () => {}
  }
  let res = 'no-model'
  try {
    res = window.NodoNative!.generate(prompt, maxTokens, cbId)
  } catch {
    res = 'error'
  }
  if (res !== 'ok') {
    callbacks.delete(cbId)
    onEvent(
      'error',
      res === 'no-model'
        ? 'Sin modelo activo. Descarga o activa uno en la pestaña Modelos.'
        : 'Error al generar respuesta'
    )
  }
  return () => {
    try {
      window.NodoNative?.stopGenerate()
    } catch {
      /* noop */
    }
    callbacks.delete(cbId)
  }
}

export function nativeAction(fn: (n: NodoNative) => string): string {
  if (!hasNative()) return 'no-bridge'
  try {
    return fn(window.NodoNative!)
  } catch {
    return 'error'
  }
}

/** Tarea agéntica con pasos visibles. Devuelve función para cancelar. */
export function nativeAgentTask(task: string, onEvent: Cb): () => void {
  ensureDispatcher()
  const cbId = `a${Date.now()}_${seq++}`
  callbacks.set(cbId, onEvent)

  if (!hasNative()) {
    let cancelled = false
    import('../agent/loop')
      .then(({ runAgentLoop }) => {
        if (cancelled) return
        onEvent('start', '')
        runAgentLoop(
          task,
          (step) => {
            if (cancelled) return
            if (step.toolName) {
              onEvent('step', `TOOL: ${step.toolName} ${JSON.stringify(step.toolArgs || {})}`)
              if (step.toolResult) onEvent('step', `RESULT: ${step.toolResult.slice(0, 300)}`)
              if (step.toolError) onEvent('step', `ERROR: ${step.toolError}`)
            }
          },
          () => {}
        )
          .then((res) => {
            if (cancelled) return
            callbacks.delete(cbId)
            onEvent('done', res.finalContent)
          })
          .catch((err) => {
            if (cancelled) return
            callbacks.delete(cbId)
            onEvent('error', err instanceof Error ? err.message : String(err))
          })
      })
      .catch(() => {
        callbacks.delete(cbId)
        onEvent('error', 'El agente requiere la app nativa en Android o motor WebLLM.')
      })
    return () => {
      cancelled = true
      callbacks.delete(cbId)
    }
  }

  let res = 'no-model'
  try {
    res = window.NodoNative!.agentTask(task, cbId)
  } catch {
    res = 'error'
  }
  if (res !== 'ok') {
    callbacks.delete(cbId)
    onEvent('error', 'Error al iniciar la tarea del agente')
  }
  return () => {
    try {
      window.NodoNative?.stopAgent()
    } catch {
      /* noop */
    }
    callbacks.delete(cbId)
  }
}

/** Promesa simple para una sola respuesta (usado por el summarizer Map-Reduce). */
export function nativeGenerateOnce(prompt: string, maxTokens: number): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!hasNative()) {
      reject(new Error('Sin motor nativo. Instala la app en Android.'))
      return
    }
    try {
      nativeGenerate(prompt, maxTokens, (kind, text) => {
        if (kind === 'done') resolve(text)
        else if (kind === 'error') reject(new Error(text))
      })
    } catch (e) {
      reject(e instanceof Error ? e : new Error(String(e)))
    }
  })
}

/** Dictado por voz offline. Eventos: start | partial | final | error | need-model. */
export function nativeDictation(onEvent: (kind: string, text: string) => void): () => void {
  const cbId = `d${Date.now()}_${seq++}`
  const handler = (id: string, kind: string, text: string) => {
    if (id !== cbId) return
    onEvent(kind, text)
    if (kind === 'final' || kind === 'error' || kind === 'need-model') {
      window.__nodoDictation = undefined
    }
  }
  window.__nodoDictation = handler

  if (hasNative()) {
    try {
      const res = window.NodoNative!.startDictation(cbId)
      if (res !== 'ok') {
        window.__nodoDictation = undefined
        if (res === 'need-model') {
          onEvent('need-model', '')
        } else {
          onEvent('error', 'Error al iniciar el servicio de voz nativo')
        }
      }
    } catch {
      window.__nodoDictation = undefined
      onEvent('error', 'Error al comunicarse con el micrófono nativo')
    }
    return () => {
      try {
        window.NodoNative?.stopDictation()
      } catch {
        /* noop */
      }
      window.__nodoDictation = undefined
    }
  }

  // Fallback para navegador web cuando se prueba fuera de Android WebView
  type AnySpeech = new () => {
    lang: string
    interimResults: boolean
    continuous: boolean
    onstart: () => void
    onresult: (e: { resultIndex: number; results: { [key: number]: { [key: number]: { transcript: string }; isFinal?: boolean } } }) => void
    onerror: (e: { error: string }) => void
    onend: () => void
    start: () => void
    stop: () => void
  }
  const SpeechRec = (window as unknown as { SpeechRecognition?: AnySpeech; webkitSpeechRecognition?: AnySpeech }).SpeechRecognition ||
    (window as unknown as { SpeechRecognition?: AnySpeech; webkitSpeechRecognition?: AnySpeech }).webkitSpeechRecognition

  if (!SpeechRec) {
    window.__nodoDictation = undefined
    onEvent('error', 'El micrófono requiere la app de Android o un navegador compatible.')
    return () => {}
  }

  try {
    const recognition = new SpeechRec()
    recognition.lang = 'es-ES'
    recognition.interimResults = true
    recognition.continuous = false

    recognition.onstart = () => {
      onEvent('start', '')
    }
    recognition.onresult = (e) => {
      const result = e.results[e.resultIndex]
      const text = result?.[0]?.transcript ?? ''
      if (result?.isFinal) {
        onEvent('final', text)
      } else {
        onEvent('partial', text)
      }
    }
    recognition.onerror = (e) => {
      window.__nodoDictation = undefined
      const msg = e.error === 'not-allowed'
        ? 'Permiso de micrófono no concedido en el navegador'
        : e.error === 'no-speech'
          ? 'No se detectó voz'
          : `Error en reconocimiento (${e.error})`
      onEvent('error', msg)
    }
    recognition.onend = () => {
      window.__nodoDictation = undefined
    }
    recognition.start()

    return () => {
      try {
        recognition.stop()
      } catch {
        /* noop */
      }
      window.__nodoDictation = undefined
    }
  } catch {
    window.__nodoDictation = undefined
    onEvent('error', 'No se pudo inicializar el micrófono en el navegador')
    return () => {}
  }
}
