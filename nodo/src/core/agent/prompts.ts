import type { ChatCompletionMessageParam } from '@mlc-ai/web-llm'
import type { Citation } from '../../types'
import type { SearchResult } from '../rag/search'

/** System prompts. En la Fase 3 se añaden los del agente y las herramientas. */

export const CHAT_SYSTEM_PROMPT = [
  'Eres NODO, un asistente de IA que funciona 100% sin conexión, directamente en el dispositivo del usuario.',
  'Responde en el idioma del usuario (por defecto, español), de forma clara, útil y concisa.',
  'Si no sabes algo o no estás seguro, dilo con honestidad. No inventes datos, cifras ni fuentes.',
].join(' ')

export const RAG_SYSTEM_PROMPT = [
  'Eres NODO, un asistente de IA tipo NotebookLM que funciona 100% offline.',
  'Responde a la pregunta del usuario utilizando EXCLUSIVAMENTE los fragmentos de contexto proporcionados abajo.',
  'Cada fragmento tiene un identificador numérico [1], [2], etc.',
  'Obligatoriamente debes citar la fuente usando [1], [2] al final de cada afirmación basada en ese fragmento.',
  'Si la respuesta no se encuentra en los fragmentos proporcionados, responde con honestidad: "No encontré esa información en tus documentos indexados."',
  'No inventes datos ni menciones hechos fuera del contexto suministrado.',
].join(' ')

export interface HistoryMessage {
  role: 'user' | 'assistant'
  content: string
}

/**
 * Construye los mensajes para el modelo recortando el historial más antiguo.
 * Los modelos del catálogo tienen una ventana de 4096 tokens: ~6000 caracteres de historial
 * dejan margen para el system prompt y la respuesta.
 */
export function buildChatMessages(
  history: HistoryMessage[],
  maxChars = 6000,
): ChatCompletionMessageParam[] {
  const kept: HistoryMessage[] = []
  let used = 0
  for (let i = history.length - 1; i >= 0; i--) {
    const msg = history[i]
    if (!msg) continue
    if (used + msg.content.length > maxChars && kept.length > 0) break
    kept.unshift(msg)
    used += msg.content.length
  }
  const messages: ChatCompletionMessageParam[] = [{ role: 'system', content: CHAT_SYSTEM_PROMPT }]
  for (const m of kept) {
    messages.push(
      m.role === 'user' ? { role: 'user', content: m.content } : { role: 'assistant', content: m.content },
    )
  }
  return messages
}

/**
 * Construye mensajes RAG integrando el contexto recuperado y exigiendo citas numéricas [1], [2].
 */
export function buildRagMessages(
  query: string,
  results: SearchResult[],
  history: HistoryMessage[] = [],
  maxChars = 6000,
): { messages: ChatCompletionMessageParam[]; citations: Citation[] } {
  const citations: Citation[] = results.map((r, idx) => ({
    index: idx + 1,
    chunkId: r.chunk.id,
    docId: r.chunk.docId,
    docName: r.docName,
    page: r.chunk.page,
    text: r.chunk.text,
  }))

  const contextText = citations
    .map((c) => `[${c.index}] Fuente: "${c.docName}" (Página ${c.page}):\n"${c.text}"`)
    .join('\n\n')

  const userPromptWithContext = [
    '=== CONTEXTO DE TUS DOCUMENTOS INDEXADOS ===',
    contextText,
    '============================================',
    `Pregunta: ${query}`,
  ].join('\n\n')

  const messages: ChatCompletionMessageParam[] = [{ role: 'system', content: RAG_SYSTEM_PROMPT }]

  let used = userPromptWithContext.length
  const kept: HistoryMessage[] = []
  for (let i = history.length - 1; i >= 0; i--) {
    const msg = history[i]
    if (!msg) continue
    if (used + msg.content.length > maxChars && kept.length > 0) break
    kept.unshift(msg)
    used += msg.content.length
  }

  for (const m of kept) {
    messages.push(
      m.role === 'user' ? { role: 'user', content: m.content } : { role: 'assistant', content: m.content },
    )
  }

  messages.push({ role: 'user', content: userPromptWithContext })

  return { messages, citations }
}

