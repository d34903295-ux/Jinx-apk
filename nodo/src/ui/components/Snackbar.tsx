import { useEffect, useState } from 'react'
import { subscribeSnack, type Snack } from '../../core/native/snackbar'
import { Icon } from './Icon'

/** Snackbar global Material: se monta una vez en App. */
export function Snackbar() {
  const [snack, setSnack] = useState<Snack | null>(null)

  useEffect(() => subscribeSnack(setSnack), [])

  if (!snack) return null

  return (
    <div className="pointer-events-none fixed bottom-[calc(env(safe-area-inset-bottom,0px)+92px)] left-0 right-0 z-50 flex justify-center px-6">
      <div
        role="status"
        aria-live="polite"
        className={`glass-sheet pointer-events-auto flex max-w-md items-center gap-2.5 rounded-2xl px-4 py-3 text-sm animate-sheet-up ${
          snack.tone === 'error'
            ? 'text-danger-400'
            : snack.tone === 'success'
              ? 'text-signal-300'
              : 'text-white'
        }`}
      >
        <Icon
          name={snack.tone === 'error' ? 'alert' : snack.tone === 'success' ? 'check' : 'sparkles'}
          size={16}
          className="shrink-0"
        />
        <span>{snack.text}</span>
      </div>
    </div>
  )
}
