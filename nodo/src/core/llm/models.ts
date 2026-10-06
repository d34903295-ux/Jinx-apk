/**
 * Catálogo de modelos y detección de hardware.
 *
 * Los IDs están verificados contra `prebuiltAppConfig.model_list` de @mlc-ai/web-llm 0.2.85.
 * Las cifras de VRAM salen de `vram_required_MB` de ese mismo catálogo.
 * - q4f16: más rápido y ligero, requiere la feature WebGPU `shader-f16`.
 * - q4f32: respaldo para GPUs sin `shader-f16` (habitual en móviles).
 */

export type ModelTier = 'minimo' | 'ligero' | 'potente' | 'pc'

export interface ModelOption {
  tier: ModelTier
  label: string
  description: string
  /** ID base sin el sufijo de cuantización. */
  baseId: string
  vramF16MB: number
  /** null = no hay variante q4f32 en el catálogo. */
  vramF32MB: number | null
}

export const MODELS: readonly ModelOption[] = [
  {
    tier: 'minimo',
    label: 'Llama 3.2 · 1B',
    description: 'El más pequeño. Para teléfonos modestos.',
    baseId: 'Llama-3.2-1B-Instruct',
    vramF16MB: 879,
    vramF32MB: 1129,
  },
  {
    tier: 'ligero',
    label: 'Qwen 2.5 · 1.5B',
    description: 'Equilibrado y bueno en español. Ideal para móvil.',
    baseId: 'Qwen2.5-1.5B-Instruct',
    vramF16MB: 1630,
    vramF32MB: 1889,
  },
  {
    tier: 'potente',
    label: 'Qwen 2.5 · 3B',
    description: 'Respuestas más sólidas. PC o móvil de gama alta.',
    baseId: 'Qwen2.5-3B-Instruct',
    vramF16MB: 2505,
    vramF32MB: 2894,
  },
  {
    tier: 'pc',
    label: 'Qwen 2.5 · 7B',
    description: 'El más capaz. Solo PC con GPU dedicada.',
    baseId: 'Qwen2.5-7B-Instruct',
    vramF16MB: 5107,
    vramF32MB: null,
  },
]

export function modelIdFor(option: ModelOption, shaderF16: boolean): string | null {
  if (shaderF16) return `${option.baseId}-q4f16_1-MLC`
  return option.vramF32MB === null ? null : `${option.baseId}-q4f32_1-MLC`
}

export function vramFor(option: ModelOption, shaderF16: boolean): number | null {
  return shaderF16 ? option.vramF16MB : option.vramF32MB
}

/** Etiqueta legible para un ID completo (p. ej. el modelo activo guardado). */
export function labelForModelId(modelId: string): string {
  const option = MODELS.find((m) => modelId.startsWith(`${m.baseId}-`))
  return option?.label ?? modelId
}

// ---------- Hardware ----------

export interface HardwareInfo {
  webgpu: boolean
  shaderF16: boolean
  gpuName: string | null
  /** RAM aproximada en GB (null si el navegador no lo expone). */
  memoryGB: number | null
  isMobile: boolean
}

export async function detectHardware(): Promise<HardwareInfo> {
  const isMobile =
    navigator.userAgentData?.mobile ?? /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
  const memoryGB = navigator.deviceMemory ?? null

  if (!('gpu' in navigator) || !navigator.gpu) {
    return { webgpu: false, shaderF16: false, gpuName: null, memoryGB, isMobile }
  }
  try {
    const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' })
    if (!adapter) return { webgpu: false, shaderF16: false, gpuName: null, memoryGB, isMobile }
    const info = adapter.info
    const gpuName = [info?.vendor, info?.architecture].filter(Boolean).join(' ') || null
    return {
      webgpu: true,
      shaderF16: adapter.features.has('shader-f16'),
      gpuName,
      memoryGB,
      isMobile,
    }
  } catch {
    return { webgpu: false, shaderF16: false, gpuName: null, memoryGB, isMobile }
  }
}

/** Recomendación conservadora: mejor un modelo que cargue que uno que falle. */
export function recommendModel(hw: HardwareInfo): ModelOption | null {
  if (!hw.webgpu) return null
  const byTier = (tier: ModelTier) => MODELS.find((m) => m.tier === tier) ?? null
  if (hw.isMobile) return hw.memoryGB !== null && hw.memoryGB <= 4 ? byTier('minimo') : byTier('ligero')
  // deviceMemory está limitado a 8 en Chrome: 8 = "8 GB o más".
  return hw.memoryGB !== null && hw.memoryGB >= 8 ? byTier('potente') : byTier('ligero')
}
