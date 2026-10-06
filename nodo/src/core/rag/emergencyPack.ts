import { ingestDocument, type IngestProgress } from './ingest'
import { getSetting, setSetting } from '../db/repo'

const EMERGENCY_FILES = [
  {
    name: 'primeros_auxilios.md',
    url: '/packs/emergencia/primeros_auxilios.md',
  },
  {
    name: 'purificacion_agua.md',
    url: '/packs/emergencia/purificacion_agua.md',
  },
  {
    name: 'refugio_supervivencia.md',
    url: '/packs/emergencia/refugio_supervivencia.md',
  },
]

export async function isEmergencyPackInstalled(): Promise<boolean> {
  const installed = await getSetting<boolean>('emergencyPackInstalled' as any)
  return Boolean(installed)
}

export async function installEmergencyPack(
  onProgress?: (fileName: string, progress: IngestProgress) => void
): Promise<void> {
  for (const item of EMERGENCY_FILES) {
    const response = await fetch(item.url)
    if (!response.ok) {
      throw new Error(`No se pudo cargar el archivo ${item.name} del paquete.`)
    }
    const text = await response.text()
    const file = new File([text], item.name, { type: 'text/markdown' })

    await ingestDocument(file, (p) => {
      onProgress?.(item.name, p)
    })
  }

  await setSetting('emergencyPackInstalled' as any, true)
}
