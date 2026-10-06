/** Estado vivo global para la Dynamic Island (descargas, IA, dictado, agente). */

export type IslandState =
  | { mode: 'hidden' }
  | { mode: 'downloading'; label: string; fraction: number; detail: string; onTap?: () => void }
  | { mode: 'thinking'; label: string }
  | { mode: 'listening'; label: string; onTap?: () => void }
  | { mode: 'agent'; label: string; detail: string }
  | { mode: 'done'; label: string }

type Listener = (s: IslandState) => void

let current: IslandState = { mode: 'hidden' }
const listeners = new Set<Listener>()

export function setIsland(s: IslandState) {
  current = s
  listeners.forEach((l) => l(s))
}

export function getIsland(): IslandState {
  return current
}

export function subscribeIsland(l: Listener): () => void {
  listeners.add(l)
  return () => {
    listeners.delete(l)
  }
}

export function haptic(kind: 'selection' | 'success' | 'warning') {
  try {
    window.NodoNative?.haptic(kind)
  } catch {
    /* sin puente */
  }
}
