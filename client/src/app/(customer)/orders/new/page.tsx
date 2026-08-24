'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { zonesApi, ordersApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatCurrency } from '@/lib/utils';
import { Loader2, MapPin, Package, CheckCircle2, ChevronRight } from 'lucide-react';

interface Zone { id: string; name: string; }
interface ChargeResult {
  volumetricWeightKg: number; billableWeightKg: number;
  baseRatePerKg: number; baseCharge: number;
  codSurchargePercent: number; codSurcharge: number;
  totalCharge: number; rateCardName: string;
}

const STEPS = ['Addresses', 'Package', 'Confirm'];

export default function NewOrderPage() {
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [zones, setZones] = useState<Zone[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [chargeLoading, setChargeLoading] = useState(false);
  const [charge, setCharge] = useState<ChargeResult | null>(null);
  const [createdOrder, setCreatedOrder] = useState<any>(null);

  const [form, setForm] = useState({
    pickupAddress: '', dropAddress: '',
    pickupZoneId: '', dropZoneId: '',
    pickupZoneName: '', dropZoneName: '',
    lengthCm: '', breadthCm: '', heightCm: '', actualWeightKg: '',
    orderType: 'B2C', paymentType: 'PREPAID',
  });

  useEffect(() => {
    zonesApi.list().then((r) => setZones(r.data.data.zones || []));
  }, []);

  // Live charge calculation when dimensions change
  useEffect(() => {
    if (!form.pickupZoneId || !form.dropZoneId || !form.lengthCm || !form.breadthCm || !form.heightCm || !form.actualWeightKg) {
      setCharge(null);
      return;
    }
    const timer = setTimeout(async () => {
      setChargeLoading(true);
      try {
        const r = await ordersApi.calculateCharge({
          pickupZoneId: form.pickupZoneId,
          dropZoneId: form.dropZoneId,
          lengthCm: parseFloat(form.lengthCm),
          breadthCm: parseFloat(form.breadthCm),
          heightCm: parseFloat(form.heightCm),
          actualWeightKg: parseFloat(form.actualWeightKg),
          orderType: form.orderType,
          paymentType: form.paymentType,
        });
        setCharge(r.data.data);
      } catch { setCharge(null); }
      finally { setChargeLoading(false); }
    }, 600);
    return () => clearTimeout(timer);
  }, [form.pickupZoneId, form.dropZoneId, form.lengthCm, form.breadthCm, form.heightCm, form.actualWeightKg, form.orderType, form.paymentType]);

  const detectZone = useCallback(async (area: string, field: 'pickup' | 'drop') => {
    if (area.length < 3) return;
    try {
      const r = await zonesApi.detect(area);
      if (r.data.data.detected && r.data.data.zone) {
        const z = r.data.data.zone;
        if (field === 'pickup') {
          setForm((p) => ({ ...p, pickupZoneId: z.id, pickupZoneName: z.name }));
        } else {
          setForm((p) => ({ ...p, dropZoneId: z.id, dropZoneName: z.name }));
        }
      }
    } catch {}
  }, []);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const r = await ordersApi.create({
        pickupAddress: form.pickupAddress,
        dropAddress: form.dropAddress,
        pickupZoneId: form.pickupZoneId,
        dropZoneId: form.dropZoneId,
        lengthCm: parseFloat(form.lengthCm),
        breadthCm: parseFloat(form.breadthCm),
        heightCm: parseFloat(form.heightCm),
        actualWeightKg: parseFloat(form.actualWeightKg),
        orderType: form.orderType,
        paymentType: form.paymentType,
      });
      setCreatedOrder(r.data.data.order);
      setStep(3); // Success step
      toast.success('Order placed successfully!');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to place order');
    } finally {
      setSubmitting(false);
    }
  };

  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  if (createdOrder) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200 }}>
          <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10 text-green-400" />
          </div>
        </motion.div>
        <h2 className="text-2xl font-bold text-white mb-2">Order Placed!</h2>
        <p className="text-white/50 mb-6">Your order has been successfully created and is being processed.</p>
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-6">
          <p className="text-xs text-white/40 mb-1">Tracking Number</p>
          <p className="font-mono text-xl font-bold text-blue-400">{createdOrder.trackingNumber}</p>
        </div>
        <div className="flex gap-3 justify-center">
          <button onClick={() => router.push(`/orders/${createdOrder.id}`)} className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2.5 rounded-xl font-medium transition-colors">
            View Order
          </button>
          <button onClick={() => router.push('/dashboard')} className="bg-white/10 hover:bg-white/15 text-white px-6 py-2.5 rounded-xl font-medium transition-colors">
            Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-2">Place New Order</h1>
        {/* Step indicator */}
        <div className="flex items-center gap-2 mt-4">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                i < step ? 'bg-green-500 text-white' : i === step ? 'bg-blue-600 text-white' : 'bg-white/10 text-white/40'
              }`}>
                {i < step ? '✓' : i + 1}
              </div>
              <span className={`text-sm ${i === step ? 'text-white' : 'text-white/40'}`}>{s}</span>
              {i < STEPS.length - 1 && <div className={`flex-1 h-0.5 w-8 ${i < step ? 'bg-green-500' : 'bg-white/10'}`} />}
            </div>
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {/* ── STEP 1: Addresses ─────────────────────────────── */}
        {step === 0 && (
          <motion.div key="step0" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
            className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-6 space-y-5">
            <h2 className="font-semibold text-white flex items-center gap-2">
              <MapPin className="w-4 h-4 text-blue-400" /> Pickup & Delivery Addresses
            </h2>

            {/* Pickup */}
            <div>
              <label className="text-sm text-white/60 mb-1.5 block">Pickup Address</label>
              <input
                value={form.pickupAddress}
                onChange={(e) => {
                  set('pickupAddress', e.target.value);
                  // Detect zone from last word
                  const words = e.target.value.split(/[,\s]+/).filter(Boolean);
                  if (words.length > 0) detectZone(words[words.length - 1], 'pickup');
                }}
                placeholder="Full pickup address (include area/pincode)"
                className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-blue-400 transition-colors"
              />
              {form.pickupZoneName && (
                <p className="text-xs text-green-400 mt-1 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Pickup Zone: {form.pickupZoneName}
                </p>
              )}
              {!form.pickupZoneName && (
                <div className="mt-2">
                  <label className="text-xs text-white/40 mb-1 block">Select zone manually</label>
                  <select value={form.pickupZoneId} onChange={(e) => {
                    const z = zones.find((z) => z.id === e.target.value);
                    set('pickupZoneId', e.target.value);
                    if (z) set('pickupZoneName', z.name);
                  }} className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-400">
                    <option value="" className="bg-gray-900">Select pickup zone</option>
                    {zones.map((z) => <option key={z.id} value={z.id} className="bg-gray-900">{z.name}</option>)}
                  </select>
                </div>
              )}
            </div>

            {/* Drop */}
            <div>
              <label className="text-sm text-white/60 mb-1.5 block">Delivery Address</label>
              <input
                value={form.dropAddress}
                onChange={(e) => {
                  set('dropAddress', e.target.value);
                  const words = e.target.value.split(/[,\s]+/).filter(Boolean);
                  if (words.length > 0) detectZone(words[words.length - 1], 'drop');
                }}
                placeholder="Full delivery address (include area/pincode)"
                className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-blue-400 transition-colors"
              />
              {form.dropZoneName && (
                <p className="text-xs text-green-400 mt-1 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Drop Zone: {form.dropZoneName}
                </p>
              )}
              {!form.dropZoneName && (
                <div className="mt-2">
                  <label className="text-xs text-white/40 mb-1 block">Select zone manually</label>
                  <select value={form.dropZoneId} onChange={(e) => {
                    const z = zones.find((z) => z.id === e.target.value);
                    set('dropZoneId', e.target.value);
                    if (z) set('dropZoneName', z.name);
                  }} className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-400">
                    <option value="" className="bg-gray-900">Select drop zone</option>
                    {zones.map((z) => <option key={z.id} value={z.id} className="bg-gray-900">{z.name}</option>)}
                  </select>
                </div>
              )}
            </div>

            <button
              onClick={() => setStep(1)}
              disabled={!form.pickupAddress || !form.dropAddress || !form.pickupZoneId || !form.dropZoneId}
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              Next: Package Details <ChevronRight className="w-4 h-4" />
            </button>
          </motion.div>
        )}

        {/* ── STEP 2: Package ─────────────────────────────── */}
        {step === 1 && (
          <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
            className="space-y-4">
            <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-6 space-y-5">
              <h2 className="font-semibold text-white flex items-center gap-2">
                <Package className="w-4 h-4 text-blue-400" /> Package Details
              </h2>

              {/* Dimensions */}
              <div>
                <label className="text-sm text-white/60 mb-2 block">Dimensions (cm)</label>
                <div className="grid grid-cols-3 gap-3">
                  {[{ k: 'lengthCm', p: 'Length' }, { k: 'breadthCm', p: 'Breadth' }, { k: 'heightCm', p: 'Height' }].map(({ k, p }) => (
                    <input key={k} type="number" min="0" step="0.1" placeholder={p}
                      value={form[k as keyof typeof form]}
                      onChange={(e) => set(k, e.target.value)}
                      className="bg-white/5 border border-white/20 rounded-xl px-3 py-3 text-white placeholder-white/30 focus:outline-none focus:border-blue-400 text-sm"
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm text-white/60 mb-1.5 block">Actual Weight (kg)</label>
                <input type="number" min="0" step="0.1" placeholder="e.g. 1.5"
                  value={form.actualWeightKg}
                  onChange={(e) => set('actualWeightKg', e.target.value)}
                  className="w-full bg-white/5 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-blue-400"
                />
              </div>

              {/* Type selectors */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-white/60 mb-2 block">Order Type</label>
                  <div className="flex rounded-xl overflow-hidden border border-white/20">
                    {['B2C', 'B2B'].map((t) => (
                      <button key={t} type="button" onClick={() => set('orderType', t)}
                        className={`flex-1 py-2.5 text-sm font-medium transition-colors ${form.orderType === t ? 'bg-blue-600 text-white' : 'bg-white/5 text-white/50 hover:text-white'}`}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-sm text-white/60 mb-2 block">Payment</label>
                  <div className="flex rounded-xl overflow-hidden border border-white/20">
                    {['PREPAID', 'COD'].map((t) => (
                      <button key={t} type="button" onClick={() => set('paymentType', t)}
                        className={`flex-1 py-2.5 text-sm font-medium transition-colors ${form.paymentType === t ? 'bg-blue-600 text-white' : 'bg-white/5 text-white/50 hover:text-white'}`}>
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Live charge preview */}
            <AnimatePresence>
              {chargeLoading && (
                <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center gap-3 text-white/50 text-sm">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-400" /> Calculating charge...
                </div>
              )}
              {charge && !chargeLoading && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  className="bg-blue-950/50 border border-blue-500/20 rounded-xl p-4">
                  <p className="text-xs text-blue-300/60 font-medium uppercase tracking-wide mb-3">Live Charge Preview</p>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between text-white/60"><span>Volumetric</span><span>{charge.volumetricWeightKg.toFixed(3)} kg</span></div>
                    <div className="flex justify-between text-white/80"><span>Billable weight</span><span className="font-semibold">{charge.billableWeightKg} kg</span></div>
                    <div className="flex justify-between text-white/60"><span>Rate ({charge.rateCardName})</span><span>{formatCurrency(charge.baseRatePerKg)}/kg</span></div>
                    <div className="flex justify-between text-white/60"><span>Base charge</span><span>{formatCurrency(charge.baseCharge)}</span></div>
                    {charge.codSurcharge > 0 && <div className="flex justify-between text-white/60"><span>COD ({charge.codSurchargePercent}%)</span><span>{formatCurrency(charge.codSurcharge)}</span></div>}
                    <div className="border-t border-white/10 pt-2 flex justify-between text-white font-bold text-base">
                      <span>Total</span><span className="text-blue-300">{formatCurrency(charge.totalCharge)}</span>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex gap-3">
              <button onClick={() => setStep(0)} className="flex-1 py-3 bg-white/10 hover:bg-white/15 text-white rounded-xl font-medium transition-colors">Back</button>
              <button
                onClick={() => setStep(2)}
                disabled={!form.lengthCm || !form.breadthCm || !form.heightCm || !form.actualWeightKg || !charge}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                Review Order <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}

        {/* ── STEP 3: Confirm ─────────────────────────────── */}
        {step === 2 && (
          <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
            className="space-y-4">
            <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-6 space-y-4">
              <h2 className="font-semibold text-white">Order Summary</h2>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="space-y-3">
                  <div><p className="text-white/40 text-xs mb-0.5">Pickup</p><p className="text-white">{form.pickupAddress}</p><p className="text-blue-400 text-xs">{form.pickupZoneName}</p></div>
                  <div><p className="text-white/40 text-xs mb-0.5">Delivery</p><p className="text-white">{form.dropAddress}</p><p className="text-blue-400 text-xs">{form.dropZoneName}</p></div>
                </div>
                <div className="space-y-3">
                  <div><p className="text-white/40 text-xs mb-0.5">Package</p><p className="text-white">{form.lengthCm}×{form.breadthCm}×{form.heightCm} cm, {form.actualWeightKg} kg</p></div>
                  <div><p className="text-white/40 text-xs mb-0.5">Type</p><p className="text-white">{form.orderType} · {form.paymentType}</p></div>
                </div>
              </div>

              {charge && (
                <div className="border-t border-white/10 pt-4 space-y-2 text-sm">
                  <div className="flex justify-between text-white/60"><span>Billable weight</span><span>{charge.billableWeightKg} kg</span></div>
                  <div className="flex justify-between text-white/60"><span>Base charge</span><span>{formatCurrency(charge.baseCharge)}</span></div>
                  {charge.codSurcharge > 0 && <div className="flex justify-between text-white/60"><span>COD surcharge</span><span>{formatCurrency(charge.codSurcharge)}</span></div>}
                  <div className="flex justify-between text-white font-bold text-lg"><span>Total</span><span className="text-blue-300">{formatCurrency(charge.totalCharge)}</span></div>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep(1)} className="flex-1 py-3 bg-white/10 hover:bg-white/15 text-white rounded-xl font-medium transition-colors">Back</button>
              <button onClick={handleSubmit} disabled={submitting}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2">
                {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Placing Order...</> : 'Confirm Order'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
