/** Cuota de almacenamiento y persistencia (para que el navegador no borre los modelos). */

export interface StorageInfo {
  usageBytes: number | null
  quotaBytes: number | null
  persisted: boolean
}

export async function getStorageInfo(): Promise<StorageInfo> {
  const storage = navigator.storage
  if (!storage?.estimate) return { usageBytes: null, quotaBytes: null, persisted: false }
  const [estimate, persisted] = await Promise.all([
    storage.estimate(),
    storage.persisted ? storage.persisted() : Promise.resolve(false),
  ])
  return {
    usageBytes: estimate.usage ?? null,
    quotaBytes: estimate.quota ?? null,
    persisted,
  }
}

/** Pide almacenamiento persistente. Devuelve true si el navegador lo concede. */
export async function requestPersistence(): Promise<boolean> {
  if (!navigator.storage?.persist) return false
  if (await navigator.storage.persisted()) return true
  return navigator.storage.persist()
}

export function formatBytes(bytes: number | null): string {
  if (bytes === null) return '—'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit++
  }
  return `${value.toFixed(value >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`
}
