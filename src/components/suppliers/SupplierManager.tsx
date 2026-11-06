import React, { useState, useEffect } from 'react';
import { Truck, Plus, Phone, MapPin, IndianRupee, RefreshCw, AlertCircle } from 'lucide-react';
import { Supplier } from '../../types';
import { api } from '../../services/api';
import { Modal } from '../common/Modal';
import { Badge } from '../common/Badge';

export const SupplierManager: React.FC = () => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [totalPayable, setTotalPayable] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);

  // Modals
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [showPaymentModal, setShowPaymentModal] = useState<boolean>(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);

  // New Supplier form
  const [name, setName] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [address, setAddress] = useState<string>('');
  const [productsSupplied, setProductsSupplied] = useState<string>('');
  const [payableBalance, setPayableBalance] = useState<number>(0);

  // Payment form
  const [payAmount, setPayAmount] = useState<number>(5000);
  const [payMethod, setPayMethod] = useState<string>('bank_transfer');
  const [payNotes, setPayNotes] = useState<string>('Mill fabric invoice payment');

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const fetchSuppliers = async () => {
    try {
      setLoading(true);
      const res = await api.suppliers.getAll();
      setSuppliers(res.suppliers || []);
      setTotalPayable(res.total_payable || 0);
    } catch (err) {
      console.error('Failed to load suppliers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const handleAddSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Supplier name is required.');
      return;
    }

    try {
      setSubmitting(true);
      await api.suppliers.createSupplier({
        name: name.trim(),
        phone: phone.trim(),
        address: address.trim(),
        products_supplied: productsSupplied.trim(),
        payable_balance: Number(payableBalance) || 0,
      });

      setShowAddModal(false);
      setName('');
      setPhone('');
      setAddress('');
      setProductsSupplied('');
      setPayableBalance(0);
      await fetchSuppliers();
    } catch (err: any) {
      setError(err.message || 'Failed to add supplier.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!selectedSupplier) return;
    if (!payAmount || payAmount <= 0) {
      setError('Please specify a valid payment amount.');
      return;
    }

    try {
      setSubmitting(true);
      await api.suppliers.recordPayment({
        supplier_id: selectedSupplier.id,
        amount: Number(payAmount),
        payment_method: payMethod,
        notes: payNotes,
      });

      alert(`Payment of ₹${payAmount} recorded for ${selectedSupplier.name}.`);
      setShowPaymentModal(false);
      await fetchSuppliers();
    } catch (err: any) {
      setError(err.message || 'Failed to record supplier payment.');
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
            Suppliers & Fabric Mills
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage raw material vendors, shirting fabric mills, and payables.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-[11px] text-slate-400 block font-semibold">Total Payables</span>
            <span className="text-lg font-mono-numbers font-black text-rose-600 dark:text-rose-400">
              ₹{Number(totalPayable).toLocaleString('en-IN')}
            </span>
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            Add Supplier
          </button>
        </div>
      </div>

      {/* Supplier Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {suppliers.map(s => (
          <div
            key={s.id}
            className="glass-card p-5 border-slate-200 dark:border-slate-800 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-start justify-between gap-2">
                <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                  {s.name}
                </h4>
                <Badge variant={s.payable_balance > 0 ? 'rose' : 'emerald'} size="sm">
                  {s.payable_balance > 0 ? 'Due' : 'Cleared'}
                </Badge>
              </div>

              <div className="mt-3 space-y-1.5 text-xs text-slate-500">
                {s.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span className="font-mono">{s.phone}</span>
                  </div>
                )}
                {s.address && (
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <span>{s.address}</span>
                  </div>
                )}
                {s.products_supplied && (
                  <div className="text-[11px] text-slate-600 dark:text-slate-400 font-medium pt-1">
                    Supply: {s.products_supplied}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold">
                  Balance Payable
                </span>
                <span className="font-mono font-bold text-sm text-slate-900 dark:text-white">
                  ₹{Number(s.payable_balance).toLocaleString('en-IN')}
                </span>
              </div>

              <button
                onClick={() => {
                  setSelectedSupplier(s);
                  setPayAmount(s.payable_balance || 1000);
                  setShowPaymentModal(true);
                }}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all shadow-sm"
              >
                Pay Vendor
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add Supplier Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add New Fabric Mill / Vendor"
        maxWidth="md"
      >
        <form onSubmit={handleAddSupplier} className="space-y-4">
          <div>
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Vendor / Mill Name *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Sri Lakshmi Cotton Mills"
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Contact Phone
              </label>
              <input
                type="text"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="+91 94432 11223"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Initial Balance Due (₹)
              </label>
              <input
                type="number"
                value={payableBalance}
                onChange={e => setPayableBalance(Number(e.target.value) || 0)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-bold"
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Location / City
            </label>
            <input
              type="text"
              value={address}
              onChange={e => setAddress(e.target.value)}
              placeholder="Tirupur, Tamil Nadu"
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Products Supplied
            </label>
            <input
              type="text"
              value={productsSupplied}
              onChange={e => setProductsSupplied(e.target.value)}
              placeholder="Cotton shirting, linen fabrics, threads"
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
              {submitting ? 'Saving...' : 'Register Vendor'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Record Payment Modal */}
      <Modal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        title="Disburse Vendor Payment"
        subtitle={`Supplier: ${selectedSupplier?.name}`}
        maxWidth="sm"
      >
        <form onSubmit={handleRecordPayment} className="space-y-4">
          <div>
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Payment Amount (₹) *
            </label>
            <input
              type="number"
              min="1"
              required
              value={payAmount}
              onChange={e => setPayAmount(Number(e.target.value) || 0)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono font-bold text-emerald-600"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Payment Method
            </label>
            <select
              value={payMethod}
              onChange={e => setPayMethod(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold"
            >
              <option value="bank_transfer">RTGS / NEFT Bank Transfer</option>
              <option value="upi">UPI / Online</option>
              <option value="cheque">Cheque</option>
              <option value="cash">Cash</option>
            </select>
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Notes / Transaction ID
            </label>
            <input
              type="text"
              value={payNotes}
              onChange={e => setPayNotes(e.target.value)}
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
              onClick={() => setShowPaymentModal(false)}
              className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-400"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20"
            >
              {submitting ? 'Recording...' : `Pay ₹${payAmount}`}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
