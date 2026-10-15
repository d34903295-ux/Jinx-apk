import { useEffect, useState, useRef, useCallback } from 'react'
import { Logo } from './Icon'

interface SplashScreenProps {
  onComplete: () => void
  isReady?: boolean
}

const BOOT_LOGS = [
  'INICIALIZANDO ENCLAVE LOCAL // PRIVACIDAD 100%',
  'INDEXANDO EMBEDDINGS & BASE VECTORIAL',
  'CONFIGURANDO MOTOR NATIVO GGUF / LLAMA.CPP',
  'SISTEMA OFFLINE LISTO // NODO ACTIVO',
]

export function SplashScreen({ onComplete, isReady = true }: SplashScreenProps) {
  const [stepIndex, setStepIndex] = useState(0)
  const [progress, setProgress] = useState(15)
  const [isExiting, setIsExiting] = useState(false)
  const isDoneRef = useRef(false)
  const onCompleteRef = useRef(onComplete)
  useEffect(() => {
    onCompleteRef.current = onComplete
  }, [onComplete])

  const triggerExit = useCallback(() => {
    if (isDoneRef.current) return
    isDoneRef.current = true
    setIsExiting(true)
    setTimeout(() => {
      onCompleteRef.current()
    }, 420)
  }, [])

  useEffect(() => {
    // Escuchar preferencia de movimiento reducido
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReducedMotion) {
      const quickTimer = setTimeout(triggerExit, 300)
      return () => clearTimeout(quickTimer)
    }

    const t1 = setTimeout(() => {
      setStepIndex(1)
      setProgress(45)
    }, 380)

    const t2 = setTimeout(() => {
      setStepIndex(2)
      setProgress(78)
    }, 850)

    const t3 = setTimeout(() => {
      setStepIndex(3)
      setProgress(100)
    }, 1300)

    const t4 = setTimeout(() => {
      if (isReady) {
        triggerExit()
      }
    }, 1650)

    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
      clearTimeout(t4)
    }
  }, [isReady, triggerExit])

  // Si isReady llega más tarde que el paso 3, finalizar inmediatamente
  useEffect(() => {
    if (isReady && progress >= 100 && !isDoneRef.current) {
      const exitTimer = setTimeout(triggerExit, 250)
      return () => clearTimeout(exitTimer)
    }
  }, [isReady, progress, triggerExit])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Inicializando Jinx"
      onClick={triggerExit}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') triggerExit()
      }}
      tabIndex={0}
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-between select-none overflow-hidden bg-ink-950 text-white safe-top safe-bottom safe-x transition-all duration-400 ease-[cubic-bezier(0.22,1,0.36,1)] ${
        isExiting ? 'opacity-0 scale-105 filter blur-xs pointer-events-none' : 'opacity-100 scale-100'
      }`}
    >
      {/* Fondo ambiental generativo (Google Imagen) */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <img
          src="/splash-ambient.jpg"
          alt=""
          className="w-full h-full object-cover opacity-25 mix-blend-screen filter contrast-125 scale-105 transition-transform duration-1000 ease-out"
        />
        {/* Viñeta radial y resplandor blanco puro */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_48%,rgba(255,255,255,0.12)_0%,transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,#000000_100%)]" />
      </div>

      {/* Barra superior de telemetría */}
      <header className="relative z-10 w-full max-w-md pt-8 px-6 flex items-center justify-between font-mono text-[10px] tracking-widest text-ink-500">
        <div className="flex items-center gap-2">
          <span className="size-1.5 rounded-full bg-white animate-ping" />
          <span className="text-white font-semibold uppercase">SECURE // ENCLAVE</span>
        </div>
        <span className="text-ink-400">OFFLINE v1.0</span>
      </header>

      {/* Centro: Núcleo Holográfico y Logotipo */}
      <main className="relative z-10 flex flex-col items-center justify-center my-auto px-4 max-w-sm w-full text-center">
        {/* Ensamblaje orbital */}
        <div className="relative size-44 sm:size-48 flex items-center justify-center mb-7">
          {/* Anillo exterior con coordenadas */}
          <div className="absolute inset-0 rounded-full border border-dashed border-white/20 animate-spin-slower" />

          {/* Anillo de precisión invertido */}
          <div className="absolute inset-3 rounded-full border border-dotted border-white/10 animate-spin-reverse" />

          {/* Halo de resplandor blanco sutil */}
          <div className="absolute inset-8 rounded-full bg-white/10 filter blur-md animate-breathe" />

          {/* Contenedor central circular de cristal del logotipo */}
          <div className="relative size-24 rounded-full bg-black/80 border border-white/30 backdrop-blur-xl flex items-center justify-center shadow-[0_0_40px_rgba(255,255,255,0.2)] overflow-hidden group">
            {/* Haz de barrido óptico (scanline) */}
            <div className="absolute inset-x-0 h-4 bg-linear-to-b from-transparent via-white/20 to-transparent pointer-events-none animate-scanline" />

            {/* Logo Jinx */}
            <div className="relative z-10 transition-transform duration-300">
              <Logo size={54} />
            </div>
          </div>
        </div>

        {/* Título y Clasificación */}
        <div className="flex flex-col items-center gap-1.5 mb-6">
          <h1 className="font-display text-3xl font-extrabold tracking-widest text-white drop-shadow-[0_0_12px_rgba(255,255,255,0.2)]">
            JINX
          </h1>
          <p className="font-mono text-[10px] tracking-[0.28em] text-white/80 uppercase font-semibold">
            SOVEREIGN INTELLIGENCE
          </p>
        </div>

        {/* Secuencia diagnóstica de arranque */}
        <div className="w-full bg-black/60 border border-white/[0.12] rounded-xl p-3 backdrop-blur-md flex flex-col gap-2.5">
          <div className="flex items-center justify-between font-mono text-[10px] text-ink-400">
            <span className="flex items-center gap-1.5 text-white font-medium truncate">
              <span className="size-1 rounded-full bg-white" />
              {BOOT_LOGS[stepIndex]}
            </span>
            <span className="shrink-0 font-bold ml-2 text-white">{progress}%</span>
          </div>

          {/* Barra de progreso de alta tecnología */}
          <div className="h-1.5 w-full bg-black/90 rounded-full overflow-hidden p-[1px] border border-white/[0.1]">
            <div
              className="h-full bg-linear-to-r from-white/40 via-white to-white rounded-full transition-all duration-300 ease-out relative"
              style={{ width: `${progress}%` }}
            >
              <div className="absolute right-0 top-0 bottom-0 w-2 bg-white rounded-full shadow-[0_0_8px_rgba(255,255,255,0.9)]" />
            </div>
          </div>
        </div>
      </main>

      {/* Pie de pantalla / Atajo para omitir */}
      <footer className="relative z-10 w-full max-w-md pb-8 px-6 flex flex-col items-center gap-2">
        <span className="font-mono text-[10px] uppercase tracking-wider text-ink-500 hover:text-ink-400 transition cursor-pointer">
          Toca en cualquier parte para continuar
        </span>
        <div className="flex items-center gap-1.5 text-[9px] font-mono text-ink-600">
          <span>MEMORIA LOCAL</span>
          <span>•</span>
          <span>SIN CONEXIÓN EXTERNA</span>
          <span>•</span>
          <span>ENCRIPTADO</span>
        </div>
      </footer>
    </div>
  )
}
