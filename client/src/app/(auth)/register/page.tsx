'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { useAuth, getRoleRedirect } from '@/lib/auth';
import { Loader2, Truck, Eye, EyeOff, User, Briefcase } from 'lucide-react';

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [form, setForm] = useState({
    name: '', email: '', phone: '', password: '', role: 'CUSTOMER',
  });
  const [error, setError] = useState('');


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await register(form);
      toast.success(`Welcome, ${user.name}! Account created.`);
      router.push(getRoleRedirect(user.role));
    } catch (err: unknown) {
      const msg = (err as any)?.response?.data?.error || 'Registration failed. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const set = (k: string, v: string) => setForm((prev) => ({ ...prev, [k]: v }));

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2.5 mb-4">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center">
              <Truck className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-white">LastMile</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Create an account</h1>
          <p className="text-white/50 mt-1 text-sm">Start tracking deliveries today</p>
        </div>

        {/* Form card */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Role selector */}
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">I am a...</label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { value: 'CUSTOMER', label: 'Customer',       icon: User,      desc: 'Place & track orders' },
                  { value: 'AGENT',    label: 'Delivery Agent', icon: Briefcase, desc: 'Manage deliveries'    },
                ].map(({ value, label, icon: Icon, desc }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => set('role', value)}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      form.role === value
                        ? 'bg-blue-600/20 border-blue-500/50 text-white'
                        : 'bg-white/5 border-white/10 text-white/50 hover:border-white/25 hover:text-white/70'
                    }`}
                  >
                    <Icon className="w-4 h-4 mb-1.5" />
                    <div className="text-sm font-medium">{label}</div>
                    <div className="text-xs opacity-60 mt-0.5">{desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-white/70 mb-1.5">Full Name</label>
              <input
                type="text"
                required
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder="John Doe"
                className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-blue-400 transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-white/70 mb-1.5">Email address</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => set('email', e.target.value)}
                placeholder="you@example.com"
                className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-blue-400 transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-white/70 mb-1.5">
                Phone <span className="text-white/30">(optional)</span>
              </label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => set('phone', e.target.value)}
                placeholder="+91 9000000000"
                className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-blue-400 transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-white/70 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={form.password}
                  onChange={(e) => set('password', e.target.value)}
                  placeholder="Min. 6 characters"
                  className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-blue-400 transition-colors pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-3.5 text-white/40 hover:text-white/70 transition-colors"
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 mt-1"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Creating account...</>
              ) : (
                'Create Account'
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-white/40 text-sm mt-5">
          Already have an account?{' '}
          <Link href="/login" className="text-blue-400 hover:text-blue-300 font-medium transition-colors">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
