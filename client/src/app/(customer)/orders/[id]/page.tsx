'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useAuth } from '@/lib/auth';
import { ordersApi } from '@/lib/api';
import { TrackingTimeline } from '@/components/tracking-timeline';
import { StatusBadge } from '@/components/status-badge';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { Loader2, Package, MapPin, Scale, CreditCard, User, Truck } from 'lucide-react';

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.push('/login');
  }, [isLoading, isAuthenticated, router]);

  useEffect(() => {
    if (!isAuthenticated || !id) return;
    ordersApi.getById(id as string)
      .then((r) => setOrder(r.data.data.order))
      .catch((e) => setError(e.response?.data?.error || 'Order not found'))
      .finally(() => setLoading(false));
  }, [isAuthenticated, id]);

  if (loading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <p className="text-red-400 text-lg">{error || 'Order not found'}</p>
        <button onClick={() => router.back()} className="mt-4 text-blue-400 hover:text-blue-300 text-sm">
          ← Go back
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <button onClick={() => router.back()} className="text-white/40 hover:text-white text-sm mb-2 flex items-center gap-1">
              ← Back
            </button>
            <h1 className="text-2xl font-bold text-white font-mono">{order.trackingNumber}</h1>
            <p className="text-white/50 mt-1 text-sm">Created {formatDateTime(order.createdAt)}</p>
          </div>
          <StatusBadge status={order.status} size="lg" />
        </div>
      </motion.div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left: Order details */}
        <div className="lg:col-span-1 space-y-4">
          {/* Route */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wide mb-4 flex items-center gap-2">
              <MapPin className="w-3.5 h-3.5 text-blue-400" /> Route
            </h3>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-white/40 mb-1">Pickup</p>
                <p className="text-white text-sm">{order.pickupAddress}</p>
                <p className="text-blue-400 text-xs mt-0.5">{order.pickupZone?.name}</p>
              </div>
              <div className="border-l-2 border-dashed border-white/10 ml-2 pl-3 py-1">
                <Truck className="w-4 h-4 text-white/20" />
              </div>
              <div>
                <p className="text-xs text-white/40 mb-1">Delivery</p>
                <p className="text-white text-sm">{order.dropAddress}</p>
                <p className="text-blue-400 text-xs mt-0.5">{order.dropZone?.name}</p>
              </div>
            </div>
          </motion.div>

          {/* Package details */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
            className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wide mb-4 flex items-center gap-2">
              <Scale className="w-3.5 h-3.5 text-blue-400" /> Package
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-white/50">Type</span><span className="text-white">{order.orderType}</span></div>
              <div className="flex justify-between"><span className="text-white/50">Actual weight</span><span className="text-white">{Number(order.actualWeightKg).toFixed(2)} kg</span></div>
              <div className="flex justify-between"><span className="text-white/50">Volumetric</span><span className="text-white">{Number(order.volumetricWeightKg).toFixed(3)} kg</span></div>
              <div className="flex justify-between"><span className="text-white/50">Billable</span><span className="text-white font-semibold">{Number(order.billableWeightKg).toFixed(1)} kg</span></div>
            </div>
          </motion.div>

          {/* Charges */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wide mb-4 flex items-center gap-2">
              <CreditCard className="w-3.5 h-3.5 text-blue-400" /> Charges
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-white/50">Payment</span><span className="text-white">{order.paymentType}</span></div>
              <div className="flex justify-between"><span className="text-white/50">Base charge</span><span className="text-white">{formatCurrency(Number(order.charge))}</span></div>
              {Number(order.codSurcharge) > 0 && (
                <div className="flex justify-between"><span className="text-white/50">COD surcharge</span><span className="text-white">{formatCurrency(Number(order.codSurcharge))}</span></div>
              )}
              <div className="border-t border-white/10 pt-2 flex justify-between font-bold">
                <span className="text-white">Total</span>
                <span className="text-blue-300">{formatCurrency(Number(order.totalCharge))}</span>
              </div>
            </div>
          </motion.div>

          {/* Agent */}
          {order.assignedAgent && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
              className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-5">
              <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wide mb-3 flex items-center gap-2">
                <User className="w-3.5 h-3.5 text-blue-400" /> Delivery Agent
              </h3>
              <p className="text-white font-medium">{order.assignedAgent.name}</p>
              {order.assignedAgent.phone && <p className="text-white/50 text-sm">{order.assignedAgent.phone}</p>}
            </motion.div>
          )}
        </div>

        {/* Right: Tracking timeline */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="lg:col-span-2 bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-6">
          <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wide mb-6 flex items-center gap-2">
            <Package className="w-3.5 h-3.5 text-blue-400" /> Tracking Timeline
          </h3>
          {order.trackingEvents?.length > 0 ? (
            <TrackingTimeline events={order.trackingEvents} />
          ) : (
            <p className="text-white/30 text-sm">No tracking events yet</p>
          )}
        </motion.div>
      </div>
    </div>
  );
}
