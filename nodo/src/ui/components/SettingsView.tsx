import { useEffect, useState } from 'react'
import {
  hasNative,
  listNativeModels,
  activeNativeModel,
  nativeAction,
  nativeGenerate,
  getDeviceSpecs,
  type DeviceSpecs,
} from '../../core/native/bridge'
import {
  getStorageInfo,
  requestPersistence,
  formatBytes,
  type StorageInfo,
} from '../../core/offline/storage'
import { db } from '../../core/db/schema'
import { getSetting, setSetting } from '../../core/db/repo'
import { Icon } from './Icon'
import { showSnack } from '../../core/native/snackbar'

interface SettingsViewProps {
  onBack: () => void
  activeModelId: string | null
  onModelChanged: (newModelId: string) => void
  theme: 'dark' | 'light'
  onToggleTheme: () => void
  onOpenModels: () => void
}

export interface BenchmarkResult {
  promptName: string
  ttftSec: number
  tokPerSec: number
  tokensCount: number
  elapsedSec: number
}

function fmtMB(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`
  return `${Math.round(mb)} MB`
}

export function SettingsView({
  onBack,
  onToggleTheme,
  onOpenModels,
  theme,
}: SettingsViewProps) {
  const [storage, setStorage] = useState<StorageInfo | null>(null)
  const [activeLabel, setActiveLabel] = useState('')
  const [ramMB, setRamMB] = useState(0)
  const [freeMB, setFreeMB] = useState(0)
  const [engineCtx, setEngineCtx] = useState(2048)
  const [engineThreads, setEngineThreads] = useState(0)
  const [perfMode, setPerfMode] = useState(false)
  const [perms, setPerms] = useState({ location: false, camera: false, battery: true })

  const [benchmarking, setBenchmarking] = useState(false)
  const [benchStep, setBenchStep] = useState(0)
  const [benchResults, setBenchResults] = useState<BenchmarkResult[]>([])
  const [benchRamUsed, setBenchRamUsed] = useState<number | null>(null)
  const [deviceSpecs, setDeviceSpecs] = useState<DeviceSpecs | null>(null)
  const [cloudApiKey, setCloudApiKey] = useState('')
  const [cloudProvider, setCloudProvider] = useState<'gemini' | 'claude'>('gemini')

  const refreshAll = async () => {
    const s = await getStorageInfo()
    setStorage(s)
    if (hasNative()) {
      try {
        const id = activeNativeModel()
        const found = listNativeModels().find((m) => m.id === id)
        setActiveLabel(found ? found.label : '')
        setRamMB(window.NodoNative!.totalRamMB())
        setFreeMB(window.NodoNative!.freeSpaceMB())
        const [nc, nt] = window.NodoNative!.getEnginePrefs().split(',').map(Number)
        if (nc) setEngineCtx(nc)
        setEngineThreads(nt ?? 0)
        setPerms({
          location: window.NodoNative!.hasLocationPermission(),
          camera: window.NodoNative!.hasCameraPermission(),
          battery: window.NodoNative!.isIgnoringBattery(),
        })
      } catch {
        /* sin puente */
      }
    }
  }

  useEffect(() => {
    void refreshAll()
    void getSetting<boolean>('perfMode').then((v) => setPerfMode(!!v))
    void getSetting<string>('cloudApiKey').then((v) => { if (v) setCloudApiKey(v) })
    void getSetting<'gemini' | 'claude'>('cloudProvider').then((v) => { if (v) setCloudProvider(v) })
    const specs = getDeviceSpecs()
    if (specs) setDeviceSpecs(specs)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const runBenchmark = async () => {
    if (!hasNative()) {
      showSnack('Se requiere la app en Android para ejecutar el benchmark.', 'error')
      return
    }
    const model = activeNativeModel()
    if (!model) {
      showSnack('Activa o descarga un modelo en la pestaña Modelos primero.', 'error')
      return
    }
    setBenchmarking(true)
    setBenchResults([])
    setBenchRamUsed(window.NodoNative?.totalRamMB() ?? null)
    showSnack('Iniciando benchmark de rendimiento...', 'info')

    const testPrompts = [
      { name: '1. Velocidad corta', prompt: 'Hola, ¿cómo estás hoy?' },
      { name: '2. Razonamiento', prompt: 'Explica brevemente por qué el cielo es azul durante el día.' },
      { name: '3. Código / Algoritmo', prompt: 'Escribe una función en JavaScript para verificar si un número es primo.' },
    ]

    const results: BenchmarkResult[] = []

    for (let i = 0; i < testPrompts.length; i++) {
      setBenchStep(i + 1)
      const p = testPrompts[i]!
      const startTime = performance.now()
      let firstTokenTime = 0
      let totalTokens = 0
      let fullOutput = ''

      await new Promise<void>((resolve) => {
        nativeGenerate(p.prompt, 128, (kind, text) => {
          if (kind === 'token') {
            if (!firstTokenTime) {
              firstTokenTime = performance.now()
            }
            totalTokens++
          } else if (kind === 'done') {
            fullOutput = text
            resolve()
          } else if (kind === 'error') {
            resolve()
          }
        })
      })

      const endTime = performance.now()
      const effectiveFirstToken = firstTokenTime || endTime
      const ttftSec = Number(((effectiveFirstToken - startTime) / 1000).toFixed(2))
      const genDurationSec = Number(((endTime - effectiveFirstToken) / 1000).toFixed(2))
      const words = fullOutput.trim().split(/\s+/).filter(Boolean).length
      const estimatedTokens = Math.max(totalTokens, Math.round(words * 1.3))
      const tokPerSec = genDurationSec > 0.05
        ? Number((estimatedTokens / genDurationSec).toFixed(1))
        : 0

      results.push({
        promptName: p.name,
        ttftSec,
        tokPerSec,
        tokensCount: estimatedTokens,
        elapsedSec: Number(((endTime - startTime) / 1000).toFixed(2)),
      })
    }

    setBenchResults(results)
    setBenchmarking(false)
    showSnack('Benchmark completado.', 'success')
  }

  const applyOptimalSettings = () => {
    const specs = getDeviceSpecs() || deviceSpecs
    const optimalThreads = specs?.bigCores ?? 4
    const optimalCtx = (specs?.totalRamMB ?? ramMB) >= 6144 ? 4096 : 2048
    setEngineThreads(optimalThreads)
    setEngineCtx(optimalCtx)
    nativeAction((n) => n.setEnginePrefs(optimalCtx, optimalThreads))
    showSnack(
      `Configuración óptima aplicada: ${optimalThreads} hilos (núcleos grandes), contexto ${optimalCtx / 1024}k.`,
      'success',
    )
  }

  const saveCloudSettings = async (key: string, prov: 'gemini' | 'claude') => {
    setCloudApiKey(key)
    setCloudProvider(prov)
    await setSetting('cloudApiKey', key)
    await setSetting('cloudProvider', prov)
    showSnack('Ajustes de API en la nube guardados.', 'success')
  }

  const togglePerf = async () => {
    const next = !perfMode
    setPerfMode(next)
    document.documentElement.classList.toggle('perf', next)
    await setSetting('perfMode', next)
    showSnack(next ? 'Modo rendimiento activado.' : 'Modo rendimiento desactivado.', 'info')
  }

  const handleRequestPersistence = async () => {
    const granted = await requestPersistence()
    await refreshAll()
    showSnack(
      granted ? 'Persistencia de almacenamiento concedida.' : 'El sistema denegó la persistencia.',
      granted ? 'success' : 'error',
    )
  }

  const handleClearAllData = async () => {
    if (!confirm('¿Borrar TODOS los documentos, notas y chats locales?')) return
    await db.transaction('rw', db.documents, db.chunks, db.notes, db.chats, db.messages, async () => {
      await db.documents.clear()
      await db.chunks.clear()
      await db.notes.clear()
      await db.chats.clear()
      await db.messages.clear()
    })
    showSnack('Datos locales eliminados.', 'success')
  }

  const permRow = (label: string, granted: boolean, hint: string) => (
    <div className="flex items-center justify-between py-2.5 border-b border-ink-200/50 dark:border-white/5">
      <div>
        <h4 className="text-sm font-semibold text-ink-900 dark:text-white">{label}</h4>
        <p className="text-xs text-ink-400 dark:text-white/45">{hint}</p>
      </div>
      <span
        className={`font-mono text-[10px] font-bold px-3 py-1 rounded-full border ${
          granted
            ? 'border-black/25 dark:border-white/30 text-black dark:text-white bg-black/5 dark:bg-white/10'
            : 'border-black/10 dark:border-white/15 text-ink-400 dark:text-white/40'
        }`}
      >
        {granted ? 'CONCEDIDO' : 'PENDIENTE'}
      </span>
    </div>
  )

  return (
    <div className="relative h-full w-full flex flex-col p-4 pb-20 sm:p-6 lg:p-10 app-backdrop select-none overflow-y-auto">
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

      <div className="w-full max-w-4xl mx-auto flex flex-col gap-6 pb-12 stagger">
        <div className="flex items-center gap-3.5 border-b border-ink-200/60 dark:border-white/10 pb-5">
          <div className="size-12 rounded-full bg-black/5 dark:bg-white/10 border border-black/10 dark:border-white/20 flex items-center justify-center text-ink-950 dark:text-white shadow-[0_0_20px_rgba(255,255,255,0.12)] backdrop-blur-xl shrink-0">
            <Icon name="settings" size={22} />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-ink-950 dark:text-white">Ajustes</h1>
            <p className="text-xs sm:text-sm text-ink-500 dark:text-white/50">
              Modelo activo, almacenamiento, tema, idioma y permisos
            </p>
          </div>
        </div>

        {/* Modelo activo */}
        <div className="glass rounded-3xl p-5 flex items-center justify-between gap-3 border border-black/10 dark:border-white/10">
          <div>
            <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-ink-400 dark:text-white/50">
              Modelo activo
            </span>
            <p className="text-base font-bold text-ink-950 dark:text-white mt-1">
              {activeLabel || 'Ninguno — descárgalo en Modelos'}
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenModels}
            className="btn-primary rounded-full text-xs px-5 py-2.5 cursor-pointer shrink-0 active:scale-95 shadow-sm"
          >
            Ir a Modelos
          </button>
        </div>

        {/* Motor */}
        <div className="glass rounded-3xl p-5 flex flex-col gap-3.5 border border-black/10 dark:border-white/10">
          <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-ink-400 dark:text-white/50">
            Motor (se aplica al cargar el modelo)
          </span>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h4 className="text-sm font-semibold text-ink-900 dark:text-white">Contexto</h4>
              <p className="text-xs text-ink-400 dark:text-white/45">Memoria de conversación</p>
            </div>
            <div className="flex gap-1.5">
              {[1024, 2048, 4096].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => {
                    setEngineCtx(v)
                    nativeAction((n) => n.setEnginePrefs(v, engineThreads))
                  }}
                  className={`px-3.5 py-1.5 rounded-full font-mono text-xs cursor-pointer border transition flex items-center justify-center active:scale-95 ${
                    engineCtx === v
                      ? 'border-black/30 dark:border-white/30 text-black dark:text-white bg-black/10 dark:bg-white/15 font-bold shadow-xs'
                      : 'border-black/10 dark:border-white/10 text-ink-500 dark:text-white/50 hover:text-black dark:hover:text-white'
                  }`}
                >
                  {v / 1024}k
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h4 className="text-sm font-semibold text-ink-900 dark:text-white">Hilos CPU</h4>
              <p className="text-xs text-ink-400 dark:text-white/45">Auto según el teléfono</p>
            </div>
            <div className="flex gap-1.5">
              {[
                { v: 0, label: 'Auto' },
                { v: 2, label: '2' },
                { v: 4, label: '4' },
                { v: 6, label: '6' },
              ].map((o) => (
                <button
                  key={o.v}
                  type="button"
                  onClick={() => {
                    setEngineThreads(o.v)
                    nativeAction((n) => n.setEnginePrefs(engineCtx, o.v))
                  }}
                  className={`px-3.5 py-1.5 rounded-full font-mono text-xs cursor-pointer border transition flex items-center justify-center active:scale-95 ${
                    engineThreads === o.v
                      ? 'border-black/30 dark:border-white/30 text-black dark:text-white bg-black/10 dark:bg-white/15 font-bold shadow-xs'
                      : 'border-black/10 dark:border-white/10 text-ink-500 dark:text-white/50 hover:text-black dark:hover:text-white'
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Benchmark Integrado */}
        <div className="glass rounded-3xl p-5 flex flex-col gap-3.5 border border-black/10 dark:border-white/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Icon name="sparkles" size={16} className="text-amber-400" />
              <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-ink-400 dark:text-white/50">
                Benchmark de Rendimiento
              </span>
            </div>
            <button
              type="button"
              disabled={benchmarking}
              onClick={runBenchmark}
              className="btn-primary rounded-full text-xs px-4 py-1.5 cursor-pointer flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
            >
              <Icon name="play" size={12} />
              <span>{benchmarking ? `Prueba ${benchStep}/3…` : 'Correr Benchmark'}</span>
            </button>
          </div>

          <p className="text-xs text-ink-500 dark:text-white/50 leading-relaxed">
            Mide el primer token (TTFT), tokens/seg y RAM con 3 pruebas estándar (velocidad, razonamiento y código).
          </p>

          {benchResults.length > 0 && (
            <div className="flex flex-col gap-2 pt-2 border-t border-black/5 dark:border-white/5">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2.5 rounded-xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10">
                  <span className="block text-[10px] text-ink-400 dark:text-white/40">1er Token Promedio</span>
                  <span className="text-sm font-bold font-mono text-ink-900 dark:text-white">
                    {(benchResults.reduce((acc, r) => acc + r.ttftSec, 0) / benchResults.length).toFixed(2)}s
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10">
                  <span className="block text-[10px] text-ink-400 dark:text-white/40">Velocidad Promedio</span>
                  <span className="text-sm font-bold font-mono text-emerald-400">
                    {(benchResults.reduce((acc, r) => acc + r.tokPerSec, 0) / benchResults.length).toFixed(1)} tok/s
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10">
                  <span className="block text-[10px] text-ink-400 dark:text-white/40">RAM del Dispositivo</span>
                  <span className="text-sm font-bold font-mono text-ink-900 dark:text-white">
                    {benchRamUsed ? `${benchRamUsed} MB` : 'OK'}
                  </span>
                </div>
              </div>

              {/* Detalle de pruebas */}
              <div className="flex flex-col gap-1.5 mt-1">
                {benchResults.map((r, idx) => (
                  <div key={idx} className="flex justify-between items-center text-xs p-2 rounded-lg bg-black/[0.02] dark:bg-white/[0.02]">
                    <span className="text-ink-700 dark:text-white/70">{r.promptName}</span>
                    <div className="flex gap-2 font-mono text-[11px]">
                      <span className="text-ink-400 dark:text-white/40">TTFT: {r.ttftSec}s</span>
                      <span className="text-emerald-400 font-bold">{r.tokPerSec} tok/s</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Metas alcanzadas */}
              <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center justify-between">
                <span>🎯 Metas: &lt;3s 1er token | &gt;8 tok/s E2B | &gt;20 tok/s Qwen</span>
                <button
                  type="button"
                  onClick={applyOptimalSettings}
                  className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 font-medium text-[11px] cursor-pointer"
                >
                  Optimizar celular
                </button>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={applyOptimalSettings}
            className="btn-ghost rounded-full border border-black/10 dark:border-white/10 text-xs py-2 w-full cursor-pointer active:scale-95"
          >
            🎯 Aplicar parámetros óptimos automáticamente
          </button>
        </div>

        {/* Fallback a Nube (Gemini / Claude) */}
        <div className="glass rounded-3xl p-5 flex flex-col gap-3 border border-black/10 dark:border-white/10">
          <div className="flex items-center gap-2">
            <Icon name="cloud" size={16} className="text-purple-400" />
            <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-ink-400 dark:text-white/50">
              API en la Nube (Opcional)
            </span>
          </div>
          <p className="text-xs text-ink-500 dark:text-white/50 leading-relaxed">
            Se utiliza únicamente si tocas el botón "Respuesta avanzada (nube)" en preguntas difíciles. 100% local por defecto.
          </p>
          <div className="flex items-center gap-2">
            <select
              value={cloudProvider}
              onChange={(e) => void saveCloudSettings(cloudApiKey, e.target.value as 'gemini' | 'claude')}
              className="text-xs p-2 rounded-xl border border-black/10 dark:border-white/15 bg-black/5 dark:bg-white/5 text-ink-900 dark:text-white font-medium cursor-pointer"
            >
              <option value="gemini">Google Gemini (Flash)</option>
              <option value="claude">Anthropic Claude</option>
            </select>
            <input
              type="password"
              placeholder="Pega tu API Key de Gemini o Claude…"
              value={cloudApiKey}
              onChange={(e) => setCloudApiKey(e.target.value)}
              onBlur={() => void saveCloudSettings(cloudApiKey, cloudProvider)}
              className="flex-1 text-xs p-2 rounded-xl border border-black/10 dark:border-white/15 bg-black/5 dark:bg-white/5 text-ink-900 dark:text-white font-mono"
            />
          </div>
        </div>

        {/* Dispositivo */}
        <div className="glass rounded-3xl p-5 flex flex-col gap-2 border border-black/10 dark:border-white/10">
          <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-ink-400 dark:text-white/50">
            Dispositivo
          </span>
          <div className="flex justify-between text-xs py-1.5 border-b border-black/5 dark:border-white/5">
            <span className="text-ink-500 dark:text-white/50">Memoria RAM:</span>
            <span className="font-mono font-semibold text-ink-950 dark:text-white">{ramMB > 0 ? fmtMB(ramMB) : '…'}</span>
          </div>
          <div className="flex justify-between text-xs py-1.5 border-b border-black/5 dark:border-white/5">
            <span className="text-ink-500 dark:text-white/50">Espacio libre:</span>
            <span className="font-mono font-semibold text-ink-950 dark:text-white">{freeMB > 0 ? fmtMB(freeMB) : '…'}</span>
          </div>
          <div className="flex justify-between text-xs py-1.5">
            <span className="text-ink-500 dark:text-white/50">Idioma:</span>
            <span className="font-semibold text-ink-950 dark:text-white">Español</span>
          </div>
        </div>

        {/* Permisos */}
        <div className="glass rounded-3xl p-5 flex flex-col gap-1 border border-black/10 dark:border-white/10">
          <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-ink-400 dark:text-white/50">
            Permisos
          </span>
          {permRow('Ubicación', perms.location, 'El agente puede decirte dónde estás.')}
          {permRow('Cámara (linterna)', perms.camera, 'El agente puede encender el flash.')}
          {permRow('Sin restricción de batería', perms.battery, 'Descargas fiables con pantalla apagada.')}
          <button
            type="button"
            onClick={() => {
              nativeAction((n) => n.openAppSettings())
              setTimeout(() => void refreshAll(), 1500)
            }}
            className="btn-ghost rounded-full border border-black/10 dark:border-white/10 text-xs py-2.5 w-full cursor-pointer mt-3 active:scale-95"
          >
            Abrir ajustes de la app
          </button>
        </div>

        {/* Almacenamiento web */}
        <div className="glass rounded-3xl p-5 flex flex-col justify-between gap-3 border border-black/10 dark:border-white/10">
          <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-ink-400 dark:text-white/50">
            Almacenamiento local
          </span>
          <div className="flex justify-between text-xs py-1.5 border-b border-black/5 dark:border-white/5">
            <span className="text-ink-500 dark:text-white/50">Documentos y notas:</span>
            <span className="font-mono font-semibold text-ink-950 dark:text-white">
              {storage ? formatBytes(storage.usageBytes) : 'Calculando...'}
            </span>
          </div>
          <div className="flex justify-between text-xs py-1.5">
            <span className="text-ink-500 dark:text-white/50">Persistencia:</span>
            <span className="font-semibold text-black dark:text-white font-mono">
              {storage?.persisted ? 'Activa' : 'Temporal'}
            </span>
          </div>
          {!storage?.persisted && (
            <button
              type="button"
              onClick={handleRequestPersistence}
              className="btn-ghost rounded-full border border-black/10 dark:border-white/10 text-xs py-2.5 w-full cursor-pointer active:scale-95"
            >
              Solicitar persistencia permanente
            </button>
          )}
        </div>

        {/* Preferencias */}
        <div className="glass rounded-3xl p-5 flex flex-col gap-4 border border-black/10 dark:border-white/10">
          <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-ink-400 dark:text-white/50">
            Preferencias
          </span>
          <div className="flex items-center justify-between py-2 border-b border-black/5 dark:border-white/5">
            <div>
              <h4 className="text-sm font-semibold text-ink-900 dark:text-white">Modo rendimiento</h4>
              <p className="text-xs text-ink-400 dark:text-white/45">Sin blur ni animaciones pesadas</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={perfMode}
              aria-label="Modo rendimiento"
              onClick={() => void togglePerf()}
              className={`relative h-8 w-14 shrink-0 rounded-full transition-colors cursor-pointer border border-black/10 dark:border-white/10 ${
                perfMode ? 'bg-black dark:bg-white' : 'bg-black/10 dark:bg-white/10'
              }`}
            >
              <span
                className={`absolute top-1 size-6 rounded-full transition-all shadow-sm ${
                  perfMode
                    ? 'left-7 bg-white dark:bg-black'
                    : 'left-1 bg-white'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between py-2 border-b border-black/5 dark:border-white/5">
            <div>
              <h4 className="text-sm font-semibold text-ink-900 dark:text-white">Tema visual</h4>
              <p className="text-xs text-ink-400 dark:text-white/45">Alternar entre modo oscuro y claro</p>
            </div>
            <button
              type="button"
              onClick={onToggleTheme}
              className="btn-ghost rounded-full border border-black/10 dark:border-white/10 text-xs px-4 py-2 gap-2 cursor-pointer active:scale-95"
              aria-label="Cambiar tema" title="Cambiar tema"
            >
              <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={15} />
              <span>{theme === 'dark' ? 'Modo Claro' : 'Modo Oscuro'}</span>
            </button>
          </div>
          <div className="flex items-center justify-between py-2">
            <div>
              <h4 className="text-sm font-semibold text-danger-400">Zona de peligro</h4>
              <p className="text-xs text-ink-400 dark:text-white/45">Eliminar documentos, notas y chats locales</p>
            </div>
            <button
              type="button"
              onClick={handleClearAllData}
              className="btn-ghost rounded-full border border-danger-500/30 text-danger-400 hover:bg-danger-500/10 text-xs px-4 py-2 gap-1.5 cursor-pointer active:scale-95"
            >
              <Icon name="trash" size={14} />
              <span>Limpiar datos</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
