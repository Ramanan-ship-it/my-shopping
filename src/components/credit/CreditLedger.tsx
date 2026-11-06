import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  AlertTriangle,
  Clock,
  Phone,
  MessageSquare,
  Search,
  RefreshCw,
  CheckCircle2,
  Share2,
} from 'lucide-react';
import { Bill } from '../../types';
import { useShop } from '../../context/ShopContext';
import { api } from '../../services/api';
import { Badge } from '../common/Badge';
import { StatCard } from '../common/StatCard';
import { CreditPaymentModal } from './CreditPaymentModal';

export const CreditLedger: React.FC = () => {
  const { activeShop, shops, currency } = useShop();
  const [bills, setBills] = useState<Bill[]>([]);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Modals
  const [selectedBillForPay, setSelectedBillForPay] = useState<Bill | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState<boolean>(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [dashRes, listRes] = await Promise.all([
        api.credit.getDashboard({ shop_id: activeShop === 'all' ? undefined : activeShop }),
        api.credit.getLedger({
          shop_id: activeShop === 'all' ? undefined : activeShop,
          status: statusFilter === 'all' ? undefined : statusFilter,
          search: search || undefined,
        }),
      ]);
      setDashboardData(dashRes);
      setBills(listRes.bills || []);
    } catch (err) {
      console.error('Failed to load credit ledger:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeShop, statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchData();
  };

  const handleSendReminder = (bill: Bill) => {
    if (!bill.customer_phone) {
      alert('No customer phone number available.');
      return;
    }
    const cleanPhone = bill.customer_phone.replace(/[^0-9]/g, '');
    const shop = shops.find(s => s.id === bill.shop_id) || shops[0];
    const text = encodeURIComponent(
      `Dear ${bill.customer_name},\nGreetings from *${shop.name}*!\n\n` +
      `This is a gentle payment reminder for Bill *#${bill.bill_number}*.\n` +
      `📌 *Pending Amount:* ${currency} ${bill.pending_amount}\n` +
      `📅 *Due Date:* ${bill.due_date || 'Immediate'}\n\n` +
      `Kindly settle the outstanding balance via UPI or at our shop counter. Thank you for your continued patronage!`
    );
    window.open(`https://wa.me/${cleanPhone}?text=${text}`, '_blank');
  };

  const handleOpenPayment = (bill: Bill) => {
    setSelectedBillForPay(bill);
    setShowPaymentModal(true);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-card p-6 border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Customer Khata & Credit Receivables
            </h2>
            <Badge variant="amber" size="sm" dot>
              Udhar Management
            </Badge>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Track unpaid balances, due dates, overdue notices, and record payments.
          </p>
        </div>

        <button
          onClick={fetchData}
          className="p-2 text-slate-500 hover:text-slate-800 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-500' : ''}`} />
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Total Outstanding Credit"
          value={`₹ ${Number(dashboardData?.total_pending_amount || 0).toLocaleString('en-IN')}`}
          subtitle={`${bills.length} active credit accounts`}
          icon={CreditCard}
          color="amber"
        />

        <StatCard
          title="Overdue Dues"
          value={`₹ ${Number(dashboardData?.overdue_amount || 0).toLocaleString('en-IN')}`}
          subtitle={`${dashboardData?.overdue_count || 0} bills past due date`}
          icon={AlertTriangle}
          color="rose"
        />

        <StatCard
          title="Upcoming Dues"
          value={`₹ ${Number(dashboardData?.due_next_7_days || 0).toLocaleString('en-IN')}`}
          subtitle="Maturing in next 7 days"
          icon={Clock}
          color="blue"
        />
      </div>

      {/* Filter and Search Bar */}
      <div className="glass-card p-4 border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row gap-3 items-center justify-between">
        <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by customer name or bill #..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-1 focus:ring-emerald-500"
          />
        </form>

        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
          {['all', 'overdue', 'pending', 'partial'].map(st => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize whitespace-nowrap transition-all ${
                statusFilter === st
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Credit Ledger Table */}
      <div className="glass-card overflow-hidden border-slate-200 dark:border-slate-800">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-950/50 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">Invoice #</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Phone</th>
                <th className="py-3 px-4">Due Date</th>
                <th className="py-3 px-4 text-right">Grand Total</th>
                <th className="py-3 px-4 text-right">Paid</th>
                <th className="py-3 px-4 text-right">Pending Balance</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {bills.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    No outstanding credit entries found.
                  </td>
                </tr>
              ) : (
                bills.map(bill => {
                  const isOverdue =
                    bill.due_date && new Date(bill.due_date).getTime() < new Date().setHours(0, 0, 0, 0);

                  return (
                    <tr
                      key={bill.id}
                      className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white">
                        {bill.bill_number}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">
                        {bill.customer_name}
                      </td>
                      <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                        {bill.customer_phone || '-'}
                      </td>
                      <td className="py-3 px-4 font-mono">
                        {bill.due_date ? (
                          <span
                            className={
                              isOverdue
                                ? 'text-rose-600 dark:text-rose-400 font-bold'
                                : 'text-slate-700 dark:text-slate-300'
                            }
                          >
                            {bill.due_date}
                          </span>
                        ) : (
                          <span className="text-slate-400">Not set</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 dark:text-white">
                        ₹{Number(bill.grand_total).toLocaleString('en-IN')}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                        ₹{Number(bill.paid_amount).toLocaleString('en-IN')}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-black text-rose-600 dark:text-rose-400 text-sm">
                        ₹{Number(bill.pending_amount).toLocaleString('en-IN')}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Badge variant={isOverdue ? 'rose' : 'amber'} size="sm" dot>
                          {isOverdue ? 'Overdue' : bill.status}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleOpenPayment(bill)}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all shadow-sm"
                          >
                            Collect
                          </button>
                          {bill.customer_phone && (
                            <button
                              onClick={() => handleSendReminder(bill)}
                              title="Send WhatsApp Payment Reminder"
                              className="p-1 text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            >
                              <MessageSquare className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payment Modal */}
      <CreditPaymentModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        bill={selectedBillForPay}
        onSuccess={fetchData}
      />
    </div>
  );
};
