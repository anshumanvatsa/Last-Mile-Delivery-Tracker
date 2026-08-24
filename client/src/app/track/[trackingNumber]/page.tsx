'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ordersApi } from '@/lib/api';
import { TrackingTimeline } from '@/components/tracking-timeline';
import { StatusBadge } from '@/components/status-badge';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { Loader2, Truck, MapPin, AlertCircle, CalendarClock } from 'lucide-react';

export default function PublicTrackingPage() {
  const { trackingNumber } = useParams<{ trackingNumber: string }>();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!trackingNumber) return;
    ordersApi.track(trackingNumber as string)
      .then((r) => setOrder(r.data.data.order))
      .catch((e) => setError(e.response?.data?.error || 'Tracking number not found'))
      .finally(() => setLoading(false));
  }, [trackingNumber]);

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8 text-center">
        <div className="inline-flex items-center gap-2 text-blue-400 mb-3">
          <Truck className="w-5 h-5" />
          <span className="text-sm font-medium uppercase tracking-wide">Package Tracking</span>
        </div>
        <h1 className="text-3xl font-bold text-white font-mono">{String(trackingNumber).toUpperCase()}</h1>
      </motion.div>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
        </div>
      )}

      {error && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="bg-red-500/10 border border-red-500/20 rounded-2xl p-8 text-center">
          <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
          <p className="text-red-300 font-medium">{error}</p>
          <p className="text-white/40 text-sm mt-2">Check the tracking number and try again.</p>
        </motion.div>
      )}

      {order && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          {/* Status card */}
          <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-6">
            <div className="flex items-start justify-between flex-wrap gap-4 mb-5">
              <div>
                <p className="text-white/50 text-sm mb-1">Current Status</p>
                <StatusBadge status={order.status} size="lg" />
              </div>
              {order.scheduledDeliveryDate && (
                <div className="flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 rounded-xl px-4 py-2">
                  <CalendarClock className="w-4 h-4 text-blue-400" />
                  <div>
                    <p className="text-xs text-blue-300/60">Scheduled Delivery</p>
                    <p className="text-blue-300 text-sm font-medium">
                      {new Date(order.scheduledDeliveryDate).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Route */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="bg-white/5 rounded-xl p-3">
                <p className="text-white/40 text-xs mb-1 flex items-center gap-1"><MapPin className="w-3 h-3" /> Origin</p>
                <p className="text-white">{order.pickupZone?.name}</p>
                <p className="text-white/50 text-xs mt-0.5 line-clamp-2">{order.pickupAddress}</p>
              </div>
              <div className="bg-white/5 rounded-xl p-3">
                <p className="text-white/40 text-xs mb-1 flex items-center gap-1"><MapPin className="w-3 h-3" /> Destination</p>
                <p className="text-white">{order.dropZone?.name}</p>
                <p className="text-white/50 text-xs mt-0.5 line-clamp-2">{order.dropAddress}</p>
              </div>
            </div>

            {order.assignedAgent && (
              <div className="mt-4 pt-4 border-t border-white/10 flex items-center gap-2 text-sm text-white/60">
                <Truck className="w-4 h-4 text-blue-400" />
                Assigned agent: <span className="text-white">{order.assignedAgent.name}</span>
              </div>
            )}
          </div>

          {/* Failed delivery CTA */}
          {order.status === 'FAILED' && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              className="bg-red-500/10 border border-red-500/30 rounded-2xl p-6 text-center">
              <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
              <h3 className="text-white font-semibold text-lg mb-2">Delivery Attempt Failed</h3>
              <p className="text-white/60 text-sm mb-5">
                We were unable to deliver your package. Would you like to schedule a new delivery date?
              </p>
              <Link
                href={`/track/${trackingNumber}/reschedule`}
                className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white px-6 py-3 rounded-xl font-semibold transition-colors"
              >
                <CalendarClock className="w-4 h-4" /> Reschedule Delivery
              </Link>
            </motion.div>
          )}

          {/* Tracking timeline */}
          <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-6">
            <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wide mb-6">
              Tracking History
            </h3>
            {order.trackingEvents?.length > 0 ? (
              <TrackingTimeline events={order.trackingEvents} />
            ) : (
              <p className="text-white/30 text-sm">No tracking events yet</p>
            )}
          </div>

          {/* Charge summary */}
          <div className="bg-white/5 backdrop-blur border border-white/10 rounded-xl p-4">
            <div className="flex justify-between text-sm">
              <span className="text-white/50">Order Type</span><span className="text-white">{order.orderType} · {order.paymentType}</span>
            </div>
            <div className="flex justify-between text-sm mt-2">
              <span className="text-white/50">Total Charge</span>
              <span className="text-white font-semibold">{formatCurrency(Number(order.totalCharge))}</span>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
