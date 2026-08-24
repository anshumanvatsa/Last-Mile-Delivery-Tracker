'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { ordersApi } from '@/lib/api';
import { Loader2, CalendarClock, CheckCircle2, Truck } from 'lucide-react';

export default function ReschedulePage() {
  const { trackingNumber } = useParams<{ trackingNumber: string }>();
  const router = useRouter();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [scheduledDate, setScheduledDate] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');

  // Tomorrow's date in YYYY-MM-DD for min attribute
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  useEffect(() => {
    if (!trackingNumber) return;
    ordersApi.track(trackingNumber as string)
      .then((r) => {
        const o = r.data.data.order;
        if (o.status !== 'FAILED') {
          setError('Only failed deliveries can be rescheduled.');
        }
        setOrder(o);
      })
      .catch((e) => setError(e.response?.data?.error || 'Order not found'))
      .finally(() => setLoading(false));
  }, [trackingNumber]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim() || reason.length < 5) {
      toast.error('Please provide a reason (at least 5 characters)');
      return;
    }
    if (!scheduledDate) {
      toast.error('Please select a delivery date');
      return;
    }

    setSubmitting(true);
    try {
      await ordersApi.reschedule(order.id, scheduledDate, reason);
      setSuccess(true);
      toast.success('Delivery rescheduled successfully!');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to reschedule. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <p className="text-red-400">{error}</p>
        <button onClick={() => router.back()} className="mt-4 text-blue-400 hover:text-blue-300 text-sm">← Go back</button>
      </div>
    );
  }

  if (success) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200 }}>
          <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10 text-green-400" />
          </div>
        </motion.div>
        <h2 className="text-2xl font-bold text-white mb-2">Rescheduled!</h2>
        <p className="text-white/60 mb-3">Your delivery has been rescheduled for</p>
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-6">
          <p className="text-blue-300 font-semibold text-lg">
            {new Date(scheduledDate).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <p className="text-white/40 text-sm mb-6">A delivery agent will be assigned shortly. You will receive an email confirmation.</p>
        <button
          onClick={() => router.push(`/track/${trackingNumber}`)}
          className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2.5 rounded-xl font-medium transition-colors"
        >
          Track Your Order
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-10">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-orange-500/20 flex items-center justify-center mx-auto mb-4">
            <CalendarClock className="w-7 h-7 text-orange-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">Reschedule Delivery</h1>
          <p className="text-white/50 mt-2 text-sm font-mono">{String(trackingNumber).toUpperCase()}</p>
        </div>

        {/* Order info */}
        {order && (
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-6">
            <div className="flex items-center gap-2 text-sm text-white/60 mb-2">
              <Truck className="w-4 h-4 text-blue-400" />
              <span>{order.pickupZone?.name} → {order.dropZone?.name}</span>
            </div>
            <p className="text-white/50 text-xs line-clamp-1">{order.dropAddress}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">
              New Delivery Date <span className="text-red-400">*</span>
            </label>
            <input
              type="date"
              required
              min={tomorrowStr}
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-400 transition-colors [color-scheme:dark]"
            />
            <p className="text-xs text-white/30 mt-1">Earliest available: {new Date(tomorrowStr).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">
              Reason for Reschedule <span className="text-red-400">*</span>
            </label>
            <textarea
              required
              minLength={5}
              rows={4}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. I'll be home on the new date, please redeliver..."
              className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-blue-400 transition-colors resize-none"
            />
            <p className="text-xs text-white/30 mt-1">{reason.length} chars (min 5)</p>
          </div>

          <button
            type="submit"
            disabled={submitting || !scheduledDate || reason.length < 5}
            className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Rescheduling...</> : <><CalendarClock className="w-4 h-4" /> Confirm Reschedule</>}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
