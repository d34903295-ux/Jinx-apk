/**
 * Pipeline de procesamiento y detección de código generado por IA.
 * 
 * Cumple estrictamente:
 * 1. Extrae el bloque ```lang ... ``` más grande y elimina los fences.
 * 2. Detecta lenguaje: <!DOCTYPE/<html/<body => html; def/import/print( => python; resto => js.
 * 3. Identifica intenciones de generación de código (codegen).
 */

export type SupportedLanguage = 'html' | 'python' | 'javascript'

export interface ExtractedCodeResult {
  code: string
  detectedLang: SupportedLanguage
  hintedLang: string
  hasFences: boolean
  lineCount: number
  title: string
}

/**
 * Extrae el bloque ```lang ... ``` más grande del texto y limpia totalmente los fences.
 * Si no hay fences, utiliza el texto completo tras limpiar posibles marcas residuales.
 */
export function extractCodeBlock(raw: string, queryContext?: string): ExtractedCodeResult {
  if (!raw || !raw.trim()) {
    return {
      code: '',
      detectedLang: 'html',
      hintedLang: '',
      hasFences: false,
      lineCount: 0,
      title: 'Código',
    }
  }

  const trimmed = raw.trim()
  const fenceRegex = /```([a-zA-Z0-9_-]*)\s*\n?([\s\S]*?)```/g
  const matches: { lang: string; body: string }[] = []

  let m: RegExpExecArray | null
  while ((m = fenceRegex.exec(trimmed)) !== null) {
    if (m[2] !== undefined) {
      matches.push({
        lang: (m[1] || '').trim().toLowerCase(),
        body: m[2],
      })
    }
  }

  let code = ''
  let hintedLang = ''
  let hasFences = false

  if (matches.length > 0) {
    // Tomar el bloque con mayor longitud de caracteres (el código principal)
    matches.sort((a, b) => b.body.length - a.body.length)
    const best = matches[0]!
    hintedLang = best.lang
    code = best.body
    hasFences = true
  } else {
    // Caso de bloque no cerrado (corte de tokens o streaming)
    const unclosed = trimmed.match(/```([a-zA-Z0-9_-]*)\s*\n?([\s\S]+)$/)
    if (unclosed && unclosed[2]) {
      hintedLang = (unclosed[1] || '').trim().toLowerCase()
      code = unclosed[2]
      hasFences = true
    } else {
      // Sin fences: usar el texto completo
      code = trimmed
      hasFences = false
    }
  }

  // Limpieza estricta: retirar cualquier fence residual al inicio o al final
  code = code
    .replace(/^```[a-zA-Z0-9_-]*\s*\n?/i, '')
    .replace(/\n?```\s*$/i, '')
    .trim()

  // Detección precisa de lenguaje
  const detectedLang = detectLanguage(code, hintedLang, queryContext)
  const lineCount = code ? code.split('\n').length : 0

  // Generar título descriptivo
  let title = 'Proyecto de Código'
  if (detectedLang === 'html') {
    title = 'Aplicación Web / UI'
  } else if (detectedLang === 'python') {
    title = 'Script Python'
  } else {
    title = 'Script JavaScript'
  }

  if (queryContext) {
    const qLower = queryContext.toLowerCase()
    if (qLower.includes('calculadora')) title = 'Calculadora ' + (detectedLang === 'html' ? 'HTML' : detectedLang.toUpperCase())
    else if (qLower.includes('juego')) title = 'Juego Interactivo'
    else if (qLower.includes('reloj')) title = 'Reloj Digital'
    else if (qLower.includes('contador')) title = 'Contador'
    else if (qLower.includes('formulario')) title = 'Formulario Web'
  }

  return {
    code,
    detectedLang,
    hintedLang,
    hasFences,
    lineCount,
    title,
  }
}

/**
 * Detecta el lenguaje de programación según reglas explícitas:
 * - <!DOCTYPE / <html / <body / tags HTML => 'html' (pestaña UI)
 * - def / import / print( / from => 'python' (pestaña PY)
 * - resto => 'javascript' (pestaña JS)
 */
export function detectLanguage(
  code: string,
  hintedLang?: string,
  queryContext?: string
): SupportedLanguage {
  const c = code.trim()
  const lower = c.toLowerCase()
  const hint = (hintedLang || '').toLowerCase()
  const qLower = (queryContext || '').toLowerCase()

  // 1. Detección HTML / UI:
  // Si contiene marcas estructurales HTML o hint de HTML
  const hasHtmlTags =
    lower.includes('<!doctype') ||
    lower.includes('<html') ||
    lower.includes('<body') ||
    lower.includes('<head') ||
    lower.includes('<script') ||
    lower.includes('<style') ||
    lower.includes('<div') ||
    lower.includes('<canvas') ||
    lower.includes('<button') ||
    /<\/?[a-z][a-z0-9]*[^<>]*>/i.test(c)

  if (hint === 'html' || hint === 'htm' || hasHtmlTags) {
    return 'html'
  }

  // 2. Detección Python:
  // Palabras clave típicas de Python
  const hasPythonKeywords =
    /^(def\s+[a-zA-Z0-9_]+\s*\(|import\s+[a-zA-Z0-9_]+|from\s+[a-zA-Z0-9_]+\s+import|print\s*\()/m.test(c) ||
    /\b(print\s*\(|for\s+[a-zA-Z0-9_]+\s+in\s+range\b|if\s+__name__\s*==\s*['"]__main__['"])/.test(c)

  if (hint === 'python' || hint === 'py' || hasPythonKeywords) {
    return 'python'
  }

  // 3. Chequeo por contexto si el código es ambiguo
  if (qLower.includes('html') || qLower.includes('página') || qLower.includes('pagina') || qLower.includes('interfaz') || qLower.includes('css')) {
    if (c.includes('<') && c.includes('>')) return 'html'
  }

  if (qLower.includes('python') || qLower.includes('pyodide') || qLower.includes('script python')) {
    return 'python'
  }

  // 4. Por defecto, JavaScript
  return 'javascript'
}

/**
 * Comprueba si la consulta del usuario es una intención de generación de código (codegen).
 */
export function isCodeGenQuery(text: string): boolean {
  if (!text || !text.trim()) return false
  const t = text.toLowerCase()

  // Patrón principal: (genera/crea/hazme/...) + (html/app/script/calculadora/página/...)
  const actionWord = /\b(genera|crea|hazme|construye|escribe|crear|generar|hacer|diseña|programa)\b/i
  const targetWord = /\b(html|app|script|calculadora|página|pagina|juego|interfaz|componente|código|codigo|web|canvas)\b/i

  if (actionWord.test(t) && targetWord.test(t)) {
    return true
  }

  // Patrones directos como "calculadora en html", "hazme una calculadora"
  if (
    /^(hazme|crea|genera)\s+un[a]?\s+(calculadora|juego|reloj|contador|formulario|lista|conversor|app|script|página|pagina)/i.test(t) ||
    /\b(calculadora|app|juego|script|pagina|página)\s+(en|con)\s+(html|js|javascript|python|css)\b/i.test(t)
  ) {
    return true
  }

  return false
}
