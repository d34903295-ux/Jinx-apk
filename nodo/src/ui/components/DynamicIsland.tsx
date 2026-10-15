import { useEffect, useState } from 'react'
import { ThinkingOrb } from 'thinking-orbs'
import { getIsland, setIsland, subscribeIsland, type IslandState } from '../../core/native/island'
import { Icon } from './Icon'

/**
 * Indicador de actividad flotante (descargas en curso, IA pensando, dictado, agente).
 * Ubicado para informar con claridad sin superponerse a los botones de navegación
 * (como "Volver al Chat" o el encabezado).
 */
export function DynamicIsland({ onOpenModels }: { onOpenModels: () => void }) {
  const [state, setState] = useState<IslandState>(() => getIsland())

  useEffect(() => subscribeIsland(setState), [])

  if (state.mode === 'hidden') return null

  const isProgress = state.mode === 'downloading'

  return (
    <aside
      aria-label="Estado del sistema"
      className="pointer-events-none fixed top-[calc(env(safe-area-inset-top,0px)+12px)] right-3 sm:right-6 z-40 flex justify-end transition-all duration-300 max-w-[calc(100vw-24px)]"
    >
      <div
        className="pointer-events-auto flex items-center gap-2 rounded-full py-1.5 pl-3 pr-2 border border-white/20 bg-black/80 backdrop-blur-xl shadow-lg shadow-black/50 transition-all duration-200"
      >
        <button
          type="button"
          onClick={() => {
            if (state.mode === 'downloading') {
              if (state.onTap) state.onTap()
              else onOpenModels()
            } else if (state.mode === 'listening' && state.onTap) {
              state.onTap()
            }
          }}
          aria-live="polite"
          aria-label={islandLabel(state)}
          className="flex items-center gap-2 text-left cursor-pointer active:scale-95 transition"
        >
          <span className="flex shrink-0 items-center justify-center">
            {state.mode === 'thinking' || state.mode === 'agent' ? (
              <ThinkingOrb state="working" size={20} color="#ffffff" aria-label={islandLabel(state)} />
            ) : state.mode === 'listening' ? (
              <ThinkingOrb state="listening" size={20} color="#ffffff" aria-label={islandLabel(state)} />
            ) : (
              <span className="relative flex size-2.5 items-center justify-center">
                <span className="size-2 rounded-full bg-signal-400" />
              </span>
            )}
          </span>

          <span className="min-w-0">
            <span className="block truncate text-xs font-semibold text-white">
              {islandLabel(state)}
            </span>
            {isProgress && (
              <span className="mt-0.5 block h-1 w-28 overflow-hidden rounded-full bg-white/10">
                <span
                  className="block h-full rounded-full bg-signal-400 transition-[width] duration-200"
                  style={{ width: `${Math.round(state.fraction * 100)}%` }}
                />
              </span>
            )}
            {(state.mode === 'downloading' || state.mode === 'agent') && state.detail && (
              <span className="block truncate font-mono text-[10px] text-ink-300">{state.detail}</span>
            )}
          </span>
        </button>

        {(state.mode === 'thinking' || state.mode === 'agent') && (
          <button
            type="button"
            onClick={() => {
              if (state.onCancel) {
                state.onCancel()
              } else {
                try {
                  window.NodoNative?.stopGenerate?.()
                  window.NodoNative?.stopAgent?.()
                } catch {}
                setIsland({ mode: 'hidden' })
              }
            }}
            className="p-1 rounded-full text-white/70 hover:text-white hover:bg-white/20 transition active:scale-95 cursor-pointer shrink-0"
            title="Detener proceso"
            aria-label="Detener proceso"
          >
            <Icon name="close" size={13} />
          </button>
        )}

        {state.mode === 'downloading' && (
          <Icon name="download" size={14} className="shrink-0 text-signal-400" />
        )}
        {state.mode === 'listening' && (
          <Icon name="mic" size={14} className="shrink-0 animate-pulse text-cyan-300" />
        )}
      </div>
    </aside>
  )
}

function islandLabel(s: IslandState): string {
  switch (s.mode) {
    case 'downloading':
      return s.label
    case 'thinking':
      return s.label
    case 'listening':
      return s.label
    case 'agent':
      return s.label
    case 'done':
      return s.label
    default:
      return ''
  }
}
