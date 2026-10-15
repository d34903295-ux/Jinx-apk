import { useEffect, useRef, useState } from 'react'
import {
  Cpu,
  FileText,
  Terminal,
  Shield,
  WifiOff,
  Zap,
  Activity,
  Layers,
  Database,
  Radio,
  Flame,
  CheckCircle2,
} from 'lucide-react'

interface JinxScreenCard {
  id: string
  tag: string
  title: string
  icon: typeof Cpu
  accent: string
  badge: string
  previewType: 'chat' | 'rag' | 'code' | 'survival' | 'metrics' | 'vault'
  snippet: {
    line1: string
    line2?: string
    highlight?: string
    sub?: string
  }
}

const ROW1_CARDS: JinxScreenCard[] = [
  {
    id: 'c1',
    tag: 'WEBGPU NEURAL INFERENCE',
    title: 'On-Device Token Stream',
    icon: Cpu,
    accent: '#00f5a0',
    badge: '0ms SERVER LATENCY',
    previewType: 'chat',
    snippet: {
      line1: 'Prompt: Solar compass calculation without GPS',
      line2: 'Jinx: Plant stick vertically. Mark shadow tip T1, wait 15m for T2. Line T1-T2 forms exact East-West axis.',
      highlight: 'TOKEN STREAM · 28 tok/s · LOCAL GPU',
    },
  },
  {
    id: 'c2',
    tag: 'NOTEBOOKLM VECTOR RAG',
    title: 'Page-Level Interactive Citations',
    icon: FileText,
    accent: '#7621B0',
    badge: '384-DIM EMBEDDINGS',
    previewType: 'rag',
    snippet: {
      line1: 'Document: Wilderness_Emergency_Protocol.pdf',
      line2: 'Answer: Grade 2 Hypothermia requires passive rewarming [1] and warm sweet fluids [2].',
      highlight: 'CITATION [1] -> Page 42, §3.2 Verified',
    },
  },
  {
    id: 'c3',
    tag: 'PYODIDE WASM SANDBOX',
    title: 'Scientific Python Runtime',
    icon: Terminal,
    accent: '#B600A8',
    badge: '15s WATCHDOG SAFETY',
    previewType: 'code',
    snippet: {
      line1: '>>> import numpy as np; import scipy',
      line2: '>>> def calc_trajectory(v0, angle): ...',
      highlight: 'STDOUT: Trajectory mapped. 1,000 steps in 12ms',
    },
  },
  {
    id: 'c4',
    tag: 'DISASTER RESILIENCE',
    title: 'Emergency Medical Dossier',
    icon: Flame,
    accent: '#BE4C00',
    badge: '100% PRE-INDEXED',
    previewType: 'survival',
    snippet: {
      line1: 'Triage: Arterial Hemorrhage / Tourniquet placement',
      line2: 'Protocol: 2-3 inches proximal to wound. Note exact UTC application timestamp.',
      highlight: 'OFF-GRID PACK · MEDICAL & TRIAGE READY',
    },
  },
  {
    id: 'c5',
    tag: 'LOCAL HARDWARE VAULT',
    title: 'Zero-Cloud IndexedDB Memory',
    icon: Database,
    accent: '#00f5a0',
    badge: '0 BYTES TELEMETRY',
    previewType: 'vault',
    snippet: {
      line1: 'Encrypted storage: notes, vector chunks, chat sessions',
      line2: 'Status: Cryptographic local persistence on Android device memory',
      highlight: 'NO SERVER LOGS · TAMPER-PROOF',
    },
  },
  {
    id: 'c6',
    tag: 'NEURAL ACCELERATION',
    title: 'Native Llama-3.2 Engine',
    icon: Zap,
    accent: '#7621B0',
    badge: '4-BIT QUANTIZED',
    previewType: 'metrics',
    snippet: {
      line1: 'Model: Llama-3.2-1B-Instruct-q4f16_1',
      line2: 'Memory footprint: 840 MB RAM · Direct WebGPU buffer bind',
      highlight: 'HARDWARE COMPUTE · ZERO NETWORK REQUIRED',
    },
  },
]

const ROW2_CARDS: JinxScreenCard[] = [
  {
    id: 'c7',
    tag: 'SOVEREIGN INTELLIGENCE',
    title: '100% Airplane Mode Verified',
    icon: WifiOff,
    accent: '#00f5a0',
    badge: 'AIRPLANE MODE ACTIVE',
    previewType: 'chat',
    snippet: {
      line1: 'Signal: 0 Bars · Cellular OFF · Wi-Fi OFF · Bluetooth OFF',
      line2: 'Jinx Core: FULL CAPABILITIES ONLINE',
      highlight: 'SYSTEM OPERATING 100% DISCONNECTED',
    },
  },
  {
    id: 'c8',
    tag: 'AUTONOMOUS AGENT TOOLS',
    title: 'Multi-Step Tool Orchestration',
    icon: Layers,
    accent: '#B600A8',
    badge: 'AUTONOMOUS EXECUTION',
    previewType: 'code',
    snippet: {
      line1: 'Agent Plan: [1] Parse PDF -> [2] Run Python calculation -> [3] Save to Notes',
      line2: 'Tool result: save_note(id=482, title="Fibonacci Sequence") -> SUCCESS',
      highlight: 'ALL TOOLS EXECUTED IN LOCAL RAM',
    },
  },
  {
    id: 'c9',
    tag: 'OFF-GRID KNOWLEDGE',
    title: 'Water Purification & Shelter',
    icon: Radio,
    accent: '#BE4C00',
    badge: 'FIELD SURVIVAL PACK',
    previewType: 'survival',
    snippet: {
      line1: 'Manual: Solar Still distillation & SODIS ultraviolet protocol',
      line2: 'Procedure: 6 hours direct solar exposure in PET clear bottle',
      highlight: 'INSTANT ACCESS WITHOUT SEARCH ENGINES',
    },
  },
  {
    id: 'c10',
    tag: 'SECURITY ARCHITECTURE',
    title: 'Hardware Sovereign Sandbox',
    icon: Shield,
    accent: '#7621B0',
    badge: 'ZERO EXTERNAL CALLS',
    previewType: 'vault',
    snippet: {
      line1: 'Network Audit: 0 outgoing HTTP requests, 0 telemetry beacons',
      line2: 'Policy: CSP connect-src restricted to local blob & data URIs',
      highlight: '100% CONFIDENTIAL & AIR-GAPPED',
    },
  },
  {
    id: 'c11',
    tag: 'SMOOTH STREAMING',
    title: '60 FPS Non-Blocking Web Workers',
    icon: Activity,
    accent: '#00f5a0',
    badge: 'DEDICATED WORKER THREADS',
    previewType: 'metrics',
    snippet: {
      line1: 'Inference thread decoupled from UI thread',
      line2: 'Interface remains fluid and responsive during intense tensor compute',
      highlight: '60 FPS FLUID MOTION · ZERO JANK',
    },
  },
  {
    id: 'c12',
    tag: 'ANDROID DISTRIBUTION',
    title: 'Native APK Distribution',
    icon: CheckCircle2,
    accent: '#B600A8',
    badge: 'PHYSICAL DEVICE READY',
    previewType: 'chat',
    snippet: {
      line1: 'Package: com.example.jinx (Jinx-app.apk)',
      line2: 'Architecture: ARM64-v8a native WebView WebGPU acceleration',
      highlight: 'DOWNLOAD ONCE · RUN FOREVER',
    },
  },
]

// Tripled lists for seamless scrolling
const ROW1_TRIPLED = [...ROW1_CARDS, ...ROW1_CARDS, ...ROW1_CARDS]
const ROW2_TRIPLED = [...ROW2_CARDS, ...ROW2_CARDS, ...ROW2_CARDS]

function MarqueeCard({ card }: { card: JinxScreenCard }) {
  const Icon = card.icon
  return (
    <div className="shrink-0 w-[300px] sm:w-[360px] md:w-[420px] h-[190px] sm:h-[230px] md:h-[270px] rounded-2xl overflow-hidden bg-gradient-to-b from-[#161820] via-[#0E1017] to-[#0A0C10] border border-white/10 p-4 sm:p-5 flex flex-col justify-between shadow-xl relative group hover:border-white/30 transition-all duration-300">
      {/* Background Subtle Gradient Glow */}
      <div
        className="absolute -top-12 -right-12 size-36 rounded-full blur-3xl opacity-20 pointer-events-none transition-opacity duration-500 group-hover:opacity-40"
        style={{ backgroundColor: card.accent }}
      />

      {/* Top Header Bar */}
      <div className="flex items-center justify-between w-full border-b border-white/[0.08] pb-3 relative z-10">
        <div className="flex items-center gap-2">
          <div className="size-6 sm:size-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
            <Icon className="size-3.5 sm:size-4" style={{ color: card.accent }} />
          </div>
          <div>
            <span className="text-[10px] font-mono tracking-widest text-[#D7E2EA]/50 block uppercase">
              {card.tag}
            </span>
            <h4 className="text-xs sm:text-sm font-semibold text-[#D7E2EA] tracking-tight leading-tight">
              {card.title}
            </h4>
          </div>
        </div>
        <span
          className="text-[9px] sm:text-[10px] font-mono uppercase px-2 py-0.5 rounded-full border tracking-wider"
          style={{
            borderColor: `${card.accent}40`,
            backgroundColor: `${card.accent}15`,
            color: card.accent,
          }}
        >
          {card.badge}
        </span>
      </div>

      {/* Middle Content Preview */}
      <div className="flex flex-col gap-1.5 my-auto relative z-10 font-mono text-[11px] sm:text-xs">
        <div className="text-[#D7E2EA]/80 font-medium truncate">
          {card.snippet.line1}
        </div>
        {card.snippet.line2 && (
          <div className="text-[#D7E2EA]/60 text-[10px] sm:text-[11px] leading-relaxed line-clamp-2">
            {card.snippet.line2}
          </div>
        )}
      </div>

      {/* Bottom Highlight Badge */}
      <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between text-[10px] sm:text-[11px] font-mono relative z-10">
        <span className="text-[#00f5a0] flex items-center gap-1.5 font-semibold">
          <span className="size-1.5 rounded-full bg-[#00f5a0] animate-pulse" />
          {card.snippet.highlight}
        </span>
        <span className="text-white/30 text-[9px]">JINX // OFFLINE</span>
      </div>
    </div>
  )
}

export function MarqueeSection() {
  const sectionRef = useRef<HTMLElement>(null)
  const [scrollOffset, setScrollOffset] = useState(0)

  useEffect(() => {
    const handleScroll = () => {
      if (!sectionRef.current) return
      const rect = sectionRef.current.getBoundingClientRect()
      const sectionTop = rect.top + window.scrollY
      const offset = (window.scrollY - sectionTop + window.innerHeight) * 0.3
      setScrollOffset(offset)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()

    return () => {
      window.removeEventListener('scroll', handleScroll)
    }
  }, [])

  return (
    <section
      ref={sectionRef}
      className="w-full bg-[#0C0C0C] pt-24 sm:pt-32 md:pt-40 pb-10 overflow-hidden font-kanit"
    >
      <div className="flex flex-col gap-3">
        {/* Row 1: Moves RIGHT on scroll */}
        <div
          className="flex gap-3"
          style={{
            transform: `translateX(${scrollOffset - 200}px)`,
            willChange: 'transform',
          }}
        >
          {ROW1_TRIPLED.map((card, idx) => (
            <MarqueeCard key={`r1-${idx}`} card={card} />
          ))}
        </div>

        {/* Row 2: Moves LEFT on scroll */}
        <div
          className="flex gap-3"
          style={{
            transform: `translateX(${-(scrollOffset - 200)}px)`,
            willChange: 'transform',
          }}
        >
          {ROW2_TRIPLED.map((card, idx) => (
            <MarqueeCard key={`r2-${idx}`} card={card} />
          ))}
        </div>
      </div>
    </section>
  )
}

export default MarqueeSection
