'use client';

import { useEffect, useState, lazy, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth';
import { adminApi, ordersApi, agentsApi, zonesApi, rateCardsApi } from '@/lib/api';
import { StatusBadge } from '@/components/status-badge';
import { formatCurrency, formatDateTime, getStatusLabel } from '@/lib/utils';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import {
  Loader2, TrendingUp, Package, Users, AlertTriangle, DollarSign,
  MapPin, ToggleLeft, ToggleRight, Plus, Zap, Settings, LayoutDashboard, Map
} from 'lucide-react';

// Dynamic import for map (SSR must be false for Leaflet)
const MapView = dynamic(() => import('@/components/map-view'), { ssr: false, loading: () => <div className="h-96 flex items-center justify-center text-white/40"><Loader2 className="w-6 h-6 animate-spin" /></div> });

const TABS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'orders', label: 'Orders', icon: Package },
  { id: 'agents', label: 'Agents', icon: Users },
  { id: 'zones', label: 'Zones & Rates', icon: Settings },
  { id: 'map', label: 'Map', icon: Map },
];

export default function AdminDashboard() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('overview');

  // Data state
  const [stats, setStats] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [zones, setZones] = useState<any[]>([]);
  const [rateCards, setRateCards] = useState<any[]>([]);
  const [mapData, setMapData] = useState<any>({ activeOrders: [], agents: [] });

  // Loading states
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [loadingAgents, setLoadingAgents] = useState(true);
  const [loadingZones, setLoadingZones] = useState(true);
  const [loadingMap, setLoadingMap] = useState(true);

  // Filters for orders tab
  const [filterStatus, setFilterStatus] = useState('');
  const [filterZone, setFilterZone] = useState('');

  // New area form
  const [newAreaZoneId, setNewAreaZoneId] = useState('');
  const [newAreaName, setNewAreaName] = useState('');
  const [addingArea, setAddingArea] = useState(false);

  useEffect(() => {
    if (!isLoading && (!isAuthenticated || user?.role !== 'ADMIN')) {
      router.push('/login');
    }
  }, [isLoading, isAuthenticated, user, router]);

  useEffect(() => {
    if (!isAuthenticated || user?.role !== 'ADMIN') return;

    // Load all data
    adminApi.stats().then((r) => setStats(r.data.data)).catch(console.error).finally(() => setLoadingStats(false));
    ordersApi.list({ limit: '100' }).then((r) => setOrders(r.data.data.orders)).catch(console.error).finally(() => setLoadingOrders(false));
    agentsApi.list().then((r) => setAgents(r.data.data.agents)).catch(console.error).finally(() => setLoadingAgents(false));
    zonesApi.list().then((r) => {
      setZones(r.data.data.zones);
      rateCardsApi.list().then((rc) => setRateCards(rc.data.data.rateCards)).catch(console.error);
    }).catch(console.error).finally(() => setLoadingZones(false));
    adminApi.mapData().then((r) => setMapData(r.data.data)).catch(console.error).finally(() => setLoadingMap(false));
  }, [isAuthenticated, user]);

  const handleAutoAssign = async (orderId: string) => {
    try {
      await ordersApi.autoAssign(orderId);
      toast.success('Agent assigned successfully');
      // Refresh orders
      ordersApi.list({ limit: '100' }).then((r) => setOrders(r.data.data.orders));
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Auto-assign failed');
    }
  };

  const handleToggleAvailability = async (agentId: string, current: boolean) => {
    try {
      await agentsApi.updateAvailability(agentId, { isAvailable: !current });
      setAgents((prev) => prev.map((a) => a.id === agentId ? { ...a, agentAvailability: { ...a.agentAvailability, isAvailable: !current } } : a));
      toast.success(`Agent marked as ${!current ? 'available' : 'unavailable'}`);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to update availability');
    }
  };

  const handleAddArea = async () => {
    if (!newAreaZoneId || !newAreaName.trim()) return;
    setAddingArea(true);
    try {
      await zonesApi.addArea(newAreaZoneId, newAreaName.trim());
      toast.success(`Area "${newAreaName}" added`);
      setNewAreaName('');
      zonesApi.list().then((r) => setZones(r.data.data.zones));
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to add area');
    } finally {
      setAddingArea(false);
    }
  };

  // Filter orders
  const filteredOrders = orders.filter((o) => {
    if (filterStatus && o.status !== filterStatus) return false;
    if (filterZone && o.pickupZoneId !== filterZone && o.dropZoneId !== filterZone) return false;
    return true;
  });

  // Prepare map pins
  const orderPins = mapData.activeOrders?.map((o: any) => ({
    id: o.id, type: 'order' as const,
    lat: o.pickupZone.latitude + (Math.random() - 0.5) * 0.1,
    lng: o.pickupZone.longitude + (Math.random() - 0.5) * 0.1,
    label: o.trackingNumber,
    status: o.status,
    popupContent: `<p style="color:#94a3b8;font-size:12px">Status: <b style="color:white">${getStatusLabel(o.status)}</b></p>
      <p style="color:#94a3b8;font-size:12px">Customer: <b style="color:white">${o.customer?.name}</b></p>
      <p style="color:#94a3b8;font-size:12px">Zone: ${o.pickupZone?.name} → ${o.dropZone?.name}</p>`,
  })) || [];

  const agentPins = mapData.agents?.map((a: any) => ({
    id: a.id, type: 'agent' as const,
    lat: a.currentZone.latitude + (Math.random() - 0.5) * 0.08,
    lng: a.currentZone.longitude + (Math.random() - 0.5) * 0.08,
    label: a.agent?.name || 'Agent',
    isAvailable: a.isAvailable,
    popupContent: `<p style="color:#94a3b8;font-size:12px">Zone: <b style="color:white">${a.currentZone?.name}</b></p>
      <p style="color:#94a3b8;font-size:12px">Status: <b style="color:${a.isAvailable ? '#22c55e' : '#ef4444'}">${a.isAvailable ? 'Available' : 'Busy'}</b></p>`,
  })) || [];

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="w-6 h-6 animate-spin text-blue-400" /></div>;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Admin Dashboard</h1>
        <p className="text-white/50 mt-1">Welcome, {user?.name}</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white/5 border border-white/10 rounded-xl p-1 mb-8 overflow-x-auto">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              activeTab === id ? 'bg-blue-600 text-white' : 'text-white/50 hover:text-white hover:bg-white/5'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* ── TAB: OVERVIEW ─────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {loadingStats ? (
            <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-blue-400" /></div>
          ) : stats && (
            <>
              {/* Stats cards */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {[
                  { label: 'Orders Today', value: stats.today?.orders, icon: Package, color: 'text-blue-400', bg: 'border-blue-500/20' },
                  { label: "Today's Revenue", value: formatCurrency(stats.today?.revenue || 0), icon: DollarSign, color: 'text-green-400', bg: 'border-green-500/20' },
                  { label: 'Agents Available', value: `${stats.agents?.available}/${stats.agents?.total}`, icon: Users, color: 'text-teal-400', bg: 'border-teal-500/20' },
                  { label: 'Pending', value: stats.ordersByStatus?.PENDING || 0, icon: TrendingUp, color: 'text-orange-400', bg: 'border-orange-500/20' },
                  { label: 'Revenue at Risk', value: formatCurrency(stats.revenueAtRisk?.amount || 0), icon: AlertTriangle, color: 'text-red-400', bg: 'border-red-500/20' },
                ].map((s, i) => (
                  <motion.div key={s.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
                    className={`bg-white/5 border ${s.bg} rounded-xl p-4`}>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs text-white/50">{s.label}</p>
                      <s.icon className={`w-4 h-4 ${s.color}`} />
                    </div>
                    <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                  </motion.div>
                ))}
              </div>

              {/* Revenue week/month */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                  <p className="text-xs text-white/50 mb-1">This Week Revenue</p>
                  <p className="text-2xl font-bold text-green-400">{formatCurrency(stats.week?.revenue || 0)}</p>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                  <p className="text-xs text-white/50 mb-1">This Month Revenue</p>
                  <p className="text-2xl font-bold text-blue-400">{formatCurrency(stats.month?.revenue || 0)}</p>
                </div>
              </div>

              {/* Charts */}
              <div className="grid lg:grid-cols-2 gap-6">
                {/* Orders by status bar chart */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                  <h3 className="text-sm font-semibold text-white mb-4">Orders by Status</h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={Object.entries(stats.ordersByStatus || {}).map(([k, v]) => ({ status: getStatusLabel(k), count: v as number }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="status" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} />
                      <YAxis tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} />
                      <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }} labelStyle={{ color: 'white' }} itemStyle={{ color: '#3b82f6' }} />
                      <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Revenue by day line chart */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                  <h3 className="text-sm font-semibold text-white mb-4">Revenue (Last 7 Days)</h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={(stats.revenueByDay || []).map((d: any) => ({ date: new Date(d.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }), revenue: d.revenue || 0, orders: d.orders || 0 }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="date" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} />
                      <YAxis tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} tickFormatter={(v) => `₹${(v/1000).toFixed(1)}k`} />
                      <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }} labelStyle={{ color: 'white' }} itemStyle={{ color: '#22c55e' }} formatter={(v: any) => formatCurrency(v)} />
                      <Line type="monotone" dataKey="revenue" stroke="#22c55e" strokeWidth={2} dot={{ fill: '#22c55e', r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── TAB: ORDERS ─────────────────────────────────────── */}
      {activeTab === 'orders' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex gap-3 flex-wrap">
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-white/10 border border-white/20 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-blue-400">
              <option value="" className="bg-gray-900">All Statuses</option>
              {['PENDING','PICKED_UP','IN_TRANSIT','OUT_FOR_DELIVERY','DELIVERED','FAILED'].map((s) => (
                <option key={s} value={s} className="bg-gray-900">{getStatusLabel(s)}</option>
              ))}
            </select>
            <select value={filterZone} onChange={(e) => setFilterZone(e.target.value)}
              className="bg-white/10 border border-white/20 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-blue-400">
              <option value="" className="bg-gray-900">All Zones</option>
              {zones.map((z) => <option key={z.id} value={z.id} className="bg-gray-900">{z.name}</option>)}
            </select>
            <span className="text-white/40 text-sm self-center">{filteredOrders.length} orders</span>
          </div>

          {/* Table */}
          <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-white/40 text-xs uppercase tracking-wide">
                    <th className="px-4 py-3 text-left">Tracking #</th>
                    <th className="px-4 py-3 text-left">Customer</th>
                    <th className="px-4 py-3 text-left">Route</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-right">Charge</th>
                    <th className="px-4 py-3 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {loadingOrders ? (
                    <tr><td colSpan={6} className="px-4 py-10 text-center"><Loader2 className="w-5 h-5 animate-spin text-blue-400 mx-auto" /></td></tr>
                  ) : filteredOrders.length === 0 ? (
                    <tr><td colSpan={6} className="px-4 py-10 text-center text-white/40">No orders found</td></tr>
                  ) : filteredOrders.map((order) => (
                    <tr key={order.id} className="hover:bg-white/3 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-white/70">{order.trackingNumber}</td>
                      <td className="px-4 py-3 text-white/70">{order.customer?.name}</td>
                      <td className="px-4 py-3 text-white/50 text-xs">
                        <span className="text-white/70">{order.pickupZone?.name}</span> → {order.dropZone?.name}
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={order.status} size="sm" /></td>
                      <td className="px-4 py-3 text-right text-white/70">{formatCurrency(Number(order.totalCharge))}</td>
                      <td className="px-4 py-3">
                        {!order.assignedAgentId && order.status === 'PENDING' && (
                          <button onClick={() => handleAutoAssign(order.id)}
                            className="flex items-center gap-1 text-xs bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 px-2 py-1 rounded-lg transition-colors">
                            <Zap className="w-3 h-3" /> Auto Assign
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: AGENTS ─────────────────────────────────────── */}
      {activeTab === 'agents' && (
        <div>
          {loadingAgents ? (
            <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-blue-400" /></div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {agents.map((agent) => {
                const avail = agent.agentAvailability;
                return (
                  <div key={agent.id} className="bg-white/5 border border-white/10 rounded-2xl p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="text-white font-semibold">{agent.name}</p>
                        <p className="text-white/40 text-xs">{agent.email}</p>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${avail?.isAvailable ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>
                        {avail?.isAvailable ? '● Available' : '● Busy'}
                      </span>
                    </div>
                    <div className="space-y-1.5 text-xs text-white/50 mb-4">
                      <div className="flex justify-between"><span>Zone</span><span className="text-white/70">{avail?.currentZone?.name || '—'}</span></div>
                      <div className="flex justify-between"><span>Active Orders</span><span className="text-white/70">{agent.activeOrders}</span></div>
                      <div className="flex justify-between"><span>Delivered Today</span><span className="text-green-400 font-medium">{agent.deliveredToday}</span></div>
                    </div>
                    <button
                      onClick={() => handleToggleAvailability(agent.id, avail?.isAvailable)}
                      className={`w-full py-2 rounded-xl text-xs font-medium transition-colors flex items-center justify-center gap-2 ${
                        avail?.isAvailable
                          ? 'bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/20'
                          : 'bg-green-500/10 hover:bg-green-500/20 text-green-300 border border-green-500/20'
                      }`}
                    >
                      {avail?.isAvailable ? <><ToggleRight className="w-3.5 h-3.5" /> Mark Unavailable</> : <><ToggleLeft className="w-3.5 h-3.5" /> Mark Available</>}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── TAB: ZONES & RATES ─────────────────────────────── */}
      {activeTab === 'zones' && (
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Zones */}
          <div className="space-y-4">
            <h3 className="text-white font-semibold flex items-center gap-2"><MapPin className="w-4 h-4 text-blue-400" /> Zones & Areas</h3>
            {loadingZones ? <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-blue-400" /></div> : (
              <div className="space-y-3">
                {zones.map((zone) => (
                  <div key={zone.id} className="bg-white/5 border border-white/10 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="text-white font-medium">{zone.name}</p>
                        <p className="text-white/40 text-xs">{zone.latitude?.toFixed(4)}°N, {zone.longitude?.toFixed(4)}°E</p>
                      </div>
                      <span className="text-xs text-white/40">{zone.areas?.length} areas</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {zone.areas?.map((area: any) => (
                        <span key={area.id} className="text-xs bg-white/10 text-white/60 px-2 py-0.5 rounded-full">{area.areaName}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Add area */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
              <h4 className="text-sm font-medium text-white mb-3 flex items-center gap-1.5"><Plus className="w-3.5 h-3.5 text-blue-400" /> Add Area to Zone</h4>
              <div className="space-y-2">
                <select value={newAreaZoneId} onChange={(e) => setNewAreaZoneId(e.target.value)}
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-400">
                  <option value="" className="bg-gray-900">Select zone</option>
                  {zones.map((z) => <option key={z.id} value={z.id} className="bg-gray-900">{z.name}</option>)}
                </select>
                <div className="flex gap-2">
                  <input value={newAreaName} onChange={(e) => setNewAreaName(e.target.value)} placeholder="Area name or pincode"
                    className="flex-1 bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-blue-400" />
                  <button onClick={handleAddArea} disabled={addingArea || !newAreaZoneId || !newAreaName.trim()}
                    className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5">
                    {addingArea ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />} Add
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Rate Cards */}
          <div className="space-y-4">
            <h3 className="text-white font-semibold">Rate Cards</h3>
            <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
              <table className="w-full text-xs">
                <thead className="border-b border-white/10">
                  <tr className="text-white/40 uppercase tracking-wide">
                    <th className="px-3 py-2.5 text-left">Type</th>
                    <th className="px-3 py-2.5 text-left">Route</th>
                    <th className="px-3 py-2.5 text-right">Rate/kg</th>
                    <th className="px-3 py-2.5 text-right">COD%</th>
                    <th className="px-3 py-2.5 text-left">Since</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {rateCards.slice(0, 20).map((rc) => (
                    <tr key={rc.id} className="hover:bg-white/3 transition-colors">
                      <td className="px-3 py-2"><span className={`px-1.5 py-0.5 rounded text-xs font-bold ${rc.orderType === 'B2C' ? 'bg-blue-500/20 text-blue-300' : 'bg-purple-500/20 text-purple-300'}`}>{rc.orderType}</span></td>
                      <td className="px-3 py-2 text-white/60">{rc.fromZone?.name?.split(' ')[0]} → {rc.toZone?.name?.split(' ')[0]}</td>
                      <td className="px-3 py-2 text-right text-white font-medium">₹{Number(rc.baseRatePerKg)}</td>
                      <td className="px-3 py-2 text-right text-white/50">{Number(rc.codSurchargePercent)}%</td>
                      <td className="px-3 py-2 text-white/40">{new Date(rc.effectiveFrom).getFullYear()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB: MAP ─────────────────────────────────────────── */}
      {activeTab === 'map' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-white font-semibold flex items-center gap-2">
              <Map className="w-4 h-4 text-blue-400" /> Live Order & Agent Map
            </h3>
            <div className="text-xs text-white/40">
              {orderPins.length} active orders · {agentPins.length} agents
            </div>
          </div>
          {loadingMap ? (
            <div className="h-96 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-blue-400" /></div>
          ) : (
            <MapView pins={[...orderPins, ...agentPins]} />
          )}
        </div>
      )}
    </div>
  );
}
