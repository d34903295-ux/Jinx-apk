import { FadeIn } from './FadeIn'
import { AnimatedText } from './AnimatedText'
import { ContactButton } from './ContactButton'
import { FileText, Terminal, WifiOff } from 'lucide-react'

const ABOUT_TEXT =
  'Cloud AI dies the moment you lose signal. Jinx gives you an autonomous intelligence operating 100% locally on your phone: on-device neural inference, zero telemetry, NotebookLM-grade document analysis, and native Python execution. Zero servers. Total sovereignty.'

export function AboutSection() {
  return (
    <section
      id="about"
      className="relative min-h-screen w-full flex flex-col items-center justify-center px-5 sm:px-8 md:px-10 py-20 bg-[#0C0C0C] font-kanit overflow-hidden"
    >
      {/* 4 Decorative 3D Glass / Chrome Feature Icons in corners */}

      {/* Top-Left: 3D Neural Processor Microchip */}
      <div className="absolute top-[4%] left-[1%] sm:left-[2%] md:left-[4%] w-[120px] sm:w-[160px] md:w-[200px] pointer-events-none z-0">
        <FadeIn delay={0.1} x={-80} y={0} duration={0.9}>
          <div className="relative group p-2">
            <div className="absolute -inset-2 bg-gradient-to-tr from-[#00f5a0]/30 to-[#7621B0]/30 rounded-3xl blur-xl opacity-60" />
            <img
              src="/jinx_icon_neural_chip.jpg"
              alt="Neural Chip 3D Icon"
              className="relative z-10 w-full h-auto object-contain rounded-2xl border border-white/20 shadow-2xl drop-shadow-[0_15px_35px_rgba(0,0,0,0.8)] filter contrast-110"
              loading="lazy"
            />
            <div className="text-[10px] font-mono text-center text-[#00f5a0] mt-1.5 uppercase tracking-widest opacity-80">
              WebGPU Core
            </div>
          </div>
        </FadeIn>
      </div>

      {/* Bottom-Left: 3D Sovereign Vector Shield */}
      <div className="absolute bottom-[8%] left-[3%] sm:left-[6%] md:left-[10%] w-[100px] sm:w-[140px] md:w-[170px] pointer-events-none z-0">
        <FadeIn delay={0.25} x={-80} y={0} duration={0.9}>
          <div className="relative group p-3 rounded-2xl bg-gradient-to-br from-white/10 via-black/60 to-white/5 border border-white/20 backdrop-blur-xl shadow-2xl flex flex-col items-center justify-center aspect-square">
            <div className="absolute -inset-3 bg-[#7621B0]/30 rounded-full blur-2xl opacity-60" />
            <div className="size-12 sm:size-16 rounded-xl bg-gradient-to-br from-[#7621B0] to-[#B600A8] flex items-center justify-center shadow-lg border border-white/30 relative z-10">
              <FileText className="size-6 sm:size-8 text-white" />
            </div>
            <span className="relative z-10 text-[10px] sm:text-xs font-mono uppercase tracking-widest text-[#D7E2EA] mt-2 font-semibold">
              Vector RAG
            </span>
          </div>
        </FadeIn>
      </div>

      {/* Top-Right: 3D Pyodide Python Engine Cube */}
      <div className="absolute top-[4%] right-[1%] sm:right-[2%] md:right-[4%] w-[120px] sm:w-[160px] md:w-[180px] pointer-events-none z-0">
        <FadeIn delay={0.15} x={80} y={0} duration={0.9}>
          <div className="relative group p-3 rounded-2xl bg-gradient-to-br from-white/10 via-black/60 to-white/5 border border-white/20 backdrop-blur-xl shadow-2xl flex flex-col items-center justify-center aspect-square">
            <div className="absolute -inset-3 bg-[#B600A8]/30 rounded-full blur-2xl opacity-60" />
            <div className="size-12 sm:size-16 rounded-xl bg-gradient-to-br from-[#B600A8] to-[#BE4C00] flex items-center justify-center shadow-lg border border-white/30 relative z-10">
              <Terminal className="size-6 sm:size-8 text-white" />
            </div>
            <span className="relative z-10 text-[10px] sm:text-xs font-mono uppercase tracking-widest text-[#D7E2EA] mt-2 font-semibold">
              Pyodide WASM
            </span>
          </div>
        </FadeIn>
      </div>

      {/* Bottom-Right: 3D Sovereign Air-Gapped Core */}
      <div className="absolute bottom-[8%] right-[3%] sm:right-[6%] md:right-[10%] w-[120px] sm:w-[150px] md:w-[190px] pointer-events-none z-0">
        <FadeIn delay={0.3} x={80} y={0} duration={0.9}>
          <div className="relative group p-2">
            <div className="absolute -inset-2 bg-gradient-to-tr from-[#00f5a0]/30 to-[#BE4C00]/30 rounded-full blur-xl opacity-60" />
            <div className="p-3 rounded-2xl bg-gradient-to-br from-white/10 via-black/60 to-white/5 border border-white/20 backdrop-blur-xl shadow-2xl flex flex-col items-center justify-center aspect-square">
              <div className="size-12 sm:size-16 rounded-xl bg-gradient-to-br from-[#00f5a0] to-[#7621B0] flex items-center justify-center shadow-lg border border-white/30 relative z-10">
                <WifiOff className="size-6 sm:size-8 text-black font-bold" />
              </div>
              <span className="relative z-10 text-[10px] sm:text-xs font-mono uppercase tracking-widest text-[#D7E2EA] mt-2 font-semibold">
                100% Offline
              </span>
            </div>
          </div>
        </FadeIn>
      </div>

      {/* Center Content */}
      <div className="relative z-10 max-w-4xl mx-auto flex flex-col items-center text-center">
        {/* Section Badge */}
        <FadeIn delay={0} y={20} duration={0.7}>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/5 backdrop-blur-md text-xs font-mono tracking-widest text-[#00f5a0] uppercase mb-4">
            <span>SOVEREIGN ARCHITECTURE</span>
          </div>
        </FadeIn>

        {/* Heading */}
        <FadeIn delay={0.05} y={40} duration={0.8}>
          <h2
            style={{ fontSize: 'clamp(3rem, 12vw, 160px)' }}
            className="hero-heading font-black uppercase leading-none tracking-tight select-none"
          >
            Why Jinx
          </h2>
        </FadeIn>

        {/* Gap between heading and text */}
        <div className="h-8 sm:h-12 md:h-14" />

        {/* Animated paragraph */}
        <AnimatedText
          text={ABOUT_TEXT}
          className="text-[#D7E2EA] font-medium leading-relaxed max-w-[580px] text-center"
        />

        {/* Gap between text and button */}
        <div className="h-12 sm:h-16 md:h-20" />

        {/* CTA Button */}
        <FadeIn delay={0.2} y={30} duration={0.8}>
          <ContactButton
            label="DOWNLOAD NOW"
            href="/Jinx-app.apk"
            download="Jinx-app.apk"
          />
        </FadeIn>
      </div>
    </section>
  )
}

export default AboutSection
