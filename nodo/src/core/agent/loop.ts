import type { ChatCompletionMessageParam } from '@mlc-ai/web-llm'
import type { ToolCall } from '../../types'
import { TOOLS, getToolsSystemPromptDescription } from './tools/registry'
import { llm } from '../llm/llmClient'

export interface AgentStep {
  stepNumber: number
  toolName?: string
  toolArgs?: Record<string, any>
  toolResult?: string
  toolError?: string
  isDone: boolean
}

export interface AgentRunResult {
  finalContent: string
  toolCalls: ToolCall[]
}

const AGENT_SYSTEM_PROMPT = `Eres NODO, un agente de IA autónomo que funciona 100% offline.
Tienes acceso a las siguientes herramientas en tu entorno local:

${getToolsSystemPromptDescription()}

INSTRUCCIONES DE FORMATO:
Debes responder SIEMPRE en formato JSON estricto sin texto adicional ni bloques explicativos antes o después.
Elige exactamente una de estas dos estructuras:

1. Si necesitas usar una herramienta:
{"tool": "nombre_herramienta", "args": {"parametro": "valor"}}

2. Si ya tienes la respuesta final para el usuario:
{"final": "Tu respuesta completa y detallada en español"}

Ejemplos:
- Para calcular algo: {"tool": "calculator", "args": {"expression": "sqrt(144) + 10"}}
- Para ejecutar Python: {"tool": "run_python", "args": {"code": "print('Hola desde Python')"}}
- Para buscar en documentos: {"tool": "search_docs", "args": {"query": "resumen del informe"}}
- Para responder directamente: {"final": "La capital de Francia es París."}
`

function extractJson(text: string): Record<string, any> | null {
  const trimmed = text.trim()

  // 1. Intentar JSON directo
  try {
    return JSON.parse(trimmed)
  } catch {
    // 2. Intentar extraer de bloques ```json ... ```
    const match = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
    if (match && match[1]) {
      try {
        return JSON.parse(match[1])
      } catch {
        /* Ignorar */
      }
    }

    // 3. Buscar el primer '{' y el último '}'
    const start = trimmed.indexOf('{')
    const end = trimmed.lastIndexOf('}')
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1))
      } catch {
        /* Ignorar */
      }
    }
  }

  return null
}

/**
 * Bucle autónomo del agente de hasta 5 pasos con auto-corrección de JSON y soporte de herramientas.
 */
export async function runAgentLoop(
  userQuery: string,
  onStep?: (step: AgentStep) => void,
  onPartialFinal?: (text: string) => void
): Promise<AgentRunResult> {
  const executedToolCalls: ToolCall[] = []
  const maxSteps = 5

  const messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: AGENT_SYSTEM_PROMPT },
    { role: 'user', content: userQuery },
  ]

  for (let step = 1; step <= maxSteps; step++) {
    let rawResponse = ''
    try {
      rawResponse = await llm.generate(messages, () => {})
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return {
        finalContent: `Ocurrió un error al ejecutar el modelo: ${msg}`,
        toolCalls: executedToolCalls,
      }
    }

    let parsed = extractJson(rawResponse)

    // Si el JSON es inválido, reintentar UNA vez con un mensaje de corrección
    if (!parsed || (!parsed.tool && !parsed.final)) {
      messages.push({ role: 'assistant', content: rawResponse })
      messages.push({
        role: 'user',
        content:
          'Tu respuesta anterior no era un JSON válido. Responde ÚNICAMENTE en JSON con {"tool": "...", "args": {...}} o {"final": "..."}.',
      })

      const retryResponse = await llm.generate(messages, () => {})
      parsed = extractJson(retryResponse)

      // Si falla otra vez, responder como chat normal
      if (!parsed || (!parsed.tool && !parsed.final)) {
        onStep?.({ stepNumber: step, isDone: true })
        onPartialFinal?.(retryResponse || rawResponse)
        return {
          finalContent: retryResponse || rawResponse,
          toolCalls: executedToolCalls,
        }
      }
    }

    // Caso A: Respuesta Final alcanzada
    if (parsed.final) {
      const finalText = String(parsed.final)
      onStep?.({ stepNumber: step, isDone: true })
      onPartialFinal?.(finalText)
      return {
        finalContent: finalText,
        toolCalls: executedToolCalls,
      }
    }

    // Caso B: Llamada a Herramienta
    const toolName = String(parsed.tool)
    const toolArgs = (parsed.args && typeof parsed.args === 'object' ? parsed.args : {}) as Record<
      string,
      any
    >
    const tool = TOOLS[toolName]

    if (!tool) {
      const errorMsg = `Herramienta desconocida "${toolName}". Herramientas válidas: ${Object.keys(
        TOOLS
      ).join(', ')}`
      messages.push({ role: 'assistant', content: rawResponse })
      messages.push({
        role: 'user',
        content: `Error al ejecutar: ${errorMsg}. Corrige o genera {"final": "..."}`,
      })
      continue
    }

    onStep?.({
      stepNumber: step,
      toolName,
      toolArgs,
      isDone: false,
    })

    let toolResult = ''
    let toolError: string | undefined

    try {
      toolResult = await tool.execute(toolArgs)
    } catch (err) {
      toolError = err instanceof Error ? err.message : String(err)
    }

    executedToolCalls.push({
      name: toolName,
      args: toolArgs,
      result: toolResult || undefined,
      error: toolError,
    })

    onStep?.({
      stepNumber: step,
      toolName,
      toolArgs,
      toolResult,
      toolError,
      isDone: false,
    })

    // Retroalimentar el resultado al modelo para el siguiente paso
    messages.push({ role: 'assistant', content: JSON.stringify(parsed) })
    messages.push({
      role: 'user',
      content: toolError
        ? `Error ejecutando ${toolName}: ${toolError}. Corrige el error o genera {"final": "..."}`
        : `Resultado de ${toolName}:\n${toolResult}\n\nCon esta información, continúa o genera {"final": "..."}`,
    })
  }

  // Si se agotaron los 5 pasos sin {"final": "..."}: pedir conclusión rápida
  messages.push({
    role: 'user',
    content: 'Por favor, resume ahora tus hallazgos finales en formato {"final": "..."}.',
  })
  const fallbackResponse = await llm.generate(messages, () => {})
  const lastParsed = extractJson(fallbackResponse)
  const finalContent = lastParsed?.final ?? fallbackResponse

  onPartialFinal?.(finalContent)
  return {
    finalContent,
    toolCalls: executedToolCalls,
  }
}
