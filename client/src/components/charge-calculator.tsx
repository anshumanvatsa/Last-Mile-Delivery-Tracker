'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { zonesApi, ordersApi } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { Calculator, Package, MapPin, Loader2 } from 'lucide-react';

interface Zone {
  id: string;
  name: string;
}

interface ChargeResult {
  volumetricWeightKg: number;
  billableWeightKg: number;
  baseRatePerKg: number;
  baseCharge: number;
  codSurchargePercent: number;
  codSurcharge: number;
  totalCharge: number;
  rateCardName: string;
}

export function ChargeCalculator() {
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ChargeResult | null>(null);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    pickupZoneId: '',
    dropZoneId: '',
    lengthCm: '',
    breadthCm: '',
    heightCm: '',
    actualWeightKg: '',
    orderType: 'B2C',
    paymentType: 'PREPAID',
  });

  useEffect(() => {
    zonesApi.list().then((r) => setZones(r.data.data.zones || [])).catch(() => {});
  }, []);

  const calculate = useCallback(async () => {
    const { pickupZoneId, dropZoneId, lengthCm, breadthCm, heightCm, actualWeightKg, orderType, paymentType } = form;
    if (!pickupZoneId || !dropZoneId || !lengthCm || !breadthCm || !heightCm || !actualWeightKg) return;

    setLoading(true);
    setError('');
    try {
      const r = await ordersApi.calculateCharge({
        pickupZoneId,
        dropZoneId,
        lengthCm: parseFloat(lengthCm),
        breadthCm: parseFloat(breadthCm),
        heightCm: parseFloat(heightCm),
        actualWeightKg: parseFloat(actualWeightKg),
        orderType,
        paymentType,
      });
      setResult(r.data.data);
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to calculate. Please try again.');
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, [form]);

  const set = (k: string, v: string) => {
    setForm((prev) => ({ ...prev, [k]: v }));
    setResult(null);
  };

  return (
    <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-6 space-y-5">
      <div className="flex items-center gap-2">
        <Calculator className="w-5 h-5 text-blue-400" />
        <h3 className="text-white font-semibold text-lg">Live Charge Calculator</h3>
      </div>

      {/* Zone selects */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-white/50 mb-1 block">Pickup Zone</label>
          <select
            value={form.pickupZoneId}
            onChange={(e) => set('pickupZoneId', e.target.value)}
            className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-400"
          >
            <option value="" className="bg-gray-900">Select zone</option>
            {zones.map((z) => (
              <option key={z.id} value={z.id} className="bg-gray-900">{z.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-white/50 mb-1 block">Drop Zone</label>
          <select
            value={form.dropZoneId}
            onChange={(e) => set('dropZoneId', e.target.value)}
            className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-400"
          >
            <option value="" className="bg-gray-900">Select zone</option>
            {zones.map((z) => (
              <option key={z.id} value={z.id} className="bg-gray-900">{z.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Dimensions */}
      <div>
        <label className="text-xs text-white/50 mb-1 block flex items-center gap-1">
          <Package className="w-3 h-3" /> Dimensions (cm) & Weight (kg)
        </label>
        <div className="grid grid-cols-4 gap-2">
          {[
            { k: 'lengthCm', label: 'L' },
            { k: 'breadthCm', label: 'B' },
            { k: 'heightCm', label: 'H' },
            { k: 'actualWeightKg', label: 'Wt' },
          ].map(({ k, label }) => (
            <div key={k} className="relative">
              <input
                type="number"
                min="0"
                step="0.1"
                placeholder="0"
                value={form[k as keyof typeof form]}
                onChange={(e) => set(k, e.target.value)}
                className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-blue-400 pr-6"
              />
              <span className="absolute right-2 top-2.5 text-xs text-white/30">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Type selects */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-white/50 mb-1 block">Order Type</label>
          <div className="flex rounded-lg overflow-hidden border border-white/20">
            {['B2C', 'B2B'].map((t) => (
              <button
                key={t}
                onClick={() => set('orderType', t)}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${
                  form.orderType === t
                    ? 'bg-blue-600 text-white'
                    : 'bg-white/5 text-white/50 hover:text-white'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs text-white/50 mb-1 block">Payment</label>
          <div className="flex rounded-lg overflow-hidden border border-white/20">
            {['PREPAID', 'COD'].map((t) => (
              <button
                key={t}
                onClick={() => set('paymentType', t)}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${
                  form.paymentType === t
                    ? 'bg-blue-600 text-white'
                    : 'bg-white/5 text-white/50 hover:text-white'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Calculate button */}
      <button
        onClick={calculate}
        disabled={loading || !form.pickupZoneId || !form.dropZoneId}
        className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
      >
        {loading ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> Calculating...</>
        ) : (
          <><Calculator className="w-4 h-4" /> Calculate Charge</>
        )}
      </button>

      {/* Error */}
      {error && (
        <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {/* Result */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-blue-950/50 border border-blue-500/20 rounded-xl p-4 space-y-3"
          >
            <p className="text-xs text-blue-300/60 font-medium uppercase tracking-wide">Charge Breakdown</p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-white/70">
                <span>Volumetric weight</span>
                <span>{result.volumetricWeightKg.toFixed(3)} kg</span>
              </div>
              <div className="flex justify-between text-white/70">
                <span>Billable weight</span>
                <span className="font-medium text-white">{result.billableWeightKg} kg</span>
              </div>
              <div className="flex justify-between text-white/70">
                <span>Rate ({result.rateCardName})</span>
                <span>{formatCurrency(result.baseRatePerKg)}/kg</span>
              </div>
              <div className="flex justify-between text-white/70">
                <span>Base charge</span>
                <span>{formatCurrency(result.baseCharge)}</span>
              </div>
              {result.codSurcharge > 0 && (
                <div className="flex justify-between text-white/70">
                  <span>COD surcharge ({result.codSurchargePercent}%)</span>
                  <span>{formatCurrency(result.codSurcharge)}</span>
                </div>
              )}
              <div className="border-t border-white/10 pt-2 flex justify-between text-white font-bold text-base">
                <span>Total</span>
                <span className="text-blue-300">{formatCurrency(result.totalCharge)}</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
