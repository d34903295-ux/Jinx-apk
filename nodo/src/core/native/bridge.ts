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
  speedMBs?: number
  etaSec?: number
  error?: string
}

export interface NodoNative {
  openModels(): void
  activeNativeModel(): string
  modelsJson(): string
  startDownload(id: string): string
  pauseDownload(): string
  resumeDownload(id: string): string
  cancelDownload(): string
  deleteModel(id: string): string
  setActiveModel(id: string): string
  generate(prompt: string, maxTokens: number, cbId: string): string
  stopGenerate(): string
  freeSpaceMB(): number
  totalRamMB(): number
  isIgnoringBattery(): boolean
  requestBatteryExemption(): string
}

declare global {
  interface Window {
    NodoNative?: NodoNative
    __nodoCb?: (cbId: string, kind: string, text: string) => void
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

type Cb = (kind: 'start' | 'token' | 'done' | 'error', text: string) => void
const callbacks = new Map<string, Cb>()
let seq = 0

function ensureDispatcher() {
  if (!window.__nodoCb) {
    window.__nodoCb = (cbId, kind, text) => {
      const cb = callbacks.get(cbId)
      if (!cb) return
      cb(kind as 'start' | 'token' | 'done' | 'error', text)
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
  let res = 'no-model'
  try {
    res = window.NodoNative!.generate(prompt, maxTokens, cbId)
  } catch {
    res = 'error'
  }
  if (res !== 'ok') {
    callbacks.delete(cbId)
    onEvent('error', res === 'no-model' ? 'Sin modelo activo. Descarga uno en Modelos.' : 'Error al generar')
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
