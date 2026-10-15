
export interface CodeExecutionResult {
  success: boolean
  logs: string[]
  result?: string
  error?: string
  executionTimeMs: number
  benchmark?: {
    name: string
    iterations: number
    totalTimeMs: number
    opsPerSec: number
  }[]
}

/** Sesión de variables persistentes en el REPL / Terminal */
export const globalSandboxSession: Record<string, any> = {}

/**
 * Transpilador y emulador offline de Python a JavaScript.
 * Soporta funciones (def), bucles (for/while), condicionales (if/elif/else),
 * print, len, range, math, list methods (.append, .extend, .pop), abs, round, etc.
 */
export function transpilePythonToJs(pyCode: string): string {
  const lines = pyCode.split('\n')
  const jsLines: string[] = []
  const indentStack: number[] = [0]

  for (const rawLine of lines) {
    const trimmed = rawLine.trim()
    if (!trimmed || trimmed.startsWith('#')) {
      jsLines.push(trimmed.startsWith('#') ? `// ${trimmed.slice(1)}` : '')
      continue
    }

    const indent = rawLine.search(/\S/)
    while (indentStack.length > 1 && indent < indentStack[indentStack.length - 1]!) {
      indentStack.pop()
      jsLines.push(' '.repeat(indentStack[indentStack.length - 1] ?? 0) + '}')
    }

    let line = trimmed

    // Reemplazos léxicos de Python a JS
    line = line.replace(/\bTrue\b/g, 'true')
    line = line.replace(/\bFalse\b/g, 'false')
    line = line.replace(/\bNone\b/g, 'null')
    line = line.replace(/\band\b/g, '&&')
    line = line.replace(/\bor\b/g, '||')
    line = line.replace(/\bnot\b/g, '!')
    line = line.replace(/\bprint\s*\(/g, 'console.log(')
    line = line.replace(/\blen\s*\(([^)]+)\)/g, 'len($1)')
    line = line.replace(/\babs\s*\(([^)]+)\)/g, 'abs($1)')
    line = line.replace(/\bstr\s*\(([^)]+)\)/g, 'String($1)')
    line = line.replace(/\bint\s*\(([^)]+)\)/g, 'parseInt(String($1), 10)')
    line = line.replace(/\bfloat\s*\(([^)]+)\)/g, 'parseFloat(String($1))')
    line = line.replace(/\bmath\.pi\b/g, 'Math.PI')
    line = line.replace(/\bmath\.sqrt\b/g, 'Math.sqrt')
    line = line.replace(/\bmath\.sin\b/g, 'Math.sin')
    line = line.replace(/\bmath\.cos\b/g, 'Math.cos')
    line = line.replace(/\bmath\.tan\b/g, 'Math.tan')
    line = line.replace(/\bmath\.pow\b/g, 'Math.pow')
    line = line.replace(/\bmath\.floor\b/g, 'Math.floor')
    line = line.replace(/\bmath\.ceil\b/g, 'Math.ceil')
    line = line.replace(/\bmath\.exp\b/g, 'Math.exp')
    line = line.replace(/\bmath\.log\b/g, 'Math.log')

    // Control de flujo estructurado de bloques con dos puntos
    if (line.endsWith(':')) {
      const header = line.slice(0, -1).trim()
      const currentIndent = ' '.repeat(indent)

      if (/^def\s+/.test(header)) {
        const m = header.match(/^def\s+([a-zA-Z0-9_]+)\s*\((.*)\)/)
        if (m) {
          jsLines.push(`${currentIndent}function ${m[1]}(${m[2]}) {`)
          indentStack.push(indent + 4)
          continue
        }
      }

      if (/^for\s+/.test(header)) {
        const mRange = header.match(/^for\s+([a-zA-Z0-9_]+)\s+in\s+range\((.*)\)/)
        if (mRange) {
          const varName = mRange[1]
          const args = mRange[2]!.split(',').map((s) => s.trim())
          if (args.length === 1) {
            jsLines.push(`${currentIndent}for (let ${varName} = 0; ${varName} < ${args[0]}; ${varName}++) {`)
          } else if (args.length === 2) {
            jsLines.push(`${currentIndent}for (let ${varName} = ${args[0]}; ${varName} < ${args[1]}; ${varName}++) {`)
          } else if (args.length >= 3) {
            jsLines.push(`${currentIndent}for (let ${varName} = ${args[0]}; ${varName} < ${args[1]}; ${varName} += ${args[2]}) {`)
          }
          indentStack.push(indent + 4)
          continue
        }

        const mIter = header.match(/^for\s+([a-zA-Z0-9_]+)\s+in\s+(.*)/)
        if (mIter) {
          jsLines.push(`${currentIndent}for (const ${mIter[1]} of ${mIter[2]}) {`)
          indentStack.push(indent + 4)
          continue
        }
      }

      if (/^while\s+/.test(header)) {
        const cond = header.replace(/^while\s+/, '')
        jsLines.push(`${currentIndent}while (${cond}) {`)
        indentStack.push(indent + 4)
        continue
      }

      if (/^if\s+/.test(header)) {
        const cond = header.replace(/^if\s+/, '')
        jsLines.push(`${currentIndent}if (${cond}) {`)
        indentStack.push(indent + 4)
        continue
      }

      if (/^elif\s+/.test(header)) {
        const cond = header.replace(/^elif\s+/, '')
        jsLines.push(`${currentIndent}else if (${cond}) {`)
        indentStack.push(indent + 4)
        continue
      }

      if (header === 'else') {
        jsLines.push(`${currentIndent}else {`)
        indentStack.push(indent + 4)
        continue
      }
    }

    jsLines.push(' '.repeat(indent) + line + (line.endsWith('{') || line.endsWith('}') ? '' : ';'))
  }

  while (indentStack.length > 1) {
    indentStack.pop()
    jsLines.push(' '.repeat(indentStack[indentStack.length - 1] ?? 0) + '}')
  }

  return jsLines.join('\n')
}

// ---------------------------------------------------------------------------
// GESTOR DEL SANDBOX AISLADO (Worker + Iframe + Watchdog + Stop)
// ---------------------------------------------------------------------------

let sandboxIframe: HTMLIFrameElement | null = null
let sandboxReady = false
let initPromise: Promise<HTMLIFrameElement> | null = null

interface PendingExecution {
  resolve: (res: CodeExecutionResult) => void
  startTime: number
  logs: string[]
  benchmarks: CodeExecutionResult['benchmark']
  onLog?: (log: string) => void
}

const activeExecutions = new Map<string, PendingExecution>()

function initSandboxRunner(): Promise<HTMLIFrameElement> {
  if (initPromise) return initPromise

  initPromise = new Promise((resolve) => {
    if (typeof document === 'undefined') return

    const existing = document.getElementById('jinx-sandbox-runner') as HTMLIFrameElement
    if (existing && existing.contentWindow) {
      sandboxIframe = existing
      sandboxReady = true
      return resolve(existing)
    }

    const iframe = document.createElement('iframe')
    iframe.id = 'jinx-sandbox-runner'
    iframe.src = '/sandbox.html'
    // Sandbox estricto sin allow-same-origin: origen null, sin acceso a NodoNative/NodoBridge
    iframe.setAttribute('sandbox', 'allow-scripts allow-modals')
    iframe.style.position = 'fixed'
    iframe.style.width = '0'
    iframe.style.height = '0'
    iframe.style.border = 'none'
    iframe.style.visibility = 'hidden'
    iframe.style.pointerEvents = 'none'

    const handleMessage = (e: MessageEvent) => {
      const data = e.data
      if (!data || typeof data !== 'object') return

      if (data.type === 'SANDBOX_READY') {
        sandboxReady = true
        sandboxIframe = iframe
        resolve(iframe)
      } else if (data.type === 'SANDBOX_LOG' && data.id) {
        const exec = activeExecutions.get(data.id)
        if (exec) {
          exec.logs.push(data.text)
          exec.onLog?.(data.text)
        }
      } else if (data.type === 'SANDBOX_BENCH' && data.id) {
        const exec = activeExecutions.get(data.id)
        if (exec && data.benchmark) {
          exec.benchmarks = exec.benchmarks || []
          exec.benchmarks.push(data.benchmark)
        }
      } else if (data.type === 'SANDBOX_RESULT' && data.id) {
        const exec = activeExecutions.get(data.id)
        if (exec) {
          activeExecutions.delete(data.id)
          exec.resolve({
            success: data.success,
            logs: data.logs && data.logs.length > 0 ? data.logs : exec.logs,
            result: data.result,
            error: data.error,
            executionTimeMs: data.executionTimeMs ?? Math.round(performance.now() - exec.startTime),
            benchmark: data.benchmarks || exec.benchmarks,
          })
        }
      } else if (data.type === 'SANDBOX_STOPPED') {
        if (data.id && activeExecutions.has(data.id)) {
          const exec = activeExecutions.get(data.id)!
          activeExecutions.delete(data.id)
          exec.resolve({
            success: false,
            logs: exec.logs,
            error: 'Ejecución detenida manualmente por el usuario.',
            executionTimeMs: Math.round(performance.now() - exec.startTime),
          })
        }
      }
    }

    window.addEventListener('message', handleMessage)
    document.body.appendChild(iframe)

    // Fallback de inicialización
    setTimeout(() => {
      if (!sandboxReady) {
        sandboxReady = true
        sandboxIframe = iframe
        resolve(iframe)
      }
    }, 1200)
  })

  return initPromise
}

/**
 * Ejecutor de código Sandbox de alto rendimiento 100% offline.
 * Ejecuta en Web Worker aislado dentro de sandbox.html (sin CSP unsafe-eval en página principal).
 * Soporta watchdog timeout y cancelación inmediata con Stop.
 */
export async function executeSandboxCode(
  code: string,
  language: 'javascript' | 'python' = 'javascript',
  timeoutMs = 8000,
  sessionContext: Record<string, any> = globalSandboxSession,
  onLog?: (log: string) => void
): Promise<CodeExecutionResult> {
  const iframe = await initSandboxRunner()
  const id = 'exec_' + Math.random().toString(36).substring(2, 9)
  const startTime = performance.now()

  return new Promise<CodeExecutionResult>((resolve) => {
    activeExecutions.set(id, {
      resolve,
      startTime,
      logs: [],
      benchmarks: [],
      onLog,
    })

    iframe.contentWindow?.postMessage(
      {
        type: language === 'python' ? 'EXECUTE_PY' : 'EXECUTE_JS',
        id,
        code,
        timeoutMs,
        session: sessionContext,
      },
      '*'
    )
  })
}

/**
 * Detiene inmediatamente la ejecución activa en el Worker del sandbox.
 */
export function stopCurrentExecution() {
  if (sandboxIframe?.contentWindow) {
    sandboxIframe.contentWindow.postMessage({ type: 'STOP' }, '*')
  }
}
