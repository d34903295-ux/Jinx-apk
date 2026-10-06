import type { SVGProps } from 'react'

/** Iconos SVG en línea (sin dependencias ni red). Trazo heredado de `currentColor`. */

export type IconName =
  | 'send'
  | 'stop'
  | 'copy'
  | 'check'
  | 'plus'
  | 'menu'
  | 'close'
  | 'trash'
  | 'sun'
  | 'moon'
  | 'cpu'
  | 'wifiOff'
  | 'download'
  | 'sparkles'
  | 'shield'
  | 'alert'
  | 'chevronDown'
  | 'refresh'
  | 'fileText'
  | 'library'
  | 'search'
  | 'upload'
  | 'message'
  | 'settings'
  | 'speak'
  | 'mic'
  | 'share'
  | 'edit'

const paths: Record<IconName, string> = {
  send: 'M5 12h13M12 5l7 7-7 7',
  stop: 'M7 7h10v10H7z',
  copy: 'M9 9h10v10H9zM5 15V5h10',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  plus: 'M12 5v14M5 12h14',
  menu: 'M4 7h16M4 12h16M4 17h10',
  close: 'M6 6l12 12M18 6L6 18',
  trash: 'M4 7h16M9 7V4h6v3M6.5 7l1 13h9l1-13',
  sun: 'M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4M12 8a4 4 0 100 8 4 4 0 000-8z',
  moon: 'M20 14.5A8 8 0 019.5 4a8 8 0 1010.5 10.5z',
  cpu: 'M8 8h8v8H8zM5 5h14v14H5zM9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3',
  wifiOff: 'M3 3l18 18M8.5 16.5a5 5 0 017 0M5 12.9a10 10 0 015.3-2.8M19 12.9a10 10 0 00-2.4-1.7M2 8.8a15 15 0 014.2-2.6M22 8.8A15 15 0 0011.8 5M12 20h.01',
  download: 'M12 4v11M7 10.5l5 5 5-5M5 20h14',
  sparkles: 'M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z',
  shield: 'M12 3l7 3v5.5c0 4.4-3 8-7 9.5-4-1.5-7-5.1-7-9.5V6z M9 12l2 2 4-4',
  alert: 'M12 4l9 16H3zM12 10v4M12 17.5h.01',
  chevronDown: 'M6 9l6 6 6-6',
  refresh: 'M20 11a8 8 0 10-2.3 5.7M20 5v6h-6',
  fileText: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8',
  library: 'M4 19.5A2.5 2.5 0 016.5 17H20 M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z',
  search: 'M11 19a8 8 0 100-16 8 8 0 000 16z M21 21l-4.35-4.35',
  upload: 'M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4 M17 8l-5-5-5 5 M12 3v12',
  message: 'M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z',
  settings: 'M12 15a3 3 0 100-6 3 3 0 000 6z M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z',
  speak: 'M11 5L6 9H2v6h4l5 4z M15.5 8.5a5 5 0 010 7 M18.5 5.5a9.4 9.4 0 010 13',
  mic: 'M12 2a3 3 0 013 3v6a3 3 0 01-6 0V5a3 3 0 013-3z M19 10v1a7 7 0 01-14 0v-1 M12 18v4 M8 22h8',
  share: 'M4 12v7a1 1 0 001 1h14a1 1 0 001-1v-7 M16 6l-4-4-4 4 M12 2v13',
  edit: 'M17 3a2.8 2.8 0 114 4L7.5 20.5 2 22l1.5-5.5z',
}

interface IconProps extends SVGProps<SVGSVGElement> {
  name: IconName
  size?: number
}

export function Icon({ name, size = 18, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      <path d={paths[name]} />
    </svg>
  )
}

/** Logo de NODO: tres nodos conectados. */
export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <linearGradient id="nodo-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#5eead4" />
          <stop offset="1" stopColor="#10b981" />
        </linearGradient>
      </defs>
      <g stroke="url(#nodo-g)" strokeWidth={4} strokeLinecap="round">
        <line x1="18" y1="20" x2="46" y2="20" />
        <line x1="18" y1="20" x2="32" y2="46" />
        <line x1="46" y1="20" x2="32" y2="46" />
      </g>
      <circle cx="18" cy="20" r="7" fill="url(#nodo-g)" />
      <circle cx="46" cy="20" r="7" fill="url(#nodo-g)" />
      <circle cx="32" cy="46" r="8" fill="#fbbf24" />
    </svg>
  )
}
