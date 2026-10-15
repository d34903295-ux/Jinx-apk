import { useRef, useState, useEffect, type ReactNode } from 'react'

interface MagnetProps {
  children: ReactNode
  padding?: number
  strength?: number
  activeTransition?: string
  inactiveTransition?: string
  className?: string
}

export function Magnet({
  children,
  padding = 150,
  strength = 3,
  activeTransition = 'transform 0.3s ease-out',
  inactiveTransition = 'transform 0.6s ease-in-out',
  className = '',
}: MagnetProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isActive, setIsActive] = useState(false)

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!ref.current) return
      const rect = ref.current.getBoundingClientRect()
      const centerX = rect.left + rect.width / 2
      const centerY = rect.top + rect.height / 2

      const distFromLeft = rect.left - e.clientX
      const distFromRight = e.clientX - rect.right
      const distFromTop = rect.top - e.clientY
      const distFromBottom = e.clientY - rect.bottom

      const isNear =
        distFromLeft < padding &&
        distFromRight < padding &&
        distFromTop < padding &&
        distFromBottom < padding

      if (isNear) {
        setIsActive(true)
        const offsetX = (e.clientX - centerX) / strength
        const offsetY = (e.clientY - centerY) / strength
        setPosition({ x: offsetX, y: offsetY })
      } else {
        setIsActive(false)
        setPosition({ x: 0, y: 0 })
      }
    }

    const handleMouseLeave = () => {
      setIsActive(false)
      setPosition({ x: 0, y: 0 })
    }

    window.addEventListener('mousemove', handleMouseMove, { passive: true })
    document.addEventListener('mouseleave', handleMouseLeave)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseleave', handleMouseLeave)
    }
  }, [padding, strength])

  return (
    <div
      ref={ref}
      className={className}
      style={{
        transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
        transition: isActive ? activeTransition : inactiveTransition,
        willChange: 'transform',
      }}
    >
      {children}
    </div>
  )
}
