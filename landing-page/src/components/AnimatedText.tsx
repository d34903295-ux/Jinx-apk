import { useRef } from 'react'
import { motion, useScroll, useTransform, type MotionValue } from 'framer-motion'

interface AnimatedTextProps {
  text: string
  className?: string
}

function CharSpan({
  char,
  progress,
  range,
}: {
  char: string
  progress: MotionValue<number>
  range: [number, number]
}) {
  const opacity = useTransform(progress, range, [0.2, 1])

  return (
    <span className="relative inline-block">
      <span className="opacity-0">{char}</span>
      <motion.span
        style={{ opacity }}
        className="absolute inset-0"
      >
        {char}
      </motion.span>
    </span>
  )
}

export function AnimatedText({ text, className = '' }: AnimatedTextProps) {
  const containerRef = useRef<HTMLParagraphElement>(null)
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start 0.85', 'end 0.25'],
  })

  const words = text.split(' ')
  let charCounter = 0
  const totalChars = text.length

  return (
    <p ref={containerRef} className={className}>
      {words.map((word, wordIndex) => {
        const characters = word.split('')
        return (
          <span key={wordIndex} className="inline-block whitespace-nowrap">
            {characters.map((char, charIndex) => {
              const start = charCounter / totalChars
              const end = (charCounter + 1) / totalChars
              charCounter++
              return (
                <CharSpan
                  key={charIndex}
                  char={char}
                  progress={scrollYProgress}
                  range={[start, end]}
                />
              )
            })}
            {wordIndex < words.length - 1 && (
              <span className="inline-block">&nbsp;</span>
            )}
          </span>
        )
      })}
    </p>
  )
}
