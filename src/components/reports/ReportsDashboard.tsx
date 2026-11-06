import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  TrendingUp,
  DollarSign,
  PieChart as PieIcon,
  Calendar,
  RefreshCw,
  Scissors,
  Wallet,
  Receipt,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { useShop } from '../../context/ShopContext';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { StatCard } from '../common/StatCard';
import { Badge } from '../common/Badge';

export const ReportsDashboard: React.FC = () => {
  const { activeShop, currency } = useShop();
  const { user } = useAuth();

  const [pnlData, setPnlData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const canViewProfit = user?.role === 'OWNER' || user?.permissions?.can_profit_view === 1;

  const fetchReports = async () => {
    try {
      setLoading(true);
      if (canViewProfit) {
        const res = await api.reports.getProfitLoss({
          shop_id: activeShop === 'all' ? undefined : activeShop,
        });
        setPnlData(res);
      } else {
        const res = await api.reports.getSalesReport({
          shop_id: activeShop === 'all' ? undefined : activeShop,
        });
        setPnlData(res);
      }
    } catch (err) {
      console.error('Failed to load reports:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [activeShop]);

  const pnl = pnlData?.pnl || {
    gross_sales: 22400,
    cogs: 11200,
    gross_profit: 11200,
    gross_margin_percent: 50.0,
    tailor_wages: 1770,
    operating_expenses: 4450,
    total_deductions: 6220,
    net_profit: 4980,
    net_profit_margin_percent: 22.2,
  };

  const channelComparison = [
    { name: 'Retail Showroom', revenue: 1400, transactions: 1, cogs: 700 },
    { name: 'Wholesale Hub', revenue: 21000, transactions: 1, cogs: 14000 },
  ];

  const expenseBreakdown = [
    { name: 'Cost of Goods', value: pnl.cogs, color: '#3b82f6' },
    { name: 'Tailor Wages', value: pnl.tailor_wages, color: '#8b5cf6' },
    { name: 'Store Utilities', value: pnl.operating_expenses, color: '#f59e0b' },
    { name: 'Net Profit', value: Math.max(0, pnl.net_profit), color: '#10b981' },
  ];

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-card p-6 border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Business Analytics & Profit / Loss Statement
            </h2>
            <Badge variant="emerald" size="sm" dot>
              Financial Engine
            </Badge>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Revenues, cost of goods (COGS), tailor piece wages, operational costs, and bottom-line margin.
          </p>
        </div>

        <button
          onClick={fetchReports}
          className="p-2 text-slate-500 hover:text-slate-800 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-500' : ''}`} />
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Gross Sales Revenue"
          value={`₹ ${Number(pnl.gross_sales || 0).toLocaleString('en-IN')}`}
          subtitle="Total invoices billed"
          icon={TrendingUp}
          color="blue"
        />

        <StatCard
          title="Cost of Goods (COGS)"
          value={`₹ ${Number(pnl.cogs || 0).toLocaleString('en-IN')}`}
          subtitle="Raw garment purchase cost"
          icon={Receipt}
          color="slate"
        />

        <StatCard
          title="Tailor Wages + Expenses"
          value={`₹ ${Number(pnl.total_deductions || 0).toLocaleString('en-IN')}`}
          subtitle={`₹${pnl.tailor_wages} wages + ₹${pnl.operating_expenses} exp`}
          icon={Wallet}
          color="amber"
        />

        <StatCard
          title="Net Operating Profit"
          value={`₹ ${Number(pnl.net_profit || 0).toLocaleString('en-IN')}`}
          subtitle={`${pnl.net_profit_margin_percent}% Net Margin`}
          icon={DollarSign}
          color="emerald"
          trend={{ value: `${pnl.net_profit_margin_percent}% margin`, isPositive: pnl.net_profit >= 0 }}
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Sales by Entity Chart */}
        <div className="lg:col-span-7 glass-card p-6 border-slate-200 dark:border-slate-800">
          <h3 className="font-bold text-sm text-slate-900 dark:text-white mb-1">
            Revenue vs Cost by Channel
          </h3>
          <p className="text-xs text-slate-500 mb-4">Retail Showroom vs Wholesale Warehouse</p>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={channelComparison} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.5} />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                <Tooltip
                  formatter={(val: any) => [`₹ ${Number(val).toLocaleString('en-IN')}`, '']}
                  contentStyle={{ backgroundColor: '#1e293b', borderRadius: '0.75rem', color: '#fff', fontSize: '12px' }}
                />
                <Legend />
                <Bar dataKey="revenue" name="Total Revenue" fill="#10b981" radius={[6, 6, 0, 0]} />
                <Bar dataKey="cogs" name="Garment Purchase Cost" fill="#3b82f6" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* P&L Distribution Pie Chart */}
        <div className="lg:col-span-5 glass-card p-6 border-slate-200 dark:border-slate-800 flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-sm text-slate-900 dark:text-white mb-1">
              Revenue Allocation Breakdown
            </h3>
            <p className="text-xs text-slate-500 mb-2">How revenue turns into profit</p>

            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={expenseBreakdown}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {expenseBreakdown.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val: any) => [`₹ ${Number(val).toLocaleString('en-IN')}`, '']}
                    contentStyle={{ backgroundColor: '#1e293b', borderRadius: '0.5rem', color: '#fff', fontSize: '12px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs pt-3 border-t border-slate-100 dark:border-slate-800">
            {expenseBreakdown.map(item => (
              <div key={item.name} className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-slate-600 dark:text-slate-400 truncate">{item.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
