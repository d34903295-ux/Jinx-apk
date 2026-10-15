export interface ExtractedPage {
  page: number
  text: string
}

export interface ExtractedDocument {
  name: string
  type: string
  size: number
  pages: ExtractedPage[]
  totalText: string
}

export async function extractPdf(arrayBuffer: ArrayBuffer): Promise<ExtractedPage[]> {
  const pdfjsLib = await import('pdfjs-dist')
  if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
    try {
      pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
        'pdfjs-dist/build/pdf.worker.min.mjs',
        import.meta.url
      ).toString()
    } catch {
      // Respaldo CDN si import.meta.url no resuelve el worker estático
      pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdn.jsdelivr.net/npm/pdfjs-dist@6.4.299/build/pdf.worker.min.mjs'
    }
  }

  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
    useSystemFonts: true,
  })
  const pdf = await loadingTask.promise
  const pages: ExtractedPage[] = []

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const textContent = await page.getTextContent()
    const pageText = textContent.items
      .map((item: any) => ('str' in item ? item.str : ''))
      .join(' ')
      .trim()
    if (pageText) {
      pages.push({ page: i, text: pageText })
    }
  }

  return pages
}

export async function extractDocx(arrayBuffer: ArrayBuffer): Promise<ExtractedPage[]> {
  const mammoth = await import('mammoth')
  const result = await mammoth.extractRawText({ arrayBuffer })
  return [{ page: 1, text: result.value.trim() }]
}

export async function extractText(fileText: string): Promise<ExtractedPage[]> {
  return [{ page: 1, text: fileText.trim() }]
}

export const SUPPORTED_EXTENSIONS = [
  'pdf',
  'docx',
  'txt',
  'md',
  'markdown',
  'json',
  'csv',
  'tsv',
  'py',
  'js',
  'ts',
  'tsx',
  'jsx',
  'html',
  'css',
  'xml',
  'yaml',
  'yml',
  'log',
  'rtf',
  'sql',
  'sh',
  'kt',
  'java',
  'c',
  'cpp',
  'rs',
  'go',
]

export async function extractFile(file: File): Promise<ExtractedDocument> {
  const extension = file.name.includes('.') ? (file.name.split('.').pop()?.toLowerCase() ?? '') : ''
  const isPdf = extension === 'pdf' || file.type === 'application/pdf'
  const isDocx = extension === 'docx' || (file.type && file.type.includes('wordprocessingml'))
  const isText =
    SUPPORTED_EXTENSIONS.includes(extension) ||
    (file.type && file.type.startsWith('text/')) ||
    file.type === 'application/json' ||
    file.type === 'application/xml'

  if (!isPdf && !isDocx && !isText) {
    throw new Error(
      `Formato no compatible (.${extension || 'desconocido'}). Usa PDF, DOCX, TXT, Markdown, CSV, JSON o código.`
    )
  }
  if (file.size === 0) {
    throw new Error(`El archivo "${file.name}" está vacío.`)
  }

  let pages: ExtractedPage[] = []

  try {
    if (isPdf) {
      pages = await extractPdf(await file.arrayBuffer())
    } else if (isDocx) {
      pages = await extractDocx(await file.arrayBuffer())
    } else {
      pages = await extractText(await file.text())
    }
  } catch (err) {
    const name = (err as { name?: string })?.name
    if (name === 'PasswordException') {
      throw new Error(`El PDF "${file.name}" está protegido con contraseña.`)
    }
    throw new Error(
      `No se pudo leer "${file.name}": archivo dañado o no válido (${err instanceof Error ? err.message : 'error desconocido'}).`
    )
  }

  pages = pages.filter((p) => p.text.length > 0)
  if (pages.length === 0) {
    throw new Error(
      isPdf
        ? `"${file.name}" no contiene texto seleccionable (probablemente es un PDF escaneado). El OCR no está disponible sin conexión.`
        : `"${file.name}" no contiene texto.`
    )
  }

  const totalText = pages.map((p) => p.text).join('\n\n')
  return {
    name: file.name,
    type: file.type || extension || 'document',
    size: file.size,
    pages,
    totalText,
  }
}
