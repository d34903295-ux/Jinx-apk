/**
 * Router automático por reglas (0 ms, sin llamadas a LLM).
 * Selecciona el modelo ideal y los parámetros según la complejidad de la pregunta.
 */

import { isCodeGenQuery } from '../code/codePipeline'

export type RouteCategory = 'fast' | 'standard' | 'complex'

export const CODEGEN_SYSTEM_PROMPT =
  'Responde con UN archivo completo, HTML con CSS y JS inline, sin explicaciones largas.'

export interface RouteDecision {
  category: RouteCategory
  targetModelId: string
  modelLabel: string
  enableThinking: boolean
  thinkingBudget: number
  temperature: number
  reason: string
  isCloudRecommended: boolean
  intent?: 'general' | 'codegen'
}

const FAST_CANDIDATES = [
  'qwen-3-0.6b-q4km',
  'qwen-2.5-0.5b-q4km',
  'gemma-3-270m-q4km',
  'functiongemma-270m-q80',
  'gemma-4-e2b-it-q4km',
  'minicpm-2b-q4km',
]

const STANDARD_CANDIDATES = [
  'gemma-4-e2b-it-q4km',
  'minicpm-2b-q4km',
  'llama-3.2-1b-q4km',
  'qwen-2.5-1.5b-q4km',
  'qwen-2.5-3b-q4km',
  'gemma-4-e4b-it-q4km',
]

const COMPLEX_CANDIDATES = [
  'gemma-4-e4b-it-q4km',
  'minicpm3-4b-q4km',
  'qwen-2.5-7b-q4km',
  'qwen-2.5-3b-q4km',
  'gemma-4-e2b-it-q4km',
]

function isMathOrData(text: string): boolean {
  const t = text.toLowerCase()
  return (
    /(\b(calcula|calculo|matematica|matemática|ecuacion|ecuación|porcentaje|estadistica|estadística|suma|resta|multiplica|divide|deriva|integra|algebra|álgebra|promedio|formula|fórmula|raiz cuadrada|desviacion|desviación|cuanto es|resultado)\b)/i.test(
      t,
    ) || /[\d+\-*/=^%]{3,}/.test(t)
  )
}

function isCodeOrTechnical(text: string): boolean {
  return (
    /```|\b(codigo|código|programacion|programación|funcion|función|function|script|clase|class|bug|error|sql|regex|typescript|javascript|python|kotlin|java|c\+\+|html|css|json|algoritmo|refactor)\b/i.test(
      text,
    )
  )
}

function isDeepReasoning(text: string): boolean {
  return (
    /\b(analiza|análisis|analisis|explica paso a paso|razona|por qué|por que|comparativa|compara|resuelve|demuestra|prueba lógica|pros y contras|evalúa|evalua)\b/i.test(
      text,
    ) || text.trim().length > 300
  )
}

function isGreetingOrShort(text: string): boolean {
  const trimmed = text.trim()
  if (
    /^(hola|buenos días|buenos dias|buenas tardes|buenas noches|qué tal|que tal|cómo estás|como estas|cómo te llamas|como te llamas|quién eres|quien eres|saludos|hey|hi|hello)\b/i.test(
      trimmed,
    )
  ) {
    return true
  }
  return trimmed.length <= 45 && !isCodeOrTechnical(text) && !isMathOrData(text)
}

/**
 * Evalúa la consulta del usuario y determina el modelo y configuración óptima.
 */
export function routeQuery(
  query: string,
  hasImage: boolean,
  downloadedModelIds: string[],
  activeModelId?: string,
): RouteDecision {
  const isCodeGen = isCodeGenQuery(query)
  const isMath = isMathOrData(query)
  const isCode = isCodeOrTechnical(query)
  const isDeep = isDeepReasoning(query)
  const isShort = isGreetingOrShort(query)

  let category: RouteCategory = 'standard'
  let reason = 'Pregunta normal'
  let preferred: string[] = STANDARD_CANDIDATES
  let enableThinking = false
  let thinkingBudget = 0
  let temperature = isMath ? 0.2 : 0.65
  let isCloudRecommended = false
  let intent: 'general' | 'codegen' = isCodeGen ? 'codegen' : 'general'

  if (isCodeGen) {
    category = 'complex'
    reason = 'Generación de código / Aplicación'
    preferred = COMPLEX_CANDIDATES
    enableThinking = false
    thinkingBudget = 0
    temperature = 0.3
    isCloudRecommended = false
  } else if (hasImage || isCode || isDeep) {
    category = 'complex'
    reason = hasImage
      ? 'Análisis visual multimodal'
      : isCode
        ? 'Código o programación'
        : 'Razonamiento profundo o análisis'
    preferred = COMPLEX_CANDIDATES
    enableThinking = true
    thinkingBudget = 512
    temperature = isMath ? 0.2 : 0.7
    isCloudRecommended = true
  } else if (isShort) {
    category = 'fast'
    reason = 'Saludo o pregunta corta ultra-rápida'
    preferred = FAST_CANDIDATES
    enableThinking = false
    thinkingBudget = 0
    temperature = 0.6
    isCloudRecommended = false
  }

  // Resolver el mejor modelo descargado
  let chosenId = ''
  for (const candidate of preferred) {
    if (downloadedModelIds.includes(candidate)) {
      chosenId = candidate
      break
    }
  }

  // Si ninguno de la lista preferida está descargado, usar el modelo activo o el primer disponible
  if (!chosenId) {
    if (activeModelId && downloadedModelIds.includes(activeModelId)) {
      chosenId = activeModelId
    } else if (downloadedModelIds.length > 0) {
      chosenId = downloadedModelIds[0]!
    } else {
      chosenId = preferred[0] || 'gemma-4-e2b-it-q4km'
    }
  }

  // Nombre amigable para mostrar en UI
  let label = 'Modelo local'
  if (chosenId.startsWith('qwen-3-0.6b') || chosenId.startsWith('qwen-2.5-0.5b')) {
    label = 'Qwen 0.6B · Ultra rápido'
  } else if (chosenId.startsWith('gemma-4-e4b')) {
    label = 'Gemma 4 E4B · Razonamiento'
  } else if (chosenId.startsWith('gemma-4-e2b')) {
    label = 'Gemma 4 E2B · Estándar'
  } else if (chosenId.startsWith('minicpm3-4b')) {
    label = 'MiniCPM 3 4B · Razonamiento'
  } else if (chosenId.startsWith('minicpm-2b')) {
    label = 'MiniCPM 2B · Estándar'
  } else {
    label = chosenId
  }

  return {
    category,
    targetModelId: chosenId,
    modelLabel: label,
    enableThinking,
    thinkingBudget,
    temperature,
    reason,
    isCloudRecommended,
    intent,
  }
}
