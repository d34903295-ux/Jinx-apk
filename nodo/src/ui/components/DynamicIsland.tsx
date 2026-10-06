import { useEffect, useState } from 'react'
import { ThinkingOrb } from 'thinking-orbs'
import { getIsland, subscribeIsland, type IslandState } from '../../core/native/island'
import { Icon } from './Icon'

/**
 * Isla dinámica: píldora viva que hace morph según la actividad
 * (descarga, IA pensando, dictado, agente). Respeta reduced-motion
 * (las transiciones globales se anulan) y anuncia vía aria-live.
 */
export function DynamicIsland({ onOpenModels }: { onOpenModels: () => void }) {
  const [state, setState] = useState<IslandState>(() => getIsland())

  useEffect(() => subscribeIsland(setState), [])

  if (state.mode === 'hidden') return null

  const expanded = state.mode === 'downloading' || state.mode === 'agent'

  return (
    <div className="pointer-events-none fixed top-[calc(env(safe-area-inset-top,0px)+10px)] left-0 right-0 z-50 flex justify-center px-4">
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
        className={`glass-sheet pointer-events-auto flex items-center gap-2.5 overflow-hidden rounded-full py-2 pl-3 pr-3.5 text-left transition-all duration-200 ease-[cubic-bezier(0.34,1.25,0.64,1)] ${
          expanded ? 'max-w-[92vw]' : 'max-w-[70vw]'
        }`}
      >
        <span className="flex shrink-0 items-center justify-center">
          {state.mode === 'thinking' || state.mode === 'agent' ? (
            <ThinkingOrb state="working" size={20} aria-label={islandLabel(state)} />
          ) : state.mode === 'listening' ? (
            <ThinkingOrb state="listening" size={20} aria-label={islandLabel(state)} />
          ) : (
            <span className="relative flex size-2.5 items-center justify-center">
              <span className="size-2 rounded-full bg-signal-400" />
            </span>
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-semibold text-white">
            {islandLabel(state)}
          </span>
          {state.mode === 'downloading' && (
            <span className="mt-1 block h-1 w-36 overflow-hidden rounded-full bg-white/10">
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
        {state.mode === 'downloading' && (
          <Icon name="download" size={14} className="shrink-0 text-signal-400" />
        )}
        {state.mode === 'listening' && (
          <Icon name="mic" size={14} className="shrink-0 animate-pulse text-cyan-300" />
        )}
      </button>
    </div>
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
