import { useEffect, useState } from 'react'
import { t } from '../../i18n'
import {
  MODELS,
  detectHardware,
  recommendModel,
  modelIdFor,
  vramFor,
  type HardwareInfo,
  type ModelOption,
} from '../../core/llm/models'
import { llm, type LoadProgress } from '../../core/llm/llmClient'
import { installModel } from '../../core/offline/installer'
import { getStorageInfo, requestPersistence, formatBytes, type StorageInfo } from '../../core/offline/storage'
import { Icon, Logo } from './Icon'
import { ProgressBar } from './ProgressBar'

interface SetupWizardProps {
  onComplete: () => void
  canCancel?: boolean
  onCancel?: () => void
}

export function SetupWizard({ onComplete, canCancel = false, onCancel }: SetupWizardProps) {
  const [detecting, setDetecting] = useState(true)
  const [hw, setHw] = useState<HardwareInfo | null>(null)
  const [storage, setStorage] = useState<StorageInfo | null>(null)
  const [cachedMap, setCachedMap] = useState<Record<string, boolean>>({})
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null)

  const [installing, setInstalling] = useState(false)
  const [progress, setProgress] = useState<LoadProgress | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isDone, setIsDone] = useState(false)

  // Detección inicial
  useEffect(() => {
    let alive = true
    async function init() {
      const [h, s] = await Promise.all([detectHardware(), getStorageInfo()])
      if (!alive) return
      setHw(h)
      setStorage(s)

      // Verificar caché de cada modelo
      const cacheStatus: Record<string, boolean> = {}
      for (const m of MODELS) {
        const id = modelIdFor(m, h.shaderF16)
        if (id) {
          try {
            cacheStatus[id] = await llm.isCached(id)
          } catch {
            cacheStatus[id] = false
          }
        }
      }
      if (!alive) return
      setCachedMap(cacheStatus)

      // Recomendar modelo si no hay uno seleccionado
      const rec = recommendModel(h)
      if (rec) {
        const recId = modelIdFor(rec, h.shaderF16)
        setSelectedModelId(recId)
      } else if (MODELS[0]) {
        setSelectedModelId(modelIdFor(MODELS[0], h.shaderF16))
      }
      setDetecting(false)
    }
    void init()
    return () => {
      alive = false
    }
  }, [])

  const handlePersist = async () => {
    const granted = await requestPersistence()
    const s = await getStorageInfo()
    setStorage(s)
    if (granted) {
      // Éxito concedido
    }
  }

  const handleInstall = async () => {
    if (!selectedModelId) return
    setInstalling(true)
    setError(null)
    try {
      await installModel(selectedModelId, (p) => setProgress(p))
      setIsDone(true)
      const s = await getStorageInfo()
      setStorage(s)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setInstalling(false)
    }
  }

  return (
    <div className="relative min-h-screen w-full flex flex-col items-center justify-center p-4 py-[calc(1rem+env(safe-area-inset-top,0px))] pb-[calc(1rem+env(safe-area-inset-bottom,0px))] sm:p-6 lg:p-10 app-backdrop select-none">
      {/* Botón cancelar/volver si ya tiene modelo */}
      {canCancel && onCancel && (
        <button
          type="button"
          onClick={onCancel}
          className="absolute top-4 left-4 sm:top-6 sm:left-6 btn-ghost gap-1.5 text-xs sm:text-sm"
        >
          <Icon name="close" size={16} />
          {t('setup.back')}
        </button>
      )}

      <div className="w-full max-w-2xl flex flex-col gap-6">
        {/* Cabecera / Branding */}
        <div className="flex flex-col items-center text-center gap-2">
          <div className="size-14 rounded-2xl bg-linear-to-br from-signal-400 to-signal-600 flex items-center justify-center shadow-xl shadow-signal-500/20 text-ink-950 mb-1">
            <Logo size={32} />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-ink-900 dark:text-white">
            {t('setup.title')}
          </h1>
          <p className="text-sm text-ink-500 dark:text-ink-400 max-w-md">
            {t('setup.subtitle')}
          </p>
        </div>

        {/* Alerta si NO hay WebGPU */}
        {hw && !hw.webgpu && (
          <div className="glass rounded-2xl border-ember-500/30 bg-ember-500/10 p-5 text-ember-600 dark:text-ember-300 flex items-start gap-3">
            <Icon name="alert" size={24} className="shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-base mb-1">{t('setup.noWebgpuTitle')}</h3>
              <p className="text-sm leading-relaxed opacity-90">{t('setup.noWebgpuBody')}</p>
            </div>
          </div>
        )}

        {/* Tarjeta principal */}
        <div className="glass-card rounded-3xl p-6 sm:p-8 flex flex-col gap-6 shadow-2xl border border-white/10 shadow-[0_0_40px_-10px_rgba(0,0,0,0.6)]">
          {detecting ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-ink-400">
              <Icon name="refresh" size={28} className="animate-spin text-signal-400" />
              <p className="text-sm font-medium">{t('setup.detecting')}</p>
            </div>
          ) : isDone ? (
            /* Vista de éxito / Instalación completa */
            <div className="flex flex-col items-center text-center py-8 gap-5 animate-fade-up">
              <div className="size-16 rounded-full bg-signal-500/20 border border-signal-500/40 text-signal-400 flex items-center justify-center shadow-[0_0_20px_rgba(0,245,160,0.4)]">
                <Icon name="check" size={32} />
              </div>
              <div className="flex flex-col gap-1.5">
                <h2 className="font-display text-xl sm:text-2xl font-bold text-white">
                  {t('setup.doneTitle')}
                </h2>
                <p className="text-sm text-ink-300 max-w-sm">
                  {t('setup.doneBody')}
                </p>
              </div>
              <button
                type="button"
                onClick={onComplete}
                className="btn-primary w-full sm:w-auto px-8 py-3 text-base mt-2 shadow-[0_0_25px_rgba(0,245,160,0.4)]"
              >
                <Icon name="sparkles" size={18} />
                {t('setup.start')}
              </button>
            </div>
          ) : (
            /* Configuración y selección de modelo */
            <>
              {/* Resumen de Hardware */}
              <div className="flex flex-col gap-2.5">
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-ink-400">
                  {t('setup.hardware')}
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {/* WebGPU */}
                  <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3 flex flex-col gap-1">
                    <span className="text-xs text-ink-400">{t('setup.webgpu')}</span>
                    <span className="font-mono text-sm font-semibold flex items-center gap-1.5 text-white">
                      <span
                        className={`size-2 rounded-full ${
                          hw?.webgpu ? 'bg-signal-400 shadow-[0_0_6px_#00f5a0]' : 'bg-danger-400'
                        }`}
                      />
                      {hw?.webgpu ? t('setup.yes') : t('setup.no')}
                    </span>
                  </div>

                  {/* Precisión FP16 */}
                  <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3 flex flex-col gap-1">
                    <span className="text-xs text-ink-400">{t('setup.f16')}</span>
                    <span className="font-mono text-sm font-semibold flex items-center gap-1.5 text-white">
                      <span
                        className={`size-2 rounded-full ${
                          hw?.shaderF16 ? 'bg-signal-400 shadow-[0_0_6px_#00f5a0]' : 'bg-ember-400'
                        }`}
                      />
                      {hw?.shaderF16 ? t('setup.yes') : t('setup.no')}
                    </span>
                  </div>

                  {/* Memoria RAM */}
                  <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3 flex flex-col gap-1">
                    <span className="text-xs text-ink-400">{t('setup.ram')}</span>
                    <span className="font-mono text-sm font-semibold text-white">
                      {hw?.memoryGB
                        ? t('setup.ramValue', { gb: hw.memoryGB })
                        : t('setup.unknown')}
                    </span>
                  </div>

                  {/* Espacio Libre */}
                  <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3 flex flex-col gap-1">
                    <span className="text-xs text-ink-400">{t('setup.storage')}</span>
                    <span className="font-mono text-sm font-semibold text-white">
                      {storage?.quotaBytes && storage.usageBytes !== null
                        ? formatBytes(storage.quotaBytes - storage.usageBytes)
                        : t('setup.unknown')}
                    </span>
                  </div>
                </div>

                {/* Persistencia de almacenamiento si no está activa */}
                {storage && !storage.persisted && (
                  <div className="flex items-center justify-between gap-3 text-xs bg-signal-500/5 border border-signal-500/20 rounded-xl p-3 mt-1">
                    <div className="flex items-center gap-2 text-ink-600 dark:text-ink-300">
                      <Icon name="shield" size={16} className="text-signal-400 shrink-0" />
                      <span>{t('setup.keepOpen')}</span>
                    </div>
                    <button
                      type="button"
                      onClick={handlePersist}
                      className="text-signal-600 dark:text-signal-400 font-semibold underline underline-offset-2 shrink-0 hover:opacity-80"
                    >
                      {t('setup.persist')}
                    </button>
                  </div>
                )}
              </div>

              {/* Selección de Modelos */}
              <div className="flex flex-col gap-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-ink-400">
                  {t('setup.chooseModel')}
                </span>
                <div className="grid grid-cols-1 gap-2.5">
                  {MODELS.map((option: ModelOption) => {
                    const shaderF16 = hw?.shaderF16 ?? false
                    const id = modelIdFor(option, shaderF16)
                    const vram = vramFor(option, shaderF16)
                    const isAvailable = id !== null && Boolean(hw?.webgpu)
                    const isRecommended = recommendModel(hw ?? {
                      webgpu: true,
                      shaderF16: false,
                      gpuName: null,
                      memoryGB: null,
                      isMobile: false,
                    })?.tier === option.tier
                    const isCached = id ? Boolean(cachedMap[id]) : false
                    const isSelected = selectedModelId === id

                    return (
                      <button
                        key={option.baseId}
                        type="button"
                        disabled={!isAvailable || installing}
                        onClick={() => id && setSelectedModelId(id)}
                        className={`w-full text-left rounded-2xl border p-4 transition flex items-center justify-between gap-4 ${
                          isSelected
                            ? 'border-signal-500 bg-signal-500/10 shadow-md shadow-signal-500/10'
                            : isAvailable
                            ? 'border-ink-200/70 dark:border-white/5 hover:border-ink-300 dark:hover:border-white/15 bg-white/40 dark:bg-white/[0.02]'
                            : 'opacity-40 border-ink-200/30 dark:border-white/5 cursor-not-allowed'
                        }`}
                      >
                        <div className="flex flex-col gap-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm sm:text-base text-ink-900 dark:text-white">
                              {option.label}
                            </span>
                            {isRecommended && (
                              <span className="rounded-full bg-signal-500/20 text-signal-600 dark:text-signal-300 text-[11px] font-semibold px-2 py-0.5">
                                {t('setup.recommended')}
                              </span>
                            )}
                            {isCached && (
                              <span className="rounded-full bg-ink-200 dark:bg-white/10 text-ink-700 dark:text-ink-300 text-[11px] font-semibold px-2 py-0.5 flex items-center gap-1">
                                <Icon name="check" size={11} />
                                {t('setup.downloaded')}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-ink-500 dark:text-ink-400 truncate">
                            {option.description}
                          </p>
                          {vram && (
                            <span className="text-[11px] text-ink-400">
                              {t('setup.vram', { gb: (vram / 1024).toFixed(1) })}
                            </span>
                          )}
                        </div>

                        <div className="shrink-0 flex items-center">
                          <div
                            className={`size-5 rounded-full border-2 flex items-center justify-center ${
                              isSelected
                                ? 'border-signal-500 bg-signal-500 text-ink-950'
                                : 'border-ink-300 dark:border-ink-600'
                            }`}
                          >
                            {isSelected && <div className="size-2 rounded-full bg-ink-950" />}
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Estado de Descarga / Progreso */}
              {installing && (
                <div className="flex flex-col gap-3 p-4 rounded-2xl bg-ink-100/60 dark:bg-white/[0.04] border border-ink-200/60 dark:border-white/5 animate-fade-up">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-ink-700 dark:text-ink-200 flex items-center gap-2">
                      <Icon name="download" size={14} className="text-signal-400 animate-bounce" />
                      {t('setup.downloading')}
                    </span>
                    <span className="font-bold text-signal-500 font-mono">
                      {Math.round((progress?.progress ?? 0) * 100)}%
                    </span>
                  </div>

                  <ProgressBar value={progress?.progress ?? 0} />

                  <p className="text-xs text-ink-500 dark:text-ink-400 font-mono truncate">
                    {progress?.text || t('setup.keepOpen')}
                  </p>
                </div>
              )}

              {/* Mensaje de error si falla */}
              {error && (
                <div className="p-4 rounded-2xl bg-danger-500/10 border border-danger-500/30 text-danger-500 text-xs flex flex-col gap-2">
                  <div className="flex items-center gap-1.5 font-semibold">
                    <Icon name="alert" size={14} />
                    <span>{t('setup.error', { msg: error })}</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleInstall}
                    className="self-start underline font-bold"
                  >
                    {t('setup.retry')}
                  </button>
                </div>
              )}

              {/* Botón de acción */}
              <div className="flex flex-col gap-2 pt-2">
                <button
                  type="button"
                  disabled={!selectedModelId || installing || !hw?.webgpu}
                  onClick={handleInstall}
                  className="btn-primary w-full py-3.5 text-base"
                >
                  {installing ? (
                    <>
                      <Icon name="refresh" size={18} className="animate-spin" />
                      {t('setup.downloading')}
                    </>
                  ) : selectedModelId && cachedMap[selectedModelId] ? (
                    <>
                      <Icon name="sparkles" size={18} />
                      {t('setup.useThis')}
                    </>
                  ) : (
                    <>
                      <Icon name="download" size={18} />
                      {t('setup.install')}
                    </>
                  )}
                </button>
                <p className="text-[11px] text-center text-ink-400">
                  {t('setup.privacy')}
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
