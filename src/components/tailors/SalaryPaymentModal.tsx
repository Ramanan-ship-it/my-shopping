import React, { useState } from 'react';
import { IndianRupee, Banknote } from 'lucide-react';
import { Tailor } from '../../types';
import { api } from '../../services/api';
import { Modal } from '../common/Modal';

interface SalaryPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  tailor: Tailor | null;
  onSuccess: () => void;
}

export const SalaryPaymentModal: React.FC<SalaryPaymentModalProps> = ({
  isOpen,
  onClose,
  tailor,
  onSuccess,
}) => {
  const [paymentType, setPaymentType] = useState<'salary' | 'advance'>('salary');
  const [amount, setAmount] = useState<number>(500);
  const [paymentMethod, setPaymentMethod] = useState<string>('cash');
  const [notes, setNotes] = useState<string>('Weekly wage settlement');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  if (!tailor) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!amount || amount <= 0) {
      setError('Please specify a valid payment amount.');
      return;
    }

    try {
      setSubmitting(true);
      await api.tailors.recordSalaryPayment({
        tailor_id: tailor.id,
        amount: Number(amount),
        payment_type: paymentType,
        payment_method: paymentMethod,
        notes,
      });

      alert(`Recorded ₹${amount} payment for ${tailor.name}.`);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Payment recording failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Tailor Payout & Advance Recorder"
      subtitle={`Tailor: ${tailor.name} (${tailor.tailor_code})`}
      maxWidth="sm"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
            Payment Type
          </label>
          <div className="grid grid-cols-2 gap-2 text-xs font-semibold">
            <button
              type="button"
              onClick={() => {
                setPaymentType('salary');
                setNotes('Salary payment');
              }}
              className={`py-2 rounded-lg border text-center transition-all ${
                paymentType === 'salary'
                  ? 'bg-emerald-600 text-white border-emerald-600 font-bold'
                  : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
              }`}
            >
              Salary Wage
            </button>
            <button
              type="button"
              onClick={() => {
                setPaymentType('advance');
                setNotes('Emergency cash advance');
              }}
              className={`py-2 rounded-lg border text-center transition-all ${
                paymentType === 'advance'
                  ? 'bg-amber-600 text-white border-amber-600 font-bold'
                  : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
              }`}
            >
              Cash Advance
            </button>
          </div>
        </div>

        <div>
          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
            Amount (₹)
          </label>
          <input
            type="number"
            min="1"
            required
            value={amount}
            onChange={e => setAmount(Number(e.target.value) || 0)}
            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono font-bold"
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
            <option value="cash">Cash in Hand</option>
            <option value="upi">UPI / GPay / PhonePe</option>
            <option value="bank_transfer">Direct Bank Transfer</option>
          </select>
        </div>

        <div>
          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
            Notes / Receipt Ref
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
            {submitting ? 'Recording...' : `Disburse ₹${amount}`}
          </button>
        </div>
      </form>
    </Modal>
  );
};
