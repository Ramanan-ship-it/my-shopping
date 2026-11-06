import React, { useState, useEffect } from 'react';
import {
  Scissors,
  CheckCircle2,
  Calendar,
  IndianRupee,
  Clock,
  PlusCircle,
  AlertCircle,
  History,
  ShieldAlert,
} from 'lucide-react';
import { Tailor, TailorProduction } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useShop } from '../../context/ShopContext';
import { api } from '../../services/api';
import { StatCard } from '../common/StatCard';
import { Badge } from '../common/Badge';

export const TailorPortalView: React.FC = () => {
  const { user } = useAuth();
  const { currency } = useShop();

  const [tailorData, setTailorData] = useState<any>(null);
  const [productionHistory, setProductionHistory] = useState<TailorProduction[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Today's Production Form
  const [shirtsQty, setShirtsQty] = useState<number>(10);
  const [pantsQty, setPantsQty] = useState<number>(8);
  const [blousesQty, setBlousesQty] = useState<number>(0);
  const [othersQty, setOthersQty] = useState<number>(0);
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState<string>('Daily piece completion');

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  const tailorId = user?.tailor_id || 'tailor_1';

  const loadTailorProfile = async () => {
    try {
      setLoading(true);
      const res = await api.tailors.getById(tailorId);
      setTailorData(res);
      setProductionHistory(res.production || []);
    } catch (err: any) {
      console.error('Failed to load tailor portal profile:', err);
      setErrorMessage(err.message || 'Failed to load tailor portal profile.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTailorProfile();
  }, [tailorId]);

  const rates = tailorData?.tailor || {
    shirt_rate: 50,
    pant_rate: 70,
    blouse_rate: 60,
    other_rate: 40,
  };

  // Real-time calculation of piece count and estimated wage
  const totalPieces = shirtsQty + pantsQty + blousesQty + othersQty;
  const estimatedEarnings =
    shirtsQty * (rates.shirt_rate || 50) +
    pantsQty * (rates.pant_rate || 70) +
    blousesQty * (rates.blouse_rate || 60) +
    othersQty * (rates.other_rate || 40);

  const handleSubmitProduction = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMessage('');
    setErrorMessage('');

    if (totalPieces <= 0) {
      setErrorMessage('Please enter at least 1 produced piece.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await api.tailors.recordProduction({
        tailor_id: tailorId,
        date,
        shop_id: user?.assigned_shop === 'wholesale' ? 'shop_wholesale' : 'shop_retail',
        shirts_qty: Number(shirtsQty),
        pants_qty: Number(pantsQty),
        blouses_qty: Number(blousesQty),
        others_qty: Number(othersQty),
        notes,
      });

      setSuccessMessage(
        `Successfully logged ${res.record.total_pieces} garments sewn. Earned: ₹${res.record.earned_amount}!`
      );

      // Refresh list
      await loadTailorProfile();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to log production.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top Banner with Strict Privacy Notice */}
      <div className="glass-card p-6 border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Tailor Self-Service Portal
            </h2>
            <Badge variant="purple" size="sm" dot>
              Tailor Verified
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Welcome, <strong className="text-slate-800 dark:text-slate-200">{tailorData?.tailor?.name || user?.name}</strong> ({tailorData?.tailor?.tailor_code || user?.tailor_code}).
          </p>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 text-xs font-semibold text-purple-700 dark:text-purple-300">
          <Scissors className="w-4 h-4" />
          <span>Piece-Rate Model</span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Total Pieces Sewn"
          value={`${tailorData?.salary_summary?.total_pieces || 18} Pcs`}
          subtitle="This billing period"
          icon={Scissors}
          color="purple"
        />

        <StatCard
          title="Total Earned Amount"
          value={`₹ ${Number(tailorData?.salary_summary?.total_earned || 1060).toLocaleString('en-IN')}`}
          subtitle="Piece-rate wages accumulated"
          icon={IndianRupee}
          color="emerald"
        />

        <StatCard
          title="Pending Payout Balance"
          value={`₹ ${Number(tailorData?.salary_summary?.pending_salary || 860).toLocaleString('en-IN')}`}
          subtitle="After advance deductions"
          icon={Clock}
          color="amber"
        />
      </div>

      {/* Form: Record Daily Garments Sewn */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 glass-card p-6 border-slate-200 dark:border-slate-800 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <PlusCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                Log Today's Production
              </h3>
            </div>
            <span className="text-xs font-semibold text-slate-500">
              Date: {date}
            </span>
          </div>

          <form onSubmit={handleSubmitProduction} className="space-y-4">
            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Production Date
              </label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold"
              />
            </div>

            {/* Garment Piece Counters */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold text-xs text-slate-900 dark:text-white">Shirts</span>
                  <span className="text-[11px] text-emerald-600 font-mono font-bold">
                    ₹{rates.shirt_rate || 50}/pc
                  </span>
                </div>
                <input
                  type="number"
                  min="0"
                  value={shirtsQty}
                  onChange={e => setShirtsQty(parseInt(e.target.value, 10) || 0)}
                  className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-mono font-black"
                />
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold text-xs text-slate-900 dark:text-white">Pants / Trousers</span>
                  <span className="text-[11px] text-emerald-600 font-mono font-bold">
                    ₹{rates.pant_rate || 70}/pc
                  </span>
                </div>
                <input
                  type="number"
                  min="0"
                  value={pantsQty}
                  onChange={e => setPantsQty(parseInt(e.target.value, 10) || 0)}
                  className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-mono font-black"
                />
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold text-xs text-slate-900 dark:text-white">Blouses / Tops</span>
                  <span className="text-[11px] text-emerald-600 font-mono font-bold">
                    ₹{rates.blouse_rate || 60}/pc
                  </span>
                </div>
                <input
                  type="number"
                  min="0"
                  value={blousesQty}
                  onChange={e => setBlousesQty(parseInt(e.target.value, 10) || 0)}
                  className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-mono font-black"
                />
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-bold text-xs text-slate-900 dark:text-white">Others / Alterations</span>
                  <span className="text-[11px] text-emerald-600 font-mono font-bold">
                    ₹{rates.other_rate || 40}/pc
                  </span>
                </div>
                <input
                  type="number"
                  min="0"
                  value={othersQty}
                  onChange={e => setOthersQty(parseInt(e.target.value, 10) || 0)}
                  className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-mono font-black"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Notes / Order Reference
              </label>
              <input
                type="text"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="e.g. 10 formal shirts stitched for retail order"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
              />
            </div>

            {/* Calculated Earnings Banner */}
            <div className="p-4 bg-gradient-to-r from-emerald-500/10 to-teal-500/10 rounded-xl border border-emerald-500/20 flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-600 dark:text-slate-300 block font-medium">
                  Total Garments: <strong className="text-slate-900 dark:text-white font-mono">{totalPieces} pcs</strong>
                </span>
                <span className="text-[11px] text-slate-400">
                  Calculated automatically based on approved piece rates
                </span>
              </div>
              <div className="text-right">
                <span className="text-[11px] text-emerald-600 dark:text-emerald-400 uppercase font-bold block">
                  Estimated Wage
                </span>
                <span className="text-xl font-mono font-black text-emerald-600 dark:text-emerald-400">
                  ₹{estimatedEarnings}
                </span>
              </div>
            </div>

            {successMessage && (
              <div className="p-3 bg-emerald-50 text-emerald-700 text-xs rounded-xl flex items-center gap-2 border border-emerald-200">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>{successMessage}</span>
              </div>
            )}

            {errorMessage && (
              <div className="p-3 bg-rose-50 text-rose-700 text-xs rounded-xl flex items-center gap-2 border border-rose-200">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || totalPieces <= 0}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-sm font-bold shadow-md shadow-emerald-600/20 active:scale-98 transition-all"
            >
              {submitting ? 'Recording Production...' : `Submit Production Log (₹${estimatedEarnings})`}
            </button>
          </form>
        </div>

        {/* Right Side: Rate Chart & Personal Production History */}
        <div className="lg:col-span-5 space-y-4">
          {/* Rate Card */}
          <div className="glass-card p-5 border-slate-200 dark:border-slate-800">
            <h4 className="font-bold text-xs text-slate-900 dark:text-white uppercase tracking-wider mb-3">
              My Agreed Piece Rates
            </h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex justify-between">
                <span className="text-slate-500">Shirt:</span>
                <span className="font-mono font-bold text-emerald-600">₹{rates.shirt_rate || 50}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex justify-between">
                <span className="text-slate-500">Pant:</span>
                <span className="font-mono font-bold text-emerald-600">₹{rates.pant_rate || 70}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex justify-between">
                <span className="text-slate-500">Blouse:</span>
                <span className="font-mono font-bold text-emerald-600">₹{rates.blouse_rate || 60}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex justify-between">
                <span className="text-slate-500">Others:</span>
                <span className="font-mono font-bold text-emerald-600">₹{rates.other_rate || 40}</span>
              </div>
            </div>
          </div>

          {/* Recent Production History */}
          <div className="glass-card p-5 border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-purple-600" />
                <h4 className="font-bold text-xs text-slate-900 dark:text-white uppercase tracking-wider">
                  Recent Submissions
                </h4>
              </div>
              <Badge variant="purple" size="sm">{productionHistory.length} logged</Badge>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto">
              {productionHistory.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6">
                  No production records yet for this period.
                </p>
              ) : (
                productionHistory.map((rec, i) => (
                  <div
                    key={rec.id || i}
                    className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-xs flex items-center justify-between"
                  >
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white">
                        {rec.total_pieces} Pieces Sewn
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {rec.date} • {rec.shirts_qty ? `${rec.shirts_qty} shirts ` : ''}
                        {rec.pants_qty ? `${rec.pants_qty} pants ` : ''}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="font-mono font-black text-emerald-600 dark:text-emerald-400 block">
                        ₹{rec.earned_amount}
                      </span>
                      <Badge variant="emerald" size="sm">Logged</Badge>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
