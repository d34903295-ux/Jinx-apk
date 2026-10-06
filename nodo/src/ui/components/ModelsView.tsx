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
import { setIsland, getIsland, haptic } from '../../core/native/island'
import { showSnack } from '../../core/native/snackbar'

function familyOf(id: string): BrandName {
  return id.startsWith('qwen') ? 'alibabacloud' : 'meta'
}

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
  const [ignoringBattery, setIgnoringBattery] = useState(true)
  const native = hasNative()

  const announce = (text: string, tone: 'info' | 'success' | 'error' = 'info') => {
    showSnack(text, tone)
    if (tone === 'error') haptic('warning')
    else if (tone === 'success') haptic('success')
  }

  const refresh = () => {
    setModels(listNativeModels())
    try {
      setFreeMB(window.NodoNative!.freeSpaceMB())
      setRamMB(window.NodoNative!.totalRamMB())
      setIgnoringBattery(window.NodoNative!.isIgnoringBattery())
    } catch {
      /* noop */
    }
  }

  useEffect(() => {
    refresh()
    const id = setInterval(() => {
      const list = listNativeModels()
      setModels(list)
      const dl = list.find((m) => m.state === 'downloading')
      if (dl) {
        setIsland({
          mode: 'downloading',
          label: `Descargando ${dl.label}`,
          fraction: dl.totalMB > 0 ? dl.downloadedMB / dl.totalMB : 0,
          detail: `${fmtMB(dl.downloadedMB)}/${fmtMB(dl.totalMB)}${dl.speedMBs !== undefined ? ` · ${dl.speedMBs.toFixed(1)} MB/s` : ''}`,
        })
      } else if (getIsland().mode === 'downloading') {
        const done = list.find((m) => m.state === 'ready' || m.state === 'active')
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
    const r = nativeAction(fn)
    if (r === 'nospace') announce('No hay espacio suficiente para ese modelo.', 'error')
    else if (r !== 'ok') announce(`"${label}" no disponible (${r}).`, 'error')
    refresh()
  }

  const startTest = (m: NativeModelInfo) => {
    const set = nativeAction((n) => n.setActiveModel(m.id))
    if (set !== 'ok') {
      announce('Activa el modelo primero.', 'error')
      return
    }
    setTestingId(m.id)
    setTestOut('Cargando modelo…')
    nativeGenerate('Di hola y preséntate en una frase.', 128, (kind, text) => {
      if (kind === 'token') setTestOut(text)
      else if (kind === 'done') setTestOut(text || '(sin respuesta)')
      else if (kind === 'error') {
        setTestOut(`Error: ${text}`)
        setTestingId(null)
      }
    })
  }

  const active = activeNativeModel()

  return (
    <div className="relative min-h-screen w-full flex flex-col p-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] sm:p-6 lg:p-10 app-backdrop select-none overflow-y-auto">
      <button
        type="button"
        onClick={onBack}
        className="self-start mb-4 btn-ghost gap-1.5 text-xs sm:text-sm cursor-pointer"
        aria-label="Volver al Chat" title="Volver al Chat"
      >
        <Icon name="close" size={16} />
        Volver al Chat
      </button>

      <div className="w-full max-w-4xl mx-auto flex flex-col gap-4 stagger">
        <div className="flex items-center gap-3">
          <div className="size-11 rounded-2xl bg-linear-to-br from-signal-400 to-signal-600 flex items-center justify-center text-ink-950 shadow-md shadow-signal-500/20">
            <Icon name="cpu" size={20} />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-ink-900 dark:text-white">
              Modelos de IA
            </h1>
            <p className="text-xs sm:text-sm text-ink-500 dark:text-ink-400">
              Descarga una sola vez · funciona sin internet · motor nativo
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 font-mono text-[11px] text-ink-400">
          <span className="rounded-full border border-white/10 px-3 py-1">
            RAM: {ramMB > 0 ? fmtMB(ramMB) : '…'}
          </span>
          <span className="rounded-full border border-white/10 px-3 py-1">
            Libre: {freeMB > 0 ? fmtMB(freeMB) : '…'}
          </span>
          {active && (
            <span className="rounded-full border border-signal-500/40 bg-signal-500/10 px-3 py-1 text-signal-400">
              Activo: {models.find((m) => m.id === active)?.label ?? active}
            </span>
          )}
        </div>

        {!native && (
          <div className="glass rounded-2xl border-cyan-500/30 bg-cyan-500/10 p-4 text-cyan-700 dark:text-cyan-300 text-sm">
            Vista previa en navegador: la descarga y la inferencia funcionan dentro del APK.
          </div>
        )}

        {native && !ignoringBattery && (
          <div className="glass rounded-2xl border-ember-500/30 bg-ember-500/10 p-4 text-sm text-ember-600 dark:text-ember-300 flex flex-col gap-2 animate-fade-up">
            <span>
              Para que las descargas grandes no se corten con la pantalla apagada, permite que NODO
              funcione sin restricciones de batería.
            </span>
            <button
              type="button"
              onClick={() => {
                nativeAction((n) => n.requestBatteryExemption())
                setTimeout(refresh, 1500)
              }}
              className="btn-amber text-xs px-4 py-2 cursor-pointer self-start"
            >
              Permitir en segundo plano
            </button>
          </div>
        )}

        {models.map((m) => {
          const tooBig = freeMB > 0 && m.state === 'none' && m.totalMB + 500 > freeMB
          const heavy = m.ramMB > 6144
          const downloading = m.state === 'downloading'
          return (
            <div key={m.id} className="glass-card rounded-3xl p-4 sm:p-5 flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-bold text-base text-ink-900 dark:text-white flex items-center gap-2">
                    <span className="text-ink-400" title={m.id.startsWith('qwen') ? 'Qwen · Alibaba' : 'Llama · Meta'}>
                      <BrandIcon name={familyOf(m.id)} size={15} title={m.id.startsWith('qwen') ? 'Qwen por Alibaba' : 'Llama por Meta'} />
                    </span>
                    {m.label}
                    {m.recommended && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-signal-500/15 text-signal-400 border border-signal-500/40">
                        RECOMENDADO
                      </span>
                    )}
                  </h3>
                  <p className="font-mono text-[11px] text-ink-400 mt-0.5 flex items-center gap-1.5">
                    <BrandIcon name="huggingface" size={12} title="Pesos de Hugging Face" />
                    {fmtMB(m.totalMB)} · RAM ~{(m.ramMB / 1024).toFixed(1)} GB · {m.language}
                  </p>
                </div>
                <span
                  className={`shrink-0 font-mono text-[10px] font-bold px-2.5 py-1 rounded-full border ${
                    m.state === 'active' || m.state === 'ready'
                      ? 'border-signal-500/40 text-signal-400 bg-signal-500/10'
                      : m.state === 'error'
                        ? 'border-danger-500/40 text-danger-400'
                        : 'border-white/10 text-ink-400'
                  }`}
                >
                  {stateLabel[m.state]}
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
                  <span className="font-mono text-[11px] text-signal-400">
                    {m.verifying
                      ? 'Verificando integridad (SHA-256)…'
                      : `${fmtMB(m.downloadedMB)}/${fmtMB(m.totalMB)}${m.speedMBs !== undefined ? ` · ${m.speedMBs.toFixed(1)} MB/s · quedan ${fmtEta(m.etaSec ?? -1)}` : ''}`}
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

              <div className="flex flex-wrap gap-2">
                {m.state === 'none' && (
                  <button type="button" disabled={tooBig} onClick={() => act('descargar', (n) => n.startDownload(m.id))} className="btn-primary text-xs px-4 py-2 cursor-pointer">
                    <Icon name="download" size={14} /> Descargar
                  </button>
                )}
                {downloading && (
                  <>
                    <button type="button" onClick={() => act('pausar', (n) => n.pauseDownload())} className="btn-ghost border border-white/10 text-xs px-4 py-2 cursor-pointer">
                      Pausar
                    </button>
                    <button type="button" onClick={() => act('cancelar', (n) => n.cancelDownload())} className="btn-ghost text-xs px-4 py-2 cursor-pointer">
                      Cancelar
                    </button>
                  </>
                )}
                {m.state === 'paused' && (
                  <>
                    <button type="button" onClick={() => act('reanudar', (n) => n.resumeDownload(m.id))} className="btn-primary text-xs px-4 py-2 cursor-pointer">
                      Reanudar
                    </button>
                    <button type="button" onClick={() => act('eliminar', (n) => n.deleteModel(m.id))} className="btn-ghost text-xs px-4 py-2 cursor-pointer">
                      Eliminar
                    </button>
                  </>
                )}
                {(m.state === 'ready' || m.state === 'active') && (
                  <>
                    {m.state !== 'active' && (
                      <button type="button" onClick={() => act('usar', (n) => n.setActiveModel(m.id))} className="btn-primary text-xs px-4 py-2 cursor-pointer">
                        Usar este modelo
                      </button>
                    )}
                    <button type="button" onClick={() => startTest(m)} className="btn-ghost border border-signal-500/40 text-signal-400 text-xs px-4 py-2 cursor-pointer">
                      <Icon name="sparkles" size={14} /> Probar modelo
                    </button>
                    <button type="button" onClick={() => act('eliminar', (n) => n.deleteModel(m.id))} className="btn-ghost text-xs px-4 py-2 cursor-pointer">
                      Eliminar
                    </button>
                  </>
                )}
                {m.state === 'error' && (
                  <button type="button" onClick={() => act('reintentar', (n) => n.resumeDownload(m.id))} className="btn-primary text-xs px-4 py-2 cursor-pointer">
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
