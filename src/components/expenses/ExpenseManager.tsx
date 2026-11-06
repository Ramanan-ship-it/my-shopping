import React, { useState, useEffect } from 'react';
import { Wallet, Plus, Calendar, RefreshCw, AlertCircle } from 'lucide-react';
import { Expense } from '../../types';
import { useShop } from '../../context/ShopContext';
import { api } from '../../services/api';
import { Modal } from '../common/Modal';
import { Badge } from '../common/Badge';

const EXPENSE_CATEGORIES = [
  'Electricity',
  'Rent',
  'Transport',
  'Maintenance',
  'Staff Salary',
  'Tailor Salary',
  'Supplier Payments',
  'Packaging',
  'Other',
];

export const ExpenseManager: React.FC = () => {
  const { activeShop, currency } = useShop();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [totalExpense, setTotalExpense] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Add Expense Form
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [category, setCategory] = useState<string>('Electricity');
  const [amount, setAmount] = useState<number>(1000);
  const [description, setDescription] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<string>('cash');
  const [receiptRef, setReceiptRef] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const fetchExpenses = async () => {
    try {
      setLoading(true);
      const res = await api.expenses.getAll({
        shop_id: activeShop === 'all' ? undefined : activeShop,
        category: categoryFilter === 'all' ? undefined : categoryFilter,
      });
      setExpenses(res.expenses || []);
      setTotalExpense(res.total_expense || 0);
    } catch (err) {
      console.error('Failed to load expenses:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExpenses();
  }, [activeShop, categoryFilter]);

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!amount || amount <= 0) {
      setError('Please enter a valid amount.');
      return;
    }

    try {
      setSubmitting(true);
      await api.expenses.createExpense({
        date,
        category,
        amount: Number(amount),
        shop_id: activeShop === 'all' ? 'shop_retail' : activeShop,
        description: description.trim(),
        payment_method: paymentMethod,
        receipt_ref: receiptRef.trim(),
      });

      setShowAddModal(false);
      setDescription('');
      setReceiptRef('');
      await fetchExpenses();
    } catch (err: any) {
      setError(err.message || 'Failed to record expense.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-card p-6 border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
            Operating Expenses Ledger
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Log shop utilities, rent, packaging materials, logistics, and store upkeep.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-[11px] text-slate-400 block font-semibold">Total Expenses</span>
            <span className="text-lg font-mono-numbers font-black text-rose-600 dark:text-rose-400">
              ₹{Number(totalExpense).toLocaleString('en-IN')}
            </span>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            Add Expense
          </button>
        </div>
      </div>

      {/* Filter Chips */}
      <div className="glass-card p-4 border-slate-200 dark:border-slate-800 flex items-center gap-1.5 overflow-x-auto">
        <button
          onClick={() => setCategoryFilter('all')}
          className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
            categoryFilter === 'all'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
          }`}
        >
          All Categories
        </button>
        {EXPENSE_CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setCategoryFilter(cat)}
            className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
              categoryFilter === cat
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Expenses Table */}
      <div className="glass-card overflow-hidden border-slate-200 dark:border-slate-800">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-950/50 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Description</th>
                <th className="py-3 px-4">Shop</th>
                <th className="py-3 px-4">Payment Method</th>
                <th className="py-3 px-4 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {expenses.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    No expense records found.
                  </td>
                </tr>
              ) : (
                expenses.map(exp => (
                  <tr
                    key={exp.id}
                    className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-3 px-4 text-slate-500 font-mono">
                      {exp.date}
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant="slate" size="sm">{exp.category}</Badge>
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-900 dark:text-white">
                      {exp.description || '-'}
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant={exp.shop_id === 'shop_wholesale' ? 'blue' : 'emerald'} size="sm">
                        {exp.shop_id === 'shop_wholesale' ? 'Wholesale' : 'Retail'}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 uppercase text-slate-500 font-mono text-[11px]">
                      {exp.payment_method}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-rose-600 dark:text-rose-400">
                      ₹{Number(exp.amount).toLocaleString('en-IN')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Expense Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Record Operating Expense"
        subtitle="Log shop utility bills, vendor payments, or maintenance costs"
        maxWidth="md"
      >
        <form onSubmit={handleCreateExpense} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Expense Date
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={e => setDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold"
              >
                {EXPENSE_CATEGORIES.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Amount (₹) *
              </label>
              <input
                type="number"
                min="1"
                required
                value={amount}
                onChange={e => setAmount(Number(e.target.value) || 0)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono font-bold text-rose-600"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Payment Method
              </label>
              <select
                value={paymentMethod}
                onChange={e => setPaymentMethod(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold"
              >
                <option value="cash">Cash</option>
                <option value="upi">UPI / Online</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="card">Card</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Description
            </label>
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="e.g. Monthly TNEB electricity bill"
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
            />
          </div>

          {error && (
            <div className="p-2 bg-rose-50 text-rose-700 text-xs rounded border border-rose-200">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setShowAddModal(false)}
              className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-400"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20"
            >
              {submitting ? 'Recording...' : `Record Expense (₹${amount})`}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
