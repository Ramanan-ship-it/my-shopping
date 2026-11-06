import React, { useState } from 'react';
import { CreditCard, IndianRupee, CheckCircle2 } from 'lucide-react';
import { Bill } from '../../types';
import { api } from '../../services/api';
import { Modal } from '../common/Modal';

interface CreditPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  bill: Bill | null;
  onSuccess: () => void;
}

export const CreditPaymentModal: React.FC<CreditPaymentModalProps> = ({
  isOpen,
  onClose,
  bill,
  onSuccess,
}) => {
  const [amount, setAmount] = useState<number>(bill?.pending_amount || 0);
  const [paymentMethod, setPaymentMethod] = useState<string>('cash');
  const [notes, setNotes] = useState<string>('Customer credit settlement');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  if (!bill) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!amount || amount <= 0) {
      setError('Please enter a valid payment amount.');
      return;
    }

    if (amount > bill.pending_amount) {
      setError(`Payment cannot exceed remaining pending balance of ₹${bill.pending_amount}.`);
      return;
    }

    try {
      setSubmitting(true);
      await api.credit.collectPayment({
        bill_id: bill.id,
        amount: Number(amount),
        payment_method: paymentMethod,
        notes,
      });

      alert(`Payment of ₹${amount} recorded successfully.`);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Payment collection failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Collect Credit Payment (Khata Settlement)"
      subtitle={`Bill: ${bill.bill_number} • Customer: ${bill.customer_name}`}
      maxWidth="sm"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Outstanding summary */}
        <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-xl flex items-center justify-between text-xs">
          <div>
            <span className="text-amber-800 dark:text-amber-300 font-semibold block">
              Remaining Pending Balance:
            </span>
            <span className="text-[11px] text-slate-400">Due: {bill.due_date || 'N/A'}</span>
          </div>
          <span className="font-mono font-black text-lg text-rose-600 dark:text-rose-400">
            ₹{bill.pending_amount}
          </span>
        </div>

        <div>
          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
            Amount Collected Now (₹) *
          </label>
          <input
            type="number"
            min="1"
            max={bill.pending_amount}
            required
            value={amount || ''}
            onChange={e => setAmount(Number(e.target.value) || 0)}
            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono font-bold text-emerald-600"
          />
        </div>

        <div>
          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
            Payment Mode
          </label>
          <select
            value={paymentMethod}
            onChange={e => setPaymentMethod(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold"
          >
            <option value="cash">Cash Payment</option>
            <option value="upi">UPI / QR Transfer</option>
            <option value="card">Debit / Credit Card</option>
            <option value="bank_transfer">Bank Transfer</option>
          </select>
        </div>

        <div>
          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
            Payment Notes / Ref
          </label>
          <input
            type="text"
            value={notes}
            onChange={e => setNotes(e.target.value)}
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
            onClick={onClose}
            className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-400"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20"
          >
            {submitting ? 'Recording...' : `Record Payment of ₹${amount}`}
          </button>
        </div>
      </form>
    </Modal>
  );
};
