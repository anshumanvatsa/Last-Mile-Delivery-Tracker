'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { useAuth, getRoleRedirect } from '@/lib/auth';
import { Loader2, Truck, Eye, EyeOff } from 'lucide-react';

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await login(form.email, form.password);
      toast.success(`Welcome back, ${user.name}!`);
      router.push(getRoleRedirect(user.role));
    } catch (err: unknown) {
      const msg = (err as any)?.response?.data?.error || 'Login failed. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = (role: string) => {
    const creds: Record<string, { email: string; password: string }> = {
      admin:    { email: 'admin@lastmile.com',     password: 'Test@1234' },
      agent:    { email: 'agent1@lastmile.com',    password: 'Test@1234' },
      customer: { email: 'customer1@lastmile.com', password: 'Test@1234' },
    };
    if (creds[role]) setForm(creds[role]);
  };

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
          <h1 className="text-2xl font-bold text-white">Welcome back</h1>
          <p className="text-white/50 mt-1 text-sm">Sign in to your account</p>
        </div>

        {/* Demo credentials */}
        <div className="bg-blue-950/50 border border-blue-500/20 rounded-xl p-4 mb-5">
          <p className="text-xs text-blue-300/70 mb-2.5 font-medium">⚡ Quick demo login:</p>
          <div className="flex gap-2">
            {[
              { role: 'admin',    label: 'Admin' },
              { role: 'agent',    label: 'Agent' },
              { role: 'customer', label: 'Customer' },
            ].map(({ role, label }) => (
              <button
                key={role}
                type="button"
                onClick={() => fillDemo(role)}
                className="flex-1 text-xs py-1.5 bg-blue-500/10 hover:bg-blue-500/25 text-blue-300 rounded-lg capitalize transition-colors border border-blue-500/20"
              >
                {label}
              </button>
            ))}
          </div>
          <p className="text-xs text-blue-300/40 mt-2">Password for all: Test@1234</p>
        </div>

        {/* Form card */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1.5">
                Email address
              </label>
              <input
                type="email"
                required
                autoComplete="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="you@example.com"
                className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-blue-400 focus:bg-white/8 transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-white/70 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="••••••••"
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
                <><Loader2 className="w-4 h-4 animate-spin" /> Signing in...</>
              ) : (
                'Sign In'
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-white/40 text-sm mt-5">
          Don&apos;t have an account?{' '}
          <Link href="/register" className="text-blue-400 hover:text-blue-300 font-medium transition-colors">
            Sign up free
          </Link>
        </p>
      </div>
    </div>
  );
}
