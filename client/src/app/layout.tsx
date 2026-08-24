import type { Metadata } from 'next';
import './globals.css';
import ClientLayout from './client-layout';

export const metadata: Metadata = {
  title: 'LastMile — Delivery Tracker',
  description: 'Production-grade last-mile delivery tracking platform with real-time updates, intelligent agent assignment, and comprehensive analytics.',
  keywords: 'delivery, tracking, logistics, last-mile, courier',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#0a0f1e] text-white antialiased font-sans">
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}
