import { useEffect, useState } from 'react'
import {
  hasNative,
  listNativeModels,
  activeNativeModel,
  nativeAction,
} from '../../core/native/bridge'
import {
  getStorageInfo,
  requestPersistence,
  formatBytes,
  type StorageInfo,
} from '../../core/offline/storage'
import { db } from '../../core/db/schema'
import { Icon } from './Icon'

interface SettingsViewProps {
  onBack: () => void
  activeModelId: string | null
  onModelChanged: (newModelId: string) => void
  theme: 'dark' | 'light'
  onToggleTheme: () => void
  onOpenModels: () => void
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
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [activeLabel, setActiveLabel] = useState('')
  const [ramMB, setRamMB] = useState(0)
  const [freeMB, setFreeMB] = useState(0)
  const [engineCtx, setEngineCtx] = useState(2048)
  const [engineThreads, setEngineThreads] = useState(0)
  const [perms, setPerms] = useState({ location: false, camera: false, battery: true })

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleRequestPersistence = async () => {
    const granted = await requestPersistence()
    await refreshAll()
    if (granted) {
      setSuccessMsg('¡Persistencia de almacenamiento concedida!')
    } else {
      setError('El sistema denegó la persistencia automática.')
    }
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
    setSuccessMsg('Datos locales eliminados.')
  }

  const permRow = (label: string, granted: boolean, hint: string) => (
    <div className="flex items-center justify-between py-2 border-b border-ink-200/50 dark:border-white/5">
      <div>
        <h4 className="text-sm font-semibold text-ink-900 dark:text-white">{label}</h4>
        <p className="text-xs text-ink-400">{hint}</p>
      </div>
      <span
        className={`font-mono text-[11px] font-bold px-2.5 py-1 rounded-full border ${
          granted
            ? 'border-signal-500/40 text-signal-400 bg-signal-500/10'
            : 'border-ember-500/40 text-ember-400'
        }`}
      >
        {granted ? 'CONCEDIDO' : 'PENDIENTE'}
      </span>
    </div>
  )

  return (
    <div className="relative min-h-dvh w-full flex flex-col p-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] sm:p-6 lg:p-10 app-backdrop select-none overflow-y-auto">
      <button
        type="button"
        onClick={onBack}
        className="self-start mb-6 btn-ghost gap-1.5 text-xs sm:text-sm cursor-pointer"
        aria-label="Volver al Chat" title="Volver al Chat"
      >
        <Icon name="close" size={16} />
        Volver al Chat
      </button>

      <div className="w-full max-w-4xl mx-auto flex flex-col gap-6 pb-12">
        <div className="flex items-center gap-3 border-b border-ink-200/60 dark:border-white/10 pb-5">
          <div className="size-12 rounded-2xl bg-linear-to-br from-signal-400 to-signal-600 flex items-center justify-center text-ink-950 shadow-lg shadow-signal-500/20">
            <Icon name="settings" size={24} />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-ink-900 dark:text-white">Ajustes</h1>
            <p className="text-xs sm:text-sm text-ink-500 dark:text-ink-400">
              Modelo activo, almacenamiento, tema, idioma y permisos
            </p>
          </div>
        </div>

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

        {/* Modelo activo */}
        <div className="glass rounded-3xl p-5 flex items-center justify-between gap-3">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-ink-400">
              Modelo activo
            </span>
            <p className="text-base font-bold text-ink-900 dark:text-white mt-1">
              {activeLabel || 'Ninguno — descárgalo en Modelos'}
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenModels}
            className="btn-primary text-xs px-4 py-2 cursor-pointer shrink-0"
          >
            Ir a Modelos
          </button>
        </div>

        {/* Motor */}
        <div className="glass rounded-3xl p-5 flex flex-col gap-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-ink-400">
            Motor (se aplica al cargar el modelo)
          </span>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h4 className="text-sm font-semibold text-ink-900 dark:text-white">Contexto</h4>
              <p className="text-xs text-ink-400">Memoria de conversación</p>
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
                  className={`px-3 py-1.5 rounded-lg font-mono text-xs cursor-pointer border transition ${
                    engineCtx === v
                      ? 'border-signal-500/60 text-signal-400 bg-signal-500/10'
                      : 'border-white/10 text-ink-400'
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
              <p className="text-xs text-ink-400">Auto según el teléfono</p>
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
                  className={`px-3 py-1.5 rounded-lg font-mono text-xs cursor-pointer border transition ${
                    engineThreads === o.v
                      ? 'border-signal-500/60 text-signal-400 bg-signal-500/10'
                      : 'border-white/10 text-ink-400'
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Dispositivo */}
        <div className="glass rounded-3xl p-5 flex flex-col gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-ink-400">
            Dispositivo
          </span>
          <div className="flex justify-between text-xs py-1 border-b border-white/5">
            <span className="text-ink-400">Memoria RAM:</span>
            <span className="font-mono font-semibold">{ramMB > 0 ? fmtMB(ramMB) : '…'}</span>
          </div>
          <div className="flex justify-between text-xs py-1 border-b border-white/5">
            <span className="text-ink-400">Espacio libre:</span>
            <span className="font-mono font-semibold">{freeMB > 0 ? fmtMB(freeMB) : '…'}</span>
          </div>
          <div className="flex justify-between text-xs py-1">
            <span className="text-ink-400">Idioma:</span>
            <span className="font-semibold">Español</span>
          </div>
        </div>

        {/* Permisos */}
        <div className="glass rounded-3xl p-5 flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-ink-400">
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
            className="btn-ghost border border-white/10 text-xs py-2 w-full cursor-pointer mt-2"
          >
            Abrir ajustes de la app
          </button>
        </div>

        {/* Almacenamiento web */}
        <div className="glass rounded-3xl p-5 flex flex-col justify-between gap-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-ink-400">
            Almacenamiento local
          </span>
          <div className="flex justify-between text-xs py-1 border-b border-white/5">
            <span className="text-ink-400">Documentos y notas:</span>
            <span className="font-mono font-semibold">
              {storage ? formatBytes(storage.usageBytes) : 'Calculando...'}
            </span>
          </div>
          <div className="flex justify-between text-xs py-1">
            <span className="text-ink-400">Persistencia:</span>
            <span className={`font-semibold ${storage?.persisted ? 'text-signal-400' : 'text-ember-400'}`}>
              {storage?.persisted ? 'Activa' : 'Temporal'}
            </span>
          </div>
          {!storage?.persisted && (
            <button
              type="button"
              onClick={handleRequestPersistence}
              className="btn-ghost border border-white/10 text-xs py-2 w-full cursor-pointer hover:border-signal-500/40"
            >
              Solicitar persistencia permanente
            </button>
          )}
        </div>

        {/* Preferencias */}
        <div className="glass rounded-3xl p-5 flex flex-col gap-4">
          <span className="text-xs font-semibold uppercase tracking-wider text-ink-400">
            Preferencias
          </span>
          <div className="flex items-center justify-between py-2 border-b border-ink-200/50 dark:border-white/5">
            <div>
              <h4 className="text-sm font-semibold text-ink-900 dark:text-white">Tema visual</h4>
              <p className="text-xs text-ink-400">Alternar entre modo oscuro y claro</p>
            </div>
            <button
              type="button"
              onClick={onToggleTheme}
              className="btn-ghost border border-ink-200/60 dark:border-white/10 text-xs px-3.5 py-1.5 gap-2 cursor-pointer"
              aria-label="Cambiar tema" title="Cambiar tema"
            >
              <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={15} />
              <span>{theme === 'dark' ? 'Modo Claro' : 'Modo Oscuro'}</span>
            </button>
          </div>
          <div className="flex items-center justify-between py-2">
            <div>
              <h4 className="text-sm font-semibold text-danger-400">Zona de peligro</h4>
              <p className="text-xs text-ink-400">Eliminar documentos, notas y chats locales</p>
            </div>
            <button
              type="button"
              onClick={handleClearAllData}
              className="btn-ghost border border-danger-500/30 text-danger-400 hover:bg-danger-500/10 text-xs px-3.5 py-1.5 gap-1.5 cursor-pointer"
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
