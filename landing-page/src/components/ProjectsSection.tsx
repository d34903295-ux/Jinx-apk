import { useRef } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'
import { FadeIn } from './FadeIn'
import { LiveProjectButton } from './LiveProjectButton'
import { Cpu, CheckCircle2 } from 'lucide-react'

interface FeatureShowcase {
  number: string
  category: string
  title: string
  description: string
  tag: string
  metrics: Array<{ label: string; value: string }>
  codePreview: string
  imageSrc: string
}

const SHOWCASES: FeatureShowcase[] = [
  {
    number: '01',
    category: 'ON-DEVICE NEURAL COMPUTE',
    title: 'Neural Chat & Token Stream',
    description:
      'Zero-latency, 100% offline conversational AI running quantized Llama-3.2 on local WebGPU shaders. No cloud, no telemetry, no tracking.',
    tag: 'WEBGPU // 28 TOKENS/S',
    metrics: [
      { label: 'Latency', value: '0ms Server' },
      { label: 'Privacy', value: '100% Air-gapped' },
      { label: 'Memory', value: '840 MB RAM' },
    ],
    codePreview:
      '// WebGPU local pipeline\nawait pipeline.generate({\n  prompt: "Synthesize survival protocol",\n  max_tokens: 512,\n  temperature: 0.2\n});',
    imageSrc: '/jinx_hero_visual.jpg',
  },
  {
    number: '02',
    category: 'NOTEBOOKLM ARCHITECTURE',
    title: 'Vector Document Intelligence',
    description:
      'Index heavy PDF manuals and technical dossiers locally using 384-dimensional on-device vector embeddings with interactive page citations.',
    tag: 'EMBEDDINGS // COSINE SEARCH',
    metrics: [
      { label: 'Model', value: 'all-MiniLM-L6-v2' },
      { label: 'Citations', value: 'Interactive Popover' },
      { label: 'Storage', value: 'IndexedDB Vault' },
    ],
    codePreview:
      '// Vector RAG cosine match\nconst results = await vectorStore.query({\n  query: "hypothermia protocol",\n  top_k: 3,\n  threshold: 0.78\n});',
    imageSrc: '/jinx_hero_visual.jpg',
  },
  {
    number: '03',
    category: 'OFFLINE SCIENTIFIC RUNTIME',
    title: 'Pyodide Python Sandbox',
    description:
      'Autonomous agent multi-tool orchestration with sandboxed WebAssembly Python execution. Run data science, physics, and triage algorithms offline.',
    tag: 'WASM // 15s WATCHDOG',
    metrics: [
      { label: 'Runtime', value: 'Pyodide WebAssembly' },
      { label: 'Libraries', value: 'NumPy, SciPy, Math' },
      { label: 'Watchdog', value: '15s Killswitch' },
    ],
    codePreview:
      '# Pyodide isolated execution\nimport numpy as np\ndef triangulate(beacon_a, beacon_b):\n    return np.linalg.solve(matrix, target)',
    imageSrc: '/jinx_hero_visual.jpg',
  },
]

function ShowcaseCard({
  showcase,
  index,
  totalCards,
}: {
  showcase: FeatureShowcase
  index: number
  totalCards: number
}) {
  const containerRef = useRef<HTMLDivElement>(null)

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start end', 'start start'],
  })

  // Scale down slightly as user scrolls past
  const targetScale = 1 - (totalCards - 1 - index) * 0.03
  const scale = useTransform(scrollYProgress, [0, 1], [1, targetScale])

  return (
    <div
      ref={containerRef}
      className="sticky top-24 md:top-32 w-full flex items-center justify-center"
      style={{
        top: `${96 + index * 28}px`,
      }}
    >
      <motion.div
        style={{ scale }}
        className="w-full rounded-[36px] sm:rounded-[48px] md:rounded-[60px] border-2 border-[#D7E2EA] bg-[#0C0C0C] p-5 sm:p-7 md:p-10 flex flex-col gap-6 md:gap-8 shadow-2xl relative overflow-hidden"
      >
        {/* Subtle Ambient Radial Highlight */}
        <div className="absolute top-0 right-0 w-[40vw] h-[300px] bg-gradient-to-bl from-[#7621B0]/20 via-[#00f5a0]/10 to-transparent blur-3xl pointer-events-none" />

        {/* Top Row: Number, Category, Title, Live Project CTA */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-white/10 pb-6 relative z-10">
          <div className="flex items-center gap-4 sm:gap-6">
            <span
              style={{ fontSize: 'clamp(2.5rem, 6vw, 5rem)' }}
              className="font-black leading-none text-[#D7E2EA] select-none tracking-tight font-kanit"
            >
              {showcase.number}
            </span>
            <div className="flex flex-col">
              <span className="text-xs sm:text-sm font-mono uppercase tracking-widest text-[#00f5a0] flex items-center gap-2">
                <span className="size-1.5 rounded-full bg-[#00f5a0] animate-pulse" />
                {showcase.category}
              </span>
              <h3
                style={{ fontSize: 'clamp(1.4rem, 2.5vw, 2.4rem)' }}
                className="font-black uppercase tracking-tight text-[#D7E2EA] leading-tight"
              >
                {showcase.title}
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <LiveProjectButton
              label="GET APK"
              href="/Jinx-app.apk"
              download="Jinx-app.apk"
              className="text-xs sm:text-sm py-2.5 px-6 font-mono"
            />
          </div>
        </div>

        {/* Bottom Row: Two-Column Interactive Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-6 items-stretch relative z-10">
          {/* Left Column (45% width): Specs + Code Preview */}
          <div className="md:col-span-5 flex flex-col gap-4">
            {/* Top Box: Real Telemetry Metrics */}
            <div
              style={{ minHeight: 'clamp(120px, 15vw, 180px)' }}
              className="w-full rounded-[24px] sm:rounded-[32px] p-5 bg-gradient-to-br from-white/10 via-[#141620] to-black/60 border border-white/15 backdrop-blur-xl flex flex-col justify-between"
            >
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <span className="text-[11px] font-mono uppercase tracking-wider text-[#D7E2EA]/70 flex items-center gap-1.5">
                  <Cpu className="size-3.5 text-[#00f5a0]" />
                  Telemetry
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#00f5a0]/15 text-[#00f5a0] border border-[#00f5a0]/30 font-semibold">
                  {showcase.tag}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 pt-2">
                {showcase.metrics.map((m) => (
                  <div key={m.label} className="flex flex-col">
                    <span className="text-[10px] font-mono text-white/40 uppercase">
                      {m.label}
                    </span>
                    <span className="text-xs font-mono font-bold text-white tracking-tight">
                      {m.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom Box: Real Code / Pipeline Preview */}
            <div
              style={{ minHeight: 'clamp(140px, 18vw, 240px)' }}
              className="w-full rounded-[24px] sm:rounded-[32px] p-5 bg-[#0A0C10] border border-white/10 font-mono text-[11px] sm:text-xs flex flex-col justify-between overflow-hidden shadow-inner"
            >
              <div className="flex items-center justify-between text-white/40 text-[10px] pb-2 border-b border-white/10">
                <span>LOCAL_PIPELINE.TS</span>
                <span className="text-[#00f5a0]">AIR-GAPPED</span>
              </div>
              <pre className="text-[#D7E2EA]/90 overflow-x-auto py-2 leading-relaxed font-mono">
                <code>{showcase.codePreview}</code>
              </pre>
              <div className="text-[10px] text-[#00f5a0] flex items-center gap-1 pt-1 border-t border-white/10">
                <CheckCircle2 className="size-3" />
                <span>Verified 100% on hardware</span>
              </div>
            </div>
          </div>

          {/* Right Column (55% width): Tall Visual Mockup Panel */}
          <div className="md:col-span-7 rounded-[28px] sm:rounded-[36px] md:rounded-[44px] overflow-hidden bg-gradient-to-b from-[#141622] via-[#0E1018] to-[#08090D] border border-white/15 p-6 flex flex-col justify-between min-h-[300px] relative group">
            <div className="flex items-center justify-between relative z-10">
              <span className="text-xs font-mono uppercase tracking-widest text-[#00f5a0] font-bold">
                JINX UI PREVIEW
              </span>
              <span className="text-[10px] font-mono text-white/40 uppercase">
                ANDROID NATIVE
              </span>
            </div>

            {/* Central Graphic */}
            <div className="relative my-4 flex items-center justify-center">
              <div className="absolute -inset-4 rounded-full bg-[#7621B0]/25 blur-3xl group-hover:bg-[#00f5a0]/25 transition-colors duration-700" />
              <img
                src={showcase.imageSrc}
                alt={showcase.title}
                loading="lazy"
                className="relative z-10 max-h-[220px] sm:max-h-[260px] w-auto object-contain drop-shadow-[0_20px_40px_rgba(0,0,0,0.9)] rounded-2xl group-hover:scale-105 transition-transform duration-500"
              />
            </div>

            {/* Description Footer */}
            <div className="relative z-10 pt-3 border-t border-white/10 flex items-center justify-between text-xs text-[#D7E2EA]/70">
              <p className="max-w-md font-light leading-relaxed">
                {showcase.description}
              </p>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

export function ProjectsSection() {
  return (
    <section
      id="showcase"
      className="w-full bg-[#0C0C0C] rounded-t-[40px] sm:rounded-t-[50px] md:rounded-t-[60px] -mt-10 sm:-mt-12 md:-mt-14 pt-20 sm:pt-24 md:pt-28 pb-32 px-4 sm:px-6 md:px-10 font-kanit relative z-10"
    >
      <div className="max-w-6xl mx-auto flex flex-col items-center mb-16 sm:mb-20">
        <FadeIn delay={0} y={30} duration={0.8}>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/5 backdrop-blur-md text-xs font-mono tracking-widest text-[#00f5a0] uppercase mb-4">
            <span>OFFGRID CAPABILITIES</span>
          </div>
        </FadeIn>
        <FadeIn delay={0.05} y={30} duration={0.8}>
          <h2
            style={{ fontSize: 'clamp(3rem, 12vw, 160px)' }}
            className="hero-heading font-black uppercase leading-none tracking-tight text-center select-none"
          >
            Inside Jinx
          </h2>
        </FadeIn>
      </div>

      {/* Sticky Stacking Cards */}
      <div className="flex flex-col gap-12 sm:gap-16 max-w-6xl mx-auto">
        {SHOWCASES.map((showcase, index) => (
          <ShowcaseCard
            key={showcase.number}
            showcase={showcase}
            index={index}
            totalCards={SHOWCASES.length}
          />
        ))}
      </div>
    </section>
  )
}

export default ProjectsSection
