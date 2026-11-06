import React, { useState, useEffect } from 'react';
import { Product } from '../../types';
import { api } from '../../services/api';
import { Modal } from '../common/Modal';

interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
  onSuccess: () => void;
}

export const ProductModal: React.FC<ProductModalProps> = ({
  isOpen,
  onClose,
  product,
  onSuccess,
}) => {
  const [formData, setFormData] = useState<Partial<Product>>({
    name: '',
    code: '',
    category: 'Shirts',
    brand: 'Smart Dress Classic',
    size: 'M',
    color: 'Standard',
    purchase_price: 350,
    retail_price: 750,
    wholesale_price: 550,
    min_stock: 10,
    hsn: '6205',
    gst_rate: 5,
  });

  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (product) {
      setFormData(product);
    } else {
      setFormData({
        name: '',
        code: `GARMENT-${Math.floor(100 + Math.random() * 900)}`,
        category: 'Shirts',
        brand: 'Smart Dress Classic',
        size: '40',
        color: 'Navy Blue',
        purchase_price: 450,
        retail_price: 850,
        wholesale_price: 650,
        min_stock: 10,
        hsn: '6205',
        gst_rate: 5,
      });
    }
  }, [product, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.name?.trim() || !formData.code?.trim()) {
      setError('Product name and SKU code are required.');
      return;
    }

    try {
      setSubmitting(true);
      if (product?.id) {
        await api.inventory.updateProduct(product.id, formData);
      } else {
        await api.inventory.addProduct(formData);
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save product.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={product ? 'Edit Garment Product' : 'Add New Garment to Catalog'}
      subtitle="Configure pricing, sizes, and wholesale tiers"
      maxWidth="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Garment / Product Name *
            </label>
            <input
              type="text"
              required
              value={formData.name || ''}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Linen Casual Chino Trousers"
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              SKU / Barcode *
            </label>
            <input
              type="text"
              required
              value={formData.code || ''}
              onChange={e => setFormData({ ...formData, code: e.target.value })}
              placeholder="TROUS-001"
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-bold"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Category
            </label>
            <select
              value={formData.category || 'Shirts'}
              onChange={e => setFormData({ ...formData, category: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold"
            >
              {['Shirts', 'Pants', 'Sarees', 'Ethnic Wear', 'Traditional', 'T-Shirts', 'Suits', 'Accessories'].map(
                c => (
                  <option key={c} value={c}>{c}</option>
                )
              )}
            </select>
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Size
            </label>
            <input
              type="text"
              value={formData.size || ''}
              onChange={e => setFormData({ ...formData, size: e.target.value })}
              placeholder="38, 40, Free Size..."
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Color / Shade
            </label>
            <input
              type="text"
              value={formData.color || ''}
              onChange={e => setFormData({ ...formData, color: e.target.value })}
              placeholder="Beige, Maroon..."
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
            />
          </div>
        </div>

        {/* Pricing Tiers */}
        <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
            Pricing & Wholesale Tiers
          </span>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] font-bold text-slate-400 block mb-1">
                Purchase Price (₹)
              </label>
              <input
                type="number"
                required
                value={formData.purchase_price || 0}
                onChange={e => setFormData({ ...formData, purchase_price: Number(e.target.value) })}
                className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono font-bold"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400 block mb-1">
                Retail Selling (₹)
              </label>
              <input
                type="number"
                required
                value={formData.retail_price || 0}
                onChange={e => setFormData({ ...formData, retail_price: Number(e.target.value) })}
                className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono font-bold text-emerald-600"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400 block mb-1">
                Wholesale Price (₹)
              </label>
              <input
                type="number"
                required
                value={formData.wholesale_price || 0}
                onChange={e => setFormData({ ...formData, wholesale_price: Number(e.target.value) })}
                className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono font-bold text-blue-600"
              />
            </div>
          </div>
        </div>

        {/* GST & Thresholds */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-[10px] font-bold text-slate-400 block mb-1">
              GST Tax Rate (%)
            </label>
            <select
              value={formData.gst_rate || 5}
              onChange={e => setFormData({ ...formData, gst_rate: Number(e.target.value) })}
              className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold"
            >
              <option value="0">0% (Exempt)</option>
              <option value="5">5% (Apparel standard)</option>
              <option value="12">12% (Premium garments)</option>
              <option value="18">18%</option>
            </select>
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-400 block mb-1">
              HSN Code
            </label>
            <input
              type="text"
              value={formData.hsn || '6205'}
              onChange={e => setFormData({ ...formData, hsn: e.target.value })}
              className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-400 block mb-1">
              Min Stock Alert
            </label>
            <input
              type="number"
              value={formData.min_stock || 10}
              onChange={e => setFormData({ ...formData, min_stock: parseInt(e.target.value, 10) || 0 })}
              className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono"
            />
          </div>
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
            {submitting ? 'Saving...' : product ? 'Update Product' : 'Create Product'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
