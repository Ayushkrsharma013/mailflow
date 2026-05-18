"use client"

import { useEffect, useRef } from "react"

interface Star { x: number; y: number; r: number; alpha: number; twinkle: number }
interface Meteor {
  x: number; y: number; vx: number; vy: number
  length: number; alpha: number; life: number; max: number
}

function spawnMeteor(w: number, h: number): Meteor {
  // Start along top edge or left edge
  const fromTop = Math.random() > 0.4
  const x = fromTop ? Math.random() * w : -10
  const y = fromTop ? -10 : Math.random() * h * 0.55
  const angle = 0.55 + (Math.random() - 0.5) * 0.4  // ~31° range around 45°
  const speed = 9 + Math.random() * 7
  return {
    x, y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    length: 90 + Math.random() * 110,
    alpha: 0, life: 0,
    max: 55 + Math.random() * 35,
  }
}

export function GalaxyBg() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")!

    let raf: number
    let frame = 0
    let w = window.innerWidth
    let h = window.innerHeight
    canvas.width = w
    canvas.height = h

    // Build static star field — sparse, varied sizes/brightness
    const stars: Star[] = Array.from({ length: 110 }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      r: 0.25 + Math.random() * 1.1,
      alpha: 0.12 + Math.random() * 0.6,
      twinkle: Math.random() * Math.PI * 2,
    }))

    const meteors: Meteor[] = []
    let nextSpawn = 100 + Math.floor(Math.random() * 80)

    function tick() {
      ctx.clearRect(0, 0, w, h)

      // Pitch black base
      ctx.fillStyle = "#000000"
      ctx.fillRect(0, 0, w, h)

      // Faint blue-violet nebula core — very subtle
      const nebula = ctx.createRadialGradient(w * 0.48, h * 0.38, 0, w * 0.48, h * 0.38, w * 0.55)
      nebula.addColorStop(0, "rgba(10,25,60,0.07)")
      nebula.addColorStop(1, "rgba(0,0,0,0)")
      ctx.fillStyle = nebula
      ctx.fillRect(0, 0, w, h)

      // Stars — gentle twinkle
      const t = frame * 0.007
      for (const s of stars) {
        const tw = s.alpha + Math.sin(t + s.twinkle) * 0.12
        ctx.beginPath()
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(210,230,255,${Math.max(0.04, tw)})`
        ctx.fill()
      }

      // Shooting stars
      if (frame >= nextSpawn) {
        meteors.push(spawnMeteor(w, h))
        nextSpawn = frame + 130 + Math.floor(Math.random() * 160)
      }

      for (let i = meteors.length - 1; i >= 0; i--) {
        const m = meteors[i]
        m.life++
        m.x += m.vx
        m.y += m.vy

        // Alpha envelope: quick fade-in (20%), hold (55%), fade-out (25%)
        const p = m.life / m.max
        if (p < 0.2)       m.alpha = p / 0.2
        else if (p > 0.75) m.alpha = 1 - (p - 0.75) / 0.25
        else               m.alpha = 1
        m.alpha = Math.max(0, Math.min(1, m.alpha))

        // Tail
        const len = Math.sqrt(m.vx * m.vx + m.vy * m.vy)
        const tx = m.x - (m.vx / len) * m.length
        const ty = m.y - (m.vy / len) * m.length

        const grad = ctx.createLinearGradient(tx, ty, m.x, m.y)
        grad.addColorStop(0, "rgba(190,230,255,0)")
        grad.addColorStop(0.65, `rgba(200,235,255,${m.alpha * 0.22})`)
        grad.addColorStop(1, `rgba(255,255,255,${m.alpha * 0.92})`)

        ctx.beginPath()
        ctx.moveTo(tx, ty)
        ctx.lineTo(m.x, m.y)
        ctx.strokeStyle = grad
        ctx.lineWidth = 1.4
        ctx.stroke()

        // Bright head glow
        const glow = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, 5)
        glow.addColorStop(0, `rgba(255,255,255,${m.alpha * 0.88})`)
        glow.addColorStop(0.5, `rgba(180,230,255,${m.alpha * 0.3})`)
        glow.addColorStop(1, "rgba(0,0,0,0)")
        ctx.fillStyle = glow
        ctx.fillRect(m.x - 5, m.y - 5, 10, 10)

        if (m.life >= m.max || m.x > w + 250 || m.y > h + 250) {
          meteors.splice(i, 1)
        }
      }

      frame++
      raf = requestAnimationFrame(tick)
    }

    tick()

    function onResize() {
      w = window.innerWidth
      h = window.innerHeight
      if (canvas) { canvas.width = w; canvas.height = h }
      for (const s of stars) {
        s.x = Math.random() * w
        s.y = Math.random() * h
      }
    }
    window.addEventListener("resize", onResize)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener("resize", onResize)
    }
  }, [])

  return (
    <canvas
      ref={ref}
      style={{
        position: "fixed", inset: 0,
        width: "100vw", height: "100vh",
        zIndex: 0, pointerEvents: "none", display: "block",
      }}
    />
  )
}
