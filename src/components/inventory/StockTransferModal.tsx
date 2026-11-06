import React, { useState } from 'react';
import { ArrowRightLeft, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Product, Shop } from '../../types';
import { api } from '../../services/api';
import { Modal } from '../common/Modal';

interface StockTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  shops: Shop[];
  onTransferSuccess: () => void;
}

export const StockTransferModal: React.FC<StockTransferModalProps> = ({
  isOpen,
  onClose,
  products,
  shops,
  onTransferSuccess,
}) => {
  const [sourceShop, setSourceShop] = useState<string>('shop_wholesale');
  const [destShop, setDestShop] = useState<string>('shop_retail');
  const [productId, setProductId] = useState<string>(products[0]?.id || '');
  const [quantity, setQuantity] = useState<number>(20);
  const [notes, setNotes] = useState<string>('Routine retail replenishment');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  const selectedProduct = products.find(p => p.id === (productId || products[0]?.id));

  const handleTransfer = async () => {
    setError('');
    if (!productId && products.length > 0) {
      setProductId(products[0].id);
    }
    const targetProdId = productId || products[0]?.id;

    if (!targetProdId) {
      setError('Please select a product.');
      return;
    }

    if (sourceShop === destShop) {
      setError('Source shop and destination shop must be different.');
      return;
    }

    if (!quantity || quantity <= 0) {
      setError('Please specify a valid quantity greater than 0.');
      return;
    }

    try {
      setSubmitting(true);
      await api.inventory.transferStock({
        source_shop: sourceShop,
        dest_shop: destShop,
        product_id: targetProdId,
        quantity: Number(quantity),
        notes,
      });

      alert(`Stock transfer of ${quantity} units completed successfully.`);
      onTransferSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Stock transfer failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Inter-Shop Stock Transfer"
      subtitle="Transfer inventory seamlessly between Retail and Wholesale warehouses"
      maxWidth="md"
    >
      <div className="space-y-4">
        {/* Source & Destination Grid */}
        <div className="grid grid-cols-2 gap-3 items-center">
          <div>
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Source Location (From)
            </label>
            <select
              value={sourceShop}
              onChange={e => {
                setSourceShop(e.target.value);
                if (e.target.value === destShop) {
                  setDestShop(e.target.value === 'shop_wholesale' ? 'shop_retail' : 'shop_wholesale');
                }
              }}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold"
            >
              <option value="shop_wholesale">Wholesale Warehouse (WHO)</option>
              <option value="shop_retail">Retail Showroom (RET)</option>
            </select>
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Destination Location (To)
            </label>
            <select
              value={destShop}
              onChange={e => {
                setDestShop(e.target.value);
                if (e.target.value === sourceShop) {
                  setSourceShop(e.target.value === 'shop_retail' ? 'shop_wholesale' : 'shop_retail');
                }
              }}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold"
            >
              <option value="shop_retail">Retail Showroom (RET)</option>
              <option value="shop_wholesale">Wholesale Warehouse (WHO)</option>
            </select>
          </div>
        </div>

        {/* Product Picker */}
        <div>
          <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
            Garment / Product
          </label>
          <select
            value={productId || products[0]?.id}
            onChange={e => setProductId(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold"
          >
            {products.map(p => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.code}) — {p.size || 'Standard'}
              </option>
            ))}
          </select>
        </div>

        {/* Transfer Quantity & Notes */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Transfer Quantity (Pieces)
            </label>
            <input
              type="number"
              min="1"
              value={quantity}
              onChange={e => setQuantity(parseInt(e.target.value, 10) || 0)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono font-bold"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Transfer Reason
            </label>
            <input
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g. Weekend retail rush"
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
            />
          </div>
        </div>

        {error && (
          <div className="p-2.5 rounded-lg bg-rose-50 text-rose-700 text-xs flex items-center gap-2 border border-rose-200">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <button
            onClick={onClose}
            className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-400"
          >
            Cancel
          </button>
          <button
            onClick={handleTransfer}
            disabled={submitting}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20"
          >
            <ArrowRightLeft className="w-4 h-4" />
            {submitting ? 'Executing Transfer...' : `Transfer ${quantity} Units`}
          </button>
        </div>
      </div>
    </Modal>
  );
};
