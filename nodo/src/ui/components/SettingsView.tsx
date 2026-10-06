import { useEffect, useState } from 'react'
import {
  MODELS,
  detectHardware,
  modelIdFor,
  vramFor,
  labelForModelId,
  type HardwareInfo,
} from '../../core/llm/models'
import { llm, type LoadProgress } from '../../core/llm/llmClient'
import {
  getStorageInfo,
  requestPersistence,
  formatBytes,
  type StorageInfo,
} from '../../core/offline/storage'
import { installModel } from '../../core/offline/installer'
import { db } from '../../core/db/schema'
import { setSetting } from '../../core/db/repo'
import { Icon } from './Icon'
import { ProgressBar } from './ProgressBar'

interface SettingsViewProps {
  onBack: () => void
  activeModelId: string | null
  onModelChanged: (newModelId: string) => void
  theme: 'dark' | 'light'
  onToggleTheme: () => void
}

export function SettingsView({
  onBack,
  activeModelId,
  onModelChanged,
  theme,
  onToggleTheme,
}: SettingsViewProps) {
  const [hw, setHw] = useState<HardwareInfo | null>(null)
  const [storage, setStorage] = useState<StorageInfo | null>(null)
  const [cachedMap, setCachedMap] = useState<Record<string, boolean>>({})
  const [downloadingModelId, setDownloadingModelId] = useState<string | null>(null)
  const [downloadProgress, setDownloadProgress] = useState<LoadProgress | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const refreshAll = async () => {
    const [h, s] = await Promise.all([detectHardware(), getStorageInfo()])
    setHw(h)
    setStorage(s)

    const map: Record<string, boolean> = {}
    for (const m of MODELS) {
      const id = modelIdFor(m, h.shaderF16)
      if (id) {
        try {
          map[id] = await llm.isCached(id)
        } catch {
          map[id] = false
        }
      }
    }
    setCachedMap(map)
  }

  useEffect(() => {
    void refreshAll()
  }, [])

  const handleSelectModel = async (modelId: string) => {
    setError(null)
    setSuccessMsg(null)

    // Si ya está en caché, simplemente activarlo
    if (cachedMap[modelId]) {
      await setSetting('activeModel', modelId)
      onModelChanged(modelId)
      setSuccessMsg(`Modelo activo cambiado a ${labelForModelId(modelId)}`)
      return
    }

    // Si no está descargado, descargarlo e instalarlo
    setDownloadingModelId(modelId)
    try {
      await installModel(modelId, (p) => setDownloadProgress(p))
      await setSetting('activeModel', modelId)
      onModelChanged(modelId)
      setSuccessMsg(`¡Modelo ${labelForModelId(modelId)} descargado y listo para usar sin conexión!`)
      await refreshAll()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setDownloadingModelId(null)
      setDownloadProgress(null)
    }
  }

  const handleDeleteModel = async (modelId: string) => {
    if (!confirm(`¿Eliminar los pesos descargados de ${labelForModelId(modelId)} para liberar espacio?`)) return
    try {
      await llm.deleteModel(modelId)
      setSuccessMsg(`Modelo ${labelForModelId(modelId)} eliminado de la caché.`)
      await refreshAll()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const handleRequestPersistence = async () => {
    const granted = await requestPersistence()
    await refreshAll()
    if (granted) {
      setSuccessMsg('¡Persistencia de almacenamiento concedida por el navegador!')
    } else {
      setError('El navegador denegó la persistencia automática de almacenamiento.')
    }
  }

  const handleClearAllData = async () => {
    if (!confirm('¿ADVERTENCIA: Deseas borrar TODOS los documentos indexados, fragmentos y notas de la base de datos local?')) return
    await db.transaction('rw', db.documents, db.chunks, db.notes, db.chats, db.messages, async () => {
      await db.documents.clear()
      await db.chunks.clear()
      await db.notes.clear()
      await db.chats.clear()
      await db.messages.clear()
    })
    setSuccessMsg('Se han eliminado todos los documentos, fragmentos, notas y chats locales.')
  }

  return (
    <div className="relative min-h-screen w-full flex flex-col p-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] sm:p-6 lg:p-10 app-backdrop select-none overflow-y-auto">
      {/* Botón Volver */}
      <button
        type="button"
        onClick={onBack}
        className="self-start mb-6 btn-ghost gap-1.5 text-xs sm:text-sm cursor-pointer"
      >
        <Icon name="close" size={16} />
        Volver al Chat
      </button>

      <div className="w-full max-w-4xl mx-auto flex flex-col gap-6 pb-12">
        {/* Cabecera */}
        <div className="flex items-center gap-3 border-b border-ink-200/60 dark:border-white/10 pb-5">
          <div className="size-12 rounded-2xl bg-linear-to-br from-signal-400 to-signal-600 flex items-center justify-center text-ink-950 shadow-lg shadow-signal-500/20">
            <Icon name="cpu" size={24} />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-ink-900 dark:text-white">
              Ajustes y Configuración del Sistema
            </h1>
            <p className="text-xs sm:text-sm text-ink-500 dark:text-ink-400">
              Gestión de modelos de IA, almacenamiento en caché y parámetros de ejecución
            </p>
          </div>
        </div>

        {/* Notificaciones de éxito o error */}
        {successMsg && (
          <div className="glass rounded-2xl border-signal-500/30 bg-signal-500/10 p-4 text-signal-700 dark:text-signal-300 flex items-center gap-3 animate-fade-up">
            <Icon name="check" size={20} className="shrink-0" />
            <span className="text-sm font-medium">{successMsg}</span>
          </div>
        )}
        {error && (
          <div className="glass rounded-2xl border-ember-500/30 bg-ember-500/10 p-4 text-ember-600 dark:text-ember-300 flex items-center gap-3 animate-fade-up">
            <Icon name="alert" size={20} className="shrink-0" />
            <span className="text-sm font-medium">{error}</span>
          </div>
        )}

        {/* Progreso de descarga si está descargando */}
        {downloadingModelId && downloadProgress && (
          <div className="glass rounded-2xl border-signal-500/30 p-5 flex flex-col gap-3 shadow-xl animate-fade-up">
            <div className="flex items-center justify-between text-xs sm:text-sm font-medium">
              <span className="flex items-center gap-2 text-signal-400">
                <Icon name="download" size={16} className="animate-spin" />
                Descargando {labelForModelId(downloadingModelId)}...
              </span>
              <span className="text-ink-400 font-mono">
                {Math.round(downloadProgress.progress * 100)}%
              </span>
            </div>
            <ProgressBar value={downloadProgress.progress} />
            <span className="text-xs text-ink-500 dark:text-ink-400 font-mono truncate">
              {downloadProgress.text}
            </span>
          </div>
        )}

        {/* Sección 1: Catálogo de Modelos */}
        <div className="flex flex-col gap-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-ink-400">
            Modelos de IA Disponibles
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {MODELS.map((option) => {
              const modelId = hw ? modelIdFor(option, hw.shaderF16) : null
              const isCurrent = modelId && activeModelId === modelId
              const isCached = modelId ? cachedMap[modelId] : false
              const vram = hw ? vramFor(option, hw.shaderF16) : option.vramF16MB

              return (
                <div
                  key={option.baseId}
                  className={`glass-card rounded-2xl p-5 flex flex-col justify-between gap-4 border transition ${
                    isCurrent
                      ? 'border-signal-500/60 shadow-[0_0_20px_-3px_rgba(0,245,160,0.25)] bg-signal-500/[0.08]'
                      : 'border-white/10 hover:border-white/20'
                  }`}
                >
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-base text-white flex items-center gap-2">
                        {option.label}
                        {isCurrent && (
                          <span className="font-mono text-[9px] font-bold bg-signal-500/20 text-signal-400 border border-signal-500/40 px-2 py-0.5 rounded-full uppercase">
                            ACTIVO
                          </span>
                        )}
                      </h4>
                      {isCached && (
                        <span className="font-mono text-[10px] text-signal-400 flex items-center gap-1 font-semibold uppercase">
                          <Icon name="check" size={13} />
                          EN CACHÉ
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-ink-300 leading-relaxed">
                      {option.description}
                    </p>
                    <span className="text-[11px] text-ink-400 font-mono">
                      VRAM requerida: ~{vram ?? 'N/D'} MB
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-white/[0.07]">
                    {modelId ? (
                      isCurrent ? (
                        <span className="font-mono text-xs text-signal-400 font-semibold flex items-center gap-1.5">
                          <span className="size-2 rounded-full bg-signal-400 shadow-[0_0_6px_#00f5a0]" />
                          EN USO
                        </span>
                      ) : (
                        <button
                          type="button"
                          disabled={Boolean(downloadingModelId)}
                          onClick={() => handleSelectModel(modelId)}
                          className={`text-xs px-3.5 py-1.5 rounded-xl font-medium cursor-pointer transition ${
                            isCached ? 'btn-primary' : 'btn-ghost border border-signal-500/40 text-signal-400 hover:bg-signal-500/10'
                          }`}
                        >
                          {isCached ? 'Activar Modelo' : 'Descargar e Instalar'}
                        </button>
                      )
                    ) : (
                      <span className="text-xs text-danger-400">Incompatible con este dispositivo</span>
                    )}

                    {isCached && modelId && !isCurrent && (
                      <button
                        type="button"
                        onClick={() => handleDeleteModel(modelId)}
                        className="text-xs text-ink-400 hover:text-danger-400 p-1 cursor-pointer"
                        title="Liberar espacio borrando el modelo"
                      >
                        <Icon name="trash" size={15} />
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Sección 2: Estado del Hardware y Almacenamiento */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Tarjeta Hardware */}
          <div className="glass rounded-3xl p-5 flex flex-col gap-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-ink-400">
              Hardware Detectado
            </span>
            <div className="flex flex-col gap-2 text-xs">
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-ink-400">Aceleración WebGPU:</span>
                <span className="font-semibold text-signal-400">
                  {hw?.webgpu ? 'Compatible' : 'No disponible'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-ink-400">Soporte Shader FP16:</span>
                <span className="font-semibold">
                  {hw?.shaderF16 ? 'Sí (Modo Rápido)' : 'No (Modo FP32)'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-white/5">
                <span className="text-ink-400">Memoria RAM aprox.:</span>
                <span className="font-semibold">{hw?.memoryGB ? `${hw.memoryGB} GB` : 'N/D'}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-ink-400">Tipo de dispositivo:</span>
                <span className="font-semibold">{hw?.isMobile ? 'Móvil / Tablet' : 'Escritorio'}</span>
              </div>
            </div>
          </div>

          {/* Tarjeta Almacenamiento */}
          <div className="glass rounded-3xl p-5 flex flex-col justify-between gap-3">
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-ink-400">
                Almacenamiento Local (Cache API)
              </span>
              <div className="flex justify-between text-xs py-1 border-b border-white/5">
                <span className="text-ink-400">Espacio Usado:</span>
                <span className="font-mono font-semibold">
                  {storage ? formatBytes(storage.usageBytes) : 'Calculando...'}
                </span>
              </div>
              <div className="flex justify-between text-xs py-1 border-b border-white/5">
                <span className="text-ink-400">Cuota Disponible:</span>
                <span className="font-mono font-semibold">
                  {storage ? formatBytes(storage.quotaBytes) : 'Calculando...'}
                </span>
              </div>
              <div className="flex justify-between text-xs py-1">
                <span className="text-ink-400">Persistencia Garantizada:</span>
                <span className={`font-semibold ${storage?.persisted ? 'text-signal-400' : 'text-ember-400'}`}>
                  {storage?.persisted ? 'Activa' : 'Temporal'}
                </span>
              </div>
            </div>

            {!storage?.persisted && (
              <button
                type="button"
                onClick={handleRequestPersistence}
                className="btn-ghost border border-white/10 text-xs py-2 w-full cursor-pointer hover:border-signal-500/40"
              >
                Solicitar Persistencia Permanente
              </button>
            )}
          </div>
        </div>

        {/* Sección 3: Preferencias y Datos */}
        <div className="glass rounded-3xl p-5 flex flex-col gap-4">
          <span className="text-xs font-semibold uppercase tracking-wider text-ink-400">
            Preferencias y Gestión de Datos
          </span>

          <div className="flex items-center justify-between py-2 border-b border-ink-200/50 dark:border-white/5">
            <div>
              <h4 className="text-sm font-semibold text-ink-900 dark:text-white">Tema Visual</h4>
              <p className="text-xs text-ink-400">Alternar entre modo oscuro y claro</p>
            </div>
            <button
              type="button"
              onClick={onToggleTheme}
              className="btn-ghost border border-ink-200/60 dark:border-white/10 text-xs px-3.5 py-1.5 gap-2 cursor-pointer"
            >
              <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={15} />
              <span>{theme === 'dark' ? 'Modo Claro' : 'Modo Oscuro'}</span>
            </button>
          </div>

          <div className="flex items-center justify-between py-2">
            <div>
              <h4 className="text-sm font-semibold text-danger-400">Zona de Peligro</h4>
              <p className="text-xs text-ink-400">
                Eliminar todos los documentos, notas y chats guardados localmente
              </p>
            </div>
            <button
              type="button"
              onClick={handleClearAllData}
              className="btn-ghost border border-danger-500/30 text-danger-400 hover:bg-danger-500/10 text-xs px-3.5 py-1.5 gap-1.5 cursor-pointer"
            >
              <Icon name="trash" size={14} />
              <span>Limpiar Datos Locales</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
