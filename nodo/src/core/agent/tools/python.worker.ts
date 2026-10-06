import { loadPyodide, type PyodideInterface } from 'pyodide'

let pyodide: PyodideInterface | null = null
let loadingPromise: Promise<PyodideInterface> | null = null

async function getPyodide(): Promise<PyodideInterface> {
  if (pyodide) return pyodide
  if (loadingPromise) return loadingPromise

  loadingPromise = loadPyodide({
    indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/',
  }).then((res) => {
    pyodide = res
    return res
  })

  return loadingPromise
}

self.onmessage = async (e: MessageEvent) => {
  const { id, code } = e.data
  try {
    const py = await getPyodide()

    // Redirigir stdout y stderr a buffers en memoria
    py.runPython(`
import sys
import io
_sys_out = io.StringIO()
_sys_err = io.StringIO()
sys.stdout = _sys_out
sys.stderr = _sys_err
`)

    let output = ''
    let error: string | null = null

    try {
      const evalResult = await py.runPythonAsync(code)
      const stdout = py.runPython('_sys_out.getvalue()')
      const stderr = py.runPython('_sys_err.getvalue()')

      const parts = [
        stdout?.trim(),
        stderr?.trim(),
        evalResult !== undefined && evalResult !== null ? String(evalResult).trim() : '',
      ].filter(Boolean)

      output = parts.join('\n') || '(Código ejecutado con éxito sin salida)'
    } catch (err: unknown) {
      const stderr = py.runPython('_sys_err.getvalue()')
      const msg = err instanceof Error ? err.message : String(err)
      error = [stderr?.trim(), msg].filter(Boolean).join('\n')
    }

    if (error) {
      self.postMessage({ id, success: false, error })
    } else {
      self.postMessage({ id, success: true, output })
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    self.postMessage({ id, success: false, error: msg })
  }
}
