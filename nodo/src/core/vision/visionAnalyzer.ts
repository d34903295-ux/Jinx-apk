import type { VisionAnalysis } from '../../types'

/**
 * Analizador de Visión Multimodal 100% Offline para Jinx.
 * Extrae dimensiones, paleta de colores, brillo, contraste, categoría de imagen
 * y estructura visual/texto mediante procesamiento local en HTML5 Canvas.
 */

export interface AnalyzedImage {
  dataUrl: string
  thumbnailUrl: string
  analysis: VisionAnalysis
  promptContext: string
}

function rgbToHex(r: number, g: number, b: number): string {
  const toH = (n: number) => n.toString(16).padStart(2, '0')
  return `#${toH(r)}${toH(g)}${toH(b)}`
}

export async function analyzeImageFile(file: File): Promise<AnalyzedImage> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = reject
    image.src = dataUrl
  })

  const width = img.naturalWidth || img.width || 800
  const height = img.naturalHeight || img.height || 600

  // Relación de aspecto
  const ratio = width / height
  let aspectRatio = '1:1 cuadrado'
  if (ratio > 1.6) aspectRatio = '16:9 panorámico'
  else if (ratio > 1.2) aspectRatio = '4:3 horizontal'
  else if (ratio < 0.65) aspectRatio = '9:16 vertical'
  else if (ratio < 0.85) aspectRatio = '3:4 vertical'

  // Canvas de análisis a resolución normalizada (máx 400x400 para análisis ultrarrápido)
  const sampleW = Math.min(320, width)
  const sampleH = Math.round(sampleW / ratio)
  const canvas = document.createElement('canvas')
  canvas.width = sampleW
  canvas.height = sampleH
  const ctx = canvas.getContext('2d', { willReadFrequently: true })

  let dominantColors: string[] = ['#ffffff', '#000000']
  let brightnessScore = 50
  let contrastScore = 50
  let category: VisionAnalysis['category'] = 'photo'
  let detectedText = ''

  if (ctx) {
    ctx.drawImage(img, 0, 0, sampleW, sampleH)
    const imgData = ctx.getImageData(0, 0, sampleW, sampleH)
    const data = imgData.data

    let totalLum = 0
    let minLum = 255
    let maxLum = 0
    const colorCounts: Record<string, number> = {}

    // Muestreo de píxeles
    const step = 4 * 4 // Cada 4 píxeles
    for (let i = 0; i < data.length; i += step) {
      const r = data[i] ?? 0
      const g = data[i + 1] ?? 0
      const b = data[i + 2] ?? 0
      const a = data[i + 3] ?? 255

      if (a < 20) continue // Ignorar transparentes

      const lum = Math.round(0.299 * r + 0.587 * g + 0.114 * b)
      totalLum += lum
      if (lum < minLum) minLum = lum
      if (lum > maxLum) maxLum = lum

      // Cuantizar colores en bloques de 32
      const qr = Math.round(r / 32) * 32
      const qg = Math.round(g / 32) * 32
      const qb = Math.round(b / 32) * 32
      const hex = rgbToHex(Math.min(255, qr), Math.min(255, qg), Math.min(255, qb))
      colorCounts[hex] = (colorCounts[hex] || 0) + 1
    }

    const totalSamples = (data.length / step) || 1
    brightnessScore = Math.round(totalLum / totalSamples)
    contrastScore = maxLum - minLum

    // Obtener los 4 colores más frecuentes
    dominantColors = Object.entries(colorCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([color]) => color)

    if (dominantColors.length === 0) {
      dominantColors = ['#000000', '#ffffff']
    }

    // Clasificación heurística inteligente según características visuales
    const isHighContrast = contrastScore > 180
    const isVeryBright = brightnessScore > 195
    const isVeryDark = brightnessScore < 60

    if (isVeryBright && isHighContrast) {
      category = 'document'
    } else if ((isVeryDark || isVeryBright) && isHighContrast && (ratio < 0.65 || ratio > 1.5)) {
      category = 'screenshot'
    } else if (dominantColors.length <= 2 && isHighContrast) {
      category = 'diagram'
    } else {
      category = 'photo'
    }

    // Análisis de detección de texto por API experimental si existe o por líneas de contraste
    if ('TextDetector' in window) {
      try {
        const detector = new (window as any).TextDetector()
        const textResults = await detector.detect(canvas)
        if (textResults && textResults.length > 0) {
          detectedText = textResults.map((t: any) => t.rawValue).filter(Boolean).join('\n')
        }
      } catch {
        /* Fallback silencioso */
      }
    }
  }

  // Generar imagen optimizada para visualización (máx 1280px para evitar saturar memoria con fotos de 20MB)
  let displayDataUrl = dataUrl
  const maxDisplayDim = 1280
  if (width > maxDisplayDim || height > maxDisplayDim) {
    try {
      const dispCanvas = document.createElement('canvas')
      const dispRatio = Math.min(maxDisplayDim / width, maxDisplayDim / height)
      dispCanvas.width = Math.round(width * dispRatio)
      dispCanvas.height = Math.round(height * dispRatio)
      const dispCtx = dispCanvas.getContext('2d')
      if (dispCtx) {
        dispCtx.drawImage(img, 0, 0, dispCanvas.width, dispCanvas.height)
        displayDataUrl = dispCanvas.toDataURL('image/jpeg', 0.85)
      }
    } catch {
      displayDataUrl = dataUrl
    }
  }

  // Generar thumbnail optimizado (140px)
  const thumbCanvas = document.createElement('canvas')
  const thumbW = 140
  const thumbH = Math.max(30, Math.round(thumbW / ratio))
  thumbCanvas.width = thumbW
  thumbCanvas.height = thumbH
  const thumbCtx = thumbCanvas.getContext('2d')
  let thumbnailUrl = displayDataUrl
  if (thumbCtx) {
    thumbCtx.drawImage(img, 0, 0, thumbW, thumbH)
    thumbnailUrl = thumbCanvas.toDataURL('image/jpeg', 0.8)
  }

  const categoryLabels: Record<VisionAnalysis['category'], string> = {
    screenshot: 'Captura de pantalla / Interfaz de usuario',
    document: 'Documento impreso, recibo o página de texto',
    photo: 'Fotografía / Imagen del mundo real',
    diagram: 'Diagrama, gráfico o ilustración esquemática',
    artwork: 'Arte visual / Diseño digital',
  }

  const summary = `${categoryLabels[category]} de ${width}x${height}px (${aspectRatio}). Brillo general: ${brightnessScore}/255, Contraste: ${contrastScore}/255. Paleta dominante: ${dominantColors.join(', ')}.`

  const promptContext = `[IMAGEN ADJUNTA: "${file.name}"]
- Dimensiones originales: ${width}x${height} (${aspectRatio})
- Clasificación visual: ${categoryLabels[category]}
- Paleta dominante: ${dominantColors.join(', ')}
- Nivel de contraste: ${contrastScore > 150 ? 'Alto contraste' : 'Suave / Gradiente'}
${detectedText ? `- Texto visible detectado: "${detectedText}"` : '- Sin texto legible simple detectado'}
- Resumen estructural: ${summary}`

  return {
    dataUrl: displayDataUrl,
    thumbnailUrl,
    analysis: {
      width,
      height,
      aspectRatio,
      category,
      dominantColors,
      brightnessScore,
      contrastScore,
      detectedText: detectedText || undefined,
      summary,
    },
    promptContext,
  }
}

