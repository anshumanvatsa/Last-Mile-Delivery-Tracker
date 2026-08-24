'use client';

import { useState, useEffect } from 'react';
import { AuthProvider } from '@/lib/auth';
import { Navbar } from '@/components/navbar';
import { Toaster } from 'sonner';

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <AuthProvider>
      <Navbar />
      <main className="pt-16 min-h-screen">
        {/* Only render children after hydration to prevent framer-motion mismatch */}
        {mounted ? children : (
          <div className="min-h-[calc(100vh-4rem)]" />
        )}
      </main>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#1e293b',
            color: '#f8fafc',
            border: '1px solid rgba(255,255,255,0.1)',
          },
        }}
      />
    </AuthProvider>
  );
}
