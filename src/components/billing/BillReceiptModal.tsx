import React, { useState } from 'react';
import { Printer, Share2, Download, CheckCircle2, X, MessageCircle, ArrowRight } from 'lucide-react';
import { Bill } from '../../types';
import { useShop } from '../../context/ShopContext';
import { useLanguage } from '../../context/LanguageContext';
import { Badge } from '../common/Badge';

interface BillReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  bill: Bill | null;
}

export const BillReceiptModal: React.FC<BillReceiptModalProps> = ({
  isOpen,
  onClose,
  bill,
}) => {
  const { shops, currency } = useShop();
  const { t } = useLanguage();
  const [printMode, setPrintMode] = useState<'thermal' | 'a4'>('thermal');
  const [whatsappPhone, setWhatsappPhone] = useState<string>('');

  if (!isOpen || !bill) return null;

  const shop = shops.find(s => s.id === bill.shop_id) || shops[0];
  const targetPhone = whatsappPhone.trim() || bill.customer_phone?.trim() || '';

  const handlePrint = () => {
    window.print();
  };

  const handleWhatsAppShare = () => {
    const cleanPhone = targetPhone.replace(/[^0-9]/g, '');

    // Format full detailed invoice for WhatsApp
    const itemLines = (bill.items || []).map(
      (it, idx) => `${idx + 1}. *${it.product_name}* x ${it.quantity} @ ₹${it.unit_price} = ₹${it.total_price}`
    ).join('\n');

    const message = encodeURIComponent(
      `*${shop.name.toUpperCase()}*\n` +
      `${shop.address || ''}\n` +
      `📞 Contact: ${shop.phone || ''}\n` +
      (shop.gstin ? `🏛️ GSTIN: ${shop.gstin}\n` : '') +
      `--------------------------------\n` +
      `🧾 *INVOICE: ${bill.bill_number}*\n` +
      `📅 Date: ${new Date(bill.created_at).toLocaleDateString()}\n` +
      `👤 Customer: ${bill.customer_name}\n` +
      (bill.customer_phone ? `📱 Phone: ${bill.customer_phone}\n` : '') +
      `--------------------------------\n` +
      `*ITEMS PURCHASED:*\n` +
      (itemLines || '• Garments / Apparels') + '\n' +
      `--------------------------------\n` +
      `💵 Subtotal: ₹${bill.subtotal}\n` +
      (bill.discount > 0 ? `🎁 Discount: -₹${bill.discount}\n` : '') +
      (bill.tax_amount > 0 ? `🏛️ GST Tax: +₹${bill.tax_amount}\n` : '') +
      `💰 *Grand Total: ₹${bill.grand_total}*\n` +
      `✅ *Paid Amount: ₹${bill.paid_amount}* (${bill.payment_method?.toUpperCase() || 'CASH'})\n` +
      (bill.pending_amount > 0
        ? `⚠️ *Balance Due: ₹${bill.pending_amount}* (Due: ${bill.due_date || 'Within 7 days'})\n`
        : '🎉 *Status: FULLY PAID*\n') +
      `--------------------------------\n` +
      `Thank you for shopping with us! Visit again. 🙏`
    );

    if (cleanPhone) {
      window.open(`https://wa.me/${cleanPhone.startsWith('91') || cleanPhone.length > 10 ? cleanPhone : '91' + cleanPhone}?text=${message}`, '_blank');
    } else {
      window.open(`https://wa.me/?text=${message}`, '_blank');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="fixed inset-0 bg-slate-900/75 backdrop-blur-sm no-print" onClick={onClose} />

      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden z-10 my-4 flex flex-col max-h-[92vh] animate-fade-in-slide">
        {/* Controls Toolbar (Top) */}
        <div className="p-3.5 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between no-print flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Format:</span>
            <button
              onClick={() => setPrintMode('thermal')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                printMode === 'thermal'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
              }`}
            >
              {t('print_thermal', '80mm Thermal')}
            </button>
            <button
              onClick={() => setPrintMode('a4')}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                printMode === 'a4'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
              }`}
            >
              {t('print_a4', 'A4 Standard GST')}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 dark:text-emerald-400 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800">
              {bill.bill_number}
            </span>
            <button
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              title="Close receipt"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Receipt Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 bg-white text-slate-900 print-container">
          <div
            className={`mx-auto bg-white text-slate-900 ${
              printMode === 'thermal'
                ? 'receipt-thermal border border-dashed border-slate-300 p-4 font-mono text-xs'
                : 'p-6 border border-slate-200 rounded-xl font-sans'
            }`}
          >
            {/* Shop Header */}
            <div className="text-center pb-3 border-b border-dashed border-slate-300">
              <h2 className="text-base sm:text-lg font-black tracking-tight uppercase">
                {shop.name}
              </h2>
              <p className="text-[11px] text-slate-600 mt-0.5 leading-tight">
                {shop.address || 'Smart Dress Shop Fashion Hub'}
              </p>
              <p className="text-[11px] text-slate-600">
                Phone: {shop.phone || '+91 98401 23456'} {shop.email ? `• Email: ${shop.email}` : ''}
              </p>
              {shop.gstin && (
                <p className="text-[11px] font-bold text-slate-800 mt-0.5">
                  GSTIN: {shop.gstin}
                </p>
              )}
              <div className="mt-2 inline-block px-2.5 py-0.5 bg-slate-100 border border-slate-300 text-[10px] font-bold uppercase rounded">
                {bill.bill_type === 'gst' ? 'TAX INVOICE' : 'RETAIL CASH MEMO'}
              </div>
            </div>

            {/* Bill Info */}
            <div className="py-2.5 border-b border-dashed border-slate-300 text-[11px] grid grid-cols-2 gap-2">
              <div>
                <span className="text-slate-500">{t('invoice_no', 'Invoice No')}:</span>{' '}
                <span className="font-bold">{bill.bill_number}</span>
              </div>
              <div className="text-right">
                <span className="text-slate-500">{t('date', 'Date')}:</span>{' '}
                <span>{new Date(bill.created_at).toLocaleDateString()}</span>
              </div>
              <div>
                <span className="text-slate-500">{t('customer_info', 'Customer')}:</span>{' '}
                <span className="font-bold">{bill.customer_name}</span>
              </div>
              <div className="text-right">
                <span className="text-slate-500">Phone:</span>{' '}
                <span>{bill.customer_phone || targetPhone || '-'}</span>
              </div>
            </div>

            {/* Items Table */}
            <div className="py-2.5 border-b border-dashed border-slate-300">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="text-left pb-1 font-semibold">{t('items', 'Item')}</th>
                    <th className="text-center pb-1 font-semibold">{t('qty', 'Qty')}</th>
                    <th className="text-right pb-1 font-semibold">{t('unit_rate', 'Rate')}</th>
                    <th className="text-right pb-1 font-semibold">{t('amount', 'Amount')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {bill.items && bill.items.length > 0 ? (
                    bill.items.map((item, idx) => (
                      <tr key={idx} className="py-1">
                        <td className="py-1 text-left">
                          <div className="font-bold">{item.product_name}</div>
                          {item.product_code && (
                            <div className="text-[10px] text-slate-400">{item.product_code}</div>
                          )}
                        </td>
                        <td className="py-1 text-center font-mono">{item.quantity}</td>
                        <td className="py-1 text-right font-mono">₹{item.unit_price}</td>
                        <td className="py-1 text-right font-mono font-bold">₹{item.total_price}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="py-2 text-center text-slate-400">
                        Clothing / Garment Items
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="py-2.5 border-b border-dashed border-slate-300 space-y-1 text-[11px]">
              <div className="flex justify-between">
                <span className="text-slate-500">{t('subtotal', 'Subtotal')}:</span>
                <span className="font-mono">₹{bill.subtotal}</span>
              </div>
              {bill.discount > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>{t('discount', 'Discount')}:</span>
                  <span className="font-mono">- ₹{bill.discount}</span>
                </div>
              )}
              {bill.tax_amount > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-500">{t('gst_tax', 'GST Tax')}:</span>
                  <span className="font-mono">+ ₹{bill.tax_amount}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-black pt-1 border-t border-slate-200">
                <span>{t('grand_total', 'Grand Total')}:</span>
                <span className="font-mono">₹{bill.grand_total}</span>
              </div>
            </div>

            {/* Payment Summary */}
            <div className="py-2.5 border-b border-dashed border-slate-300 space-y-1 text-[11px]">
              <div className="flex justify-between">
                <span className="text-slate-500">{t('payment_method', 'Payment Mode')}:</span>
                <span className="font-bold uppercase">{bill.payment_method || 'CASH'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">{t('paid_amount', 'Paid Amount')}:</span>
                <span className="font-mono font-bold text-emerald-700">₹{bill.paid_amount}</span>
              </div>
              {bill.pending_amount > 0 && (
                <div className="flex justify-between text-rose-700 font-bold bg-rose-50 p-1.5 rounded">
                  <span>Pending Balance (Due {bill.due_date || '7 days'}):</span>
                  <span className="font-mono">₹{bill.pending_amount}</span>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="text-center pt-3 text-[10px] text-slate-500 space-y-1">
              <p className="font-medium">{t('thank_you', 'Thank you for shopping with us! Visit again.')}</p>
              <p>Goods once sold can be exchanged within 7 days with original invoice.</p>
              <p className="text-[9px] text-slate-400">Powered by Smart Dress Shop ERP</p>
            </div>
          </div>
        </div>

        {/* BOTTOM ACTION BAR (Print or Send in WhatsApp) */}
        <div className="p-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 no-print flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg">
          {/* Quick WhatsApp Phone Editor (if customer didn't give phone during checkout) */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-xs font-semibold text-slate-500 whitespace-nowrap">WhatsApp No:</span>
            <input
              type="text"
              placeholder="+91 98401 23456"
              defaultValue={bill.customer_phone || ''}
              onChange={e => setWhatsappPhone(e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg w-full sm:w-44 font-mono focus:ring-1 focus:ring-emerald-500 text-slate-900 dark:text-white"
            />
          </div>

          {/* Primary Action Buttons at Bottom */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={handleWhatsAppShare}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 active:scale-98 transition-all"
            >
              <MessageCircle className="w-4 h-4 fill-white text-emerald-600" />
              <span>{t('send_whatsapp', 'Send in WhatsApp')}</span>
            </button>

            <button
              onClick={handlePrint}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 text-white dark:text-slate-900 rounded-xl text-xs font-bold shadow-md active:scale-98 transition-all"
            >
              <Printer className="w-4 h-4" />
              <span>{t('print_receipt', 'Print Bill')}</span>
            </button>

            <button
              onClick={onClose}
              className="px-3.5 py-2.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all"
            >
              {t('new_bill_f2', 'New Bill')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
