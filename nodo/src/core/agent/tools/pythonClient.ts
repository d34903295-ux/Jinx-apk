export interface PythonExecutionResult {
  success: boolean
  output?: string
  error?: string
}

class PythonRunner {
  private worker: Worker | null = null
  private currentId = 0
  private callbacks = new Map<
    number,
    { resolve: (r: PythonExecutionResult) => void; timer: ReturnType<typeof setTimeout> }
  >()

  private getWorker(): Worker {
    if (!this.worker) {
      this.worker = new Worker(new URL('./python.worker.ts', import.meta.url), { type: 'module' })
      this.worker.onmessage = (e: MessageEvent) => {
        const { id, success, output, error } = e.data
        if (this.callbacks.has(id)) {
          const { resolve, timer } = this.callbacks.get(id)!
          clearTimeout(timer)
          this.callbacks.delete(id)
          resolve({ success, output, error })
        }
      }
    }
    return this.worker
  }

  private resetWorker(): void {
    if (this.worker) {
      this.worker.terminate()
      this.worker = null
    }
    // Rechazar promesas pendientes
    this.callbacks.forEach(({ resolve, timer }) => {
      clearTimeout(timer)
      resolve({ success: false, error: 'Worker reiniciado por tiempo de espera excedido' })
    })
    this.callbacks.clear()
  }

  async run(code: string, timeoutMs = 15000): Promise<PythonExecutionResult> {
    const id = ++this.currentId
    const worker = this.getWorker()

    return new Promise<PythonExecutionResult>((resolve) => {
      const timer = setTimeout(() => {
        this.resetWorker()
        resolve({
          success: false,
          error: `Tiempo límite de ejecución excedido (${timeoutMs / 1000}s). El hilo fue reiniciado.`,
        })
      }, timeoutMs)

      this.callbacks.set(id, { resolve, timer })
      worker.postMessage({ id, code })
    })
  }
}

export const pythonRunner = new PythonRunner()
