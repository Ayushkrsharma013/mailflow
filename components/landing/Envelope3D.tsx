'use client'
import { motion } from 'framer-motion'
import { useState, useEffect } from 'react'

const PILLS = [
  { label: 'Urgent',        color: '#ef4444', tx: -115, ty: -85  },
  { label: 'Action needed', color: '#f97316', tx: -48,  ty: -130 },
  { label: 'FYI',           color: '#06b6d4', tx: 48,   ty: -130 },
  { label: 'Promo',         color: '#a78bfa', tx: 115,  ty: -85  },
]

export function Envelope3D() {
  // phases: 0=closed  1=opening  2=agent-rising  3=pills-out
  const [phase, setPhase] = useState(0)

  useEffect(() => {
    let alive = true
    const run = async () => {
      while (alive) {
        setPhase(0)
        await delay(900)
        if (!alive) return
        setPhase(1)
        await delay(1300)
        if (!alive) return
        setPhase(2)
        await delay(700)
        if (!alive) return
        setPhase(3)
        await delay(3200)
      }
    }
    run()
    return () => { alive = false }
  }, [])

  return (
    <div style={{ position: 'relative', width: 340, height: 360, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>

      {/* Ambient floor glow */}
      <div style={{
        position: 'absolute', bottom: 30, left: '50%',
        transform: 'translateX(-50%)',
        width: 240, height: 24,
        background: 'rgba(0,212,255,0.14)',
        filter: 'blur(22px)', borderRadius: '50%',
        pointerEvents: 'none',
      }} />

      {/* ── Envelope ── */}
      <div style={{ perspective: '860px', perspectiveOrigin: '50% 44%' }}>
        <motion.div
          style={{
            position: 'relative',
            width: 280, height: 178,
            transformStyle: 'preserve-3d',
          }}
          animate={{
            rotateY: phase === 0 ? -14 : -8,
            rotateX: phase === 0 ? 6 : 2,
            rotateZ: phase === 0 ? -1.5 : -0.5,
          }}
          transition={{ duration: 1.6, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* — Body — */}
          <div style={{
            position: 'absolute', inset: 0, borderRadius: 5,
            background: 'linear-gradient(155deg, #0e2040 0%, #081525 100%)',
            border: '1px solid rgba(0,212,255,0.22)',
            boxShadow: '0 0 50px rgba(0,212,255,0.06), 0 26px 70px rgba(0,0,0,0.7)',
            overflow: 'hidden',
          }}>
            {/* Left-fold crease */}
            <div style={{
              position: 'absolute', inset: 0,
              clipPath: 'polygon(0% 30%, 50% 55%, 0% 100%)',
              background: 'rgba(0,212,255,0.05)',
            }} />
            {/* Right-fold crease */}
            <div style={{
              position: 'absolute', inset: 0,
              clipPath: 'polygon(100% 30%, 50% 55%, 100% 100%)',
              background: 'rgba(0,212,255,0.05)',
            }} />
            {/* Bottom-fold crease */}
            <div style={{
              position: 'absolute', inset: 0,
              clipPath: 'polygon(0% 100%, 50% 55%, 100% 100%)',
              background: 'rgba(0,212,255,0.07)',
            }} />

            {/* Inside content — visible when flap opens */}
            <motion.div
              animate={{ opacity: phase >= 1 ? 1 : 0 }}
              transition={{ duration: 0.5, delay: 0.35 }}
              style={{
                position: 'absolute', top: 0, left: 1, right: 1,
                height: '52%',
                background: 'linear-gradient(180deg, #050c1a 0%, #081422 100%)',
                display: 'flex', flexDirection: 'column',
                padding: '14px 18px', gap: 7, overflow: 'hidden',
              }}
            >
              {[
                { w: '82%', op: 0.9 },
                { w: '64%', op: 0.55 },
                { w: '46%', op: 0.32 },
              ].map(({ w, op }, i) => (
                <motion.div
                  key={i}
                  animate={{ scaleX: phase >= 2 ? 1 : 0 }}
                  transition={{ delay: 0.15 + i * 0.12, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                  style={{
                    height: 5.5, borderRadius: 3, width: w,
                    background: `rgba(0,212,255,${op * 0.55})`,
                    transformOrigin: 'left',
                  }}
                />
              ))}
            </motion.div>
          </div>

          {/* — Back flap (static inner V) — */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: 102,
            background: 'linear-gradient(155deg, #0b1c32, #0e2244)',
            clipPath: 'polygon(0% 0%, 50% 78%, 100% 0%)',
            zIndex: 2,
          }} />

          {/* — Front flap (animated open) — */}
          <motion.div
            style={{
              position: 'absolute', top: 0, left: 0, right: 0, height: 102,
              background: 'linear-gradient(155deg, #122848, #0f2040)',
              clipPath: 'polygon(0% 0%, 100% 0%, 50% 78%)',
              transformOrigin: '50% 0%',
              transformStyle: 'preserve-3d',
              backfaceVisibility: 'hidden',
              zIndex: 3,
              borderBottom: '1px solid rgba(0,212,255,0.12)',
            }}
            animate={{ rotateX: phase >= 1 ? -166 : 0 }}
            transition={{ duration: 1.15, ease: [0.22, 1, 0.36, 1] }}
          />
        </motion.div>
      </div>

      {/* ── AI Agent orb ── */}
      <motion.div
        initial={{ y: 10, opacity: 0, scale: 0.3 }}
        animate={
          phase >= 2
            ? { y: -128, opacity: 1, scale: 1 }
            : { y: 10,  opacity: 0, scale: 0.3 }
        }
        transition={{
          type: 'spring', stiffness: 160, damping: 17,
          opacity: { duration: 0.25 },
        }}
        style={{
          position: 'absolute',
          width: 52, height: 52, borderRadius: '50%',
          background: 'radial-gradient(circle at 35% 32%, #60eeff, #00a8cc 55%, #004d6e)',
          border: '1.5px solid rgba(0,212,255,0.7)',
          boxShadow: '0 0 32px rgba(0,212,255,0.65), 0 0 70px rgba(0,212,255,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 20,
        }}
      >
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2.8, repeat: Infinity, ease: 'linear' }}
          style={{ width: 22, height: 22, opacity: 0.95 }}
        >
          {/* 4-pointed star */}
          <svg viewBox="0 0 22 22" fill="none">
            <path d="M11 1 L13 9 L21 11 L13 13 L11 21 L9 13 L1 11 L9 9 Z" fill="white" />
          </svg>
        </motion.div>

        {/* Pulse ring */}
        <motion.div
          animate={{ scale: [1, 1.9], opacity: [0.5, 0] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeOut' }}
          style={{
            position: 'absolute', inset: -4,
            borderRadius: '50%',
            border: '1.5px solid rgba(0,212,255,0.5)',
            pointerEvents: 'none',
          }}
        />
      </motion.div>

      {/* ── Category pills ── */}
      {PILLS.map((pill, i) => (
        <motion.div
          key={pill.label}
          initial={{ x: 0, y: 10, opacity: 0, scale: 0.4 }}
          animate={
            phase >= 3
              ? { x: pill.tx, y: pill.ty, opacity: 1, scale: 1 }
              : { x: 0,       y: 10,      opacity: 0, scale: 0.4 }
          }
          transition={{
            type: 'spring', stiffness: 130, damping: 18,
            delay: i * 0.09,
            opacity: { duration: 0.2 },
          }}
          style={{
            position: 'absolute',
            fontSize: 10, fontWeight: 600, letterSpacing: '0.03em',
            padding: '4px 11px', borderRadius: 999, whiteSpace: 'nowrap',
            background: `${pill.color}18`,
            border: `1px solid ${pill.color}45`,
            color: pill.color,
            zIndex: 20,
            fontFamily: 'ui-monospace, "Geist Mono", monospace',
          }}
        >
          {pill.label}
        </motion.div>
      ))}
    </div>
  )
}

function delay(ms: number) {
  return new Promise<void>(r => setTimeout(r, ms))
}
