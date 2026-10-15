import type { Attachment } from '../../types'
import { extractPdf, extractDocx, extractText } from '../rag/extract'
import { analyzeImageFile } from '../vision/visionAnalyzer'

export async function processChatAttachment(file: File): Promise<Attachment> {
  const id = `att_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
  const mimeType = file.type || 'application/octet-stream'
  const isImage = mimeType.startsWith('image/') || /\.(png|jpe?g|webp|gif|bmp|svg|avif|heic|heif)$/i.test(file.name)

  // 1. Imágenes (Multimodal)
  if (isImage) {
    try {
      const vision = await analyzeImageFile(file)
      return {
        id,
        name: file.name,
        type: 'image',
        mimeType: mimeType.startsWith('image/') ? mimeType : 'image/jpeg',
        size: file.size,
        dataUrl: vision.dataUrl,
        visionAnalysis: vision.analysis,
        textContent: vision.promptContext,
      }
    } catch {
      let dataUrl: string | undefined
      try {
        dataUrl = await new Promise<string | undefined>((resolve) => {
          const reader = new FileReader()
          reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : undefined)
          reader.onerror = () => resolve(undefined)
          reader.readAsDataURL(file)
        })
      } catch {
        /* noop */
      }

      return {
        id,
        name: file.name,
        type: 'image',
        mimeType: mimeType.startsWith('image/') ? mimeType : 'image/jpeg',
        size: file.size,
        dataUrl,
        textContent: `[Imagen adjunta: ${file.name} (${(file.size / 1024).toFixed(1)} KB)]`,
      }
    }
  }

  // 2. Documentos PDF
  if (file.name.toLowerCase().endsWith('.pdf') || mimeType === 'application/pdf') {
    try {
      const buffer = await file.arrayBuffer()
      const pages = await extractPdf(buffer)
      const fullText = pages.map((p) => `--- Página ${p.page} ---\n${p.text}`).join('\n\n')
      return {
        id,
        name: file.name,
        type: 'document',
        mimeType: 'application/pdf',
        size: file.size,
        textContent: fullText || `[Documento PDF: ${file.name}]`,
      }
    } catch (err) {
      return {
        id,
        name: file.name,
        type: 'document',
        mimeType: 'application/pdf',
        size: file.size,
        textContent: `[Documento PDF: ${file.name} (${err instanceof Error ? err.message : String(err)})]`,
      }
    }
  }

  // 3. Documentos Word DOCX
  if (file.name.toLowerCase().endsWith('.docx') || mimeType.includes('wordprocessingml')) {
    try {
      const buffer = await file.arrayBuffer()
      const pages = await extractDocx(buffer)
      const text = pages.map((p) => p.text).join('\n')
      return {
        id,
        name: file.name,
        type: 'document',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        size: file.size,
        textContent: text || `[Documento Word: ${file.name}]`,
      }
    } catch (err) {
      return {
        id,
        name: file.name,
        type: 'document',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        size: file.size,
        textContent: `[Documento Word: ${file.name} (${err instanceof Error ? err.message : String(err)})]`,
      }
    }
  }

  // 4. Texto, Código, JSON, Markdown, CSV, Configs
  try {
    const rawText = await file.text()
    const extracted = await extractText(rawText)
    return {
      id,
      name: file.name,
      type: file.name.match(/\.(py|js|ts|tsx|jsx|html|css|json|csv|sql|sh|kt|java|c|cpp|rs|go|xml|yaml|yml|md|txt)$/i) ? 'file' : 'document',
      mimeType,
      size: file.size,
      textContent: extracted[0]?.text || rawText.slice(0, 50000),
    }
  } catch {
    return {
      id,
      name: file.name,
      type: 'file',
      mimeType,
      size: file.size,
      textContent: `[Archivo adjunto: ${file.name} (${(file.size / 1024).toFixed(1)} KB)]`,
    }
  }
}
