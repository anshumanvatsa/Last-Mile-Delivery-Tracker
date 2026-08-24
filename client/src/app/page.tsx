'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import {
  Truck, Shield, Zap, MapPin, ArrowRight, Package, BarChart3, Search
} from 'lucide-react';
import { ChargeCalculator } from '@/components/charge-calculator';
import { ordersApi } from '@/lib/api';

export default function LandingPage() {
  const [trackingInput, setTrackingInput] = useState('');
  const router = useRouter();

  const handleTrack = (e: React.FormEvent) => {
    e.preventDefault();
    if (trackingInput.trim()) {
      router.push(`/track/${trackingInput.trim().toUpperCase()}`);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0f1e]">
      {/* ── HERO ──────────────────────────────────────────────── */}
      <section className="relative overflow-hidden pt-20 pb-32 px-4">
        {/* Background glow */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl" />
          <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl" />
        </div>

        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left: Hero text */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="space-y-8"
            >
              <div className="inline-flex items-center gap-2 bg-blue-600/10 border border-blue-500/20 rounded-full px-4 py-2 text-sm text-blue-300">
                <Zap className="w-3.5 h-3.5" />
                Production-grade last-mile platform
              </div>

              <h1 className="text-5xl lg:text-6xl font-bold text-white leading-tight">
                Last-Mile Delivery,{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300">
                  First-Class
                </span>{' '}
                Experience
              </h1>

              <p className="text-xl text-white/60 leading-relaxed">
                Intelligent delivery management with dynamic rate calculation, automated agent assignment,
                and real-time order tracking — built for scale.
              </p>

              {/* Tracking input */}
              <form onSubmit={handleTrack} className="flex gap-3">
                <div className="flex-1 relative">
                  <Search className="absolute left-4 top-3.5 w-4 h-4 text-white/40" />
                  <input
                    type="text"
                    placeholder="Enter tracking number (LMD-YYYYMMDD-XXXXX)"
                    value={trackingInput}
                    onChange={(e) => setTrackingInput(e.target.value)}
                    className="w-full bg-white/5 border border-white/20 rounded-xl pl-10 pr-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-blue-400 focus:bg-white/10 transition-colors"
                  />
                </div>
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-medium transition-colors flex items-center gap-2 whitespace-nowrap"
                >
                  Track <ArrowRight className="w-4 h-4" />
                </button>
              </form>

              {/* CTAs */}
              <div className="flex items-center gap-4">
                <Link
                  href="/register"
                  className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-semibold transition-colors flex items-center gap-2"
                >
                  Get Started <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  href="/login"
                  className="text-white/60 hover:text-white px-6 py-3 rounded-xl font-medium border border-white/10 hover:border-white/20 transition-colors"
                >
                  Sign In
                </Link>
              </div>

              {/* Demo credentials */}
              <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                <p className="text-xs text-white/40 mb-2 font-medium uppercase tracking-wide">Demo Credentials</p>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  {[
                    { role: 'Admin', email: 'admin@lastmile.com' },
                    { role: 'Agent', email: 'agent1@lastmile.com' },
                    { role: 'Customer', email: 'customer1@lastmile.com' },
                  ].map(({ role, email }) => (
                    <div key={role} className="bg-white/5 rounded-lg p-2">
                      <span className="text-blue-400 font-medium block">{role}</span>
                      <span className="text-white/50">{email}</span>
                      <span className="text-white/30 block">Test@1234</span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>

            {/* Right: Charge Calculator */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <ChargeCalculator />
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── FEATURES ──────────────────────────────────────────── */}
      <section className="py-24 px-4 border-t border-white/5">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl font-bold text-white mb-4">
              Everything you need to run last-mile delivery
            </h2>
            <p className="text-white/50 text-lg max-w-2xl mx-auto">
              Production-grade architecture with full audit trail, dynamic pricing, and intelligent assignment.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: BarChart3,
                title: 'Dynamic Rate Engine',
                desc: 'DB-driven rate cards with volumetric weight calculation, zone-based pricing, and COD surcharges. Zero hardcoding — update rates without touching code.',
                color: 'text-blue-400',
                bg: 'bg-blue-500/10 border-blue-500/20',
              },
              {
                icon: Zap,
                title: 'Auto Agent Assignment',
                desc: 'Zone-first intelligent assignment finds the nearest available agent automatically. Fallback to any available agent with documented GPS extension path.',
                color: 'text-green-400',
                bg: 'bg-green-500/10 border-green-500/20',
              },
              {
                icon: MapPin,
                title: 'Real-Time Tracking',
                desc: 'Immutable event-sourced tracking log with actor attribution. Every status change timestamped with agent details and notes — full audit trail.',
                color: 'text-purple-400',
                bg: 'bg-purple-500/10 border-purple-500/20',
              },
              {
                icon: Shield,
                title: 'Secure Auth',
                desc: 'JWT access tokens + server-side refresh token rotation with DB storage. True logout invalidates tokens — no stale token attacks.',
                color: 'text-orange-400',
                bg: 'bg-orange-500/10 border-orange-500/20',
              },
              {
                icon: Package,
                title: 'Failed Delivery Flow',
                desc: 'Automated failed delivery handling with customer email notifications, one-click reschedule, idempotency guards, and automatic agent reassignment.',
                color: 'text-pink-400',
                bg: 'bg-pink-500/10 border-pink-500/20',
              },
              {
                icon: Truck,
                title: 'Admin Dashboard',
                desc: 'Revenue analytics, order management with filters, live agent availability map, visual rate card builder — everything an operations team needs.',
                color: 'text-cyan-400',
                bg: 'bg-cyan-500/10 border-cyan-500/20',
              },
            ].map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className={`bg-white/5 backdrop-blur border rounded-xl p-6 hover:bg-white/8 transition-colors ${feature.bg}`}
              >
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-4 ${feature.bg}`}>
                  <feature.icon className={`w-5 h-5 ${feature.color}`} />
                </div>
                <h3 className="text-white font-semibold mb-2">{feature.title}</h3>
                <p className="text-white/50 text-sm leading-relaxed">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────── */}
      <footer className="border-t border-white/10 py-8 px-4 text-center text-white/30 text-sm">
        <p>© {new Date().getFullYear()} LastMile Delivery Tracker · Built for the hackathon challenge</p>
      </footer>
    </div>
  );
}
