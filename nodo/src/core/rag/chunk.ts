import type { ExtractedPage } from './extract'

export interface TextChunk {
  page: number
  position: number
  text: string
}

/**
 * Trocea páginas de texto en fragmentos con solapamiento (~500 tokens / ~1600 caracteres, ~80 tokens / ~250 caracteres de solapamiento).
 * Respeta saltos de párrafo, encabezados markdown, bloques de código y frases completas.
 * Enriquece fragmentos con el encabezado activo para maximizar la precisión semántica vectorial.
 */
export function chunkPages(
  pages: ExtractedPage[],
  chunkSizeChars = 1600,
  overlapChars = 250
): TextChunk[] {
  const result: TextChunk[] = []
  let globalPosition = 0

  for (const pageItem of pages) {
    const text = pageItem.text.trim()
    if (!text) continue

    // Si la página entera cabe en un chunk, la dejamos entera
    if (text.length <= chunkSizeChars) {
      result.push({
        page: pageItem.page,
        position: globalPosition++,
        text,
      })
      continue
    }

    let start = 0
    let currentHeading = ''

    while (start < text.length) {
      let end = Math.min(start + chunkSizeChars, text.length)

      // Rastrear el último encabezado markdown visible antes de este punto
      const priorText = text.slice(Math.max(0, start - 500), end)
      const headingMatches = priorText.match(/(?:^|\n)(#{1,4}\s+[^\n]+)/g)
      if (headingMatches && headingMatches.length > 0) {
        const lastHeading = headingMatches[headingMatches.length - 1]!.trim().replace(/^#+\s*/, '')
        if (lastHeading) currentHeading = lastHeading
      }

      // Intentar cortar en un límite natural (fin de párrafo, fin de código, punto o espacio)
      if (end < text.length) {
        const paragraphEnd = text.lastIndexOf('\n\n', end)
        const codeBlockEnd = text.lastIndexOf('```\n', end)
        const sentenceEnd = Math.max(
          text.lastIndexOf('. ', end),
          text.lastIndexOf('? ', end),
          text.lastIndexOf('! ', end),
          text.lastIndexOf('.\n', end)
        )
        const spaceEnd = text.lastIndexOf(' ', end)

        if (codeBlockEnd > start + chunkSizeChars * 0.6) {
          end = codeBlockEnd + 4
        } else if (paragraphEnd > start + chunkSizeChars * 0.5) {
          end = paragraphEnd + 2
        } else if (sentenceEnd > start + chunkSizeChars * 0.5) {
          end = sentenceEnd + 2
        } else if (spaceEnd > start + chunkSizeChars * 0.5) {
          end = spaceEnd + 1
        }
      }

      let chunkText = text.slice(start, end).trim()

      // Enriquecimiento de contexto: si el chunk no tiene el encabezado y hay uno activo, anteponerlo
      if (currentHeading && !chunkText.includes(currentHeading) && !chunkText.startsWith('#')) {
        chunkText = `[Sección: ${currentHeading}]\n${chunkText}`
      }

      if (chunkText.length > 20) {
        result.push({
          page: pageItem.page,
          position: globalPosition++,
          text: chunkText,
        })
      } else if (chunkText.length > 0) {
        // Si el fragmento residual es corto, anexarlo al chunk previo para 0% de pérdida de información
        const lastChunk = result[result.length - 1]
        if (lastChunk && lastChunk.page === pageItem.page) {
          lastChunk.text += `\n${chunkText}`
        } else {
          result.push({
            page: pageItem.page,
            position: globalPosition++,
            text: chunkText,
          })
        }
      }

      if (end >= text.length) break
      start = Math.max(start + 1, end - overlapChars)
    }
  }

  return result
}
