import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  Receipt,
  Store,
  Award,
  Calendar,
  DollarSign,
  ArrowUpRight,
  Sparkles,
  BarChart2,
  PieChart as PieIcon,
  RefreshCw,
  Layers,
  ArrowRight,
  CreditCard,
  CheckCircle,
  Building2,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { api } from '../../services/api';
import { BusinessOverviewData } from '../../types';
import { useLanguage } from '../../context/LanguageContext';
import { StatCard } from '../common/StatCard';
import { Badge } from '../common/Badge';

export const BusinessOverviewView: React.FC = () => {
  const { t } = useLanguage();
  const [data, setData] = useState<BusinessOverviewData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [dateFilter, setDateFilter] = useState<string>('this_month');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [showCustomPicker, setShowCustomPicker] = useState<boolean>(false);

  const fetchOverview = async (filter = dateFilter, start = startDate, end = endDate) => {
    try {
      setLoading(true);
      const params: any = { filter };
      if (filter === 'custom' && start && end) {
        params.start_date = start;
        params.end_date = end;
      }
      const res = await api.reports.getBusinessOverview(params);
      setData(res);
    } catch (err) {
      console.error('Failed to fetch business overview:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (dateFilter !== 'custom') {
      fetchOverview(dateFilter);
    }
  }, [dateFilter]);

  const handleApplyCustomDate = () => {
    if (startDate && endDate) {
      fetchOverview('custom', startDate, endDate);
    }
  };

  const metrics = data?.metrics || {
    combinedSales: 0,
    combinedBills: 0,
    retailSales: 0,
    wholesaleSales: 0,
    retailBills: 0,
    wholesaleBills: 0,
    retailAvgBill: 0,
    wholesaleAvgBill: 0,
    retailPaid: 0,
    wholesalePaid: 0,
    retailPending: 0,
    wholesalePending: 0,
    bestShop: 'Calculating...',
    bestShopReason: 'Processing database transactions...',
  };

  const dateFilterButtons = [
    { id: 'today', label: 'Today' },
    { id: 'yesterday', label: 'Yesterday' },
    { id: 'this_week', label: 'This Week' },
    { id: 'this_month', label: 'This Month' },
    { id: 'custom', label: 'Custom Date Range' },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-fade-in-slide">
      {/* Executive Header Banner */}
      <div className="glass-card p-6 sm:p-7 border-slate-200/80 dark:border-slate-800 relative overflow-hidden flex flex-col lg:flex-row lg:items-center justify-between gap-6 shadow-sm">
        <div className="space-y-2 z-10">
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="p-2 bg-gradient-to-tr from-emerald-600 to-teal-500 rounded-xl text-white shadow-md shadow-emerald-600/20">
              <Building2 className="w-5 h-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              BUSINESS OVERVIEW
            </h1>
            <Badge variant="emerald" size="sm">
              <Sparkles className="w-3 h-3 mr-1" />
              Owner Exclusive Intelligence
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-2xl">
            Unified multi-store performance dashboard combining independent Wholesale and Retail operations into single-view executive analytics.
          </p>
        </div>

        {/* Date Filter Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 z-10">
          <div className="inline-flex rounded-xl p-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            {dateFilterButtons.map((btn) => (
              <button
                key={btn.id}
                onClick={() => {
                  setDateFilter(btn.id);
                  if (btn.id === 'custom') {
                    setShowCustomPicker(true);
                  } else {
                    setShowCustomPicker(false);
                  }
                }}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  dateFilter === btn.id
                    ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {btn.label}
              </button>
            ))}
          </div>

          <button
            onClick={() => fetchOverview(dateFilter, startDate, endDate)}
            title="Refresh Analytics"
            className="p-2 text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-colors flex items-center justify-center"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-500' : ''}`} />
          </button>
        </div>

        {/* Decorative blur */}
        <div className="absolute -top-16 -right-16 w-56 h-56 bg-emerald-500/10 dark:bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Custom Date Range Picker Dropdown/Inputs */}
      {showCustomPicker && (
        <div className="glass-card p-4 border-slate-200 dark:border-slate-800 flex flex-wrap items-center gap-4 bg-emerald-50/40 dark:bg-emerald-950/20">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300">
            <Calendar className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Select Custom Range:</span>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[11px] text-slate-500">From:</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-3 py-1.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[11px] text-slate-500">To:</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-3 py-1.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <button
            onClick={handleApplyCustomDate}
            disabled={!startDate || !endDate}
            className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow transition-all"
          >
            Apply Range
          </button>
        </div>
      )}

      {/* Best Performing Shop Highlight Card */}
      <div className="glass-card p-5 border-emerald-300/60 dark:border-emerald-800/60 bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent relative overflow-hidden">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-400 flex items-center justify-center text-white shadow-lg shadow-amber-500/30 shrink-0">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] uppercase font-black tracking-wider text-emerald-800 dark:text-emerald-400">
                  Top Performing Entity
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300">
                  Live DB Result
                </span>
              </div>
              <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white mt-0.5">
                {metrics.bestShop}
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                {metrics.bestShopReason}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-6 shrink-0 bg-white/60 dark:bg-slate-900/60 p-3 rounded-2xl border border-emerald-200/60 dark:border-emerald-800/40">
            <div>
              <span className="text-[10px] font-semibold text-slate-500 uppercase block">Retail Avg Ticket</span>
              <span className="text-sm font-extrabold text-slate-900 dark:text-white">
                ₹{metrics.retailAvgBill.toLocaleString('en-IN')}
              </span>
            </div>
            <div className="w-px h-8 bg-slate-200 dark:bg-slate-700" />
            <div>
              <span className="text-[10px] font-semibold text-slate-500 uppercase block">Wholesale Avg Ticket</span>
              <span className="text-sm font-extrabold text-blue-600 dark:text-blue-400">
                ₹{metrics.wholesaleAvgBill.toLocaleString('en-IN')}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 4 Core Combined KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Combined Sales */}
        <StatCard
          title="Combined Total Sales"
          value={`₹ ${metrics.combinedSales.toLocaleString('en-IN')}`}
          subtitle={`${metrics.combinedBills} total bills from both shops`}
          icon={TrendingUp}
          color="emerald"
          trend={{ value: 'Wholesale + Retail', isPositive: true }}
        />

        {/* Total Bills */}
        <StatCard
          title="Total Bill Count"
          value={`${metrics.combinedBills} Invoices`}
          subtitle={`Retail: ${metrics.retailBills} | Wholesale: ${metrics.wholesaleBills}`}
          icon={Receipt}
          color="blue"
          trend={{ value: 'Multi-store cumulative', isPositive: true }}
        />

        {/* Retail Shop Sales */}
        <StatCard
          title="Retail Shop Sales"
          value={`₹ ${metrics.retailSales.toLocaleString('en-IN')}`}
          subtitle={`${metrics.retailBills} Bills (Avg: ₹${metrics.retailAvgBill})`}
          icon={Store}
          color="purple"
          trend={{ value: `${((metrics.retailSales / (metrics.combinedSales || 1)) * 100).toFixed(1)}% of total`, isPositive: true }}
        />

        {/* Wholesale Shop Sales */}
        <StatCard
          title="Wholesale Shop Sales"
          value={`₹ ${metrics.wholesaleSales.toLocaleString('en-IN')}`}
          subtitle={`${metrics.wholesaleBills} Bills (Avg: ₹${metrics.wholesaleAvgBill})`}
          icon={Building2}
          color="amber"
          trend={{ value: `${((metrics.wholesaleSales / (metrics.combinedSales || 1)) * 100).toFixed(1)}% of total`, isPositive: true }}
        />
      </div>

      {/* Charts Section: Daily Sales Comparison & Monthly Growth */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Sales Comparison (Retail vs Wholesale) */}
        <div className="glass-card p-6 border-slate-200 dark:border-slate-800 space-y-4">
          <div className="flex items-center justify-between pb-2">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-emerald-500" />
                <span>Daily Sales Comparison</span>
              </h3>
              <p className="text-xs text-slate-500">
                Independent daily revenue tracking (Past 14 days)
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs font-semibold">
              <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                Retail
              </span>
              <span className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                Wholesale
              </span>
            </div>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data?.dailyComparison || []} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="areaRetail" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="areaWholesale" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#94a3b8" opacity={0.15} />
                <XAxis dataKey="date" stroke="#94a3b8" fontSize={10} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} />
                <Tooltip
                  formatter={(val: any, name: any) => [`₹ ${Number(val).toLocaleString('en-IN')}`, name === 'retail_sales' ? 'Retail' : 'Wholesale']}
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '0.75rem',
                    color: '#fff',
                    fontSize: '12px',
                  }}
                />
                <Area type="monotone" dataKey="retail_sales" name="retail_sales" stroke="#10b981" strokeWidth={2.5} fill="url(#areaRetail)" />
                <Area type="monotone" dataKey="wholesale_sales" name="wholesale_sales" stroke="#3b82f6" strokeWidth={2.5} fill="url(#areaWholesale)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Monthly Sales Comparison */}
        <div className="glass-card p-6 border-slate-200 dark:border-slate-800 space-y-4">
          <div className="flex items-center justify-between pb-2">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-blue-500" />
                <span>Monthly Sales Comparison & Growth</span>
              </h3>
              <p className="text-xs text-slate-500">
                Month-by-month comparative growth trajectory
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs font-semibold">
              <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                Retail
              </span>
              <span className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                Wholesale
              </span>
            </div>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.monthlyComparison || []} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#94a3b8" opacity={0.15} />
                <XAxis dataKey="month" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                <Tooltip
                  formatter={(val: any, name: any) => [`₹ ${Number(val).toLocaleString('en-IN')}`, name === 'retail_sales' ? 'Retail' : 'Wholesale']}
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '0.75rem',
                    color: '#fff',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="retail_sales" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="wholesale_sales" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Side-by-Side Complete Financial Breakdown Table */}
      <div className="glass-card overflow-hidden border-slate-200 dark:border-slate-800">
        <div className="p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white text-base">
              Shop Comparison Matrix
            </h3>
            <p className="text-xs text-slate-500">
              Detailed financial parameters calculated from authentic invoices
            </p>
          </div>
          <Badge variant="blue" size="sm">
            Strict Multi-Entity Isolation
          </Badge>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-100/75 dark:bg-slate-800/75 text-slate-600 dark:text-slate-300 font-bold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">Financial Metric</th>
                <th className="py-3 px-4 text-emerald-600 dark:text-emerald-400">Retail Shop (Bazaar St)</th>
                <th className="py-3 px-4 text-blue-600 dark:text-blue-400">Wholesale Shop (Textile Market)</th>
                <th className="py-3 px-4 text-slate-900 dark:text-white font-extrabold">Combined Total</th>
                <th className="py-3 px-4">Difference / Dominance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-medium">
              <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">Total Gross Sales</td>
                <td className="py-3 px-4 font-bold text-emerald-600">₹{metrics.retailSales.toLocaleString('en-IN')}</td>
                <td className="py-3 px-4 font-bold text-blue-600">₹{metrics.wholesaleSales.toLocaleString('en-IN')}</td>
                <td className="py-3 px-4 font-black text-slate-900 dark:text-white">₹{metrics.combinedSales.toLocaleString('en-IN')}</td>
                <td className="py-3 px-4">
                  {metrics.retailSales > metrics.wholesaleSales ? (
                    <span className="text-emerald-600 font-bold">Retail leads by ₹{(metrics.retailSales - metrics.wholesaleSales).toLocaleString('en-IN')}</span>
                  ) : metrics.wholesaleSales > metrics.retailSales ? (
                    <span className="text-blue-600 font-bold">Wholesale leads by ₹{(metrics.wholesaleSales - metrics.retailSales).toLocaleString('en-IN')}</span>
                  ) : (
                    <span className="text-slate-400">Equal</span>
                  )}
                </td>
              </tr>

              <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">Total Invoices / Bills</td>
                <td className="py-3 px-4">{metrics.retailBills} bills</td>
                <td className="py-3 px-4">{metrics.wholesaleBills} bills</td>
                <td className="py-3 px-4 font-black text-slate-900 dark:text-white">{metrics.combinedBills} bills</td>
                <td className="py-3 px-4 text-slate-500">
                  {metrics.retailBills >= metrics.wholesaleBills ? 'Retail has higher volume' : 'Wholesale has higher volume'}
                </td>
              </tr>

              <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">Average Ticket Value</td>
                <td className="py-3 px-4 font-semibold">₹{metrics.retailAvgBill.toLocaleString('en-IN')}</td>
                <td className="py-3 px-4 font-semibold text-blue-600">₹{metrics.wholesaleAvgBill.toLocaleString('en-IN')}</td>
                <td className="py-3 px-4 font-black text-slate-900 dark:text-white">
                  ₹{metrics.combinedBills > 0 ? Math.round(metrics.combinedSales / metrics.combinedBills).toLocaleString('en-IN') : 0}
                </td>
                <td className="py-3 px-4 text-slate-500">
                  {metrics.wholesaleAvgBill > metrics.retailAvgBill ? (
                    <span className="text-blue-600 font-semibold">Wholesale ticket is {(metrics.wholesaleAvgBill / (metrics.retailAvgBill || 1)).toFixed(1)}x larger</span>
                  ) : 'Comparable'}
                </td>
              </tr>

              <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">Payments Collected</td>
                <td className="py-3 px-4 text-emerald-600 font-semibold">₹{metrics.retailPaid.toLocaleString('en-IN')}</td>
                <td className="py-3 px-4 text-blue-600 font-semibold">₹{metrics.wholesalePaid.toLocaleString('en-IN')}</td>
                <td className="py-3 px-4 font-black text-slate-900 dark:text-white">₹{(metrics.retailPaid + metrics.wholesalePaid).toLocaleString('en-IN')}</td>
                <td className="py-3 px-4 text-emerald-600">Collected in Bank/Cash</td>
              </tr>

              <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">Pending Customer Khata / Credit</td>
                <td className="py-3 px-4 text-amber-600 font-semibold">₹{metrics.retailPending.toLocaleString('en-IN')}</td>
                <td className="py-3 px-4 text-amber-600 font-semibold">₹{metrics.wholesalePending.toLocaleString('en-IN')}</td>
                <td className="py-3 px-4 font-black text-amber-600">₹{(metrics.retailPending + metrics.wholesalePending).toLocaleString('en-IN')}</td>
                <td className="py-3 px-4 text-amber-600">Receivables awaiting recovery</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

