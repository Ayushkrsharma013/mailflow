'use client'
import { motion, useScroll, useSpring } from 'framer-motion'
import Link from 'next/link'
import { Mail, Zap, Shield, MessageCircle, ArrowRight, Check, Lock, Sparkles } from 'lucide-react'
import { Envelope3D } from './Envelope3D'
import { GalaxyBg } from './GalaxyBg'

const STEPS = [
  {
    n: '01',
    title: 'Connect Gmail',
    desc: 'OAuth 2.0 in 30 seconds. Connect multiple accounts — we never store your emails.',
    icon: Lock,
    color: '#06b6d4',
  },
  {
    n: '02',
    title: 'AI reads & sorts',
    desc: 'Every email tagged: Urgent, Action needed, FYI, Promo. Sub-second categorization.',
    icon: Sparkles,
    color: '#8b5cf6',
  },
  {
    n: '03',
    title: 'You approve',
    desc: 'Get a daily digest on Telegram or Slack. One-tap to send AI-drafted replies.',
    icon: MessageCircle,
    color: '#22d3ee',
  },
]

const FEATURES = [
  {
    icon: Mail,
    title: 'Multi-Account Inbox',
    desc: 'All your Gmail accounts in one unified digest. No more switching tabs.',
    color: '#06b6d4',
    bg: 'rgba(6,182,212,0.07)',
    border: 'rgba(6,182,212,0.18)',
  },
  {
    icon: Zap,
    title: 'AI Categorization',
    desc: 'Urgent. Action needed. FYI. Promo. Spam. Every email, precisely sorted.',
    color: '#f97316',
    bg: 'rgba(249,115,22,0.07)',
    border: 'rgba(249,115,22,0.18)',
  },
  {
    icon: MessageCircle,
    title: 'Telegram + Slack',
    desc: 'Approve, edit, or reject AI-drafted replies right from your chat app.',
    color: '#a78bfa',
    bg: 'rgba(167,139,250,0.07)',
    border: 'rgba(167,139,250,0.18)',
  },
  {
    icon: Shield,
    title: 'Privacy First',
    desc: 'Tokens encrypted at rest. AI runs server-side. Zero email stored.',
    color: '#34d399',
    bg: 'rgba(52,211,153,0.07)',
    border: 'rgba(52,211,153,0.18)',
  },
]

const STATS = [
  { value: '121', unit: '/day', label: 'avg emails sorted' },
  { value: '5',   unit: '',    label: 'AI categories' },
  { value: '0.3', unit: 's',   label: 'sort latency' },
  { value: '∞',   unit: '',    label: 'accounts supported' },
]

export function LandingPage({ user }: { user: any }) {
  const { scrollYProgress } = useScroll()
  const scaleX = useSpring(scrollYProgress, { stiffness: 100, damping: 30 })

  return (
    <div style={{
      minHeight: '100vh',
      background: '#000000',
      color: '#dde8f0',
      fontFamily: 'ui-sans-serif, system-ui, -apple-system, sans-serif',
      overflowX: 'hidden',
    }}>

      {/* Galaxy starfield background */}
      <GalaxyBg />

      {/* Scroll progress bar */}
      <motion.div style={{
        position: 'fixed', top: 0, left: 0, right: 0, height: 2,
        background: 'linear-gradient(90deg, #00d4ff, #0088cc)',
        transformOrigin: 'left', scaleX, zIndex: 200,
      }} />

      {/* ════════════ HEADER ════════════ */}
      <motion.header
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        style={{
          position: 'sticky', top: 0, zIndex: 50,
          background: 'rgba(0,0,0,0.88)',
          backdropFilter: 'blur(18px)',
          WebkitBackdropFilter: 'blur(18px)',
          borderBottom: '1px solid rgba(0,212,255,0.1)',
          height: 52, padding: '0 28px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 7,
            background: 'linear-gradient(135deg, rgba(0,212,255,0.25), rgba(0,136,204,0.1))',
            border: '1px solid rgba(0,212,255,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Mail size={14} style={{ color: '#00d4ff' }} />
          </div>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#e8f4ff', letterSpacing: '-0.02em' }}>
            MailFlow
          </span>
          <span style={{
            fontSize: 9.5, fontWeight: 600, padding: '2px 7px', borderRadius: 999,
            background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.22)',
            color: '#00d4ff', fontFamily: 'monospace', letterSpacing: '0.06em',
          }}>
            AI
          </span>
        </div>

        <nav style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <a href="#how-it-works" style={{ fontSize: 12.5, color: 'rgba(221,232,240,0.55)', textDecoration: 'none' }}>
            How it works
          </a>
          <a href="#features" style={{ fontSize: 12.5, color: 'rgba(221,232,240,0.55)', textDecoration: 'none' }}>
            Features
          </a>
          <Link
            href={user ? '/dashboard' : '/login'}
            style={{
              fontSize: 12.5, fontWeight: 600,
              padding: '6px 18px', borderRadius: 999,
              background: user ? 'rgba(0,212,255,0.15)' : 'rgba(0,212,255,0.12)',
              border: '1px solid rgba(0,212,255,0.3)',
              color: '#00d4ff', textDecoration: 'none',
            }}
          >
            {user ? 'Dashboard' : 'Sign in'}
          </Link>
        </nav>
      </motion.header>

      {/* ════════════ HERO ════════════ */}
      <section style={{
        position: 'relative', zIndex: 1,
        maxWidth: 1100, margin: '0 auto',
        padding: '80px 28px 60px',
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        alignItems: 'center',
        gap: 48,
      }}>
        {/* Left: copy */}
        <motion.div
          initial={{ opacity: 0, x: -24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* Badge */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 7,
            padding: '5px 12px', borderRadius: 999, marginBottom: 24,
            background: 'rgba(0,212,255,0.08)',
            border: '1px solid rgba(0,212,255,0.2)',
          }}>
            <motion.span
              animate={{ scale: [1, 1.5, 1], opacity: [1, 0.35, 1] }}
              transition={{ duration: 2.2, repeat: Infinity }}
              style={{ width: 5, height: 5, borderRadius: '50%', background: '#00d4ff', display: 'inline-block' }}
            />
            <span style={{
              fontSize: 10.5, fontWeight: 600, color: '#5ee8ff',
              fontFamily: 'monospace', letterSpacing: '0.1em',
            }}>
              AI-NATIVE INBOX
            </span>
          </div>

          <h1 style={{
            fontSize: 'clamp(28px, 4.5vw, 48px)',
            fontWeight: 700, lineHeight: 1.12,
            letterSpacing: '-0.03em',
            marginBottom: 18, color: '#edf6ff',
          }}>
            Your inbox,{' '}
            <span style={{
              background: 'linear-gradient(135deg, #00d4ff, #0088ff)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>
              organized
            </span>
            {' '}by AI.
          </h1>

          <p style={{
            fontSize: 15.5, lineHeight: 1.72,
            color: 'rgba(221,232,240,0.6)',
            marginBottom: 32, maxWidth: 420,
          }}>
            Connect your Gmail. MailFlow categorizes every email, drafts replies in your voice, and sends a daily digest to Telegram or Slack.{' '}
            <span style={{ color: 'rgba(0,212,255,0.8)' }}>You approve — it handles the rest.</span>
          </p>

          {/* CTA row */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 32, flexWrap: 'wrap' }}>
            <Link
              href={user ? '/dashboard' : '/login'}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '12px 24px', borderRadius: 10,
                background: 'linear-gradient(135deg, #00b4db, #0083b0)',
                boxShadow: '0 0 28px rgba(0,212,255,0.25), 0 4px 16px rgba(0,0,0,0.4)',
                color: '#fff', fontSize: 13.5, fontWeight: 600,
                textDecoration: 'none', letterSpacing: '-0.01em',
              }}
            >
              {user ? 'Go to Dashboard' : 'Get started free'}
              <ArrowRight size={14} />
            </Link>
            <a
              href="#how-it-works"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '12px 20px', borderRadius: 10,
                border: '1px solid rgba(255,255,255,0.1)',
                color: 'rgba(221,232,240,0.65)', fontSize: 13.5,
                textDecoration: 'none',
              }}
            >
              See how it works
            </a>
          </div>

          {/* Trust signals */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
            {[
              'Gmail OAuth — no passwords',
              'Encrypted at rest',
              'Cancel any time',
            ].map(t => (
              <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <Check size={11} style={{ color: '#00d4ff', flexShrink: 0 }} />
                <span style={{ fontSize: 11.5, color: 'rgba(221,232,240,0.4)' }}>{t}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Right: 3D envelope */}
        <motion.div
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
          style={{ display: 'flex', justifyContent: 'center' }}
        >
          <Envelope3D />
        </motion.div>
      </section>

      {/* ════════════ STATS STRIP ════════════ */}
      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        style={{
          position: 'relative', zIndex: 1,
          borderTop: '1px solid rgba(0,212,255,0.08)',
          borderBottom: '1px solid rgba(0,212,255,0.08)',
          background: 'rgba(0,212,255,0.025)',
          padding: '22px 28px',
          display: 'flex', justifyContent: 'center', gap: 60, flexWrap: 'wrap',
        }}
      >
        {STATS.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.07, duration: 0.35 }}
            style={{ textAlign: 'center' }}
          >
            <p style={{ fontSize: 0 }}>
              <span style={{ fontSize: 20, fontWeight: 700, color: '#00d4ff', letterSpacing: '-0.02em', fontFamily: 'monospace' }}>
                {s.value}
              </span>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(0,212,255,0.5)', marginLeft: 1 }}>
                {s.unit}
              </span>
            </p>
            <p style={{ fontSize: 10.5, color: 'rgba(221,232,240,0.4)', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {s.label}
            </p>
          </motion.div>
        ))}
      </motion.div>

      {/* ════════════ HOW IT WORKS ════════════ */}
      <section id="how-it-works" style={{ position: 'relative', zIndex: 1, maxWidth: 1100, margin: '0 auto', padding: '88px 28px' }}>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          style={{ textAlign: 'center', marginBottom: 56 }}
        >
          <p style={{
            fontSize: 10.5, fontWeight: 600, letterSpacing: '0.12em',
            color: 'rgba(0,212,255,0.6)', fontFamily: 'monospace',
            marginBottom: 12, textTransform: 'uppercase',
          }}>
            HOW IT WORKS
          </p>
          <h2 style={{
            fontSize: 'clamp(22px, 3.5vw, 34px)', fontWeight: 700,
            color: '#edf6ff', letterSpacing: '-0.025em', lineHeight: 1.2,
          }}>
            Three steps. Inbox{' '}
            <span style={{ color: '#00d4ff' }}>clarity</span>.
          </h2>
        </motion.div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 2, position: 'relative' }}>
          {/* Connector line */}
          <div style={{
            position: 'absolute', top: 32, left: '16.5%', right: '16.5%', height: 1,
            background: 'linear-gradient(90deg, transparent, rgba(0,212,255,0.2) 20%, rgba(0,212,255,0.2) 80%, transparent)',
            pointerEvents: 'none',
          }} />

          {STEPS.map((step, i) => {
            const Icon = step.icon
            return (
              <motion.div
                key={step.n}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.12, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                style={{
                  background: 'rgba(0,212,255,0.03)',
                  border: '1px solid rgba(0,212,255,0.1)',
                  borderRadius: 14,
                  padding: '32px 28px',
                  position: 'relative',
                  textAlign: 'center',
                  margin: '0 1px',
                }}
              >
                {/* Step number */}
                <span style={{
                  position: 'absolute', top: 14, right: 16,
                  fontSize: 9.5, fontWeight: 600, color: 'rgba(0,212,255,0.3)',
                  fontFamily: 'monospace', letterSpacing: '0.06em',
                }}>
                  {step.n}
                </span>

                {/* Icon circle */}
                <div style={{
                  width: 52, height: 52, borderRadius: 14, margin: '0 auto 18px',
                  background: `${step.color}14`,
                  border: `1px solid ${step.color}28`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: step.color,
                }}>
                  <Icon size={22} />
                </div>

                <h3 style={{ fontSize: 15, fontWeight: 600, color: '#edf6ff', marginBottom: 10, letterSpacing: '-0.01em' }}>
                  {step.title}
                </h3>
                <p style={{ fontSize: 13, color: 'rgba(221,232,240,0.5)', lineHeight: 1.65 }}>
                  {step.desc}
                </p>
              </motion.div>
            )
          })}
        </div>
      </section>

      {/* ════════════ FEATURES ════════════ */}
      <section id="features" style={{
        position: 'relative', zIndex: 1,
        background: 'rgba(0,212,255,0.015)',
        borderTop: '1px solid rgba(0,212,255,0.07)',
        borderBottom: '1px solid rgba(0,212,255,0.07)',
      }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '88px 28px' }}>
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            style={{ textAlign: 'center', marginBottom: 52 }}
          >
            <p style={{
              fontSize: 10.5, fontWeight: 600, letterSpacing: '0.12em',
              color: 'rgba(0,212,255,0.6)', fontFamily: 'monospace',
              marginBottom: 12, textTransform: 'uppercase',
            }}>
              FEATURES
            </p>
            <h2 style={{
              fontSize: 'clamp(22px, 3.5vw, 34px)', fontWeight: 700,
              color: '#edf6ff', letterSpacing: '-0.025em',
            }}>
              Everything your inbox needs.
            </h2>
          </motion.div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
            {FEATURES.map((f, i) => {
              const Icon = f.icon
              return (
                <motion.div
                  key={f.title}
                  initial={{ opacity: 0, y: 18 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.09, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                  whileHover={{ y: -3, transition: { type: 'spring', stiffness: 350, damping: 22 } }}
                  style={{
                    background: f.bg,
                    border: `1px solid ${f.border}`,
                    borderRadius: 14, padding: '26px 24px',
                    position: 'relative', overflow: 'hidden',
                  }}
                >
                  {/* Top accent strip */}
                  <div style={{
                    position: 'absolute', top: 0, left: 0, right: 0, height: 2.5,
                    background: `linear-gradient(90deg, ${f.color} 0%, ${f.color}30 60%, transparent 100%)`,
                    opacity: 0.7,
                  }} />

                  <div style={{
                    width: 40, height: 40, borderRadius: 10, marginBottom: 16,
                    background: `${f.color}14`, border: `1px solid ${f.color}28`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: f.color,
                  }}>
                    <Icon size={18} />
                  </div>
                  <h3 style={{ fontSize: 14, fontWeight: 600, color: '#edf6ff', marginBottom: 8, letterSpacing: '-0.01em' }}>
                    {f.title}
                  </h3>
                  <p style={{ fontSize: 12.5, color: 'rgba(221,232,240,0.5)', lineHeight: 1.65 }}>
                    {f.desc}
                  </p>
                </motion.div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ════════════ FINAL CTA ════════════ */}
      <section style={{ position: 'relative', zIndex: 1, padding: '96px 28px', textAlign: 'center', overflow: 'hidden' }}>
        {/* Decorative glow */}
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%,-50%)',
          width: 600, height: 300,
          background: 'radial-gradient(ellipse, rgba(0,212,255,0.07) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        <motion.div
          initial={{ opacity: 0, y: 22 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          style={{ position: 'relative' }}
        >
          {/* Small envelope icon */}
          <div style={{
            width: 52, height: 52, borderRadius: 14, margin: '0 auto 24px',
            background: 'linear-gradient(135deg, rgba(0,212,255,0.2), rgba(0,136,204,0.1))',
            border: '1px solid rgba(0,212,255,0.28)',
            boxShadow: '0 0 32px rgba(0,212,255,0.18)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Mail size={22} style={{ color: '#00d4ff' }} />
          </div>

          <h2 style={{
            fontSize: 'clamp(24px, 4vw, 40px)', fontWeight: 700,
            color: '#edf6ff', letterSpacing: '-0.03em',
            lineHeight: 1.15, marginBottom: 14,
          }}>
            Stop drowning in email.
          </h2>

          <p style={{
            fontSize: 15, color: 'rgba(221,232,240,0.5)', lineHeight: 1.7,
            marginBottom: 36, maxWidth: 380, margin: '0 auto 36px',
          }}>
            Connect Gmail in 30 seconds. Your AI agent starts sorting immediately.
          </p>

          <Link
            href={user ? '/dashboard' : '/login'}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '14px 32px', borderRadius: 12,
              background: 'linear-gradient(135deg, #00b4db, #0083b0)',
              boxShadow: '0 0 40px rgba(0,212,255,0.3), 0 8px 24px rgba(0,0,0,0.5)',
              color: '#fff', fontSize: 14.5, fontWeight: 600,
              textDecoration: 'none', letterSpacing: '-0.01em',
            }}
          >
            {user ? 'Open Dashboard' : 'Get started — it\'s free'}
            <ArrowRight size={15} />
          </Link>

          <p style={{ marginTop: 16, fontSize: 11.5, color: 'rgba(221,232,240,0.3)' }}>
            Works with any Gmail account · No credit card required
          </p>
        </motion.div>
      </section>

      {/* ════════════ FOOTER ════════════ */}
      <footer style={{
        borderTop: '1px solid rgba(0,212,255,0.08)',
        padding: '18px 28px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        maxWidth: 1100, margin: '0 auto',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Mail size={13} style={{ color: 'rgba(0,212,255,0.4)' }} />
          <span style={{ fontSize: 11.5, color: 'rgba(221,232,240,0.3)' }}>
            MailFlow · part of{' '}
            <a href="https://app.flow-forges.com" style={{ color: 'rgba(221,232,240,0.4)', textDecoration: 'none' }}>
              FlowForges
            </a>
          </span>
        </div>
        <p style={{ fontSize: 11.5, color: 'rgba(221,232,240,0.25)', fontFamily: 'monospace' }}>
          &copy; 2026 AKS Forge Lab
        </p>
      </footer>

    </div>
  )
}
