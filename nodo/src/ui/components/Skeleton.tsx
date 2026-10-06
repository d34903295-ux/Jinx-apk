/** Esqueleto de carga sobrio (en vez de spinners). */
export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`shimmer-block animate-shimmer rounded-xl bg-white/[0.06] ${className}`}
    />
  );
}
