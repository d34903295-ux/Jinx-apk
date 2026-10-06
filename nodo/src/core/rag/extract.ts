import * as pdfjsLib from 'pdfjs-dist'
import mammoth from 'mammoth'

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

/** Configuración diferida del worker de PDF.js */
function ensurePdfWorker(): void {
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
}

export async function extractPdf(arrayBuffer: ArrayBuffer): Promise<ExtractedPage[]> {
  ensurePdfWorker()
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
  const result = await mammoth.extractRawText({ arrayBuffer })
  return [{ page: 1, text: result.value.trim() }]
}

export async function extractText(fileText: string): Promise<ExtractedPage[]> {
  return [{ page: 1, text: fileText.trim() }]
}

export async function extractFile(file: File): Promise<ExtractedDocument> {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? ''
  let pages: ExtractedPage[] = []

  if (extension === 'pdf') {
    const buffer = await file.arrayBuffer()
    pages = await extractPdf(buffer)
  } else if (extension === 'docx') {
    const buffer = await file.arrayBuffer()
    pages = await extractDocx(buffer)
  } else {
    const text = await file.text()
    pages = await extractText(text)
  }

  const totalText = pages.map((p) => p.text).join('\n\n')
  return {
    name: file.name,
    type: file.type || extension,
    size: file.size,
    pages,
    totalText,
  }
}
