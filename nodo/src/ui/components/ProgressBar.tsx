interface ProgressBarProps {
  /** 0..1 */
  value: number
  label?: string
}

export function ProgressBar({ value, label }: ProgressBarProps) {
  const pct = Math.max(0, Math.min(100, Math.round(value * 100)))
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      aria-label={label}
      className="h-2 w-full overflow-hidden rounded-full bg-ink-200 dark:bg-white/[0.07]"
    >
      <div
        className="shimmer-bar h-full rounded-full bg-linear-to-r from-signal-500 to-signal-300 transition-[width] duration-300 ease-out animate-shimmer"
        style={{ width: `${Math.max(pct, 2)}%` }}
      />
    </div>
  )
}
