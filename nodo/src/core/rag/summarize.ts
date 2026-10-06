import { getDocument, getDocumentChunks } from './ingest'
import { llm } from '../llm/llmClient'

export interface SummarizeProgress {
  stage: 'mapping' | 'reducing' | 'done'
  currentBatch: number
  totalBatches: number
  text: string
}

/**
 * Resumen de documento completo mediante estrategia Map-Reduce para no sobrecargar el contexto.
 */
export async function summarizeDocument(
  docId: number,
  onProgress?: (p: SummarizeProgress) => void
): Promise<string> {
  const doc = await getDocument(docId)
  if (!doc) throw new Error('Documento no encontrado.')

  const chunks = await getDocumentChunks(docId)
  if (chunks.length === 0) throw new Error('El documento no contiene texto indexado.')

  // Caso 1: Documento corto (< 3 fragmentos), se resume directamente
  if (chunks.length <= 2) {
    onProgress?.({
      stage: 'mapping',
      currentBatch: 1,
      totalBatches: 1,
      text: 'Resumiendo documento directamente...',
    })

    const combinedText = chunks.map((c) => c.text).join('\n\n')
    const prompt = [
      {
        role: 'system' as const,
        content:
          'Eres un analista experto. Crea un resumen claro, estructurado y exhaustivo del siguiente texto en español con viñetas y puntos clave.',
      },
      {
        role: 'user' as const,
        content: `Documento: "${doc.name}"\n\nContenido:\n${combinedText}`,
      },
    ]

    return llm.generate(prompt, () => {})
  }

  // Caso 2: Documento largo -> Map-Reduce
  // 1. Agrupar en lotes de ~3 chunks
  const batchSize = 3
  const batches: string[][] = []
  for (let i = 0; i < chunks.length; i += batchSize) {
    batches.push(chunks.slice(i, i + batchSize).map((c) => c.text))
  }

  const batchSummaries: string[] = []

  // Fase Map: Resumir cada lote
  for (let i = 0; i < batches.length; i++) {
    onProgress?.({
      stage: 'mapping',
      currentBatch: i + 1,
      totalBatches: batches.length,
      text: `Analizando sección ${i + 1} de ${batches.length}...`,
    })

    const batchText = batches[i]!.join('\n\n')
    const prompt = [
      {
        role: 'system' as const,
        content:
          'Resume de forma concisa los puntos clave de este fragmento de documento en 2-4 viñetas esenciales en español.',
      },
      {
        role: 'user' as const,
        content: batchText,
      },
    ]

    const partialSummary = await llm.generate(prompt, () => {})
    batchSummaries.push(partialSummary)
  }

  // Fase Reduce: Síntesis final de todos los resúmenes
  onProgress?.({
    stage: 'reducing',
    currentBatch: 1,
    totalBatches: 1,
    text: 'Sintetizando el resumen global del documento...',
  })

  const combinedSummaries = batchSummaries
    .map((s, idx) => `### Sección ${idx + 1}\n${s}`)
    .join('\n\n')

  const finalPrompt = [
    {
      role: 'system' as const,
      content:
        'Eres un analista experto. Con base en los resúmenes de las secciones de un documento, elabora un resumen ejecutivo global estructurado en español: 1. Visión general, 2. Puntos clave, 3. Conclusiones.',
    },
    {
      role: 'user' as const,
      content: `Documento: "${doc.name}"\n\nResúmenes por sección:\n${combinedSummaries}`,
    },
  ]

  const finalSummary = await llm.generate(finalPrompt, () => {})
  onProgress?.({
    stage: 'done',
    currentBatch: 1,
    totalBatches: 1,
    text: '¡Resumen completado!',
  })

  return finalSummary
}
