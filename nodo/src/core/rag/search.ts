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
 * Búsqueda semántica vectorial local optimizada por similitud coseno sobre IndexedDB.
 * Precalcula la norma del vector de consulta una sola vez y mantiene un top-K acotado.
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
  if (queryVector.length === 0) return []

  // Precalcular la norma del vector de consulta una sola vez
  let normA = 0
  const qLen = queryVector.length
  for (let i = 0; i < qLen; i++) {
    const val = queryVector[i]!
    normA += val * val
  }
  const sqrtNormA = Math.sqrt(normA)
  if (sqrtNormA === 0) return []

  // Obtener nombres de documentos en caché rápida
  const docs = await db.documents.toArray()
  const docMap = new Map<number, string>(docs.map((d) => [d.id, d.name]))

  // Array ordenado de tamaño máximo topK para evitar alocar y ordenar arrays gigantes
  const topResults: SearchResult[] = []

  // Términos para coincidencia léxica complementaria (búsqueda híbrida)
  const queryTerms = query.toLowerCase().split(/\s+/).filter((t) => t.length > 2)

  for (const chunk of chunks) {
    const chunkVector = chunk.vector
    if (!chunkVector || chunkVector.length !== qLen) continue

    let dot = 0
    let normB = 0
    for (let i = 0; i < qLen; i++) {
      const a = queryVector[i]!
      const b = chunkVector[i]!
      dot += a * b
      normB += b * b
    }
    const denom = sqrtNormA * Math.sqrt(normB)
    const vecScore = denom === 0 ? 0 : dot / denom

    // Factor léxico (BM25 simplificado)
    let lexicalScore = 0
    if (queryTerms.length > 0) {
      const lowerChunk = chunk.text.toLowerCase()
      let matches = 0
      for (const term of queryTerms) {
        if (lowerChunk.includes(term)) matches++
      }
      lexicalScore = (matches / queryTerms.length) * 0.35
    }

    // Puntuación combinada híbrida
    const finalScore = vecScore * 0.65 + lexicalScore

    if (finalScore < minScore) continue

    // Si ya tenemos topK elementos y el score es menor o igual al peor del topK, descartar
    if (topResults.length === topK && finalScore <= topResults[topResults.length - 1]!.score) {
      continue
    }

    const item: SearchResult = {
      chunk,
      docName: docMap.get(chunk.docId) ?? 'Documento',
      score: finalScore,
    }

    // Inserción ordenada en topResults (longitud máxima topK, típicamente <= 5)
    let insertIdx = topResults.findIndex((r) => r.score < finalScore)
    if (insertIdx === -1) insertIdx = topResults.length

    topResults.splice(insertIdx, 0, item)
    if (topResults.length > topK) {
      topResults.pop()
    }
  }

  return topResults
}
