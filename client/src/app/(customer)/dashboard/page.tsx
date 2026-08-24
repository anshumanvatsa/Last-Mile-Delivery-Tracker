'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useAuth } from '@/lib/auth';
import { ordersApi } from '@/lib/api';
import { StatusBadge } from '@/components/status-badge';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { Package, Plus, TrendingUp, Clock, CheckCircle2, Loader2 } from 'lucide-react';

interface Order {
  id: string;
  trackingNumber: string;
  status: string;
  pickupAddress: string;
  dropAddress: string;
  totalCharge: number;
  createdAt: string;
  pickupZone: { name: string };
  dropZone: { name: string };
}

export default function CustomerDashboard() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [stats, setStats] = useState({ total: 0, pending: 0, delivered: 0 });

  useEffect(() => {
    if (!isLoading && (!isAuthenticated || user?.role !== 'CUSTOMER')) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, user, router]);

  useEffect(() => {
    if (!isAuthenticated) return;
    ordersApi.list({ limit: '20' }).then((r) => {
      const data = r.data.data.orders as Order[];
      setOrders(data);
      setStats({
        total: r.data.data.pagination.total,
        pending: data.filter((o) => ['PENDING', 'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY'].includes(o.status)).length,
        delivered: data.filter((o) => o.status === 'DELIVERED').length,
      });
    }).catch(console.error).finally(() => setLoadingOrders(false));
  }, [isAuthenticated]);

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="w-6 h-6 animate-spin text-blue-400" /></div>;
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">My Dashboard</h1>
          <p className="text-white/50 mt-1">Welcome back, {user?.name}</p>
        </div>
        <Link
          href="/orders/new"
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl font-medium transition-colors"
        >
          <Plus className="w-4 h-4" /> Place Order
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: 'Total Orders', value: stats.total, icon: Package, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
          { label: 'In Progress', value: stats.pending, icon: Clock, color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20' },
          { label: 'Delivered', value: stats.delivered, icon: CheckCircle2, color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20' },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className={`bg-white/5 backdrop-blur border rounded-xl p-5 ${stat.bg}`}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-white/50">{stat.label}</span>
              <stat.icon className={`w-5 h-5 ${stat.color}`} />
            </div>
            <p className={`text-3xl font-bold ${stat.color}`}>{stat.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Orders list */}
      <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
          <h2 className="font-semibold text-white flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-blue-400" /> Recent Orders
          </h2>
        </div>

        {loadingOrders ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-16">
            <Package className="w-12 h-12 text-white/20 mx-auto mb-3" />
            <p className="text-white/40">No orders yet</p>
            <Link href="/orders/new" className="mt-4 inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 text-sm">
              <Plus className="w-4 h-4" /> Place your first order
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {orders.map((order, i) => (
              <motion.div
                key={order.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.05 }}
              >
                <Link
                  href={`/orders/${order.id}`}
                  className="flex items-center justify-between px-6 py-4 hover:bg-white/3 transition-colors group"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center flex-shrink-0">
                      <Package className="w-5 h-5 text-blue-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-mono text-sm text-white font-medium">{order.trackingNumber}</p>
                      <p className="text-xs text-white/40 mt-0.5 truncate">
                        {order.pickupZone?.name} → {order.dropZone?.name}
                      </p>
                      <p className="text-xs text-white/30">{formatDateTime(order.createdAt)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 flex-shrink-0 ml-4">
                    <StatusBadge status={order.status} />
                    <span className="text-white/70 font-medium text-sm">{formatCurrency(order.totalCharge)}</span>
                    <span className="text-white/20 group-hover:text-white/40 transition-colors">→</span>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
