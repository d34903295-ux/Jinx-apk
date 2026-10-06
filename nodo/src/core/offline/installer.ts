import { getSetting, setSetting } from '../db/repo'
import { llm, type LoadProgress } from '../llm/llmClient'
import { requestPersistence } from './storage'

/** Asistente de instalación: el ÚNICO momento en que la app usa internet. */

export async function installModel(
  modelId: string,
  onProgress?: (p: LoadProgress) => void,
): Promise<void> {
  // Pedir persistencia antes de descargar cientos de MB para que el navegador no los borre.
  await requestPersistence()
  try {
    await llm.load(modelId, onProgress)
  } catch (err) {
    const e = err as Error
    if (e?.message?.includes('WebGPU')) {
      throw new Error('Tu dispositivo no soporta WebGPU. Prueba un modelo más pequeño o actualiza Android.')
    }
    throw new Error(`No se pudo descargar el modelo: ${e?.message ?? 'error desconocido'}`)
  }
  await setSetting('activeModel', modelId)
}

export interface OfflineStatus {
  /** El service worker tiene la app en caché (siempre false en `npm run dev`). */
  appCached: boolean
  /** El modelo activo está completo en la Cache API. */
  modelCached: boolean
  modelId: string | null
}

export async function getOfflineStatus(): Promise<OfflineStatus> {
  const modelId = (await getSetting<string>('activeModel')) ?? null
  let appCached = false
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.getRegistration()
      appCached = Boolean(reg?.active)
    } catch {
      appCached = false
    }
  }
  let modelCached = false
  try {
    modelCached = modelId ? await llm.isCached(modelId) : false
  } catch {
    modelCached = false
  }
  return { appCached, modelCached, modelId }
}
