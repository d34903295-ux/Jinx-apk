import { db } from '../db/schema'
import type { ChunkRecord } from '../../types'
import { embedder } from './embedClient'

export interface SearchResult {
  chunk: ChunkRecord
  docName: string
  score: number
}

export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length || a.length === 0) return 0
  let dot = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < a.length; i++) {
    const valA = a[i]!
    const valB = b[i]!
    dot += valA * valB
    normA += valA * valA
    normB += valB * valB
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB)
  return denom === 0 ? 0 : dot / denom
}

/**
 * Búsqueda semántica vectorial local por similitud coseno sobre IndexedDB.
 */
export async function searchChunks(
  query: string,
  topK = 5,
  minScore = 0.25
): Promise<SearchResult[]> {
  const chunks = await db.chunks.toArray()
  if (chunks.length === 0) return []

  // Vectorizar la consulta del usuario
  const queryVector = await embedder.embed(query)

  // Obtener nombres de documentos en caché rápida
  const docs = await db.documents.toArray()
  const docMap = new Map<number, string>(docs.map((d) => [d.id, d.name]))

  const scored: SearchResult[] = []

  for (const chunk of chunks) {
    if (!chunk.vector || chunk.vector.length === 0) continue
    const score = cosineSimilarity(queryVector, chunk.vector)
    if (score >= minScore) {
      scored.push({
        chunk,
        docName: docMap.get(chunk.docId) ?? 'Documento',
        score,
      })
    }
  }

  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, topK)
}
