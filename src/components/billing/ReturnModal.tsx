import React, { useState } from 'react';
import { RotateCcw, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Bill, BillItem } from '../../types';
import { api } from '../../services/api';
import { Modal } from '../common/Modal';

interface ReturnModalProps {
  isOpen: boolean;
  onClose: () => void;
  bill: Bill | null;
  onReturnSuccess: () => void;
}

export const ReturnModal: React.FC<ReturnModalProps> = ({
  isOpen,
  onClose,
  bill,
  onReturnSuccess,
}) => {
  const [returnItems, setReturnItems] = useState<{ [productId: string]: number }>({});
  const [restockInventory, setRestockInventory] = useState<boolean>(true);
  const [refundMethod, setRefundMethod] = useState<'cash' | 'credit_adjustment'>('cash');
  const [notes, setNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  if (!bill) return null;

  const handleQtyChange = (productId: string, qty: number, maxQty: number) => {
    const validQty = Math.max(0, Math.min(qty, maxQty));
    setReturnItems(prev => ({
      ...prev,
      [productId]: validQty,
    }));
  };

  const calculateReturnTotal = () => {
    if (!bill.items) return 0;
    return bill.items.reduce((sum, item) => {
      const qty = returnItems[item.product_id] || 0;
      return sum + qty * item.unit_price;
    }, 0);
  };

  const returnTotal = calculateReturnTotal();

  const handleProcessReturn = async () => {
    setError('');
    const itemsToReturn = Object.entries(returnItems)
      .filter(([_, qty]) => qty > 0)
      .map(([productId, quantity]) => {
        const item = bill.items?.find(i => i.product_id === productId);
        return {
          product_id: productId,
          product_name: item?.product_name || 'Item',
          quantity,
          refund_rate: item?.unit_price || 0,
        };
      });

    if (itemsToReturn.length === 0) {
      setError('Please specify at least 1 item to return.');
      return;
    }

    try {
      setSubmitting(true);
      await api.billing.processReturn({
        bill_id: bill.id,
        shop_id: bill.shop_id,
        customer_id: bill.customer_id,
        items: itemsToReturn,
        restock_inventory: restockInventory,
        refund_method: refundMethod,
        notes,
      });

      alert('Return processed successfully. Stock has been adjusted.');
      onReturnSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to process return.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Process Return / Exchange"
      subtitle={`Bill: ${bill.bill_number} • Customer: ${bill.customer_name}`}
      maxWidth="lg"
    >
      <div className="space-y-4">
        <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-xl text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>
            Select the returned items and quantities. Restocked items will immediately increment inventory.
          </span>
        </div>

        {/* Items List */}
        <div className="space-y-2">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            Purchased Items
          </span>
          <div className="space-y-2 max-h-56 overflow-y-auto">
            {bill.items?.map(item => {
              const currentReturnQty = returnItems[item.product_id] || 0;
              return (
                <div
                  key={item.product_id}
                  className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3 text-xs"
                >
                  <div>
                    <span className="font-bold text-slate-900 dark:text-white block">
                      {item.product_name}
                    </span>
                    <span className="text-slate-500 font-mono text-[11px]">
                      Billed: {item.quantity} pcs @ ₹{item.unit_price}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-slate-400 text-xs">Return Qty:</span>
                    <input
                      type="number"
                      min="0"
                      max={item.quantity}
                      value={currentReturnQty}
                      onChange={e =>
                        handleQtyChange(
                          item.product_id,
                          parseInt(e.target.value, 10) || 0,
                          item.quantity
                        )
                      }
                      className="w-16 px-2 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded text-center font-mono font-bold"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Options */}
        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div>
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Refund Method
            </label>
            <select
              value={refundMethod}
              onChange={e => setRefundMethod(e.target.value as any)}
              className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
            >
              <option value="cash">Cash Refund</option>
              <option value="credit_adjustment">Credit Ledger Adjustment</option>
            </select>
          </div>

          <div className="flex items-center pt-4">
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={restockInventory}
                onChange={e => setRestockInventory(e.target.checked)}
                className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
              />
              Restock back to Inventory
            </label>
          </div>
        </div>

        {/* Return Total */}
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 rounded-xl flex items-center justify-between text-xs">
          <span className="font-bold text-emerald-900 dark:text-emerald-300">Total Refund Amount:</span>
          <span className="font-mono font-extrabold text-base text-emerald-600 dark:text-emerald-400">
            ₹{returnTotal}
          </span>
        </div>

        {error && (
          <div className="p-2 bg-rose-50 text-rose-700 text-xs rounded border border-rose-200">
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-400"
          >
            Cancel
          </button>
          <button
            onClick={handleProcessReturn}
            disabled={submitting || returnTotal <= 0}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20"
          >
            {submitting ? 'Processing...' : `Confirm Return (₹${returnTotal})`}
          </button>
        </div>
      </div>
    </Modal>
  );
};
