import type { ExtractedPage } from './extract'

export interface TextChunk {
  page: number
  position: number
  text: string
}

/**
 * Trocea páginas de texto en fragmentos con solapamiento (~500 tokens / ~1600 caracteres, ~80 tokens / ~250 caracteres de solapamiento).
 * Respeta saltos de párrafo y frases completas para no cortar ideas por la mitad.
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
    while (start < text.length) {
      let end = Math.min(start + chunkSizeChars, text.length)

      // Intentar cortar en un límite natural (fin de párrafo, punto o espacio) si no estamos al final
      if (end < text.length) {
        const paragraphEnd = text.lastIndexOf('\n\n', end)
        const sentenceEnd = Math.max(
          text.lastIndexOf('. ', end),
          text.lastIndexOf('? ', end),
          text.lastIndexOf('! ', end)
        )
        const spaceEnd = text.lastIndexOf(' ', end)

        if (paragraphEnd > start + chunkSizeChars * 0.5) {
          end = paragraphEnd + 2
        } else if (sentenceEnd > start + chunkSizeChars * 0.5) {
          end = sentenceEnd + 2
        } else if (spaceEnd > start + chunkSizeChars * 0.5) {
          end = spaceEnd + 1
        }
      }

      const chunkText = text.slice(start, end).trim()
      if (chunkText.length > 20) {
        result.push({
          page: pageItem.page,
          position: globalPosition++,
          text: chunkText,
        })
      }

      if (end >= text.length) break
      start = Math.max(start + 1, end - overlapChars)
    }
  }

  return result
}
