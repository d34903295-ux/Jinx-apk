/**
 * Jinx Pure Offline QR Code Generator
 * Genera códigos QR vectoriales SVG válidos sin conexión ni librerías externas.
 * Soporta URLs, credenciales WiFi, vCards, textos y direcciones cripto.
 */

// Tablas Galois Field GF(256) para codificación Reed-Solomon
const GF_EXP = new Uint8Array(512)
const GF_LOG = new Uint8Array(256)

;(function initGaloisField() {
  let x = 1
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x
    GF_LOG[x] = i
    x <<= 1
    if (x & 256) x ^= 0x11d // polinomio primitivo x^8 + x^4 + x^3 + x^2 + 1
  }
  for (let i = 255; i < 512; i++) {
    GF_EXP[i] = GF_EXP[i - 255]!
  }
})()

function gfMul(x: number, y: number): number {
  if (x === 0 || y === 0) return 0
  return GF_EXP[GF_LOG[x]! + GF_LOG[y]!]!
}

function rsGeneratorPoly(degree: number): Uint8Array {
  let poly = new Uint8Array([1])
  for (let i = 0; i < degree; i++) {
    const next = new Uint8Array(poly.length + 1)
    const factor = GF_EXP[i] ?? 0
    for (let j = 0; j < poly.length; j++) {
      next[j] = (next[j] ?? 0) ^ gfMul(poly[j] ?? 0, factor)
      next[j + 1] = (next[j + 1] ?? 0) ^ (poly[j] ?? 0)
    }
    poly = next
  }
  return poly
}

function rsCalculateEC(data: Uint8Array, ecLength: number): Uint8Array {
  const gen = rsGeneratorPoly(ecLength)
  const remainder = new Uint8Array(ecLength)
  for (let i = 0; i < data.length; i++) {
    const factor = (data[i] ?? 0) ^ (remainder[0] ?? 0)
    for (let j = 0; j < ecLength - 1; j++) {
      remainder[j] = (remainder[j + 1] ?? 0) ^ gfMul(gen[j + 1] ?? 0, factor)
    }
    remainder[ecLength - 1] = gfMul(gen[ecLength] ?? 0, factor)
  }
  return remainder
}

// Capacidades de bytes por versión (Nivel M: ~15% corrección)
// Versión 1..6
const VERSION_SPECS = [
  { version: 1, size: 21, dataBytes: 16, ecBytes: 10, totalBytes: 26 },
  { version: 2, size: 25, dataBytes: 28, ecBytes: 16, totalBytes: 44 },
  { version: 3, size: 29, dataBytes: 44, ecBytes: 26, totalBytes: 70 },
  { version: 4, size: 33, dataBytes: 64, ecBytes: 36, totalBytes: 100 },
  { version: 5, size: 37, dataBytes: 86, ecBytes: 48, totalBytes: 134 },
  { version: 6, size: 41, dataBytes: 108, ecBytes: 64, totalBytes: 172 },
]

export interface QrCodeOptions {
  text: string
  size?: number // píxeles de salida (por defecto 256)
  darkColor?: string
  lightColor?: string
}

/** Genera la matriz booleana del código QR */
export function generateQrMatrix(text: string): { matrix: boolean[][]; size: number } {
  const utf8Bytes = new TextEncoder().encode(text)
  const spec = VERSION_SPECS.find((s) => s.dataBytes >= utf8Bytes.length + 3) || VERSION_SPECS[VERSION_SPECS.length - 1]!

  // Codificar modo Byte (0100) + longitud + datos
  const bits: number[] = []
  const pushBits = (val: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) {
      bits.push((val >> i) & 1)
    }
  }

  pushBits(0b0100, 4) // Modo byte
  pushBits(utf8Bytes.length, 8) // Contador de caracteres (8 bits para ver 1..9)
  for (let i = 0; i < utf8Bytes.length; i++) {
    pushBits(utf8Bytes[i]!, 8)
  }

  // Terminador
  pushBits(0, Math.min(4, spec.dataBytes * 8 - bits.length))
  while (bits.length % 8 !== 0) bits.push(0)

  // Bytes de relleno (0xEC, 0x11)
  const dataCodewords = new Uint8Array(spec.dataBytes)
  let byteIdx = 0
  for (let i = 0; i < bits.length; i += 8) {
    let b = 0
    for (let j = 0; j < 8; j++) b = (b << 1) | bits[i + j]!
    dataCodewords[byteIdx++] = b
  }
  let padToggle = 0xec
  while (byteIdx < spec.dataBytes) {
    dataCodewords[byteIdx++] = padToggle
    padToggle = padToggle === 0xec ? 0x11 : 0xec
  }

  // Código corrector Reed-Solomon
  const ecCodewords = rsCalculateEC(dataCodewords, spec.ecBytes)
  const allCodewords = new Uint8Array(spec.totalBytes)
  allCodewords.set(dataCodewords, 0)
  allCodewords.set(ecCodewords, spec.dataBytes)

  // Crear matriz vacía
  const size = spec.size
  const matrix: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false))
  const isFunction: boolean[][] = Array.from({ length: size }, () => Array(size).fill(false))

  // Función para colocar patrones fijos
  const setModule = (r: number, c: number, val: boolean) => {
    if (r >= 0 && r < size && c >= 0 && c < size) {
      matrix[r]![c] = val
      isFunction[r]![c] = true
    }
  }

  // Patrones de búsqueda (Finder patterns 7x7) en 3 esquinas
  const drawFinder = (top: number, left: number) => {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const nr = top + r
        const nc = left + c
        if (nr >= 0 && nr < size && nc >= 0 && nc < size) {
          const isOuter = r === 0 || r === 6 || c === 0 || c === 6
          const isInner = r >= 2 && r <= 4 && c >= 2 && c <= 4
          setModule(nr, nc, isOuter || isInner)
        }
      }
    }
  }

  drawFinder(0, 0)
  drawFinder(0, size - 7)
  drawFinder(size - 7, 0)

  // Patrones de temporización (Timing patterns)
  for (let i = 8; i < size - 8; i++) {
    const val = i % 2 === 0
    setModule(6, i, val)
    setModule(i, 6, val)
  }

  // Módulo oscuro obligatorio
  setModule(4 * spec.version + 9, 8, true)

  // Patrón de alineación para versión 2 en adelante
  if (spec.version >= 2) {
    const alignPos = size - 7
    for (let r = -2; r <= 2; r++) {
      for (let c = -2; c <= 2; c++) {
        const isBorder = Math.abs(r) === 2 || Math.abs(c) === 2
        const isCenter = r === 0 && c === 0
        setModule(alignPos + r, alignPos + c, isBorder || isCenter)
      }
    }
  }

  // Reservar información de formato (15 bits)
  for (let i = 0; i < 9; i++) {
    if (i !== 6) {
      isFunction[8]![i] = true
      isFunction[i]![8] = true
    }
  }
  for (let i = size - 8; i < size; i++) {
    isFunction[8]![i] = true
  }
  for (let i = size - 7; i < size; i++) {
    isFunction[i]![8] = true
  }

  // Rellenar datos en zigzag con máscara estándar (Mascara 0: (r + c) % 2 === 0)
  let bitPointer = 0
  const totalDataBits = allCodewords.length * 8
  let upward = true

  for (let rightCol = size - 1; rightCol > 0; rightCol -= 2) {
    if (rightCol === 6) rightCol-- // Saltar columna de temporización
    const rows = upward
      ? Array.from({ length: size }, (_, i) => size - 1 - i)
      : Array.from({ length: size }, (_, i) => i)

    for (const r of rows) {
      for (let cOffset = 0; cOffset < 2; cOffset++) {
        const c = rightCol - cOffset
        if (!isFunction[r]![c]) {
          let bit = false
          if (bitPointer < totalDataBits) {
            const byte = allCodewords[Math.floor(bitPointer / 8)]!
            const bitInByte = 7 - (bitPointer % 8)
            bit = ((byte >> bitInByte) & 1) === 1
            bitPointer++
          }
          // Aplicar máscara 0: invert si (r + c) % 2 === 0
          if ((r + c) % 2 === 0) bit = !bit
          matrix[r]![c] = bit
        }
      }
    }
    upward = !upward
  }

  // Escribir información de formato (Nivel M, Máscara 0 = formato bits: 101010000010010)
  const formatBits = [1, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0]
  for (let i = 0; i < 6; i++) matrix[8]![i] = formatBits[i] === 1
  matrix[8]![7] = formatBits[6] === 1
  matrix[8]![8] = formatBits[7] === 1
  matrix[7]![8] = formatBits[8] === 1
  for (let i = 9; i < 15; i++) matrix[14 - i]![8] = formatBits[i] === 1

  for (let i = 0; i < 8; i++) matrix[size - 1 - i]![8] = formatBits[i] === 1
  for (let i = 8; i < 15; i++) matrix[8]![size - 15 + i] = formatBits[i] === 1

  return { matrix, size }
}

/** Genera código QR en formato vectorial SVG listo para mostrar o descargar */
export function generateQrSvg(opts: QrCodeOptions): string {
  const { matrix, size } = generateQrMatrix(opts.text)
  const displaySize = opts.size || 256
  const dark = opts.darkColor || '#FFFFFF'
  const light = opts.lightColor || '#09090B'
  const margin = 2
  const fullSize = size + margin * 2

  let rects = ''
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (matrix[r]![c]) {
        rects += `<rect x="${c + margin}" y="${r + margin}" width="1" height="1" fill="${dark}"/>`
      }
    }
  }

  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${fullSize} ${fullSize}" width="${displaySize}" height="${displaySize}" shape-rendering="crispEdges">
      <rect width="${fullSize}" height="${fullSize}" fill="${light}" rx="1"/>
      ${rects}
    </svg>
  `.trim()
}
