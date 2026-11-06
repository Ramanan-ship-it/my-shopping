import React, { useState, useEffect } from 'react';
import { Users, Search, Plus, Phone, MapPin, Receipt, RefreshCw } from 'lucide-react';
import { Customer } from '../../types';
import { useShop } from '../../context/ShopContext';
import { api } from '../../services/api';
import { Badge } from '../common/Badge';
import { Modal } from '../common/Modal';

export const CustomerList: React.FC = () => {
  const { activeShop, currency } = useShop();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');

  // Add Customer Modal
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [name, setName] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [address, setAddress] = useState<string>('');
  const [gstin, setGstin] = useState<string>('');
  const [customerType, setCustomerType] = useState<'retail' | 'wholesale'>('retail');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const res = await api.customers.getAll({
        shop_id: activeShop === 'all' ? undefined : activeShop,
        search: search || undefined,
      });
      setCustomers(res.customers || []);
    } catch (err) {
      console.error('Failed to load customers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, [activeShop]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchCustomers();
  };

  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim() || !phone.trim()) {
      setError('Customer name and phone number are required.');
      return;
    }

    try {
      setSubmitting(true);
      await api.customers.createCustomer({
        name: name.trim(),
        phone: phone.trim(),
        address: address.trim(),
        gstin: gstin.trim(),
        customer_type: customerType,
        shop_id: activeShop === 'all' ? 'shop_retail' : activeShop,
      });

      setName('');
      setPhone('');
      setAddress('');
      setGstin('');
      setShowAddModal(false);
      await fetchCustomers();
    } catch (err: any) {
      setError(err.message || 'Failed to create customer.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-card p-6 border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
            Customer Directory
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage Retail consumers and Wholesale business buyers.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            Add Customer
          </button>
          <button
            onClick={fetchCustomers}
            className="p-2 text-slate-500 hover:text-slate-800 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-500' : ''}`} />
          </button>
        </div>
      </div>

      {/* Search Toolbar */}
      <div className="glass-card p-4 border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by customer name or phone..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-1 focus:ring-emerald-500"
          />
        </form>
        <span className="text-xs text-slate-500 font-semibold">
          {customers.length} registered customers
        </span>
      </div>

      {/* Customer Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {customers.map(c => (
          <div
            key={c.id}
            className="glass-card p-5 border-slate-200 dark:border-slate-800 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-start justify-between gap-2">
                <h4 className="font-bold text-sm text-slate-900 dark:text-white truncate">
                  {c.name}
                </h4>
                <Badge variant={c.customer_type === 'wholesale' ? 'blue' : 'slate'} size="sm">
                  {c.customer_type.toUpperCase()}
                </Badge>
              </div>

              <div className="mt-3 space-y-1.5 text-xs text-slate-500">
                <div className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  <span className="font-mono">{c.phone}</span>
                </div>
                {c.address && (
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    <span className="truncate">{c.address}</span>
                  </div>
                )}
                {c.gstin && (
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[10px] text-slate-400">GST:</span>
                    <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">
                      {c.gstin}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
              <span className="text-slate-400 font-medium">Khata Balance:</span>
              <span
                className={`font-mono font-bold ${
                  (c.pending_credit || 0) > 0
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-emerald-600 dark:text-emerald-400'
                }`}
              >
                ₹{Number(c.pending_credit || 0).toLocaleString('en-IN')}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Add Customer Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add New Customer"
        subtitle="Register customer for fast POS lookup and credit tracking"
        maxWidth="md"
      >
        <form onSubmit={handleAddCustomer} className="space-y-4">
          <div>
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Customer / Business Name *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Balaji Textiles or Ramesh Kumar"
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Phone Number *
              </label>
              <input
                type="text"
                required
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="+91 98401 23456"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-bold"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Customer Type
              </label>
              <select
                value={customerType}
                onChange={e => setCustomerType(e.target.value as any)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold"
              >
                <option value="retail">Retail Consumer</option>
                <option value="wholesale">Wholesale Dealer / Bulk</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Address / Town
            </label>
            <input
              type="text"
              value={address}
              onChange={e => setAddress(e.target.value)}
              placeholder="e.g. 14 Gandhi Road, Chennai"
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              GSTIN (For B2B Tax Invoices)
            </label>
            <input
              type="text"
              value={gstin}
              onChange={e => setGstin(e.target.value)}
              placeholder="33AABCS1429B1Z1"
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono"
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
              {submitting ? 'Saving...' : 'Register Customer'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
