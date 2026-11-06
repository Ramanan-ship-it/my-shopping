import React, { useState, useEffect } from 'react';
import {
  Search,
  Filter,
  Receipt,
  Printer,
  RotateCcw,
  Calendar,
  RefreshCw,
  Eye,
  FileText,
} from 'lucide-react';
import { Bill } from '../../types';
import { useShop } from '../../context/ShopContext';
import { api } from '../../services/api';
import { Badge } from '../common/Badge';
import { BillReceiptModal } from './BillReceiptModal';
import { ReturnModal } from './ReturnModal';

export const BillsHistoryView: React.FC = () => {
  const { activeShop, currency } = useShop();
  const [bills, setBills] = useState<Bill[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Modals
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);
  const [showReceiptModal, setShowReceiptModal] = useState<boolean>(false);
  const [billForReturn, setBillForReturn] = useState<Bill | null>(null);
  const [showReturnModal, setShowReturnModal] = useState<boolean>(false);

  const fetchBills = async () => {
    try {
      setLoading(true);
      const res = await api.billing.getBills({
        shop_id: activeShop === 'all' ? undefined : activeShop,
        status: statusFilter === 'all' ? undefined : statusFilter,
        search: search || undefined,
      });
      setBills(res.bills || []);
      setSummary(res.summary || null);
    } catch (err) {
      console.error('Failed to load bills:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBills();
  }, [activeShop, statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchBills();
  };

  const handleOpenReceipt = async (billId: string) => {
    try {
      const res = await api.billing.getBillById(billId);
      setSelectedBill(res.bill);
      setShowReceiptModal(true);
    } catch (err) {
      console.error('Failed to load full bill details:', err);
    }
  };

  const handleOpenReturn = async (bill: Bill) => {
    try {
      const res = await api.billing.getBillById(bill.id);
      setBillForReturn(res.bill);
      setShowReturnModal(true);
    } catch (err) {
      console.error('Failed to load bill items for return:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Summary */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-card p-6 border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
            Bills & Tax Invoices
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Complete billing records, payment receipts, and returns across shops.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-[11px] text-slate-400 block font-semibold">Total Revenue</span>
            <span className="text-lg font-mono-numbers font-black text-emerald-600 dark:text-emerald-400">
              {currency} {Number(summary?.total_revenue || 0).toLocaleString('en-IN')}
            </span>
          </div>
          <button
            onClick={fetchBills}
            className="p-2 text-slate-500 hover:text-slate-800 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-500' : ''}`} />
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="glass-card p-4 border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row gap-3 items-center justify-between">
        <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search bill number or customer..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-1 focus:ring-emerald-500"
          />
        </form>

        {/* Status Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
          {['all', 'paid', 'partial', 'pending', 'overdue'].map(st => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize whitespace-nowrap transition-all ${
                statusFilter === st
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Bills Table */}
      <div className="glass-card overflow-hidden border-slate-200 dark:border-slate-800">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-950/50 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">Invoice #</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4 text-right">Total</th>
                <th className="py-3 px-4 text-right">Paid</th>
                <th className="py-3 px-4 text-right">Pending</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {bills.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    No billing records found matching your filters.
                  </td>
                </tr>
              ) : (
                bills.map(bill => (
                  <tr
                    key={bill.id}
                    className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white">
                      {bill.bill_number}
                    </td>
                    <td className="py-3 px-4 text-slate-500">
                      {new Date(bill.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900 dark:text-white">
                        {bill.customer_name}
                      </div>
                      {bill.customer_phone && (
                        <div className="text-[11px] text-slate-400">{bill.customer_phone}</div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant={bill.bill_type === 'gst' ? 'blue' : 'slate'} size="sm">
                        {bill.bill_type.toUpperCase()}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 dark:text-white">
                      ₹{Number(bill.grand_total).toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                      ₹{Number(bill.paid_amount).toLocaleString('en-IN')}
                    </td>
                    <td className="py-3 px-4 text-right font-mono">
                      {bill.pending_amount > 0 ? (
                        <span className="text-rose-600 dark:text-rose-400 font-bold">
                          ₹{Number(bill.pending_amount).toLocaleString('en-IN')}
                        </span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <Badge
                        variant={
                          bill.status === 'paid'
                            ? 'emerald'
                            : bill.status === 'partial'
                            ? 'amber'
                            : bill.status === 'overdue'
                            ? 'rose'
                            : 'slate'
                        }
                        size="sm"
                        dot
                      >
                        {bill.status}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => handleOpenReceipt(bill.id)}
                          title="View / Print Receipt"
                          className="p-1.5 text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleOpenReturn(bill)}
                          title="Return / Exchange Item"
                          className="p-1.5 text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      <BillReceiptModal
        isOpen={showReceiptModal}
        onClose={() => setShowReceiptModal(false)}
        bill={selectedBill}
      />

      <ReturnModal
        isOpen={showReturnModal}
        onClose={() => setShowReturnModal(false)}
        bill={billForReturn}
        onReturnSuccess={fetchBills}
      />
    </div>
  );
};
