import type { ChatCompletionMessageParam } from '@mlc-ai/web-llm'
import type { Citation } from '../../types'
import type { SearchResult } from '../rag/search'

/** System prompts. En la Fase 3 se añaden los del agente y las herramientas. */

export const CHAT_SYSTEM_PROMPT =
  'Responde en español, directo y preciso. Si es simple, responde en 1-2 frases. Si no sabes, dilo.'

export const RAG_SYSTEM_PROMPT = [
  'Responde en español, directo y preciso, usando EXCLUSIVAMENTE los fragmentos proporcionados.',
  'Cita la fuente usando [1], [2] al final de cada afirmación.',
  'Si no está en los textos, di: "No encontré esa información en tus documentos indexados."',
].join(' ')

export interface HistoryMessage {
  role: 'user' | 'assistant'
  content: string
}

/**
 * Construye los mensajes para el modelo recortando a los últimos 4-6 mensajes
 * y generando un resumen automático del contexto anterior.
 */
export function buildChatMessages(
  history: HistoryMessage[],
  maxRecentMessages = 6,
  options?: { enableThinking?: boolean; thinkingBudget?: number; intent?: 'general' | 'codegen' },
): ChatCompletionMessageParam[] {
  let systemPrompt = CHAT_SYSTEM_PROMPT

  if (options?.intent === 'codegen') {
    systemPrompt = 'Responde con UN archivo completo, HTML con CSS y JS inline, sin explicaciones largas.'
  } else {
    // Control estricto de Thinking: solo si se solicita explícitamente con límite de tokens
    if (options?.enableThinking) {
      const budget = options.thinkingBudget || 512
      systemPrompt += ` [Pensamiento analítico permitido: razonar paso a paso de forma concisa antes de la respuesta final, presupuesto máximo de ${budget} tokens]`
    } else {
      systemPrompt += ' [No uses etiquetas de pensamiento ni reflexiones internas. Ve directamente a la respuesta final]'
    }
  }

  // Recorte a los últimos 4-6 mensajes
  const recent = history.slice(-maxRecentMessages)
  const older = history.slice(0, -maxRecentMessages)

  if (older.length > 0) {
    // Resumen automático y conciso de los temas tratados anteriormente
    const topics = older
      .filter((m) => m.role === 'user')
      .map((m) => m.content.replace(/\n+/g, ' ').slice(0, 60))
      .filter(Boolean)
      .slice(-4)
      .join('; ')

    if (topics) {
      systemPrompt += ` Contexto previo de la conversación resumido: Temas anteriores: "${topics}".`
    }
  }

  const messages: ChatCompletionMessageParam[] = [{ role: 'system', content: systemPrompt }]
  for (const m of recent) {
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

