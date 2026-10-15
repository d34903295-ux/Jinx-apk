import { useEffect, useRef, useState, useCallback } from 'react'
import * as THREE from 'three'
import { Sparkles, Sliders, Activity } from 'lucide-react'
import { Magnet } from './Magnet'
import { FadeIn } from './FadeIn'
import { ContactButton } from './ContactButton'

export type WaveMode = 'matrix' | 'neural' | 'quantum'

interface DigitalWaveFieldHeroProps {
  onOpenApp?: () => void
  initialMode?: WaveMode
  className?: string
}

export function DigitalWaveFieldHero({
  onOpenApp,
  initialMode = 'matrix',
  className = '',
}: DigitalWaveFieldHeroProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [mode, setMode] = useState<WaveMode>(initialMode)
  const [intensity, setIntensity] = useState<number>(1.2)
  const [isControlsOpen, setIsControlsOpen] = useState<boolean>(false)
  const [pulseCount, setPulseCount] = useState<number>(0)
  const [fps, setFps] = useState<number>(60)

  // Mutable refs for Three.js animation loop without React re-render overhead
  const stateRef = useRef({
    mode,
    intensity,
    mouse: new THREE.Vector2(0, 0),
    targetMouse: new THREE.Vector2(0, 0),
    mouseSpeed: 0,
    lastMouse: new THREE.Vector2(0, 0),
    pulses: [] as Array<{
      x: number
      z: number
      time: number
      radius: number
      strength: number
    }>,
  })

  // Keep stateRef synced with React state
  useEffect(() => {
    stateRef.current.mode = mode
    stateRef.current.intensity = intensity
  }, [mode, intensity])

  // Trigger manual shockwave pulse
  const triggerPulse = useCallback((x = 0, z = 0, strength = 2.5) => {
    stateRef.current.pulses.push({
      x,
      z,
      time: 0,
      radius: 0,
      strength,
    })
    setPulseCount((prev) => prev + 1)
  }, [])

  // Three.js Scene Setup & Animation Loop
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    // Scene & Camera
    const scene = new THREE.Scene()
    scene.fog = new THREE.FogExp2(0x0c0c0c, 0.018)

    const camera = new THREE.PerspectiveCamera(
      55,
      canvas.clientWidth / canvas.clientHeight,
      0.1,
      1000
    )
    camera.position.set(0, 24, 38)
    camera.lookAt(0, 0, 0)

    // Renderer
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    })
    renderer.setSize(canvas.clientWidth, canvas.clientHeight)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setClearColor(0x0c0c0c, 0)

    // Grid Dimensions
    const cols = 90
    const rows = 90
    const count = cols * rows
    const separation = 0.95

    const geometry = new THREE.BufferGeometry()
    const positions = new Float32Array(count * 3)
    const originalPositions = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)
    const baseColors = new Float32Array(count * 3)

    let index = 0
    const xOffset = ((cols - 1) * separation) / 2
    const zOffset = ((rows - 1) * separation) / 2

    for (let ix = 0; ix < cols; ix++) {
      for (let iz = 0; iz < rows; iz++) {
        const x = ix * separation - xOffset
        const z = iz * separation - zOffset
        const y = 0

        positions[index * 3] = x
        positions[index * 3 + 1] = y
        positions[index * 3 + 2] = z

        originalPositions[index * 3] = x
        originalPositions[index * 3 + 1] = y
        originalPositions[index * 3 + 2] = z

        // Normalized distance from center
        const distFromCenter = Math.sqrt(x * x + z * z) / 45
        // Palette: Gradient from violet to cyan to deep slate
        const r = 0.4 + 0.3 * Math.sin(distFromCenter * 3.0)
        const g = 0.45 + 0.35 * Math.cos(distFromCenter * 2.0)
        const b = 0.8 + 0.2 * Math.sin(distFromCenter * 4.0)

        colors[index * 3] = r
        colors[index * 3 + 1] = g
        colors[index * 3 + 2] = b

        baseColors[index * 3] = r
        baseColors[index * 3 + 1] = g
        baseColors[index * 3 + 2] = b

        index++
      }
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))

    // High quality circle sprite texture for points
    const createCircleTexture = () => {
      const size = 64
      const canvasEl = document.createElement('canvas')
      canvasEl.width = size
      canvasEl.height = size
      const ctx = canvasEl.getContext('2d')
      if (ctx) {
        const center = size / 2
        const gradient = ctx.createRadialGradient(
          center,
          center,
          0,
          center,
          center,
          center
        )
        gradient.addColorStop(0, 'rgba(255, 255, 255, 1)')
        gradient.addColorStop(0.3, 'rgba(200, 230, 255, 0.8)')
        gradient.addColorStop(0.7, 'rgba(120, 160, 240, 0.2)')
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)')
        ctx.fillStyle = gradient
        ctx.beginPath()
        ctx.arc(center, center, center, 0, Math.PI * 2)
        ctx.fill()
      }
      const texture = new THREE.CanvasTexture(canvasEl)
      texture.wrapS = THREE.ClampToEdgeWrapping
      texture.wrapT = THREE.ClampToEdgeWrapping
      return texture
    }

    const material = new THREE.PointsMaterial({
      size: 0.85,
      vertexColors: true,
      map: createCircleTexture(),
      transparent: true,
      opacity: 0.88,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })

    const pointCloud = new THREE.Points(geometry, material)
    scene.add(pointCloud)

    // Raycaster plane to intersect cursor with the 3D ground
    const raycaster = new THREE.Raycaster()
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
    const intersectionPoint = new THREE.Vector3()

    // Mouse & Touch handling
    const onPointerMove = (e: MouseEvent | TouchEvent) => {
      let clientX = 0
      let clientY = 0
      if ('touches' in e && e.touches.length > 0) {
        const touch = e.touches[0]
        if (touch) {
          clientX = touch.clientX
          clientY = touch.clientY
        }
      } else if ('clientX' in e) {
        clientX = e.clientX
        clientY = e.clientY
      }

      const rect = canvas.getBoundingClientRect()
      const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1
      const ndcY = -(((clientY - rect.top) / rect.height) * 2 - 1)

      stateRef.current.targetMouse.set(ndcX, ndcY)

      // Calculate pointer speed
      const curMouse = new THREE.Vector2(ndcX, ndcY)
      const speed = curMouse.distanceTo(stateRef.current.lastMouse) * 60
      stateRef.current.mouseSpeed = Math.min(speed, 5)
      stateRef.current.lastMouse.copy(curMouse)

      // If moving quickly, spawn a dynamic ripple under cursor
      if (speed > 1.2 && Math.random() > 0.4) {
        raycaster.setFromCamera(curMouse, camera)
        if (raycaster.ray.intersectPlane(plane, intersectionPoint)) {
          stateRef.current.pulses.push({
            x: intersectionPoint.x,
            z: intersectionPoint.z,
            time: 0,
            radius: 0,
            strength: Math.min(speed * 0.4, 2.2),
          })
        }
      }
    }

    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      let clientX = 0
      let clientY = 0
      if ('touches' in e && e.touches.length > 0) {
        const touch = e.touches[0]
        if (touch) {
          clientX = touch.clientX
          clientY = touch.clientY
        }
      } else if ('clientX' in e) {
        clientX = e.clientX
        clientY = e.clientY
      }
      const rect = canvas.getBoundingClientRect()
      const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1
      const ndcY = -(((clientY - rect.top) / rect.height) * 2 - 1)
      const curMouse = new THREE.Vector2(ndcX, ndcY)

      raycaster.setFromCamera(curMouse, camera)
      if (raycaster.ray.intersectPlane(plane, intersectionPoint)) {
        triggerPulse(intersectionPoint.x, intersectionPoint.z, 3.2)
      }
    }

    window.addEventListener('mousemove', onPointerMove, { passive: true })
    window.addEventListener('touchmove', onPointerMove, { passive: true })
    window.addEventListener('mousedown', onPointerDown, { passive: true })
    window.addEventListener('touchstart', onPointerDown, { passive: true })

    // Resize handling
    const onResize = () => {
      if (!canvas) return
      const width = canvas.clientWidth
      const height = canvas.clientHeight
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      renderer.setSize(width, height)
    }
    window.addEventListener('resize', onResize)

    // Animation Loop
    let animationFrameId = 0
    let lastTime = performance.now()
    let frameCount = 0
    let fpsTimer = performance.now()
    let time = 0

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate)

      const now = performance.now()
      const delta = (now - lastTime) / 1000
      lastTime = now
      time += delta

      // FPS tracking
      frameCount++
      if (now - fpsTimer >= 1000) {
        setFps(frameCount)
        frameCount = 0
        fpsTimer = now
      }

      // Smooth mouse lerp
      stateRef.current.mouse.lerp(stateRef.current.targetMouse, 0.08)

      // Get pointer intersection with ground plane
      raycaster.setFromCamera(stateRef.current.mouse, camera)
      const hasIntersection = raycaster.ray.intersectPlane(
        plane,
        intersectionPoint
      )

      // Camera gentle sway influenced by cursor
      camera.position.x = THREE.MathUtils.lerp(
        camera.position.x,
        stateRef.current.mouse.x * 6,
        0.04
      )
      camera.position.y = THREE.MathUtils.lerp(
        camera.position.y,
        24 - stateRef.current.mouse.y * 3,
        0.04
      )
      camera.lookAt(0, 0, 0)

      // Update pulses
      const pulses = stateRef.current.pulses
      for (let p = pulses.length - 1; p >= 0; p--) {
        const pulse = pulses[p]
        if (!pulse) continue
        pulse.time += delta * 1.8
        pulse.radius += delta * 24.0
        if (pulse.time > 3.0) {
          pulses.splice(p, 1)
        }
      }

      const curMode = stateRef.current.mode
      const curIntensity = stateRef.current.intensity
      const posAttr = geometry.attributes.position as THREE.BufferAttribute
      const colAttr = geometry.attributes.color as THREE.BufferAttribute
      const posArray = posAttr.array as Float32Array
      const colArray = colAttr.array as Float32Array

      for (let i = 0; i < count; i++) {
        const i3 = i * 3
        const x = originalPositions[i3] ?? 0
        const z = originalPositions[i3 + 2] ?? 0

        let elevation = 0
        let excitation = 0

        if (curMode === 'matrix') {
          // Digital square-sine matrix wave
          elevation =
            Math.sin(x * 0.22 + time * 2.2) *
            Math.cos(z * 0.22 + time * 1.8) *
            1.8 *
            curIntensity
          elevation += Math.sin((x + z) * 0.15 + time * 1.2) * 0.8
        } else if (curMode === 'neural') {
          // Fluid organic ripples
          const dist = Math.sqrt(x * x + z * z)
          elevation = Math.sin(dist * 0.35 - time * 3.5) * 2.2 * curIntensity
          elevation += Math.cos(x * 0.4 + time * 1.5) * 0.7
        } else if (curMode === 'quantum') {
          // Sharp energetic spikes
          elevation =
            Math.sin(x * 0.45 + time * 4.0) *
            Math.sin(z * 0.45 - time * 3.0) *
            2.5 *
            curIntensity
          elevation += Math.cos((x - z) * 0.3 + time * 2.5) * 1.1
        }

        // Pointer proximity displacement & glow
        if (hasIntersection) {
          const dx = x - intersectionPoint.x
          const dz = z - intersectionPoint.z
          const distSq = dx * dx + dz * dz
          const cursorRadiusSq = 120

          if (distSq < cursorRadiusSq) {
            const factor = Math.exp(-distSq / 40)
            const mouseRipple = Math.sin(Math.sqrt(distSq) * 1.2 - time * 6.0)
            elevation += factor * (3.8 + mouseRipple * 1.5) * curIntensity
            excitation += factor * 2.2
          }
        }

        // Active Shockwave Pulses
        for (let p = 0; p < pulses.length; p++) {
          const pulse = pulses[p]
          if (!pulse) continue
          const pdx = x - pulse.x
          const pdz = z - pulse.z
          const pdist = Math.sqrt(pdx * pdx + pdz * pdz)
          const diff = Math.abs(pdist - pulse.radius)

          if (diff < 4.5) {
            const pulseFactor =
              Math.exp(-(diff * diff) / 6.0) * Math.exp(-pulse.time * 0.8)
            elevation +=
              Math.sin(diff * 2.0 - pulse.time * 4.0) *
              pulseFactor *
              pulse.strength *
              2.5
            excitation += pulseFactor * 3.5
          }
        }

        posArray[i3 + 1] = elevation

        // Dynamic vertex color response
        const baseR = baseColors[i3] ?? 0.4
        const baseG = baseColors[i3 + 1] ?? 0.5
        const baseB = baseColors[i3 + 2] ?? 0.8

        // Height color boost + Excitation flash
        const heightBoost = (elevation + 2.0) * 0.18
        colArray[i3] = THREE.MathUtils.clamp(
          baseR + heightBoost * 0.3 + excitation * 0.8,
          0,
          1
        )
        colArray[i3 + 1] = THREE.MathUtils.clamp(
          baseG + heightBoost * 0.6 + excitation * 1.0,
          0,
          1
        )
        colArray[i3 + 2] = THREE.MathUtils.clamp(
          baseB + heightBoost * 0.9 + excitation * 0.5,
          0,
          1
        )
      }

      posAttr.needsUpdate = true
      colAttr.needsUpdate = true

      renderer.render(scene, camera)
    }

    animate()

    // Cleanup
    return () => {
      cancelAnimationFrame(animationFrameId)
      window.removeEventListener('mousemove', onPointerMove)
      window.removeEventListener('touchmove', onPointerMove)
      window.removeEventListener('mousedown', onPointerDown)
      window.removeEventListener('touchstart', onPointerDown)
      window.removeEventListener('resize', onResize)

      geometry.dispose()
      material.dispose()
      renderer.dispose()
    }
  }, [triggerPulse])

  return (
    <section
      className={`relative min-h-screen w-full flex flex-col justify-between overflow-x-clip bg-[#0C0C0C] text-[#D7E2EA] font-kanit select-none ${className}`}
    >
      {/* Background Three.js Digital Wave Field Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-auto z-0 touch-none"
      />

      {/* Subtle Atmospheric Lighting Overlays */}
      <div className="absolute inset-0 pointer-events-none z-[1] opacity-75" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[80vw] h-[350px] bg-gradient-to-b from-[#7621B0]/15 via-[#00f5a0]/5 to-transparent blur-3xl pointer-events-none z-[1]" />

      {/* 1. Header / Navbar */}
      <FadeIn delay={0} y={-20} duration={0.8} className="w-full z-20">
        <nav className="w-full flex items-center justify-between px-6 md:px-10 pt-6 md:pt-8 uppercase font-medium tracking-wider text-sm md:text-lg lg:text-[1.4rem]">
          <a
            href="#about"
            className="hover:opacity-70 transition-opacity duration-200"
          >
            Overview
          </a>
          <a
            href="#features"
            className="hover:opacity-70 transition-opacity duration-200"
          >
            Features
          </a>
          <a
            href="#showcase"
            className="hover:opacity-70 transition-opacity duration-200"
          >
            Showcase
          </a>
          <div className="flex items-center gap-3 sm:gap-6">
            <a
              href="#contact"
              className="hover:opacity-70 transition-opacity duration-200"
            >
              Contact
            </a>
            {onOpenApp && (
              <button
                type="button"
                onClick={onOpenApp}
                className="hidden lg:flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-white/20 bg-white/5 text-xs text-white hover:bg-white/10 transition-colors cursor-pointer active:scale-95"
              >
                <span>Launch Web App</span>
                <span className="size-1.5 rounded-full bg-[#00f5a0] animate-ping" />
              </button>
            )}
            <a
              href="/Jinx-app.apk"
              download="Jinx-app.apk"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-[#00f5a0]/40 bg-[#00f5a0]/10 text-xs text-[#00f5a0] tracking-widest hover:bg-[#00f5a0]/20 transition-colors shadow-[0_0_15px_rgba(0,245,160,0.2)] font-mono"
            >
              <span>GET APK</span>
              <span className="size-1.5 rounded-full bg-[#00f5a0] animate-pulse" />
            </a>
          </div>
        </nav>
      </FadeIn>

      {/* 2. Hero Massive Heading & Interactive 3D Core */}
      <div className="w-full relative z-10 flex flex-col items-center justify-center my-auto px-4">
        {/* Living Wave Status Tag */}
        <FadeIn delay={0.1} y={15} duration={0.7}>
          <div className="inline-flex items-center gap-2.5 px-3.5 py-1 rounded-full border border-white/10 bg-white/5 backdrop-blur-md text-[11px] font-mono tracking-wider text-[#D7E2EA]/80 mb-3 sm:mb-2 shadow-inner">
            <span className="size-2 rounded-full bg-[#00f5a0] animate-ping" />
            <span className="uppercase">JINX CORE v1.0 · OFF-GRID NEURAL ENGINE</span>
            <span className="text-white/40">|</span>
            <span className="text-[#00f5a0]">{fps} FPS</span>
            <span className="text-white/40">|</span>
            <span className="text-white/60">8,100 NODES</span>
            <span className="text-white/40">|</span>
            <span className="text-[#00f5a0]">PULSES: {pulseCount}</span>
          </div>
        </FadeIn>

        {/* Massive Title */}
        <div className="w-full overflow-hidden text-center z-10 mt-1 sm:mt-0 md:-mt-4">
          <FadeIn delay={0.15} y={40} duration={0.9}>
            <h1 className="hero-heading font-black uppercase tracking-tight leading-none whitespace-nowrap w-full text-[16vw] sm:text-[17vw] md:text-[18vw] lg:text-[19vw] select-none">
              JINX
            </h1>
          </FadeIn>
        </div>

        {/* Hero Magnet 3D Core / Portrait */}
        <div className="relative mt-2 sm:mt-4 md:mt-2 pointer-events-auto">
          <FadeIn delay={0.4} y={30} duration={1}>
            <Magnet
              padding={150}
              strength={3}
              activeTransition="transform 0.3s ease-out"
              inactiveTransition="transform 0.6s ease-in-out"
              className="flex items-center justify-center cursor-grab active:cursor-grabbing"
            >
              <div
                className="relative group cursor-pointer"
                onClick={() => triggerPulse(0, 0, 4.0)}
                title="Click to trigger shockwave pulse"
              >
                {/* Radiant Ambient Core Glow */}
                <div className="absolute -inset-6 rounded-full bg-gradient-to-tr from-[#00f5a0]/30 via-[#7621B0]/30 to-[#BE4C00]/30 blur-3xl opacity-70 group-hover:opacity-100 transition-opacity duration-500 animate-pulse" />
                <img
                  src="/jinx_hero_visual.jpg"
                  onError={(e) => {
                    ;(e.currentTarget as HTMLImageElement).src =
                      '/nodo_hero_core.jpg'
                  }}
                  alt="Jinx Sovereign 3D Core & Mobile Assistant"
                  className="relative z-10 w-[240px] sm:w-[320px] md:w-[400px] lg:w-[460px] h-auto object-contain drop-shadow-[0_20px_50px_rgba(0,0,0,0.85)] filter contrast-105 group-hover:scale-105 transition-transform duration-500 rounded-3xl"
                  draggable={false}
                />
                {/* Touch hint badge */}
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 z-20 px-3 py-1 rounded-full bg-black/70 border border-white/20 backdrop-blur-md text-[10px] uppercase font-mono tracking-widest text-[#D7E2EA] opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none whitespace-nowrap">
                  Click / Tap to Pulse Grid
                </div>
              </div>
            </Magnet>
          </FadeIn>
        </div>
      </div>

      {/* 3. Floating Glassmorphism Wave HUD Controls (Responsive Drawer / Pill) */}
      <div className="relative z-20 w-full px-6 md:px-10 pb-7 sm:pb-8 md:pb-10 flex flex-col md:flex-row items-end justify-between gap-6">
        {/* Left: Tagline & Interactive Mode Selector */}
        <div className="flex flex-col gap-4 max-w-[320px] sm:max-w-[460px]">
          <FadeIn delay={0.35} y={20} duration={0.8}>
            <p
              style={{ fontSize: 'clamp(0.75rem, 1.3vw, 1.35rem)' }}
              className="text-[#D7E2EA] font-light uppercase tracking-wide leading-snug"
            >
              A 100% OFFLINE SOVEREIGN AI AGENT POWERED BY LOCAL WEBGPU &amp; ON-DEVICE NEURAL COMPUTE
            </p>
          </FadeIn>

          {/* Glassmorphic Field Mode Tabs & Controls */}
          <FadeIn delay={0.45} y={20} duration={0.8}>
            <div className="flex flex-col gap-2">
              <div className="inline-flex items-center gap-1.5 p-1 rounded-2xl bg-black/60 border border-white/10 backdrop-blur-xl shadow-2xl">
                {[
                  { id: 'matrix', label: 'WEBGPU' },
                  { id: 'neural', label: 'VECTOR RAG' },
                  { id: 'quantum', label: 'PYODIDE' },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setMode(item.id as WaveMode)
                      triggerPulse(0, 0, 3.0)
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-mono uppercase tracking-wider transition-all duration-300 cursor-pointer ${
                      mode === item.id
                        ? 'bg-gradient-to-r from-[#B600A8] to-[#7621B0] text-white shadow-lg shadow-[#7621B0]/30 font-semibold scale-105'
                        : 'text-[#D7E2EA]/60 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}

                {/* Pulse shockwave button */}
                <button
                  type="button"
                  onClick={() => triggerPulse(0, 0, 3.5)}
                  className="px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-[#00f5a0]/20 text-[#00f5a0] hover:text-white transition-all text-xs font-mono flex items-center gap-1 cursor-pointer active:scale-95"
                  title="Send Quantum Shockwave"
                >
                  <Sparkles className="size-3.5" />
                  <span className="hidden sm:inline">Pulse</span>
                </button>

                {/* Settings Toggle Button */}
                <button
                  type="button"
                  onClick={() => setIsControlsOpen((prev) => !prev)}
                  className={`p-1.5 rounded-xl border transition-all text-xs cursor-pointer ${
                    isControlsOpen
                      ? 'border-[#00f5a0] bg-[#00f5a0]/20 text-[#00f5a0]'
                      : 'border-white/10 text-white/60 hover:text-white hover:bg-white/5'
                  }`}
                  title="Grid Controls"
                >
                  <Sliders className="size-3.5" />
                </button>
              </div>

              {/* Collapsible Tuning Drawer */}
              {isControlsOpen && (
                <div className="p-3 rounded-2xl bg-black/80 border border-white/10 backdrop-blur-2xl flex flex-col gap-2.5 shadow-2xl w-full text-xs font-mono">
                  <div className="flex items-center justify-between text-white/70">
                    <span className="flex items-center gap-1.5">
                      <Activity className="size-3 text-[#00f5a0]" />
                      Wave Amplitude
                    </span>
                    <span className="text-[#00f5a0]">{intensity.toFixed(1)}x</span>
                  </div>
                  <input
                    type="range"
                    min="0.4"
                    max="2.5"
                    step="0.1"
                    value={intensity}
                    onChange={(e) => setIntensity(parseFloat(e.target.value))}
                    className="w-full accent-[#00f5a0] cursor-pointer"
                  />
                  <div className="flex items-center justify-between text-[10px] text-white/40 pt-1 border-t border-white/10">
                    <span>Engine: Local Three.js</span>
                    <span>Physics: Cursor + Touch</span>
                  </div>
                </div>
              )}
            </div>
          </FadeIn>
        </div>

        {/* Right: Contact & Download CTA */}
        <FadeIn delay={0.5} y={20} duration={0.8} className="flex flex-col sm:flex-row items-end sm:items-center gap-3">
          <a
            href="#features"
            className="inline-flex items-center justify-center rounded-full border border-white/20 hover:border-white/50 text-[#D7E2EA] font-medium uppercase tracking-widest px-6 py-3 sm:px-7 sm:py-3.5 text-xs sm:text-sm hover:bg-white/10 transition-all duration-300 cursor-pointer active:scale-95"
          >
            Explore Architecture
          </a>
          <ContactButton
            label="DOWNLOAD JINX (327 MB)"
            href="/Jinx-app.apk"
            download="Jinx-app.apk"
          />
        </FadeIn>
      </div>
    </section>
  )
}

export default DigitalWaveFieldHero
