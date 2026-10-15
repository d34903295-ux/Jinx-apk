import { db } from '../db/schema'
import type { ChunkRecord, DocumentRecord } from '../../types'
import { extractFile } from './extract'
import { chunkPages } from './chunk'
import { embedder } from './embedClient'

export interface IngestProgress {
  stage: 'extracting' | 'chunking' | 'embedding' | 'saving' | 'done'
  text: string
  current?: number
  total?: number
}

export async function ingestDocument(
  file: File,
  onProgress?: (progress: IngestProgress) => void,
  signal?: AbortSignal
): Promise<number> {
  const checkAbort = () => {
    if (signal?.aborted) throw new DOMException('Importación cancelada', 'AbortError')
  }

  // 0. Duplicados accidentales (mismo nombre y tamaño)
  const dup = await db.documents.where('name').equals(file.name).and((d) => d.size === file.size).first()
  if (dup) throw new Error(`"${file.name}" ya está en la biblioteca.`)

  // 1. Extracción
  onProgress?.({ stage: 'extracting', text: `Extrayendo texto de ${file.name}...` })
  const extracted = await extractFile(file)
  checkAbort()

  if (!extracted.totalText || extracted.pages.length === 0) {
    throw new Error(`No se pudo extraer texto del archivo "${file.name}".`)
  }

  // 2. Troceo
  onProgress?.({ stage: 'chunking', text: 'Dividiendo contenido en fragmentos...' })
  const chunks = chunkPages(extracted.pages)

  if (chunks.length === 0) {
    throw new Error('El documento no generó fragmentos de texto válidos.')
  }

  // 3. Generación de vectores en Web Worker
  onProgress?.({
    stage: 'embedding',
    text: `Calculando vectores locales (0/${chunks.length})...`,
    current: 0,
    total: chunks.length,
  })

  const chunkTexts = chunks.map((c) => c.text)
  const vectors = await embedder.embedBatch(chunkTexts, (done, total) => {
    onProgress?.({
      stage: 'embedding',
      text: `Calculando vectores locales (${done}/${total})...`,
      current: done,
      total,
    })
  })
  checkAbort()
  if (vectors.length !== chunks.length) {
    throw new Error('El cálculo de vectores devolvió un resultado incompleto.')
  }

  // 4. Guardado atómico en IndexedDB (sin registros parciales)
  onProgress?.({ stage: 'saving', text: 'Guardando documento en base de datos local...' })

  const docId = await db.transaction('rw', db.documents, db.chunks, async () => {
    const id = (await db.documents.add({
      name: extracted.name,
      type: extracted.type,
      pages: extracted.pages.length,
      size: extracted.size,
      createdAt: Date.now(),
    } as DocumentRecord)) as number

    const chunkRecords: Omit<ChunkRecord, 'id'>[] = chunks.map((c, idx) => ({
      docId: id,
      page: c.page,
      position: c.position,
      text: c.text,
      vector: vectors[idx]!,
    }))
    await db.chunks.bulkAdd(chunkRecords as ChunkRecord[])
    return id
  })

  onProgress?.({ stage: 'done', text: '¡Documento indexado con éxito!' })
  return docId
}

export async function deleteDocument(docId: number): Promise<void> {
  await db.transaction('rw', db.documents, db.chunks, async () => {
    await db.chunks.where('docId').equals(docId).delete()
    await db.documents.delete(docId)
  })
}

export async function listDocuments(): Promise<DocumentRecord[]> {
  return db.documents.orderBy('createdAt').reverse().toArray()
}

export async function getDocument(docId: number): Promise<DocumentRecord | undefined> {
  return db.documents.get(docId)
}

export async function getDocumentChunks(docId: number): Promise<ChunkRecord[]> {
  return db.chunks.where('docId').equals(docId).sortBy('position')
}
