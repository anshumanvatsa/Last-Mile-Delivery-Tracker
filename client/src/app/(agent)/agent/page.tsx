'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth';
import { ordersApi } from '@/lib/api';
import { StatusBadge } from '@/components/status-badge';
import { formatCurrency, formatDateTime, getNextStatuses, getStatusLabel } from '@/lib/utils';
import { Loader2, Package, MapPin, ChevronDown, CheckCircle2, Truck } from 'lucide-react';

export default function AgentPage() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [statusForms, setStatusForms] = useState<Record<string, { status: string; note: string }>>({});

  useEffect(() => {
    if (!isLoading && (!isAuthenticated || user?.role !== 'AGENT')) {
      router.push('/login');
    }
  }, [isLoading, isAuthenticated, user, router]);

  useEffect(() => {
    if (!isAuthenticated) return;
    ordersApi.list({ limit: '50' })
      .then((r) => {
        const data = r.data.data.orders || [];
        // Sort: active statuses first
        const activeStatuses = ['OUT_FOR_DELIVERY', 'PICKED_UP', 'IN_TRANSIT', 'PENDING'];
        const sorted = [...data].sort((a: any, b: any) => {
          const ai = activeStatuses.indexOf(a.status);
          const bi = activeStatuses.indexOf(b.status);
          if (ai === -1 && bi === -1) return 0;
          if (ai === -1) return 1;
          if (bi === -1) return -1;
          return ai - bi;
        });
        setOrders(sorted);
        // Initialize status forms
        const forms: Record<string, { status: string; note: string }> = {};
        sorted.forEach((o: any) => {
          const next = getNextStatuses(o.status);
          forms[o.id] = { status: next[0] || '', note: '' };
        });
        setStatusForms(forms);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [isAuthenticated]);

  const handleStatusUpdate = async (orderId: string) => {
    const form = statusForms[orderId];
    if (!form?.status) return;
    setUpdatingId(orderId);
    try {
      await ordersApi.updateStatus(orderId, form.status, form.note || undefined);
      // Update local state
      setOrders((prev) => prev.map((o) =>
        o.id === orderId ? { ...o, status: form.status } : o
      ));
      // Update the form with next valid statuses
      const newNextStatuses = getNextStatuses(form.status);
      setStatusForms((prev) => ({
        ...prev,
        [orderId]: { status: newNextStatuses[0] || '', note: '' },
      }));
      toast.success(`Status updated to ${getStatusLabel(form.status)}`);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to update status');
    } finally {
      setUpdatingId(null);
    }
  };

  if (isLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
      </div>
    );
  }

  const activeOrders = orders.filter((o) => !['DELIVERED', 'FAILED'].includes(o.status));
  const completedOrders = orders.filter((o) => ['DELIVERED', 'FAILED'].includes(o.status));

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">My Deliveries</h1>
        <p className="text-white/50 mt-1">Welcome, {user?.name} · {activeOrders.length} active orders</p>
      </div>

      {orders.length === 0 ? (
        <div className="text-center py-20">
          <Package className="w-12 h-12 text-white/20 mx-auto mb-3" />
          <p className="text-white/40">No orders assigned to you yet</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Active orders */}
          {activeOrders.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-white/50 uppercase tracking-wide mb-3">
                Active Orders ({activeOrders.length})
              </h2>
              <div className="space-y-4">
                {activeOrders.map((order, i) => {
                  const form = statusForms[order.id] || { status: '', note: '' };
                  const nextStatuses = getNextStatuses(order.status);
                  const isUpdating = updatingId === order.id;

                  return (
                    <motion.div
                      key={order.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-5"
                    >
                      {/* Order header */}
                      <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
                        <div>
                          <p className="font-mono text-sm text-white font-medium">{order.trackingNumber}</p>
                          <p className="text-white/50 text-xs mt-0.5">{formatDateTime(order.createdAt)}</p>
                        </div>
                        <StatusBadge status={order.status} />
                      </div>

                      {/* Customer & addresses */}
                      <div className="grid sm:grid-cols-2 gap-3 mb-4 text-sm">
                        <div className="bg-white/5 rounded-xl p-3">
                          <p className="text-white/40 text-xs mb-1">Customer</p>
                          <p className="text-white">{order.customer?.name}</p>
                        </div>
                        <div className="bg-white/5 rounded-xl p-3">
                          <p className="text-white/40 text-xs mb-1">Charge</p>
                          <p className="text-white font-semibold">{formatCurrency(Number(order.totalCharge))}</p>
                          <p className="text-white/40 text-xs">{order.paymentType}</p>
                        </div>
                      </div>

                      <div className="space-y-2 text-sm mb-4">
                        <div className="flex items-start gap-2">
                          <MapPin className="w-3.5 h-3.5 text-green-400 mt-0.5 flex-shrink-0" />
                          <div>
                            <span className="text-white/40 text-xs">Pickup · </span>
                            <span className="text-white/70">{order.pickupAddress}</span>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <MapPin className="w-3.5 h-3.5 text-blue-400 mt-0.5 flex-shrink-0" />
                          <div>
                            <span className="text-white/40 text-xs">Drop · </span>
                            <span className="text-white/70">{order.dropAddress}</span>
                          </div>
                        </div>
                      </div>

                      {/* Status update form */}
                      {nextStatuses.length > 0 && (
                        <div className="border-t border-white/10 pt-4 space-y-3">
                          <div className="flex gap-3">
                            <select
                              value={form.status}
                              onChange={(e) => setStatusForms((p) => ({ ...p, [order.id]: { ...form, status: e.target.value } }))}
                              className="flex-1 bg-white/10 border border-white/20 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-400"
                            >
                              {nextStatuses.map((s) => (
                                <option key={s} value={s} className="bg-gray-900">{getStatusLabel(s)}</option>
                              ))}
                            </select>
                            <button
                              onClick={() => handleStatusUpdate(order.id)}
                              disabled={isUpdating || !form.status}
                              className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center gap-2 whitespace-nowrap"
                            >
                              {isUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Truck className="w-4 h-4" />}
                              Update
                            </button>
                          </div>
                          <textarea
                            rows={2}
                            value={form.note}
                            onChange={(e) => setStatusForms((p) => ({ ...p, [order.id]: { ...form, note: e.target.value } }))}
                            placeholder="Optional note (e.g. door locked, left with neighbour...)"
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-blue-400 resize-none"
                          />
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Completed */}
          {completedOrders.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-white/50 uppercase tracking-wide mb-3">
                Completed ({completedOrders.length})
              </h2>
              <div className="space-y-2">
                {completedOrders.map((order) => (
                  <div key={order.id} className="bg-white/3 border border-white/5 rounded-xl p-4 flex items-center justify-between">
                    <div>
                      <p className="font-mono text-sm text-white/70">{order.trackingNumber}</p>
                      <p className="text-white/30 text-xs">{order.customer?.name} · {formatDateTime(order.updatedAt)}</p>
                    </div>
                    <StatusBadge status={order.status} size="sm" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
