import type { ButtonHTMLAttributes } from 'react'

interface LiveProjectButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label?: string
  href?: string
  download?: boolean | string
}

export function LiveProjectButton({
  label = 'LIVE PROJECT',
  href,
  download,
  className = '',
  onClick,
  ...props
}: LiveProjectButtonProps) {
  const baseClasses =
    'inline-flex items-center justify-center rounded-full border-2 border-[#D7E2EA] text-[#D7E2EA] font-medium uppercase tracking-widest px-8 py-3 sm:px-10 sm:py-3.5 text-sm sm:text-base hover:bg-[#D7E2EA]/10 transition-all duration-300 active:scale-95 cursor-pointer ' +
    className

  if (href) {
    return (
      <a
        href={href}
        download={download}
        className={baseClasses}
        onClick={onClick as any}
      >
        {label}
      </a>
    )
  }

  return (
    <button
      type="button"
      className={baseClasses}
      onClick={onClick}
      {...props}
    >
      {label}
    </button>
  )
}
