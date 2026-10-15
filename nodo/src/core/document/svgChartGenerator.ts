/**
 * Jinx SVG Chart & Diagram Generator
 * Genera gráficos vectoriales SVG interactivos, elegantes y 100% offline.
 * Sigue la estética "Blanco, Negro y Transparente" de Jinx.
 */

export interface ChartDataPoint {
  label: string
  value: number
  color?: string
}

export interface BarChartOptions {
  title?: string
  data: ChartDataPoint[]
  width?: number
  height?: number
  unit?: string
}

export interface LineChartOptions {
  title?: string
  data: { label: string; value: number }[]
  width?: number
  height?: number
  unit?: string
  smooth?: boolean
}

export interface KpiCardOptions {
  title: string
  value: string | number
  delta?: string
  isPositiveDelta?: boolean
  subtitle?: string
  width?: number
  height?: number
}

/** Genera un gráfico de barras vectorial SVG */
export function generateBarChartSvg(opts: BarChartOptions): string {
  const w = opts.width || 600
  const h = opts.height || 340
  const padLeft = 60
  const padBottom = 50
  const padTop = opts.title ? 50 : 20
  const padRight = 30

  const chartW = w - padLeft - padRight
  const chartH = h - padTop - padBottom

  const maxVal = Math.max(...opts.data.map((d) => d.value), 1)
  const barCount = opts.data.length
  const barGap = 16
  const barWidth = Math.max((chartW - (barCount - 1) * barGap) / barCount, 12)

  // Líneas de guía horizontales
  const gridSteps = 4
  let gridLines = ''
  for (let i = 0; i <= gridSteps; i++) {
    const yVal = padTop + (chartH / gridSteps) * i
    const tickVal = Math.round(maxVal - (maxVal / gridSteps) * i)
    gridLines += `
      <line x1="${padLeft}" y1="${yVal}" x2="${w - padRight}" y2="${yVal}" stroke="rgba(255,255,255,0.08)" stroke-width="1" stroke-dasharray="4,4"/>
      <text x="${padLeft - 10}" y="${yVal + 4}" fill="#71717A" font-size="11" text-anchor="end" font-family="monospace">${tickVal}${opts.unit || ''}</text>
    `
  }

  // Barras
  let bars = ''
  opts.data.forEach((d, idx) => {
    const x = padLeft + idx * (barWidth + barGap)
    const barH = (d.value / maxVal) * chartH
    const y = padTop + chartH - barH
    const color = d.color || '#57E6FF'

    bars += `
      <g class="bar-group">
        <rect x="${x}" y="${y}" width="${barWidth}" height="${barH}" rx="4" fill="${color}" fill-opacity="0.85">
          <title>${d.label}: ${d.value}${opts.unit || ''}</title>
        </rect>
        <text x="${x + barWidth / 2}" y="${y - 8}" fill="#FFFFFF" font-size="10" font-weight="600" text-anchor="middle" font-family="sans-serif">${d.value}</text>
        <text x="${x + barWidth / 2}" y="${padTop + chartH + 20}" fill="#A1A1AA" font-size="11" text-anchor="middle" font-family="sans-serif">${d.label}</text>
      </g>
    `
  })

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="100%" height="100%" style="background:#09090B; border:1px solid rgba(255,255,255,0.1); border-radius:12px; font-family:Inter,system-ui,sans-serif;">
      ${opts.title ? `<text x="${w / 2}" y="30" fill="#FFFFFF" font-size="15" font-weight="bold" text-anchor="middle">${opts.title}</text>` : ''}
      ${gridLines}
      ${bars}
    </svg>
  `.trim()
}

/** Genera un gráfico de línea y área de tendencia SVG */
export function generateLineChartSvg(opts: LineChartOptions): string {
  const w = opts.width || 600
  const h = opts.height || 320
  const padLeft = 55
  const padBottom = 45
  const padTop = opts.title ? 50 : 25
  const padRight = 30

  const chartW = w - padLeft - padRight
  const chartH = h - padTop - padBottom
  const maxVal = Math.max(...opts.data.map((d) => d.value), 1)
  const minVal = Math.min(...opts.data.map((d) => d.value), 0)
  const range = maxVal - minVal || 1

  const points = opts.data.map((d, i) => {
    const x = padLeft + (i / Math.max(opts.data.length - 1, 1)) * chartW
    const y = padTop + chartH - ((d.value - minVal) / range) * chartH
    return { x, y, label: d.label, val: d.value }
  })

  const pathD = points.map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`)).join(' ')
  const areaD = `${pathD} L ${points[points.length - 1]?.x ?? 0} ${padTop + chartH} L ${points[0]?.x ?? 0} ${padTop + chartH} Z`

  let circles = ''
  points.forEach((p) => {
    circles += `
      <circle cx="${p.x}" cy="${p.y}" r="4.5" fill="#57E6FF" stroke="#09090B" stroke-width="2"/>
      <text x="${p.x}" y="${padTop + chartH + 18}" fill="#71717A" font-size="10" text-anchor="middle">${p.label}</text>
    `
  })

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="100%" height="100%" style="background:#09090B; border:1px solid rgba(255,255,255,0.1); border-radius:12px; font-family:Inter,system-ui,sans-serif;">
      <defs>
        <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#57E6FF" stop-opacity="0.35"/>
          <stop offset="100%" stop-color="#57E6FF" stop-opacity="0.0"/>
        </linearGradient>
      </defs>
      ${opts.title ? `<text x="${w / 2}" y="30" fill="#FFFFFF" font-size="15" font-weight="bold" text-anchor="middle">${opts.title}</text>` : ''}
      <path d="${areaD}" fill="url(#lineGrad)"/>
      <path d="${pathD}" fill="none" stroke="#57E6FF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
      ${circles}
    </svg>
  `.trim()
}

/** Genera una tarjeta de métrica KPI destacada con indicador de crecimiento */
export function generateKpiCardSvg(opts: KpiCardOptions): string {
  const w = opts.width || 320
  const h = opts.height || 160
  const isPos = opts.isPositiveDelta !== false

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" style="background:#09090B; border:1px solid rgba(255,255,255,0.12); border-radius:12px; font-family:Inter,system-ui,sans-serif;">
      <text x="24" y="38" fill="#A1A1AA" font-size="13" font-weight="500">${opts.title}</text>
      <text x="24" y="86" fill="#FFFFFF" font-size="36" font-weight="800" font-family="'Space Grotesk',sans-serif">${opts.value}</text>
      ${
        opts.delta
          ? `
        <rect x="24" y="104" width="75" height="24" rx="6" fill="${isPos ? 'rgba(74,222,128,0.12)' : 'rgba(248,113,113,0.12)'}"/>
        <text x="32" y="120" fill="${isPos ? '#4ADE80' : '#F87171'}" font-size="12" font-weight="700">${isPos ? '▲ +' : '▼ -'}${opts.delta}</text>
      `
          : ''
      }
      ${opts.subtitle ? `<text x="${opts.delta ? 110 : 24}" y="120" fill="#71717A" font-size="12">${opts.subtitle}</text>` : ''}
    </svg>
  `.trim()
}
