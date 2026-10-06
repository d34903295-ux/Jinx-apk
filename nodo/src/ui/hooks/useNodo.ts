import { useEffect, useState, useSyncExternalStore } from 'react'
import { llm, type LLMState } from '../../core/llm/llmClient'
import { getOfflineStatus, type OfflineStatus } from '../../core/offline/installer'

/** Estado reactivo del LLM (carga, generación, errores). */
export function useLLM(): LLMState {
  return useSyncExternalStore(llm.subscribe, llm.getState)
}

/** true si el navegador reporta conexión de red. */
export function useOnline(): boolean {
  const [online, setOnline] = useState(() => navigator.onLine)
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])
  return online
}

/** Estado de preparación offline; se recalcula cuando cambia `refreshKey`. */
export function useOfflineStatus(refreshKey: unknown): OfflineStatus | null {
  const [status, setStatus] = useState<OfflineStatus | null>(null)
  useEffect(() => {
    let alive = true
    const check = () =>
      getOfflineStatus()
        .then((s) => alive && setStatus(s))
        .catch(() => alive && setStatus(null))
    void check()
    // El service worker puede activarse unos segundos después de la primera carga.
    navigator.serviceWorker?.addEventListener('controllerchange', check)
    return () => {
      alive = false
      navigator.serviceWorker?.removeEventListener('controllerchange', check)
    }
  }, [refreshKey])
  return status
}
