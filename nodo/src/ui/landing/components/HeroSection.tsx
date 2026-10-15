import { DigitalWaveFieldHero } from './DigitalWaveFieldHero'

export interface HeroSectionProps {
  onOpenApp?: () => void
}

export function HeroSection({ onOpenApp }: HeroSectionProps) {
  return <DigitalWaveFieldHero onOpenApp={onOpenApp} />
}

export default HeroSection
