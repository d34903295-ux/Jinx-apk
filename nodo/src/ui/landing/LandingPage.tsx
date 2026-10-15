import { HeroSection } from './components/HeroSection'
import { MarqueeSection } from './components/MarqueeSection'
import { AboutSection } from './components/AboutSection'
import { ServicesSection } from './components/ServicesSection'
import { ProjectsSection } from './components/ProjectsSection'
import { ContactButton } from './components/ContactButton'
import { FadeIn } from './components/FadeIn'
import { Send, ShieldCheck, Code2 } from 'lucide-react'

interface LandingPageProps {
  onOpenApp?: () => void
}

export function LandingPage({ onOpenApp }: LandingPageProps) {
  return (
    <div className="w-full min-h-screen bg-[#0C0C0C] text-[#D7E2EA] font-kanit overflow-x-clip relative selection:bg-[#B600A8]/30 selection:text-white">
      {/* 1. Hero Section (Digital Wave Field Three.js) */}
      <HeroSection onOpenApp={onOpenApp} />

      {/* 2. Marquee Section (Jinx Living Screens) */}
      <MarqueeSection />

      {/* 3. Why Jinx Section */}
      <AboutSection />

      {/* 4. Core Features Section (White Background) */}
      <ServicesSection />

      {/* 5. Inside Jinx Section (Sticky Stacking Cards) */}
      <ProjectsSection />

      {/* 6. Download APK & Official Contact Footer Banner */}
      <footer
        id="contact"
        className="w-full bg-[#0C0C0C] border-t border-[#D7E2EA]/10 py-20 sm:py-24 px-6 sm:px-10 flex flex-col items-center text-center relative z-20"
      >
        <div className="max-w-4xl mx-auto flex flex-col items-center gap-8">
          <FadeIn delay={0} y={20} duration={0.8}>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#00f5a0]/40 bg-[#00f5a0]/10 px-4 py-1.5 font-mono text-xs text-[#00f5a0] uppercase tracking-widest">
              <span className="size-2 rounded-full bg-[#00f5a0] animate-pulse" />
              <span>JINX v1.0 · READY FOR OFFLINE DEPLOYMENT</span>
            </div>
          </FadeIn>

          <FadeIn delay={0.15} y={30} duration={0.8}>
            <h2
              style={{ fontSize: 'clamp(2.5rem, 8vw, 6rem)' }}
              className="hero-heading font-black uppercase leading-none tracking-tight"
            >
              Get Jinx Today
            </h2>
          </FadeIn>

          <FadeIn delay={0.3} y={20} duration={0.8}>
            <p className="text-[#D7E2EA]/70 max-w-xl text-sm sm:text-base md:text-lg font-light leading-relaxed">
              Install once and operate forever without internet. Fully private on-device intelligence, document vector search, and Python code execution directly on your Android phone.
            </p>
          </FadeIn>

          <FadeIn delay={0.45} y={20} duration={0.8}>
            <div className="flex flex-col sm:flex-row items-center gap-4 mt-2">
              <ContactButton
                label="DOWNLOAD APK (327 MB)"
                href="/Jinx-app.apk"
                download="Jinx-app.apk"
              />

              {onOpenApp && (
                <button
                  type="button"
                  onClick={onOpenApp}
                  className="inline-flex items-center justify-center rounded-full border-2 border-[#D7E2EA] text-[#D7E2EA] font-medium uppercase tracking-widest px-8 py-3 sm:px-10 sm:py-3.5 text-xs sm:text-sm hover:bg-[#D7E2EA]/10 transition-all duration-300 cursor-pointer active:scale-95"
                >
                  Launch In Browser
                </button>
              )}
            </div>
          </FadeIn>

          {/* Official Community & Links */}
          <FadeIn delay={0.55} y={15} duration={0.8}>
            <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-8 pt-6 text-xs sm:text-sm font-mono text-[#D7E2EA]/70">
              <a
                href="https://github.com/example/jinx"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 hover:text-[#00f5a0] transition-colors"
              >
                <Code2 className="size-4 text-[#00f5a0]" />
                <span>GitHub Repository</span>
              </a>
              <a
                href="https://t.me/jinx_agent"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 hover:text-[#00f5a0] transition-colors"
              >
                <Send className="size-4" />
                <span>Telegram Community</span>
              </a>
              <span className="flex items-center gap-2 text-white/50">
                <ShieldCheck className="size-4 text-[#00f5a0]" />
                <span>100% Air-gapped &amp; Private</span>
              </span>
            </div>
          </FadeIn>

          {/* Telemetry Footer Info */}
          <div className="w-full pt-12 mt-8 border-t border-white/[0.06] flex flex-col sm:flex-row items-center justify-between text-xs text-[#D7E2EA]/40 font-mono gap-4">
            <span>PACKAGE: JINX-APP.APK · ARM64-V8A WEBGPU</span>
            <span>HACK47 OFFGRID EDITION · 2026</span>
            <span>SHA-256 VERIFIED · 0 BYTES CLOUD TELEMETRY</span>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default LandingPage
