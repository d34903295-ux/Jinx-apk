import type { ButtonHTMLAttributes } from 'react'

interface ContactButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label?: string
  href?: string
  download?: boolean | string
}

export function ContactButton({
  label = 'DOWNLOAD APK v1.0',
  href,
  download,
  className = '',
  onClick,
  ...props
}: ContactButtonProps) {
  const content = (
    <span className="relative z-10 flex items-center justify-center gap-2">
      {label}
    </span>
  )

  const styleProps = {
    background:
      'linear-gradient(123deg, #18011F 7%, #B600A8 37%, #7621B0 72%, #BE4C00 100%)',
    boxShadow:
      '0px 4px 4px rgba(181, 1, 167, 0.25), 4px 4px 12px #7721B1 inset',
    outline: '2px solid white',
    outlineOffset: '-3px',
  }

  const baseClasses =
    'relative inline-flex items-center justify-center rounded-full font-medium uppercase tracking-widest text-white transition-all duration-300 hover:scale-105 active:scale-95 px-8 py-3 sm:px-10 sm:py-3.5 md:px-12 md:py-4 text-xs sm:text-sm md:text-base select-none cursor-pointer ' +
    className

  if (href) {
    return (
      <a
        href={href}
        download={download}
        style={styleProps}
        className={baseClasses}
        onClick={onClick as any}
      >
        {content}
      </a>
    )
  }

  return (
    <button
      type="button"
      style={styleProps}
      className={baseClasses}
      onClick={onClick}
      {...props}
    >
      {content}
    </button>
  )
}
