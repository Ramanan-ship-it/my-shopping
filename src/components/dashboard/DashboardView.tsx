import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  Receipt,
  Boxes,
  Scissors,
  CreditCard,
  PlusCircle,
  ArrowRightLeft,
  AlertTriangle,
  RefreshCw,
  ShoppingBag,
  Sparkles,
  ArrowUpRight,
  Clock,
  Shirt,
  CheckCircle2,
  ChevronRight,
  Eye,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
} from 'recharts';
import { useAuth } from '../../context/AuthContext';
import { useShop } from '../../context/ShopContext';
import { useLanguage } from '../../context/LanguageContext';
import { api } from '../../services/api';
import { StatCard } from '../common/StatCard';
import { Badge } from '../common/Badge';
import { ActiveTab } from '../layout/Sidebar';

interface DashboardViewProps {
  onNavigate: (tab: ActiveTab) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const { activeShop, currency } = useShop();
  const { t } = useLanguage();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const res = await api.reports.getDashboard({ shop_id: activeShop });
      setData(res);
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [activeShop]);

  const salesTrendData = [
    { day: 'Mon', retail: 14200, wholesale: 32000 },
    { day: 'Tue', retail: 16800, wholesale: 29000 },
    { day: 'Wed', retail: 19400, wholesale: 41000 },
    { day: 'Thu', retail: 15300, wholesale: 33500 },
    { day: 'Fri', retail: 24600, wholesale: 54000 },
    { day: 'Sat', retail: 38200, wholesale: 47000 },
    { day: 'Sun', retail: 42500, wholesale: 22000 },
  ];

  const categoryData = [
    { name: 'Shirts', pieces: 142, rate: '₹50' },
    { name: 'Pants', pieces: 98, rate: '₹70' },
    { name: 'Sarees', pieces: 54, rate: '₹90' },
    { name: 'Ethnic', pieces: 68, rate: '₹80' },
    { name: 'Suits', pieces: 26, rate: '₹120' },
  ];

  const todaySales = Number(data?.metrics?.today_sales || 24800);
  const creditPending = Number(data?.metrics?.total_credit_pending || 38500);
  const piecesSewn = Number(data?.metrics?.today_pieces || 32);
  const totalProducts = Number(data?.metrics?.total_products || 12);
  const lowStockCount = Number(data?.metrics?.low_stock_count || 2);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10 animate-fade-in-slide">
      {/* Top Welcome Banner with Quick Actions */}
      <div className="relative overflow-hidden glass-card p-6 sm:p-7 border-slate-200/80 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-5">
        <div className="space-y-1 z-10">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              {t('welcome_user', 'Welcome back')}, {user?.name || 'Manager'}
            </h1>
            <Badge variant="emerald" size="sm" dot>
              {t('live_operations', 'Live Operations')}
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-xl">
            {t('dashboard_subtitle', 'Real-time overview of sales, garments inventory, tailor stitching, and khata credit.')}
          </p>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5 z-10">
          {(user?.permissions?.can_billing === 1 || user?.role === 'OWNER') && (
            <button
              onClick={() => onNavigate('pos')}
              className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/25 active:scale-95 transition-all"
            >
              <PlusCircle className="w-4 h-4" />
              <span>{t('new_bill_f2', 'New Bill (F2)')}</span>
            </button>
          )}

          {(user?.permissions?.can_stock_transfer === 1 || user?.role === 'OWNER') && (
            <button
              onClick={() => onNavigate('inventory')}
              className="flex items-center gap-2 px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold active:scale-95 transition-all border border-slate-200 dark:border-slate-700"
            >
              <ArrowRightLeft className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>{t('transfer_stock', 'Transfer Stock')}</span>
            </button>
          )}

          <button
            onClick={fetchDashboardData}
            title={t('refresh_stats', 'Refresh Statistics')}
            className="p-2.5 text-slate-500 hover:text-slate-800 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-500' : ''}`} />
          </button>
        </div>

        {/* Subtle decorative glow circle in banner */}
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-emerald-500/10 dark:bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />
      </div>

      {/* KPI Stat Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title={t('total_sales_today', "Today's Sales")}
          value={`${currency} ${todaySales.toLocaleString('en-IN')}`}
          subtitle={t('retail_wholesale_combined', 'Retail & Wholesale combined')}
          icon={TrendingUp}
          color="emerald"
          trend={{ value: '+14.2% vs yesterday', isPositive: true }}
          onClick={() => onNavigate('bills')}
        />

        <StatCard
          title={t('customer_credit', 'Customer Khata (Credit)')}
          value={`${currency} ${creditPending.toLocaleString('en-IN')}`}
          subtitle={`${data?.metrics?.overdue_bills_count || 3} ${t('bills_overdue', 'bills overdue')}`}
          icon={CreditCard}
          color="amber"
          trend={{ value: 'Receivables active', isPositive: false }}
          onClick={() => onNavigate('credit')}
        />

        <StatCard
          title={t('tailor_production', 'Tailor Production')}
          value={`${piecesSewn} ${t('pieces', 'pieces')}`}
          subtitle={`₹ ${Number(data?.metrics?.today_tailor_wages || 1880).toLocaleString('en-IN')} ${t('wages_today', 'wages earned today')}`}
          icon={Scissors}
          color="purple"
          trend={{ value: '10 tailors active', isPositive: true }}
          onClick={() => onNavigate('tailors')}
        />

        <StatCard
          title={t('inventory_status', 'Inventory Status')}
          value={`${totalProducts} Products`}
          subtitle={`${lowStockCount} ${t('low_stock_count', 'items low in stock')}`}
          icon={Boxes}
          color={lowStockCount > 0 ? 'rose' : 'blue'}
          trend={{ value: 'Real-time sync', isPositive: true }}
          onClick={() => onNavigate('inventory')}
        />
      </div>

      {/* Charts Section: Weekly Revenue Trend & Garment Production Mix */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Weekly Revenue Trend Area Chart */}
        <div className="lg:col-span-2 glass-card p-6 border-slate-200 dark:border-slate-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base">
                {t('weekly_sales_trend', 'Weekly Sales Revenue Trend')}
              </h3>
              <p className="text-xs text-slate-500">
                {t('retail_vs_wholesale', 'Retail vs Wholesale daily collection')}
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs font-semibold">
              <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                {t('retail', 'Retail')}
              </span>
              <span className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                {t('wholesale', 'Wholesale')}
              </span>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={salesTrendData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRetail" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="colorWholesale" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#94a3b8" opacity={0.15} />
                <XAxis dataKey="day" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                <Tooltip
                  formatter={(value: any) => [`₹ ${Number(value).toLocaleString('en-IN')}`, '']}
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: '0.75rem',
                    color: '#fff',
                    fontSize: '12px',
                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.4)',
                  }}
                />
                <Area type="monotone" dataKey="retail" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorRetail)" />
                <Area type="monotone" dataKey="wholesale" stroke="#3b82f6" strokeWidth={2.5} fillOpacity={1} fill="url(#colorWholesale)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Garment Categories Output */}
        <div className="glass-card p-6 border-slate-200 dark:border-slate-800 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-base">
                  {t('production_by_category', 'Production by Garment Category')}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {t('volume_sewn', 'Output sewn by tailor workshop this week')}
                </p>
              </div>
              <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
                <Shirt className="w-4 h-4" />
              </div>
            </div>

            <div className="h-52 w-full mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryData} layout="vertical" margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
                  <XAxis type="number" stroke="#94a3b8" fontSize={10} hide />
                  <YAxis type="category" dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip
                    formatter={(val: any) => [`${val} pieces`, 'Sewn']}
                    contentStyle={{ backgroundColor: '#0f172a', borderRadius: '0.5rem', color: '#fff', fontSize: '12px' }}
                  />
                  <Bar dataKey="pieces" fill="#8b5cf6" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
            <span>Piece rate: ₹40 - ₹120 / garment</span>
            <button
              onClick={() => onNavigate('tailors')}
              className="text-emerald-600 dark:text-emerald-400 font-bold hover:underline flex items-center gap-1"
            >
              <span>{t('view_tailor_logs', 'View Tailor Logs')}</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Workshop Summary Widget: Given vs Stitched vs Balance */}
      <div className="glass-card p-6 border-slate-200 dark:border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <Scissors className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base">
                {t('tailor_hub', 'Tailors & Stitching Workshop Hub')}
              </h3>
              <p className="text-xs text-slate-500">
                {t('owner_control_notice', 'Only the Shop Owner can assign work or edit stitched counts. Tailors have view-only access.')}
              </p>
            </div>
          </div>

          <button
            onClick={() => onNavigate('tailors')}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/60 rounded-xl hover:bg-purple-100 dark:hover:bg-purple-900/50 transition-all self-start sm:self-auto"
          >
            <span>Manage Work Orders</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4">
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                {t('given_by_owner', 'Given by Owner')}
              </span>
              <span className="text-2xl font-black text-slate-900 dark:text-white font-mono-numbers mt-1 block">
                200 <span className="text-xs font-normal text-slate-400">shirts</span>
              </span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
              📥
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block">
                {t('stitched_by_tailor', 'Stitched by Tailor')}
              </span>
              <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono-numbers mt-1 block">
                150 <span className="text-xs font-normal text-slate-400">stitched</span>
              </span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
              ✂️
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 block">
                {t('balance_to_stitch', 'Balance to Stitch')}
              </span>
              <span className="text-2xl font-black text-amber-600 dark:text-amber-400 font-mono-numbers mt-1 block">
                50 <span className="text-xs font-normal text-slate-400">remaining</span>
              </span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
              ⏳
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Row: Low Stock Alerts & Recent Invoices Stream */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Low Stock Alerts */}
        <div className="glass-card p-6 border-slate-200 dark:border-slate-800 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                  {t('low_stock_alerts', 'Low Stock Inventory Alerts')}
                </h3>
                <p className="text-xs text-slate-500">
                  Garments needing reorder or transfer from warehouse
                </p>
              </div>
            </div>
            <button
              onClick={() => onNavigate('inventory')}
              className="text-xs text-emerald-600 dark:text-emerald-400 font-bold hover:underline flex items-center gap-1"
            >
              <span>{t('reorder_transfer', 'Reorder / Transfer')}</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-2.5">
            <div className="p-3.5 rounded-xl border border-rose-200 dark:border-rose-900/40 bg-rose-50/40 dark:bg-rose-950/20 flex items-center justify-between">
              <div>
                <span className="font-bold text-xs text-slate-900 dark:text-white block">
                  Executive Wool Blend Blazer
                </span>
                <span className="text-[11px] text-slate-500">Size 42 • Charcoal Grey • Retail Counter</span>
              </div>
              <div className="text-right">
                <Badge variant="rose" size="sm" dot>4 units left</Badge>
                <span className="text-[10px] text-slate-400 block mt-0.5">Threshold: 5 units</span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl border border-amber-200 dark:border-amber-900/40 bg-amber-50/40 dark:bg-amber-950/20 flex items-center justify-between">
              <div>
                <span className="font-bold text-xs text-slate-900 dark:text-white block">
                  Premium Cotton Formal Shirt
                </span>
                <span className="text-[11px] text-slate-500">Size 40 • Sky Blue • Retail Showroom</span>
              </div>
              <div className="text-right">
                <Badge variant="amber" size="sm" dot>10 units left</Badge>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold block mt-0.5">
                  Wholesale warehouse has 100
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Invoices Stream */}
        <div className="glass-card p-6 border-slate-200 dark:border-slate-800 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <Receipt className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                  {t('recent_pos_bills', 'Recent POS Invoices')}
                </h3>
                <p className="text-xs text-slate-500">
                  {t('latest_invoices', 'Latest customer transactions')}
                </p>
              </div>
            </div>
            <button
              onClick={() => onNavigate('bills')}
              className="text-xs text-emerald-600 dark:text-emerald-400 font-bold hover:underline flex items-center gap-1"
            >
              <span>{t('view_all_bills', 'View All Bills')}</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-2.5">
            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between hover:bg-slate-50/60 dark:hover:bg-slate-800/50 transition-colors">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono-numbers text-xs font-bold text-slate-900 dark:text-white">
                    WHO-GST-2026-00001
                  </span>
                  <Badge variant="blue" size="sm">GST</Badge>
                </div>
                <span className="text-[11px] text-slate-500 mt-0.5 block">
                  Karthikeyan Textiles • Wholesale
                </span>
              </div>
              <div className="text-right">
                <span className="font-mono-numbers font-bold text-xs text-slate-900 dark:text-white block">
                  ₹ 21,000
                </span>
                <Badge variant="emerald" size="sm">
                  Paid (UPI)
                </Badge>
              </div>
            </div>

            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between hover:bg-slate-50/60 dark:hover:bg-slate-800/50 transition-colors">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono-numbers text-xs font-bold text-slate-900 dark:text-white">
                    RET-2026-00001
                  </span>
                  <Badge variant="slate" size="sm">Retail</Badge>
                </div>
                <span className="text-[11px] text-slate-500 mt-0.5 block">
                  Priya Sundaram • Retail Store
                </span>
              </div>
              <div className="text-right">
                <span className="font-mono-numbers font-bold text-xs text-slate-900 dark:text-white block">
                  ₹ 1,400
                </span>
                <Badge variant="emerald" size="sm">
                  Paid (Cash)
                </Badge>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
