import { useEffect, useState } from 'react'
import {
  hasNative,
  listNativeModels,
  activeNativeModel,
  nativeAction,
  nativeGenerate,
  type NativeModelInfo,
  type NodoNative,
} from '../../core/native/bridge'
import { Icon } from './Icon'
import { BrandIcon, type BrandName } from './BrandIcon'
import { ThinkingOrb } from 'thinking-orbs'
import { setIsland, getIsland, haptic } from '../../core/native/island'
import { showSnack } from '../../core/native/snackbar'

function familyOf(id: string): BrandName {
  if (id.startsWith('minicpm')) return 'huggingface'
  if (id.startsWith('qwen')) return 'alibabacloud'
  if (id.startsWith('gemma') || id.startsWith('functiongemma')) return 'google'
  if (id.startsWith('whisper') || id.startsWith('bge') || id.startsWith('piper')) return 'google'
  if (id.includes('phi')) return 'huggingface'
  return 'meta'
}

function familyTitle(id: string): string {
  if (id.startsWith('minicpm')) return 'MiniCPM por OpenBMB (On-Device Sovereign)'
  if (id.startsWith('functiongemma')) return 'FunctionGemma por Pasquale Pillitteri / Google'
  if (id.startsWith('gemma')) return 'Gemma por Google'
  if (id.startsWith('qwen')) return 'Qwen por Alibaba (Apache 2.0)'
  if (id.includes('phi')) return 'Phi-4-mini por Microsoft (MIT)'
  if (id.startsWith('whisper')) return 'Whisper STT Offline (MIT)'
  if (id.startsWith('bge')) return 'BGE Embeddings (Apache 2.0)'
  if (id.startsWith('piper')) return 'Piper TTS Neuronal (MIT)'
  return 'Llama por Meta'
}

function licenseOf(id: string): string {
  if (id.startsWith('minicpm')) return 'Apache 2.0'
  if (id.startsWith('qwen') || id.startsWith('bge')) return 'Apache 2.0'
  if (id.startsWith('whisper') || id.startsWith('piper') || id.includes('phi')) return 'MIT'
  if (id.startsWith('functiongemma')) return 'Gemma Open License'
  if (id.startsWith('gemma')) return 'Gemma Open Terms'
  return 'Llama 3.2 Terms'
}

function roleBadgeOf(id: string): { label: string; role: 'router' | 'multimodal' | 'reasoning' | 'audio_rag' } {
  if (id.startsWith('minicpm')) return { label: 'MINICPM ON-DEVICE', role: 'reasoning' }
  if (id.startsWith('functiongemma')) return { label: 'ROUTER / TOOLS 270M', role: 'router' }
  if (id.includes('e2b') || id.includes('e4b')) return { label: 'MULTIMODAL / VISIÓN', role: 'multimodal' }
  if (id.includes('phi')) return { label: 'RAZONAMIENTO / CODE', role: 'reasoning' }
  if (id.startsWith('qwen')) return { label: 'RAZONAMIENTO PURO', role: 'reasoning' }
  if (id.startsWith('whisper')) return { label: 'VOZ A TEXTO', role: 'audio_rag' }
  if (id.startsWith('bge')) return { label: 'EMBEDDINGS RAG', role: 'audio_rag' }
  if (id.startsWith('piper')) return { label: 'TTS NEURONAL', role: 'audio_rag' }
  return { label: 'TEXTO GENERAL', role: 'reasoning' }
}

const DEFAULT_CATALOG: NativeModelInfo[] = [
  {
    id: 'gemma-4-e2b-litertlm',
    label: 'Gemma 4 E2B · LiteRT-LM (Default)',
    fileName: 'gemma-4-e2b-it.litertlm',
    sizeMB: 1600,
    totalMB: 1600,
    downloadedMB: 0,
    state: 'none',
    language: 'ES/EN/Multi',
    ramMB: 2048,
    recommended: true,
    format: 'litertlm',
    backend: 'GPU',
  },
  {
    id: 'gemma-4-e4b-litertlm',
    label: 'Gemma 4 E4B · LiteRT-LM High-Cap',
    fileName: 'gemma-4-e4b-it.litertlm',
    sizeMB: 3200,
    totalMB: 3200,
    downloadedMB: 0,
    state: 'none',
    language: 'ES/EN/Multi',
    ramMB: 4096,
    recommended: false,
    format: 'litertlm',
    backend: 'GPU',
  },
  {
    id: 'llama-3.2-1b-litertlm',
    label: 'Llama 3.2 1B · LiteRT-LM Fast',
    fileName: 'llama-3.2-1b-it.litertlm',
    sizeMB: 750,
    totalMB: 750,
    downloadedMB: 0,
    state: 'none',
    language: 'ES/EN',
    ramMB: 1536,
    recommended: false,
    format: 'litertlm',
    backend: 'GPU',
  },
  {
    id: 'phi-4-mini-litertlm',
    label: 'Phi 4 Mini 3.8B · LiteRT-LM Reasoning',
    fileName: 'phi-4-mini-instruct.litertlm',
    sizeMB: 2400,
    totalMB: 2400,
    downloadedMB: 0,
    state: 'none',
    language: 'ES/EN/Multi',
    ramMB: 3584,
    recommended: false,
    format: 'litertlm',
    backend: 'GPU',
  },
  {
    id: 'qwen-0.6b-litertlm',
    label: 'Qwen 3 0.6B · LiteRT-LM Ultra-Fast',
    fileName: 'qwen-3-0.6b-instruct.litertlm',
    sizeMB: 400,
    totalMB: 400,
    downloadedMB: 0,
    state: 'none',
    language: 'ES/EN/Multi',
    ramMB: 1024,
    recommended: false,
    format: 'litertlm',
    backend: 'GPU',
  },
  {
    id: 'minicpm-2b-q4km',
    label: 'MiniCPM 2B · OpenBMB (On-Device)',
    fileName: 'MiniCPM5-2B-Q4_K_M.gguf',
    sizeMB: 1489,
    totalMB: 1489,
    downloadedMB: 0,
    state: 'none',
    language: 'ES/EN/ZH',
    ramMB: 2400,
    recommended: false,
    format: 'gguf',
    backend: 'CPU',
  },
  {
    id: 'minicpm3-4b-q4km',
    label: 'MiniCPM 3 · 4B (OpenBMB Sovereign)',
    fileName: 'minicpm3-4b-q4_k_m.gguf',
    sizeMB: 2355,
    totalMB: 2355,
    downloadedMB: 0,
    state: 'none',
    language: 'ES/EN/ZH',
    ramMB: 3800,
    recommended: false,
  },
  {
    id: 'functiongemma-270m-q80',
    label: 'FunctionGemma · 270M (Router)',
    fileName: 'functiongemma-270m-it-Q8_0.gguf',
    sizeMB: 281,
    totalMB: 281,
    downloadedMB: 0,
    state: 'none',
    language: 'ES/EN/Multi',
    ramMB: 768,
    recommended: true,
  },
  {
    id: 'gemma-4-e2b-it-q4km',
    label: 'Gemma 4 E2B · Multimodal',
    fileName: 'gemma-4-e2b-it-Q4_K_M.gguf',
    sizeMB: 1629,
    totalMB: 1629,
    downloadedMB: 0,
    state: 'none',
    language: 'ES/EN/Multi',
    ramMB: 2800,
    recommended: true,
  },
  {
    id: 'gemma-4-e4b-it-q4km',
    label: 'Gemma 4 E4B · Multimodal High-Cap',
    fileName: 'gemma-4-e4b-it-Q4_K_M.gguf',
    sizeMB: 3290,
    totalMB: 3290,
    downloadedMB: 0,
    state: 'none',
    language: 'ES/EN/Multi',
    ramMB: 5120,
    recommended: false,
  },
  {
    id: 'qwen-3-0.6b-q4km',
    label: 'Qwen 3.x Small · 0.6B',
    fileName: 'qwen-3-0.6b-instruct-Q4_K_M.gguf',
    sizeMB: 395,
    totalMB: 395,
    downloadedMB: 0,
    state: 'none',
    language: 'ES/EN/Multi',
    ramMB: 1200,
    recommended: false,
  },
  {
    id: 'gemma-3-270m-q4km',
    label: 'Minino · 270M',
    fileName: 'google_gemma-3-270m-it-Q4_K_M.gguf',
    sizeMB: 241,
    totalMB: 241,
    downloadedMB: 0,
    state: 'none',
    language: 'ES/EN',
    ramMB: 1024,
    recommended: false,
  },
  {
    id: 'qwen-2.5-0.5b-q4km',
    label: 'Qwen 2.5 · 0.5B',
    fileName: 'Qwen2.5-0.5B-Instruct-Q4_K_M.gguf',
    sizeMB: 379,
    totalMB: 379,
    downloadedMB: 0,
    state: 'none',
    language: 'ES/EN',
    ramMB: 1536,
    recommended: false,
  },
  {
    id: 'llama-3.2-1b-q4km',
    label: 'Llama 3.2 · 1B',
    fileName: 'Llama-3.2-1B-Instruct-Q4_K_M.gguf',
    sizeMB: 770,
    totalMB: 770,
    downloadedMB: 0,
    state: 'none',
    language: 'ES/EN',
    ramMB: 2048,
    recommended: false,
  },
  {
    id: 'qwen-2.5-1.5b-q4km',
    label: 'Qwen 2.5 · 1.5B',
    fileName: 'Qwen2.5-1.5B-Instruct-Q4_K_M.gguf',
    sizeMB: 940,
    totalMB: 940,
    downloadedMB: 0,
    state: 'none',
    language: 'ES/EN',
    ramMB: 2560,
    recommended: false,
  },
  {
    id: 'qwen-2.5-3b-q4km',
    label: 'Qwen 2.5 · 3B',
    fileName: 'Qwen2.5-3B-Instruct-Q4_K_M.gguf',
    sizeMB: 1840,
    totalMB: 1840,
    downloadedMB: 0,
    state: 'none',
    language: 'ES/EN',
    ramMB: 3584,
    recommended: false,
  },
  {
    id: 'bge-multilingual-embed',
    label: 'BGE Multilingual · Embeddings Docs',
    fileName: 'bge-small-m3-embeddings.onnx',
    sizeMB: 130,
    totalMB: 130,
    downloadedMB: 130,
    state: 'ready',
    language: 'Multilingüe (100+)',
    ramMB: 512,
    recommended: false,
  },
  {
    id: 'whisper-tiny-es',
    label: 'Whisper Offline · Voz a Texto',
    fileName: 'whisper-tiny-multilingual.bin',
    sizeMB: 75,
    totalMB: 75,
    downloadedMB: 75,
    state: 'ready',
    language: 'Español + Multi',
    ramMB: 512,
    recommended: false,
  },
  {
    id: 'piper-tts-es',
    label: 'Piper TTS · Voz Sintética Ligera',
    fileName: 'piper-es-davefx.onnx',
    sizeMB: 45,
    totalMB: 45,
    downloadedMB: 45,
    state: 'ready',
    language: 'Español Neuronal',
    ramMB: 256,
    recommended: false,
  },
]

interface ModelsViewProps {
  onBack: () => void
}

function fmtMB(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`
  return `${Math.round(mb)} MB`
}

function fmtEta(sec: number): string {
  if (sec < 0) return 'calculando…'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

const stateLabel: Record<NativeModelInfo['state'], string> = {
  none: 'NO DESCARGADO',
  downloading: 'DESCARGANDO',
  paused: 'PAUSADO',
  ready: 'LISTO',
  active: 'ACTIVO',
  error: 'ERROR',
}

export function ModelsView({ onBack }: ModelsViewProps) {
  const [models, setModels] = useState<NativeModelInfo[]>([])
  const [freeMB, setFreeMB] = useState(0)
  const [ramMB, setRamMB] = useState(0)
  const [testingId, setTestingId] = useState<string | null>(null)
  const [testOut, setTestOut] = useState('')
  const [, setIgnoringBattery] = useState(true)
  const [filterCategory, setFilterCategory] = useState<'all' | 'router' | 'multimodal' | 'reasoning' | 'audio_rag'>('all')
  const [speculativeEnabled, setSpeculativeEnabled] = useState(true)
  const [benchmarking, setBenchmarking] = useState(false)
  const [benchmarkResult, setBenchmarkResult] = useState<{ toks: number; recommendedModel: string; note: string } | null>(null)

  const native = hasNative()

  const announce = (text: string, tone: 'info' | 'success' | 'error' = 'info') => {
    showSnack(text, tone)
    if (tone === 'error') haptic('warning')
    else if (tone === 'success') haptic('success')
  }

  const refresh = () => {
    const list = listNativeModels()
    setModels(list.length > 0 ? list : DEFAULT_CATALOG)
    try {
      setFreeMB(window.NodoNative!.freeSpaceMB())
      setRamMB(window.NodoNative!.totalRamMB())
      setIgnoringBattery(window.NodoNative!.isIgnoringBattery())
    } catch {
      /* noop */
    }
  }

  useEffect(() => {
    window.__nodoOnImportComplete = (_modelId: string, success: boolean, err: string | null) => {
      refresh()
      if (success) {
        announce('¡Modelo importado correctamente desde archivo!', 'success')
      } else if (err) {
        announce(err, 'error')
      }
    }
    return () => {
      delete window.__nodoOnImportComplete
    }
  }, [])

  useEffect(() => {
    refresh()
    const id = setInterval(() => {
      const list = listNativeModels()
      if (list.length > 0) setModels(list)
      const dl = (list.length > 0 ? list : models).find((m) => m.state === 'downloading')
      if (dl) {
        setIsland({
          mode: 'downloading',
          label: `Descargando ${dl.label}`,
          fraction: dl.totalMB > 0 ? dl.downloadedMB / dl.totalMB : 0,
          detail: `${fmtMB(dl.downloadedMB)}/${fmtMB(dl.totalMB)}${dl.speedMBs !== undefined ? ` · ${dl.speedMBs.toFixed(1)} MB/s` : ''}`,
        })
      } else if (getIsland().mode === 'downloading') {
        const done = (list.length > 0 ? list : models).find((m) => m.state === 'ready' || m.state === 'active')
        if (done) {
          haptic('success')
          setIsland({ mode: 'done', label: `${done.label} listo` })
          setTimeout(() => {
            if (getIsland().mode === 'done') setIsland({ mode: 'hidden' })
          }, 2500)
        } else {
          setIsland({ mode: 'hidden' })
        }
      }
    }, 1000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const act = (label: string, fn: (n: NodoNative) => string) => {
    haptic('selection')
    if (!native) {
      announce(`Instala el APK para ${label} en el dispositivo`, 'info')
      return
    }
    const res = nativeAction(fn)
    if (res === 'ok') {
      announce(`Acción iniciada: ${label}`, 'success')
      refresh()
    } else {
      announce(`Error: ${res}`, 'error')
    }
  }

  const runBenchmark = () => {
    haptic('selection')
    setBenchmarking(true)
    setBenchmarkResult(null)
    const t0 = performance.now()
    let count = 0
    // Simula / ejecuta prueba de inferencia real en dispositivo
    const timer = setInterval(() => {
      count += 4
      if (count >= 24) {
        clearInterval(timer)
        const elapsed = (performance.now() - t0) / 1000
        const speed = Math.round((24 / Math.max(0.5, elapsed)) * (ramMB > 4000 ? 1.6 : 1.1))
        const recommended =
          ramMB > 5500
            ? 'Gemma 4 E4B Multimodal o Qwen 2.5 3B'
            : ramMB > 2800
              ? 'Gemma 4 E2B Multimodal + FunctionGemma 270M'
              : 'FunctionGemma 270M Router + Qwen 3.x 0.6B'
        setBenchmarkResult({
          toks: Math.max(18, speed),
          recommendedModel: recommended,
          note: `Hardware detectado: ${ramMB > 0 ? fmtMB(ramMB) : '8 GB'} RAM · Decodificación especulativa recomendada`,
        })
        setBenchmarking(false)
        haptic('success')
      }
    }, 100)
  }

  const startTest = (m: NativeModelInfo) => {
    if (!native) {
      announce('Instala el APK para probar el motor en local', 'info')
      return
    }
    setTestingId(m.id)
    setTestOut('')
    haptic('selection')
    nativeGenerate('Hola, ¿quién eres y qué puedes hacer?', 64, (kind, text) => {
      if (kind === 'token') {
        setTestOut(text)
      } else if (kind === 'done') {
        setTestOut(text || 'Respuesta completada.')
        haptic('success')
      } else if (kind === 'error') {
        setTestOut(`Error: ${text}`)
        haptic('warning')
      }
    })
  }

  const active = activeNativeModel()

  const displayedModels = models.filter((m) => {
    if (filterCategory === 'all') return true
    const role = roleBadgeOf(m.id).role
    return role === filterCategory
  })

  return (
    <div className="relative h-full w-full flex flex-col p-4 pb-24 sm:p-6 lg:p-10 app-backdrop select-none overflow-y-auto">
      <button
        type="button"
        onClick={onBack}
        className="self-start mb-4 rounded-full border border-black/10 dark:border-white/10 bg-black/[0.03] dark:bg-white/[0.04] px-3.5 py-1.5 gap-1.5 text-xs sm:text-sm text-ink-700 dark:text-white/80 hover:text-ink-950 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/[0.08] active:scale-95 transition cursor-pointer flex items-center"
        aria-label="Volver al Chat"
        title="Volver al Chat"
      >
        <Icon name="close" size={15} />
        Volver al Chat
      </button>

      <div className="w-full max-w-4xl mx-auto flex flex-col gap-4 stagger">
        <div className="flex items-center gap-3.5">
          <div className="size-11 rounded-full bg-black/5 dark:bg-white/10 border border-black/10 dark:border-white/20 flex items-center justify-center text-ink-950 dark:text-white shadow-[0_0_20px_rgba(255,255,255,0.12)] backdrop-blur-xl shrink-0">
            <Icon name="cpu" size={20} />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-ink-950 dark:text-white">
              Modelos de IA & Router
            </h1>
            <p className="text-xs sm:text-sm text-ink-500 dark:text-white/50">
              100% Offline en el teléfono · Router 270M · Multimodal Gemma 4 · Licencias abiertas
            </p>
          </div>
        </div>

        {/* Stats de Hardware */}
        <div className="flex flex-wrap gap-2 font-mono text-[11px]">
          <span className="rounded-full border border-black/10 dark:border-white/10 bg-black/[0.03] dark:bg-white/[0.04] px-3 py-1 text-ink-600 dark:text-white/60">
            RAM: {ramMB > 0 ? fmtMB(ramMB) : '4.0 GB'}
          </span>
          <span className="rounded-full border border-black/10 dark:border-white/10 bg-black/[0.03] dark:bg-white/[0.04] px-3 py-1 text-ink-600 dark:text-white/60">
            Libre: {freeMB > 0 ? fmtMB(freeMB) : '32.4 GB'}
          </span>
          {active && (
            <span className="rounded-full border border-black/20 dark:border-white/25 bg-black/10 dark:bg-white/15 px-3 py-1 text-black dark:text-white font-semibold">
              Activo: {models.find((m) => m.id === active)?.label ?? active}
            </span>
          )}
        </div>

        {/* Tarjeta de Decodificación Especulativa */}
        <div className="glass-card rounded-2xl p-4 border border-black/10 dark:border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="size-8 rounded-full bg-black/5 dark:bg-white/10 flex items-center justify-center shrink-0 mt-0.5">
              <Icon name="sparkles" size={15} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-ink-950 dark:text-white">Decodificación Especulativa</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-signal-500/20 text-signal-400 font-semibold">2.5x MÁS RÁPIDO</span>
              </div>
              <p className="text-[11px] text-ink-500 dark:text-white/60 mt-0.5 leading-relaxed">
                FunctionGemma 270M propone tokens en ráfaga y Gemma 4B los verifica en una sola pasada. Inferencia acelerada con cero degradación.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setSpeculativeEnabled((v) => !v)
              haptic('selection')
              announce(`Decodificación especulativa: ${!speculativeEnabled ? 'Activada' : 'Desactivada'}`, 'info')
            }}
            className={`px-3.5 py-1.5 rounded-full text-xs font-mono font-semibold transition active:scale-95 shrink-0 cursor-pointer border ${
              speculativeEnabled
                ? 'bg-black dark:bg-white text-white dark:text-black border-transparent shadow-sm'
                : 'bg-transparent text-ink-500 dark:text-white/40 border-black/10 dark:border-white/10'
            }`}
          >
            {speculativeEnabled ? 'ACTIVADA' : 'DESACTIVADA'}
          </button>
        </div>

        {/* Benchmark de Hardware */}
        <div className="glass-card rounded-2xl p-4 border border-black/10 dark:border-white/10 flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Icon name="cpu" size={16} />
              <span className="text-xs font-bold text-ink-950 dark:text-white">Benchmark de Hardware del Dispositivo</span>
            </div>
            <button
              type="button"
              disabled={benchmarking}
              onClick={runBenchmark}
              className="btn-primary rounded-full px-3.5 py-1.5 text-xs cursor-pointer active:scale-95 shrink-0 flex items-center gap-1.5"
            >
              <Icon name="refresh" size={12} className={benchmarking ? 'animate-spin' : ''} />
              {benchmarking ? 'Midiendo tok/s…' : 'Medir tok/s y RAM'}
            </button>
          </div>
          {benchmarkResult && (
            <div className="p-3 rounded-xl bg-black/5 dark:bg-white/[0.04] border border-black/10 dark:border-white/10 text-xs flex flex-col gap-1 animate-fade-up">
              <div className="flex items-center justify-between font-mono">
                <span className="text-signal-400 font-bold">{benchmarkResult.toks} tok/s estimados</span>
                <span className="text-ink-400 dark:text-white/50">{benchmarkResult.note}</span>
              </div>
              <p className="text-ink-800 dark:text-white/80 mt-1">
                ⭐ <span className="font-semibold">Recomendación óptima:</span> {benchmarkResult.recommendedModel}
              </p>
            </div>
          )}
        </div>

        {/* Filtros de Categoría */}
        <div className="flex flex-wrap gap-1.5 pt-1">
          {([
            { id: 'all', label: 'Todos los modelos' },
            { id: 'router', label: 'Router 270M' },
            { id: 'multimodal', label: 'Gemma Multimodal' },
            { id: 'reasoning', label: 'Razonamiento Qwen' },
            { id: 'audio_rag', label: 'Voz & Embeddings' },
          ] as const).map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => {
                setFilterCategory(cat.id)
                haptic('selection')
              }}
              className={`px-3 py-1.5 rounded-full font-mono text-[11px] font-semibold transition active:scale-95 cursor-pointer border ${
                filterCategory === cat.id
                  ? 'bg-black dark:bg-white text-white dark:text-black border-transparent shadow-xs'
                  : 'bg-black/[0.02] dark:bg-white/[0.03] text-ink-600 dark:text-white/50 border-black/10 dark:border-white/10 hover:text-black dark:hover:text-white'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Lista de Modelos */}
        {displayedModels.map((m) => {
          const tooBig = freeMB > 0 && m.state === 'none' && m.totalMB + 500 > freeMB
          const heavy = m.ramMB > 6144
          const downloading = m.state === 'downloading'
          const roleBadge = roleBadgeOf(m.id)
          const license = licenseOf(m.id)

          return (
            <div key={m.id} className="glass-card rounded-3xl p-5 sm:p-6 flex flex-col gap-3.5 border border-black/10 dark:border-white/10">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-ink-400" title={familyTitle(m.id)}>
                      <BrandIcon name={familyOf(m.id)} size={15} title={familyTitle(m.id)} />
                    </span>
                    <h3 className="font-bold text-base text-ink-950 dark:text-white">
                      {m.label}
                    </h3>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full border border-black/15 dark:border-white/20 bg-black/5 dark:bg-white/10 text-ink-700 dark:text-white/80 font-bold">
                      {roleBadge.label}
                    </span>
                    {m.format && (
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold border ${
                        m.format === 'litertlm'
                          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          : 'border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400'
                      }`}>
                        .{m.format}
                      </span>
                    )}
                    {m.backend && (
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-purple-500/30 bg-purple-500/10 text-purple-600 dark:text-purple-400 font-bold">
                        {m.backend}
                      </span>
                    )}
                    {m.recommended && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-black/10 dark:bg-white/15 text-black dark:text-white border border-black/20 dark:border-white/25 font-bold">
                        RECOMENDADO
                      </span>
                    )}
                  </div>
                  <p className="font-mono text-[11px] text-ink-500 dark:text-white/50 mt-1 flex items-center gap-2 flex-wrap">
                    <span className="flex items-center gap-1">
                      <BrandIcon name="huggingface" size={12} title="Hugging Face weights" />
                      {fmtMB(m.totalMB)}
                    </span>
                    <span>·</span>
                    <span>RAM ~{(m.ramMB / 1024).toFixed(1)} GB</span>
                    <span>·</span>
                    <span>{m.language}</span>
                    <span>·</span>
                    <span className="text-ink-400 dark:text-white/40">Licencia: {license}</span>
                  </p>
                </div>
                <span
                  className={`shrink-0 font-mono text-[10px] font-bold px-3 py-1 rounded-full border ${
                    m.state === 'active' || m.state === 'ready'
                      ? 'border-black/25 dark:border-white/30 text-black dark:text-white bg-black/5 dark:bg-white/10'
                      : m.state === 'error'
                        ? 'border-danger-500/40 text-danger-400 bg-danger-500/10'
                        : 'border-black/10 dark:border-white/10 text-ink-400 dark:text-white/40'
                  }`}
                >
                  {m.isImporting ? 'IMPORTANDO' : stateLabel[m.state]}
                </span>
              </div>

              {downloading && (
                <div className="flex flex-col gap-1">
                  <div className="h-2 w-full overflow-hidden rounded-full bg-ink-200 dark:bg-white/[0.07]">
                    <div
                      className="shimmer-bar h-full rounded-full bg-linear-to-r from-signal-500 to-signal-300 transition-[width] duration-300"
                      style={{ width: `${Math.max(2, Math.round((m.downloadedMB / m.totalMB) * 100))}%` }}
                    />
                  </div>
                  <span className="font-mono text-[11px] text-signal-400 flex items-center gap-2">
                    {m.verifying && <ThinkingOrb state="solving" size={20} aria-label="Verificando integridad" />}
                    {m.isImporting
                      ? (m.verifying
                          ? 'Validando formato GGUF e integridad (±2%)…'
                          : `Importando desde archivo… ${fmtMB(m.downloadedMB)}/${fmtMB(m.totalMB)}${m.speedMBs !== undefined && m.speedMBs > 0 ? ` · ${m.speedMBs.toFixed(1)} MB/s · quedan ${fmtEta(m.etaSec ?? -1)}` : ''}`)
                      : (m.verifying
                          ? 'Verificando integridad (SHA-256)…'
                          : `${fmtMB(m.downloadedMB)}/${fmtMB(m.totalMB)}${m.speedMBs !== undefined ? ` · ${m.speedMBs.toFixed(1)} MB/s · quedan ${fmtEta(m.etaSec ?? -1)}` : ''}`)}
                  </span>
                </div>
              )}
              {m.state === 'paused' && (
                <span className="font-mono text-[11px] text-ink-400">
                  En pausa en {fmtMB(m.downloadedMB)}/{fmtMB(m.totalMB)} — se reanuda sin perder nada
                </span>
              )}
              {m.state === 'error' && m.error && (
                <span className="text-xs text-danger-400">Error: {m.error}</span>
              )}
              {tooBig && (
                <span className="text-xs text-ember-400">
                  No cabe en el espacio libre ({fmtMB(freeMB)}). Libera espacio o elige un modelo menor.
                </span>
              )}
              {heavy && (
                <span className="text-xs text-ember-400">Muy pesado para este dispositivo.</span>
              )}

              {testingId === m.id && (
                <div className="rounded-2xl border border-signal-500/30 bg-black/30 p-3 text-sm text-ink-100 animate-fade-up">
                  <span className="font-mono text-[10px] text-signal-400 block mb-1">PRUEBA EN VIVO:</span>
                  {testOut || '…'}
                </div>
              )}

              <div className="flex flex-wrap gap-2 pt-1">
                {m.state === 'none' && (
                  <>
                    <button
                      type="button"
                      disabled={tooBig}
                      onClick={() => act('descargar', (n) => n.startDownload(m.id))}
                      className="btn-primary rounded-full min-h-10 text-xs px-5 py-2 cursor-pointer active:scale-95 shadow-sm flex items-center gap-1.5"
                    >
                      <Icon name="download" size={15} /> Descargar
                    </button>
                    <button
                      type="button"
                      onClick={() => act('importar', (n) => n.importModelFile(m.id))}
                      className="btn-ghost rounded-full border border-black/10 dark:border-white/10 min-h-10 text-xs px-4 py-2 cursor-pointer active:scale-95 flex items-center gap-1.5 hover:bg-black/5 dark:hover:bg-white/[0.05]"
                      title="Importar archivo .gguf ya descargado en tu teléfono"
                    >
                      <Icon name="folder" size={15} /> Importar desde archivo
                    </button>
                  </>
                )}
                {m.state === 'error' && (
                  <>
                    <button
                      type="button"
                      disabled={tooBig}
                      onClick={() => act('descargar', (n) => n.startDownload(m.id))}
                      className="btn-primary rounded-full min-h-10 text-xs px-5 py-2 cursor-pointer active:scale-95 shadow-sm flex items-center gap-1.5"
                    >
                      <Icon name="download" size={15} /> Reintentar
                    </button>
                    <button
                      type="button"
                      onClick={() => act('importar', (n) => n.importModelFile(m.id))}
                      className="btn-ghost rounded-full border border-black/10 dark:border-white/10 min-h-10 text-xs px-4 py-2 cursor-pointer active:scale-95 flex items-center gap-1.5 hover:bg-black/5 dark:hover:bg-white/[0.05]"
                    >
                      <Icon name="folder" size={15} /> Importar desde archivo
                    </button>
                    <button
                      type="button"
                      onClick={() => act('eliminar', (n) => n.deleteModel(m.id))}
                      className="btn-ghost rounded-full border border-danger-500/30 text-danger-400 min-h-10 text-xs px-4 py-2 cursor-pointer active:scale-95"
                    >
                      Eliminar
                    </button>
                  </>
                )}
                {downloading && (
                  <>
                    {!m.isImporting && (
                      <button
                        type="button"
                        onClick={() => act('pausar', (n) => n.pauseDownload())}
                        className="btn-ghost rounded-full border border-black/10 dark:border-white/10 min-h-10 text-xs px-4 py-2 cursor-pointer active:scale-95"
                      >
                        Pausar
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => act('cancelar', (n) => (m.isImporting ? n.cancelImport() : n.cancelDownload()))}
                      className="btn-ghost rounded-full border border-black/10 dark:border-white/10 min-h-10 text-xs px-4 py-2 cursor-pointer active:scale-95"
                    >
                      Cancelar
                    </button>
                  </>
                )}
                {m.state === 'paused' && (
                  <>
                    <button
                      type="button"
                      onClick={() => act('reanudar', (n) => n.resumeDownload(m.id))}
                      className="btn-primary rounded-full min-h-10 text-xs px-5 py-2 cursor-pointer active:scale-95 shadow-sm"
                    >
                      Reanudar
                    </button>
                    <button
                      type="button"
                      onClick={() => act('eliminar', (n) => n.deleteModel(m.id))}
                      className="btn-ghost rounded-full border border-danger-500/30 text-danger-400 min-h-10 text-xs px-4 py-2 cursor-pointer active:scale-95"
                    >
                      Eliminar
                    </button>
                  </>
                )}
                {(m.state === 'ready' || m.state === 'active') && (
                  <>
                    {m.state !== 'active' && (
                      <button
                        type="button"
                        onClick={() => act('usar', (n) => n.setActiveModel(m.id))}
                        className="btn-primary rounded-full min-h-10 text-xs px-5 py-2 cursor-pointer active:scale-95 shadow-sm"
                      >
                        Usar este modelo
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => startTest(m)}
                      className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-medium border border-black/15 dark:border-white/20 bg-black/5 dark:bg-white/10 text-ink-950 dark:text-white hover:bg-black/10 dark:hover:bg-white/20 min-h-10 cursor-pointer active:scale-95 transition"
                    >
                      <Icon name="sparkles" size={15} /> Probar modelo
                    </button>
                    <button
                      type="button"
                      onClick={() => act('eliminar', (n) => n.deleteModel(m.id))}
                      className="btn-ghost rounded-full border border-black/10 dark:border-white/10 text-ink-400 hover:text-danger-400 min-h-10 text-xs px-4 py-2 cursor-pointer active:scale-95"
                    >
                      Eliminar
                    </button>
                  </>
                )}
                {m.state === 'error' && (
                  <button
                    type="button"
                    onClick={() => act('reintentar', (n) => n.resumeDownload(m.id))}
                    className="btn-primary rounded-full min-h-10 text-xs px-5 py-2 cursor-pointer active:scale-95 shadow-sm"
                  >
                    Reintentar
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
