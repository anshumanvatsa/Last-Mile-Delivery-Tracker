'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Truck, Menu, X, LogOut, User, LayoutDashboard, Map } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';

const navLinks = {
  CUSTOMER: [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/orders/new', label: 'Place Order', icon: Truck },
  ],
  AGENT: [
    { href: '/agent', label: 'My Orders', icon: Truck },
  ],
  ADMIN: [
    { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/admin?tab=map', label: 'Map', icon: Map },
  ],
};

export function Navbar() {
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  const links = user ? navLinks[user.role] || [] : [];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0a0f1e]/80 backdrop-blur-xl border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
              <Truck className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-white text-lg tracking-tight">LastMile</span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-1">
            {links.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  pathname.startsWith(href.split('?')[0]) && href !== '/'
                    ? 'bg-blue-600/20 text-blue-300'
                    : 'text-white/60 hover:text-white hover:bg-white/5'
                )}
              >
                <Icon className="w-4 h-4" />
                {label}
              </Link>
            ))}
          </div>

          {/* Right side */}
          <div className="hidden md:flex items-center gap-3">
            {user ? (
              <>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-lg">
                  <User className="w-3.5 h-3.5 text-white/40" />
                  <span className="text-sm text-white/70">{user.name}</span>
                  <span className="text-xs text-blue-400 font-medium">{user.role}</span>
                </div>
                <button
                  onClick={logout}
                  className="flex items-center gap-1.5 px-3 py-2 text-white/50 hover:text-white text-sm rounded-lg hover:bg-white/5 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Link href="/login" className="text-white/60 hover:text-white text-sm px-3 py-2 rounded-lg hover:bg-white/5 transition-colors">
                  Sign In
                </Link>
                <Link href="/register" className="bg-blue-600 hover:bg-blue-500 text-white text-sm px-4 py-2 rounded-lg font-medium transition-colors">
                  Get Started
                </Link>
              </div>
            )}
          </div>

          {/* Mobile toggle */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden text-white/60 hover:text-white"
          >
            {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden border-t border-white/10 bg-[#0a0f1e]"
          >
            <div className="px-4 py-4 space-y-1">
              {links.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-white/70 hover:text-white hover:bg-white/5 transition-colors"
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </Link>
              ))}
              {user ? (
                <button
                  onClick={logout}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-red-400 hover:text-red-300 rounded-lg hover:bg-red-500/10 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </button>
              ) : (
                <div className="pt-2 space-y-2">
                  <Link href="/login" onClick={() => setMobileOpen(false)} className="block text-center py-2 text-white/70 border border-white/20 rounded-lg hover:bg-white/5 transition-colors">Sign In</Link>
                  <Link href="/register" onClick={() => setMobileOpen(false)} className="block text-center py-2 bg-blue-600 text-white rounded-lg font-medium">Get Started</Link>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
