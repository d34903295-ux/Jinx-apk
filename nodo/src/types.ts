/**
 * Tipos compartidos de NODO. Coinciden con el esquema de IndexedDB (ver core/db/schema.ts).
 */

export type Role = 'system' | 'user' | 'assistant' | 'tool'

/** Cita a un fragmento de documento (se usa desde la Fase 2). */
export interface Citation {
  index: number
  chunkId: number
  docId: number
  docName: string
  page: number
  text: string
}

/** Llamada a herramienta del agente (se usa desde la Fase 3). */
export interface ToolCall {
  name: string
  args: Record<string, unknown>
  result?: string
  error?: string
}

export interface DocumentRecord {
  id: number
  name: string
  type: string
  pages: number
  createdAt: number
  size: number
}

export interface ChunkRecord {
  id: number
  docId: number
  page: number
  /** Posición del fragmento dentro del documento (orden). */
  position: number
  text: string
  vector: Float32Array
}

export interface ChatRecord {
  id: number
  title: string
  createdAt: number
  updatedAt: number
}

export interface VisionAnalysis {
  width: number
  height: number
  aspectRatio: string
  category: 'screenshot' | 'document' | 'photo' | 'diagram' | 'artwork'
  dominantColors: string[]
  brightnessScore: number
  contrastScore: number
  detectedText?: string
  summary: string
}

export interface Attachment {
  id: string
  name: string
  type: 'image' | 'document' | 'file'
  mimeType: string
  size: number
  dataUrl?: string
  textContent?: string
  visionAnalysis?: VisionAnalysis
}

export interface GenerationStats {
  promptTokens: number
  generatedTokens: number
  ttftMs: number
  totalTimeMs: number
  tokensPerSecond: number
  backend: string
}

export interface MessageRecord {
  id: number
  chatId: number
  role: Role
  content: string
  citations: Citation[]
  toolCalls: ToolCall[]
  attachments?: Attachment[]
  stats?: GenerationStats
  createdAt: number
}

export interface NoteRecord {
  id: number
  title: string
  body: string
  updatedAt: number
}

export interface SettingRecord {
  key: string
  value: unknown
}

export type Theme = 'dark' | 'light'
