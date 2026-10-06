/** Snackbar global estilo Material (un solo aviso visible). */

export interface Snack {
  id: number
  text: string
  tone: 'info' | 'success' | 'error'
}

type Listener = (s: Snack | null) => void

let current: Snack | null = null
let seq = 0
let timer: ReturnType<typeof setTimeout> | null = null
const listeners = new Set<Listener>()

export function showSnack(text: string, tone: Snack['tone'] = 'info', ms = 3500) {
  if (timer) clearTimeout(timer)
  current = { id: ++seq, text, tone }
  listeners.forEach((l) => l(current))
  timer = setTimeout(() => {
    current = null
    listeners.forEach((l) => l(null))
  }, ms)
}

export function subscribeSnack(l: Listener): () => void {
  listeners.add(l)
  return () => {
    listeners.delete(l)
  }
}
