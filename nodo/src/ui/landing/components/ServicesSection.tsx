import { FadeIn } from './FadeIn'

interface FeatureItem {
  number: string
  name: string
  description: string
}

const FEATURES: FeatureItem[] = [
  {
    number: '01',
    name: 'LOCAL WEBGPU INFERENCE',
    description:
      "Run cutting-edge quantized neural LLMs directly on your phone's GPU. Stream tokens at 60 FPS with 0ms server latency, zero cloud subscriptions, and total offline freedom.",
  },
  {
    number: '02',
    name: 'OFFLINE DOCUMENT RAG',
    description:
      'Upload complex technical manuals, PDFs, and field guides. Search with on-device vector embeddings and inspect exact interactive page-level citations.',
  },
  {
    number: '03',
    name: 'AUTONOMOUS PYTHON SANDBOX',
    description:
      'Execute scientific Python scripts, mathematical algorithms, and data calculations locally in an isolated WebAssembly sandbox with watchdog safety.',
  },
  {
    number: '04',
    name: '100% PRIVATE & AIR-GAPPED',
    description:
      'Your queries, files, and intelligence never leave your hardware. Zero telemetry, zero tracking, and zero cloud dependencies forever.',
  },
  {
    number: '05',
    name: 'OFF-GRID SURVIVAL PACK',
    description:
      'Pre-indexed emergency medical dossiers, wilderness protocols, and disaster triage instructions accessible instantly during total blackout.',
  },
]

export function ServicesSection() {
  return (
    <section
      id="features"
      className="w-full bg-[#FFFFFF] rounded-t-[40px] sm:rounded-t-[50px] md:rounded-t-[60px] px-5 sm:px-8 md:px-10 py-20 sm:py-24 md:py-32 font-kanit text-[#0C0C0C] relative z-0"
    >
      <div className="max-w-5xl mx-auto flex flex-col items-center">
        {/* Section Heading */}
        <FadeIn delay={0} y={30} duration={0.8}>
          <h2
            style={{ fontSize: 'clamp(3rem, 12vw, 160px)' }}
            className="font-black uppercase leading-none tracking-tight text-[#0C0C0C] text-center mb-16 sm:mb-20 md:mb-28 select-none"
          >
            Features
          </h2>
        </FadeIn>

        {/* 5 Features List */}
        <div className="w-full flex flex-col">
          {FEATURES.map((item, index) => (
            <FadeIn
              key={item.number}
              delay={index * 0.1}
              y={25}
              duration={0.7}
              className="w-full"
            >
              <div
                className={`w-full flex flex-col md:flex-row md:items-center justify-between py-8 sm:py-10 md:py-12 border-b border-[#0C0C0C]/15 gap-4 md:gap-8 ${
                  index === 0 ? 'border-t' : ''
                }`}
              >
                {/* Number on left */}
                <div
                  style={{ fontSize: 'clamp(3rem, 10vw, 140px)' }}
                  className="font-black text-[#0C0C0C] leading-none select-none tracking-tight shrink-0 md:w-[220px]"
                >
                  {item.number}
                </div>

                {/* Name & description stacked vertically on right */}
                <div className="flex flex-col gap-2 md:gap-3 flex-1">
                  <h3
                    style={{ fontSize: 'clamp(1.1rem, 2.2vw, 2.1rem)' }}
                    className="font-medium uppercase tracking-wide text-[#0C0C0C]"
                  >
                    {item.name}
                  </h3>
                  <p
                    style={{ fontSize: 'clamp(0.85rem, 1.5vw, 1.25rem)' }}
                    className="font-light leading-relaxed max-w-2xl text-[#0C0C0C]/70"
                  >
                    {item.description}
                  </p>
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  )
}

export default ServicesSection
