/**
 * Jinx Offline PDF Generator (PDF 1.4 Compliant Engine)
 * Genera documentos PDF de alta fidelidad 100% offline sin dependencias externas ni CDNs.
 * Soporta paginación automática, tablas, bloques de código, listas, títulos y codificación WinAnsi para español.
 */

export interface PdfTable {
  headers: string[]
  rows: string[][]
}

export interface PdfCallout {
  type: 'info' | 'tip' | 'warning'
  text: string
}

export interface PdfSection {
  heading?: string
  text?: string
  bullets?: string[]
  code?: string
  table?: PdfTable
  callout?: PdfCallout
  divider?: boolean
}

export interface PdfDocumentOptions {
  title: string
  subtitle?: string
  author?: string
  date?: string
  accentColor?: [number, number, number] // RGB 0..1 (default: negro puro [0, 0, 0])
  sections: PdfSection[]
}

// Constantes A4 en puntos tipográficos (72 pt = 1 pulgada)
const PAGE_WIDTH = 595.28
const PAGE_HEIGHT = 841.89
const MARGIN_LEFT = 45
const MARGIN_RIGHT = 45
const MARGIN_TOP = 50
const MARGIN_BOTTOM = 55
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT

/** Mapea caracteres acentuados y especiales de español a secuencias de escape WinAnsi (octal) */
function escapePdfText(text: string): string {
  let out = ''
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!
    const code = ch.charCodeAt(0)
    if (ch === '(') out += '\\('
    else if (ch === ')') out += '\\)'
    else if (ch === '\\') out += '\\\\'
    else if (code >= 32 && code <= 126) {
      out += ch
    } else {
      // Latin-1 / WinAnsi mapping
      switch (ch) {
        case 'á': out += '\\341'; break
        case 'é': out += '\\351'; break
        case 'í': out += '\\355'; break
        case 'ó': out += '\\363'; break
        case 'ú': out += '\\372'; break
        case 'ñ': out += '\\361'; break
        case 'Á': out += '\\301'; break
        case 'É': out += '\\311'; break
        case 'Í': out += '\\315'; break
        case 'Ó': out += '\\323'; break
        case 'Ú': out += '\\332'; break
        case 'Ñ': out += '\\321'; break
        case 'ü': out += '\\374'; break
        case 'Ü': out += '\\334'; break
        case '¿': out += '\\277'; break
        case '¡': out += '\\241'; break
        case '•': out += '\\225'; break
        case '—': out += '\\227'; break
        case '–': out += '\\226'; break
        case '“': out += '\\223'; break
        case '”': out += '\\224'; break
        case '‘': out += '\\221'; break
        case '’': out += '\\222'; break
        case '€': out += '\\200'; break
        case '°': out += '\\260'; break
        default:
          if (code >= 160 && code <= 255) {
            out += '\\' + code.toString(8).padStart(3, '0')
          } else {
            out += '?'
          }
      }
    }
  }
  return out
}

/** Divide un texto largo en líneas respetando el ancho máximo en pt */
function wrapText(text: string, maxCharsPerLine: number): string[] {
  const lines: string[] = []
  const paragraphs = text.split('\n')
  for (const para of paragraphs) {
    if (para.trim() === '') {
      lines.push('')
      continue
    }
    const words = para.split(/\s+/)
    let currentLine = ''
    for (const w of words) {
      const candidate = currentLine ? `${currentLine} ${w}` : w
      if (candidate.length <= maxCharsPerLine) {
        currentLine = candidate
      } else {
        if (currentLine) lines.push(currentLine)
        currentLine = w
      }
    }
    if (currentLine) lines.push(currentLine)
  }
  return lines
}

interface PageStream {
  content: string[]
}

/** Compilador PDF vectorial estándar */
export function buildPdf(options: PdfDocumentOptions): Uint8Array {
  const pages: PageStream[] = []
  let currentPage: PageStream = { content: [] }
  let y = PAGE_HEIGHT - MARGIN_TOP

  const newPage = () => {
    if (currentPage.content.length > 0) {
      pages.push(currentPage)
    }
    currentPage = { content: [] }
    y = PAGE_HEIGHT - MARGIN_TOP - 20
  }

  const checkHeight = (needed: number) => {
    if (y - needed < MARGIN_BOTTOM) {
      newPage()
    }
  }

  // PORTADA / ENCABEZADO PRINCIPAL (Página 1)
  const [ar, ag, ab] = options.accentColor ?? [0, 0, 0]

  // Barra de acento decorativa superior
  currentPage.content.push(
    `${ar} ${ag} ${ab} rg`,
    `${MARGIN_LEFT} ${y} ${CONTENT_WIDTH} 3 re f`
  )
  y -= 25

  // Título
  const titleLines = wrapText(options.title, 42)
  for (const line of titleLines) {
    currentPage.content.push(
      'BT',
      '/F2 22 Tf',
      '0 0 0 rg',
      `${MARGIN_LEFT} ${y} Td`,
      `(${escapePdfText(line)}) Tj`,
      'ET'
    )
    y -= 26
  }

  // Subtítulo
  if (options.subtitle) {
    y -= 4
    const subLines = wrapText(options.subtitle, 55)
    for (const line of subLines) {
      currentPage.content.push(
        'BT',
        '/F1 12 Tf',
        '0.3 0.3 0.3 rg',
        `${MARGIN_LEFT} ${y} Td`,
        `(${escapePdfText(line)}) Tj`,
        'ET'
      )
      y -= 16
    }
  }

  // Metadatos (Autor, Fecha, App)
  y -= 8
  const metaParts: string[] = []
  if (options.author) metaParts.push(`Autor: ${options.author}`)
  metaParts.push(`Fecha: ${options.date || new Date().toLocaleDateString('es-ES')}`)
  metaParts.push('Jinx AI • Offline Engine')
  const metaStr = metaParts.join('  |  ')

  currentPage.content.push(
    'BT',
    '/F1 9 Tf',
    '0.5 0.5 0.5 rg',
    `${MARGIN_LEFT} ${y} Td`,
    `(${escapePdfText(metaStr)}) Tj`,
    'ET',
    // Línea divisoria elegante
    '0.85 0.85 0.85 RG',
    '0.5 w',
    `${MARGIN_LEFT} ${y - 10} m ${PAGE_WIDTH - MARGIN_RIGHT} ${y - 10} l S`
  )
  y -= 28

  // SECCIONES DEL DOCUMENTO
  for (const sec of options.sections) {
    if (sec.divider) {
      checkHeight(20)
      currentPage.content.push(
        '0.85 0.85 0.85 RG',
        '0.5 w',
        `${MARGIN_LEFT} ${y} m ${PAGE_WIDTH - MARGIN_RIGHT} ${y} l S`
      )
      y -= 20
      continue
    }

    // Encabezado de sección
    if (sec.heading) {
      checkHeight(40)
      y -= 10
      currentPage.content.push(
        // Mini marcador vertical de sección
        `${ar} ${ag} ${ab} rg`,
        `${MARGIN_LEFT} ${y - 2} 4 14 re f`,
        'BT',
        '/F2 14 Tf',
        '0.1 0.1 0.1 rg',
        `${MARGIN_LEFT + 10} ${y} Td`,
        `(${escapePdfText(sec.heading)}) Tj`,
        'ET'
      )
      y -= 24
    }

    // Texto de párrafo
    if (sec.text) {
      const lines = wrapText(sec.text, 68)
      for (const line of lines) {
        if (line === '') {
          y -= 8
          continue
        }
        checkHeight(16)
        currentPage.content.push(
          'BT',
          '/F1 10 Tf',
          '0.15 0.15 0.15 rg',
          `${MARGIN_LEFT} ${y} Td`,
          `(${escapePdfText(line)}) Tj`,
          'ET'
        )
        y -= 15
      }
      y -= 6
    }

    // Lista de viñetas / bullets
    if (sec.bullets && sec.bullets.length > 0) {
      for (const bullet of sec.bullets) {
        const bulletLines = wrapText(bullet, 64)
        for (let i = 0; i < bulletLines.length; i++) {
          const bLine = bulletLines[i]!
          checkHeight(16)
          currentPage.content.push(
            'BT',
            '/F1 10 Tf',
            '0.2 0.2 0.2 rg',
            `${MARGIN_LEFT + 14} ${y} Td`,
            `(${escapePdfText(bLine)}) Tj`,
            'ET'
          )
          if (i === 0) {
            // Dibujar punto de viñeta
            currentPage.content.push(
              `${ar} ${ag} ${ab} rg`,
              `${MARGIN_LEFT + 4} ${y + 3} 3 3 re f`
            )
          }
          y -= 15
        }
      }
      y -= 6
    }

    // Cuadro de código monospace
    if (sec.code) {
      const codeLines = sec.code.split('\n')
      const boxHeight = codeLines.length * 13 + 16
      checkHeight(boxHeight + 10)
      // Fondo gris oscuro/claro
      currentPage.content.push(
        '0.96 0.96 0.97 rg',
        '0.88 0.88 0.90 RG',
        '0.75 w',
        `${MARGIN_LEFT} ${y - boxHeight + 8} ${CONTENT_WIDTH} ${boxHeight} re B`
      )
      let codeY = y - 6
      for (const cLine of codeLines) {
        const safeCode = cLine.length > 70 ? cLine.substring(0, 70) + '…' : cLine
        currentPage.content.push(
          'BT',
          '/F3 8.5 Tf',
          '0.1 0.1 0.2 rg',
          `${MARGIN_LEFT + 12} ${codeY} Td`,
          `(${escapePdfText(safeCode)}) Tj`,
          'ET'
        )
        codeY -= 13
      }
      y -= boxHeight + 12
    }

    // Cuadro Callout (info / tip / warning)
    if (sec.callout) {
      const cLines = wrapText(sec.callout.text, 62)
      const cHeight = cLines.length * 15 + 18
      checkHeight(cHeight + 8)

      let bgR = 0.95, bgG = 0.97, bgB = 1.0 // info (azul tenue)
      let borderR = 0.2, borderG = 0.5, borderB = 0.9
      if (sec.callout.type === 'tip') {
        bgR = 0.94; bgG = 0.98; bgB = 0.94
        borderR = 0.15; borderG = 0.65; borderB = 0.3
      } else if (sec.callout.type === 'warning') {
        bgR = 1.0; bgG = 0.97; bgB = 0.92
        borderR = 0.9; borderG = 0.55; borderB = 0.1
      }

      currentPage.content.push(
        `${bgR} ${bgG} ${bgB} rg`,
        `${borderR} ${borderG} ${borderB} RG`,
        '0.5 w',
        `${MARGIN_LEFT} ${y - cHeight + 10} ${CONTENT_WIDTH} ${cHeight} re B`,
        // Barra izquierda sólida
        `${borderR} ${borderG} ${borderB} rg`,
        `${MARGIN_LEFT} ${y - cHeight + 10} 4 ${cHeight} re f`
      )

      let calloutY = y - 4
      for (const line of cLines) {
        currentPage.content.push(
          'BT',
          '/F1 9.5 Tf',
          '0.1 0.1 0.1 rg',
          `${MARGIN_LEFT + 14} ${calloutY} Td`,
          `(${escapePdfText(line)}) Tj`,
          'ET'
        )
        calloutY -= 15
      }
      y -= cHeight + 12
    }

    // Tabla de datos
    if (sec.table && sec.table.headers.length > 0) {
      const cols = sec.table.headers.length
      const colWidth = CONTENT_WIDTH / cols
      const rowHeight = 18
      const tableHeight = (sec.table.rows.length + 1) * rowHeight + 10

      checkHeight(Math.min(tableHeight, 100))

      // Cabecera de la tabla (fondo negro / acento)
      currentPage.content.push(
        '0.1 0.1 0.1 rg',
        `${MARGIN_LEFT} ${y - rowHeight + 4} ${CONTENT_WIDTH} ${rowHeight} re f`
      )
      for (let c = 0; c < cols; c++) {
        const headerText = sec.table.headers[c] || ''
        currentPage.content.push(
          'BT',
          '/F2 9 Tf',
          '1 1 1 rg',
          `${MARGIN_LEFT + c * colWidth + 6} ${y - 8} Td`,
          `(${escapePdfText(headerText)}) Tj`,
          'ET'
        )
      }
      y -= rowHeight

      // Filas de la tabla
      for (let r = 0; r < sec.table.rows.length; r++) {
        checkHeight(rowHeight + 4)
        const row = sec.table.rows[r] || []
        const isEven = r % 2 === 0
        if (isEven) {
          currentPage.content.push(
            '0.97 0.97 0.97 rg',
            `${MARGIN_LEFT} ${y - rowHeight + 4} ${CONTENT_WIDTH} ${rowHeight} re f`
          )
        }
        for (let c = 0; c < cols; c++) {
          const cell = row[c] || ''
          currentPage.content.push(
            'BT',
            '/F1 8.5 Tf',
            '0.15 0.15 0.15 rg',
            `${MARGIN_LEFT + c * colWidth + 6} ${y - 8} Td`,
            `(${escapePdfText(cell)}) Tj`,
            'ET'
          )
        }
        // Línea inferior de la fila
        currentPage.content.push(
          '0.9 0.9 0.9 RG',
          '0.3 w',
          `${MARGIN_LEFT} ${y - rowHeight + 4} m ${PAGE_WIDTH - MARGIN_RIGHT} ${y - rowHeight + 4} l S`
        )
        y -= rowHeight
      }
      y -= 12
    }
  }

  // Guardar última página
  if (currentPage.content.length > 0) {
    pages.push(currentPage)
  }
  if (pages.length === 0) {
    pages.push({ content: ['BT /F1 12 Tf (Documento vacío) Tj ET'] })
  }

  const totalPages = pages.length

  // Agregar pie de página ("Página X de Y") a cada página
  for (let pIdx = 0; pIdx < pages.length; pIdx++) {
    const p = pages[pIdx]!
    const pageNum = pIdx + 1
    const footerText = `Jinx AI • Página ${pageNum} de ${totalPages}`
    p.content.push(
      '0.88 0.88 0.88 RG',
      '0.5 w',
      `${MARGIN_LEFT} ${MARGIN_BOTTOM + 8} m ${PAGE_WIDTH - MARGIN_RIGHT} ${MARGIN_BOTTOM + 8} l S`,
      'BT',
      '/F1 8.5 Tf',
      '0.5 0.5 0.5 rg',
      `${MARGIN_LEFT} ${MARGIN_BOTTOM - 4} Td`,
      `(${escapePdfText(footerText)}) Tj`,
      'ET',
      'BT',
      '/F1 8.5 Tf',
      '0.5 0.5 0.5 rg',
      `${PAGE_WIDTH - MARGIN_RIGHT - 110} ${MARGIN_BOTTOM - 4} Td`,
      `(${escapePdfText('100% Offline Secured')}) Tj`,
      'ET'
    )
  }

  // ENSAMBLADOR DE OBJETOS PDF 1.4
  const objects: string[] = []
  const xrefOffsets: number[] = []

  // Estructura:
  // Obj 1: Catalog
  // Obj 2: Pages tree
  // Obj 3: Font Helvetica
  // Obj 4: Font Helvetica-Bold
  // Obj 5: Font Courier
  // Obj 6: Font Courier-Bold
  // Luego para cada página: Obj (7 + i*2) = Page, Obj (8 + i*2) = Content Stream

  const fontHelveticaId = 3
  const fontHelveticaBoldId = 4
  const fontCourierId = 5
  const fontCourierBoldId = 6

  const pageObjectIds: number[] = []
  for (let i = 0; i < totalPages; i++) {
    pageObjectIds.push(7 + i * 2)
  }

  // Obj 1: Catalog
  objects.push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj')

  // Obj 2: Pages
  const kidsStr = pageObjectIds.map((id) => `${id} 0 R`).join(' ')
  objects.push(`2 0 obj\n<< /Type /Pages /Kids [${kidsStr}] /Count ${totalPages} >>\nendobj`)

  // Obj 3..6: Fuentes estándar Tipo 1 con WinAnsiEncoding
  objects.push('3 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj')
  objects.push('4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj')
  objects.push('5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>\nendobj')
  objects.push('6 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Courier-Bold /Encoding /WinAnsiEncoding >>\nendobj')

  // Páginas y Streams
  for (let i = 0; i < totalPages; i++) {
    const pageId = 7 + i * 2
    const contentId = pageId + 1
    const p = pages[i]!
    const streamBody = p.content.join('\n')
    const streamBytes = new TextEncoder().encode(streamBody)

    // Page Object
    objects.push(
      `${pageId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Contents ${contentId} 0 R /Resources << /Font << /F1 ${fontHelveticaId} 0 R /F2 ${fontHelveticaBoldId} 0 R /F3 ${fontCourierId} 0 R /F4 ${fontCourierBoldId} 0 R >> /ProcSet [/PDF /Text] >> >>\nendobj`
    )

    // Content Stream Object
    objects.push(
      `${contentId} 0 obj\n<< /Length ${streamBytes.length} >>\nstream\n${streamBody}\nendstream\nendobj`
    )
  }

  // CONSTRUIR BUFFER FINAL CON TABLA XREF
  const header = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n'
  const encoder = new TextEncoder()
  const chunks: Uint8Array[] = [encoder.encode(header)]
  let currentOffset = chunks[0]!.length

  // Registrar offset de cada objeto
  for (let i = 0; i < objects.length; i++) {
    xrefOffsets.push(currentOffset)
    const objBytes = encoder.encode(objects[i] + '\n')
    chunks.push(objBytes)
    currentOffset += objBytes.length
  }

  const startXref = currentOffset

  // Xref table
  let xrefStr = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (const offset of xrefOffsets) {
    xrefStr += offset.toString().padStart(10, '0') + ' 00000 n \n'
  }
  xrefStr += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${startXref}\n%%EOF\n`

  chunks.push(encoder.encode(xrefStr))

  // Concatenar todos los chunks en un solo Uint8Array
  const totalLength = chunks.reduce((acc, c) => acc + c.length, 0)
  const result = new Uint8Array(totalLength)
  let pos = 0
  for (const c of chunks) {
    result.set(c, pos)
    pos += c.length
  }

  return result
}

/** Genera un Blob PDF para vista previa o descarga */
export function generatePdfBlob(options: PdfDocumentOptions): Blob {
  const bytes = buildPdf(options)
  const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
  return new Blob([arrayBuffer], { type: 'application/pdf' })
}

/** Descarga el documento PDF directamente en el navegador del usuario */
export function downloadPdf(options: PdfDocumentOptions, filename?: string): { filename: string; sizeBytes: number } {
  const blob = generatePdfBlob(options)
  const safeName = filename || `${options.title.toLowerCase().replace(/[^a-z0-9_-]/g, '_').slice(0, 30) || 'documento'}.pdf`
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = safeName.endsWith('.pdf') ? safeName : `${safeName}.pdf`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 6000)
  return { filename: a.download, sizeBytes: blob.size }
}
