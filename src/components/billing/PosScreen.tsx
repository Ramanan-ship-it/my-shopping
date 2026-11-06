import React, { useState, useEffect } from 'react';
import {
  Search,
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  CreditCard,
  QrCode,
  Banknote,
  Receipt,
  UserCheck,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Percent,
  History,
  Store,
  ArrowRight,
  PackageCheck,
  Sparkles,
  Tag,
  Clock,
  Layers,
} from 'lucide-react';
import { Product, BillItem, Customer, Bill } from '../../types';
import { useShop } from '../../context/ShopContext';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { api } from '../../services/api';
import { Badge } from '../common/Badge';
import { BillReceiptModal } from './BillReceiptModal';

const CATEGORIES = [
  'All',
  'Shirts',
  'Pants',
  'Sarees',
  'Ethnic Wear',
  'Traditional',
  'T-Shirts',
  'Suits',
  'Accessories',
];

interface PosScreenProps {
  onNavigateToHistory?: () => void;
}

export const PosScreen: React.FC<PosScreenProps> = ({ onNavigateToHistory }) => {
  const { activeShop, shops, currency } = useShop();
  const { user } = useAuth();
  const { t } = useLanguage();

  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  // Billing Form State
  const [billType, setBillType] = useState<'normal' | 'gst'>('normal');
  const [cart, setCart] = useState<BillItem[]>([]);
  const [customerName, setCustomerName] = useState<string>('Walk-in Customer');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [customerId, setCustomerId] = useState<string>('');
  const [billDiscount, setBillDiscount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'upi' | 'card' | 'credit' | 'partial'>('cash');
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [dueDate, setDueDate] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  // Submission & Receipt Modal
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [completedBill, setCompletedBill] = useState<Bill | null>(null);
  const [showReceiptModal, setShowReceiptModal] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [successNotice, setSuccessNotice] = useState<string>('');

  // Effective shop for billing
  const effectiveShopId = activeShop === 'all' ? 'shop_retail' : activeShop;
  const currentShopObj = shops.find(s => s.id === effectiveShopId) || shops[0];

  const loadData = async () => {
    try {
      setLoading(true);
      const [prodRes, custRes] = await Promise.all([
        api.inventory.getProducts({ shop_id: effectiveShopId }),
        api.customers.getAll({ shop_id: effectiveShopId }),
      ]);
      setProducts(prodRes.products || []);
      setCustomers(custRes.customers || []);
    } catch (err) {
      console.error('Failed to load POS data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [effectiveShopId]);

  // Helper to accurately extract current available stock for this shop
  const getProductStock = (product: Product): number => {
    return Number(
      product.current_stock ??
      product.active_shop_stock ??
      (effectiveShopId === 'shop_wholesale' ? product.wholesale_stock : product.retail_stock) ??
      product.total_stock ??
      0
    );
  };

  // Filtered Products
  const filteredProducts = products.filter(p => {
    const matchesCategory = selectedCategory === 'All' || p.category === selectedCategory;
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      q === '' ||
      p.name.toLowerCase().includes(q) ||
      p.code.toLowerCase().includes(q) ||
      (p.brand && p.brand.toLowerCase().includes(q));
    return matchesCategory && matchesSearch;
  });

  // Quick add on Barcode / Enter key in search box
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const q = searchQuery.trim().toLowerCase();
      if (!q) return;

      // Exact code match first, else first filtered match
      const exact = filteredProducts.find(p => p.code.toLowerCase() === q);
      const match = exact || (filteredProducts.length === 1 ? filteredProducts[0] : null);

      if (match) {
        addToCart(match);
        setSearchQuery('');
      }
    }
  };

  // Cart operations
  const addToCart = (product: Product) => {
    const available = getProductStock(product);
    if (available <= 0) {
      setErrorMessage(`Product '${product.name}' is out of stock in ${currentShopObj?.name || 'this shop'}.`);
      return;
    }
    setErrorMessage('');

    setCart(prev => {
      const existing = prev.find(item => item.product_id === product.id);
      if (existing) {
        if (existing.quantity >= available) {
          setErrorMessage(`Cannot add more. Only ${available} units available in stock.`);
          return prev;
        }
        return prev.map(item =>
          item.product_id === product.id
            ? {
                ...item,
                quantity: item.quantity + 1,
                total_price: Number(((item.quantity + 1) * item.unit_price - item.discount).toFixed(2)),
              }
            : item
        );
      } else {
        const unitPrice =
          effectiveShopId === 'shop_wholesale'
            ? product.wholesale_price || product.selling_price
            : product.retail_price || product.selling_price;
        const taxRate = billType === 'gst' ? product.gst_rate || 5 : 0;
        const total = unitPrice;

        return [
          ...prev,
          {
            product_id: product.id,
            product_name: product.name,
            product_code: product.code,
            quantity: 1,
            unit_price: unitPrice,
            discount: 0,
            tax_rate: taxRate,
            tax_amount: 0,
            total_price: total,
            available_stock: available,
          },
        ];
      }
    });
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart(prev =>
      prev
        .map(item => {
          if (item.product_id === productId) {
            const newQty = item.quantity + delta;
            if (newQty <= 0) return null;
            if (item.available_stock && newQty > item.available_stock) {
              setErrorMessage(`Stock limit reached! Only ${item.available_stock} available.`);
              return item;
            }
            setErrorMessage('');
            return {
              ...item,
              quantity: newQty,
              total_price: Number((newQty * item.unit_price - item.discount).toFixed(2)),
            };
          }
          return item;
        })
        .filter(Boolean) as BillItem[]
    );
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.product_id !== productId));
  };

  // Calculate Totals
  const subtotal = Number(cart.reduce((sum, item) => sum + item.quantity * item.unit_price, 0).toFixed(2));
  const totalItemDiscount = Number(cart.reduce((sum, item) => sum + item.discount, 0).toFixed(2));
  const effectiveDiscount = Number((totalItemDiscount + Number(billDiscount || 0)).toFixed(2));

  const taxableAmount = Math.max(0, subtotal - effectiveDiscount);
  const totalTax =
    billType === 'gst'
      ? Number(
          cart
            .reduce((sum, item) => {
              const itemShare = subtotal > 0 ? (item.quantity * item.unit_price) / subtotal : 0;
              const itemTaxable = taxableAmount * itemShare;
              return sum + (itemTaxable * (item.tax_rate || 5)) / 100;
            }, 0)
            .toFixed(2)
        )
      : 0;

  const grandTotal = Math.max(0, Number((taxableAmount + totalTax).toFixed(2)));

  // Auto-sync paidAmount when grandTotal or paymentMethod changes
  useEffect(() => {
    if (paymentMethod === 'credit') {
      setPaidAmount(0);
      if (!dueDate) {
        const d = new Date();
        d.setDate(d.getDate() + 7);
        setDueDate(d.toISOString().split('T')[0]);
      }
    } else if (paymentMethod === 'partial') {
      if (paidAmount === grandTotal || paidAmount === 0) {
        setPaidAmount(Number((grandTotal * 0.5).toFixed(2)));
      }
      if (!dueDate) {
        const d = new Date();
        d.setDate(d.getDate() + 7);
        setDueDate(d.toISOString().split('T')[0]);
      }
    } else {
      setPaidAmount(grandTotal);
    }
  }, [grandTotal, paymentMethod]);

  const pendingAmount = Math.max(0, Number((grandTotal - paidAmount).toFixed(2)));

  const handleSelectCustomer = (cust: Customer) => {
    setCustomerId(cust.id);
    setCustomerName(cust.name);
    setCustomerPhone(cust.phone);
  };

  const applyDiscountPreset = (type: 'percent' | 'flat', val: number) => {
    if (type === 'percent') {
      setBillDiscount(Number(((subtotal * val) / 100).toFixed(2)));
    } else {
      setBillDiscount(val);
    }
  };

  const handleCheckout = async () => {
    setErrorMessage('');
    if (cart.length === 0) {
      setErrorMessage('Please add at least one garment item to the bill.');
      return;
    }

    if (!customerName.trim()) {
      setErrorMessage('Customer name is required.');
      return;
    }

    if (pendingAmount > 0 && !dueDate) {
      setErrorMessage('A payment due date is mandatory when there is an unpaid balance.');
      return;
    }

    try {
      setIsSubmitting(true);
      const payload = {
        bill_type: billType,
        shop_id: effectiveShopId,
        customer_id: customerId || undefined,
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim(),
        items: cart,
        subtotal,
        discount: effectiveDiscount,
        tax_amount: totalTax,
        grand_total: grandTotal,
        payment_method: paymentMethod,
        paid_amount: paidAmount,
        due_date: pendingAmount > 0 ? dueDate : undefined,
        notes,
      };

      // 1. Call API to create bill and atomically update SQLite database
      const res = await api.billing.createBill(payload);

      // 2. Fetch full bill details with items & shop info for receipt
      let billData: any = null;
      if (res && res.billId) {
        try {
          const fullRes = await api.billing.getBillById(res.billId);
          if (fullRes?.bill) {
            billData = fullRes.bill;
          }
        } catch (fetchErr) {
          console.warn('Could not fetch full bill record:', fetchErr);
        }
      }

      if (!billData) {
        billData = {
          ...payload,
          id: (res as any)?.billId || `bill_${Date.now()}`,
          bill_number: (res as any)?.billNumber || `BILL-${Date.now()}`,
          pending_amount: pendingAmount,
          status: pendingAmount > 0 ? (paidAmount > 0 ? 'partial' : 'pending') : 'paid',
          created_at: new Date().toISOString(),
          items: [...cart],
        };
      }

      // 3. Immediately display the receipt modal with Print and WhatsApp actions
      setCompletedBill(billData);
      setShowReceiptModal(true);
      setSuccessNotice(`Bill ${billData.bill_number} generated & saved to history successfully!`);

      // 4. Reset cart and refresh active product stock
      setCart([]);
      setCustomerName('Walk-in Customer');
      setCustomerPhone('');
      setCustomerId('');
      setBillDiscount(0);
      setNotes('');
      await loadData();
    } catch (err: any) {
      console.error('Checkout error:', err);
      setErrorMessage(err.message || 'Failed to generate bill.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto pb-8 animate-fade-in-slide">
      {/* Top Banner & Quick Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 glass-card p-4 sm:p-5 border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center font-bold shadow-md shadow-emerald-600/20">
            <Store className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
                {t('pos_title', 'Point of Sale Cashier Terminal')}
              </h2>
              <Badge variant="emerald" size="sm">
                {currentShopObj?.name || 'Retail'}
              </Badge>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t('pos_subtitle', 'Fast barcode scanning, instant billing, customer khata & WhatsApp invoices')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          {onNavigateToHistory && (
            <button
              onClick={onNavigateToHistory}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-all border border-slate-200 dark:border-slate-700 active:scale-95"
            >
              <History className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>{t('bill_history', 'Bills History')}</span>
            </button>
          )}

          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold">
            <button
              onClick={() => setBillType('normal')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                billType === 'normal'
                  ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm font-bold'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              {t('normal_bill', 'Retail Bill')}
            </button>
            <button
              onClick={() => setBillType('gst')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                billType === 'gst'
                  ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm font-bold'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              {t('gst_bill', 'GST Tax Invoice')}
            </button>
          </div>
        </div>
      </div>

      {successNotice && (
        <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 rounded-xl text-xs flex items-center justify-between border border-emerald-200 dark:border-emerald-800 animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span className="font-semibold">{successNotice}</span>
          </div>
          <button
            onClick={() => setSuccessNotice('')}
            className="text-slate-400 hover:text-slate-600 text-xs font-bold ml-2"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Split Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column: Garment Catalog & Stock Grid (7 Cols) */}
        <div className="lg:col-span-7 space-y-3 flex flex-col">
          {/* Search & Category Filter Header */}
          <div className="glass-card p-4 border-slate-200 dark:border-slate-800 space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
              <input
                type="text"
                placeholder={t('search_products', 'Search garment name, SKU code or scan barcode...')}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white"
              />
            </div>

            {/* Category Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
                    selectedCategory === cat
                      ? 'bg-emerald-600 text-white shadow-sm font-bold'
                      : 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {cat === 'All' ? t('all_categories', 'All Categories') : cat}
                </button>
              ))}
            </div>
          </div>

          {/* Product Grid */}
          <div className="flex-1 overflow-y-auto max-h-[calc(100vh-21rem)] grid grid-cols-2 sm:grid-cols-3 gap-3 pr-1">
            {loading ? (
              <div className="col-span-3 py-16 text-center text-slate-400">
                <div className="w-7 h-7 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                <p className="text-xs font-medium">Loading garment stocks...</p>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="col-span-3 py-16 text-center text-slate-400">
                <p className="text-sm font-bold">No garments found.</p>
                <p className="text-xs text-slate-500 mt-1">Try another category or clear search query.</p>
              </div>
            ) : (
              filteredProducts.map(product => {
                const stock = getProductStock(product);
                const price =
                  effectiveShopId === 'shop_wholesale'
                    ? product.wholesale_price || product.selling_price
                    : product.retail_price || product.selling_price;
                const isOutOfStock = stock <= 0;
                const inCart = cart.find(c => c.product_id === product.id);

                return (
                  <div
                    key={product.id}
                    onClick={() => !isOutOfStock && addToCart(product)}
                    className={`glass-card p-3.5 border flex flex-col justify-between transition-all group ${
                      isOutOfStock
                        ? 'opacity-40 cursor-not-allowed bg-slate-50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800'
                        : inCart
                        ? 'cursor-pointer border-emerald-500 ring-2 ring-emerald-500/30 bg-emerald-50/20 dark:bg-emerald-950/20'
                        : 'cursor-pointer border-slate-200 dark:border-slate-800 hover:border-emerald-500 hover:shadow-md active:scale-98'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-1 mb-1.5">
                        <span className="font-mono-numbers text-[10px] font-bold text-slate-400">
                          {product.code}
                        </span>
                        <Badge
                          variant={isOutOfStock ? 'rose' : stock <= 5 ? 'amber' : 'emerald'}
                          size="sm"
                        >
                          {isOutOfStock
                            ? t('out_of_stock', 'Out of Stock')
                            : `${stock} ${t('available_stock', 'In Stock')}`}
                        </Badge>
                      </div>

                      <h4 className="font-bold text-xs text-slate-900 dark:text-white line-clamp-2 leading-tight">
                        {product.name}
                      </h4>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {product.size || 'Free Size'} • {product.color || 'Standard'}
                      </p>
                    </div>

                    <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                      <div>
                        <span className="font-mono-numbers text-sm font-black text-emerald-600 dark:text-emerald-400">
                          {currency} {price}
                        </span>
                        <span className="text-[9px] text-slate-400 block">
                          {effectiveShopId === 'shop_wholesale' ? t('wholesale', 'Wholesale') : t('retail', 'Retail')}
                        </span>
                      </div>

                      <button
                        type="button"
                        disabled={isOutOfStock}
                        onClick={e => {
                          e.stopPropagation();
                          if (!isOutOfStock) addToCart(product);
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 active:scale-95 ${
                          isOutOfStock
                            ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                            : inCart
                            ? 'bg-emerald-600 text-white shadow-sm'
                            : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white dark:bg-emerald-950/60 dark:text-emerald-300 dark:hover:bg-emerald-600'
                        }`}
                      >
                        <Plus className="w-3 h-3" />
                        <span>{inCart ? `${inCart.quantity} in Bill` : t('add_to_cart', 'Add')}</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: POS Cart & Checkout Panel (5 Cols) */}
        <div className="lg:col-span-5 flex flex-col space-y-3">
          <div className="glass-card p-4 sm:p-5 border-slate-200 dark:border-slate-800 flex-1 flex flex-col justify-between">
            <div>
              {/* Cart Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    <ShoppingCart className="w-4 h-4" />
                  </div>
                  <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                    {t('current_bill', 'Current Bill Docket')} ({cart.reduce((sum, it) => sum + it.quantity, 0)} {t('pieces', 'pcs')})
                  </h3>
                </div>
                {cart.length > 0 && (
                  <button
                    onClick={() => setCart([])}
                    className="text-[11px] text-rose-500 hover:text-rose-700 font-bold"
                  >
                    {t('clear_cart', 'Clear')}
                  </button>
                )}
              </div>

              {/* Customer Details Box */}
              <div className="py-3 border-b border-slate-200 dark:border-slate-800 space-y-2.5">
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      {t('customer_info', 'Customer Name')} <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={customerName}
                      onChange={e => setCustomerName(e.target.value)}
                      placeholder={t('walk_in_customer', 'Walk-in Customer')}
                      className="w-full mt-1 px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      {t('customer_phone', 'Customer Mobile / WhatsApp')}
                    </label>
                    <input
                      type="text"
                      value={customerPhone}
                      onChange={e => setCustomerPhone(e.target.value)}
                      placeholder="+91 98401 23456"
                      className="w-full mt-1 px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono focus:ring-2 focus:ring-emerald-500 text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                {/* Quick Customer Selection */}
                {customers.length > 0 && customerName === 'Walk-in Customer' && (
                  <div className="flex items-center gap-1.5 overflow-x-auto pt-0.5">
                    <span className="text-[10px] text-slate-400 font-medium whitespace-nowrap">Recent:</span>
                    {customers.slice(0, 4).map(c => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => handleSelectCustomer(c)}
                        className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-[10px] text-slate-700 dark:text-slate-300 hover:bg-emerald-50 dark:hover:bg-emerald-950 hover:text-emerald-600 whitespace-nowrap border border-slate-200 dark:border-slate-700"
                      >
                        {c.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Cart Items List */}
              <div className="py-2.5 max-h-48 overflow-y-auto space-y-2 pr-1">
                {cart.length === 0 ? (
                  <div className="py-8 text-center text-slate-400 text-xs">
                    <ShoppingCart className="w-8 h-8 mx-auto mb-1.5 text-slate-300 dark:text-slate-600 stroke-[1.5]" />
                    <span className="max-w-xs block mx-auto leading-relaxed">
                      {t('cart_empty', 'Cart is empty. Click any garment or scan barcode to add items.')}
                    </span>
                  </div>
                ) : (
                  cart.map(item => (
                    <div
                      key={item.product_id}
                      className="p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/50 flex items-center justify-between gap-2"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-xs text-slate-900 dark:text-white truncate">
                          {item.product_name}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono-numbers">
                          ₹{item.unit_price} × {item.quantity} = ₹{item.total_price}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.product_id, -1)}
                          className="p-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 hover:text-rose-600 active:scale-95"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="font-mono-numbers text-xs font-bold w-6 text-center text-slate-900 dark:text-white">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.product_id, 1)}
                          className="p-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 hover:text-emerald-600 active:scale-95"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeFromCart(item.product_id)}
                          className="p-1 text-slate-400 hover:text-rose-600 ml-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Checkout & Calculation Section */}
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-3">
              {/* Quick Discount Presets */}
              <div className="flex items-center gap-1.5 overflow-x-auto text-[10px]">
                <span className="text-slate-400 font-medium">Quick Disc:</span>
                {[
                  { label: '5%', type: 'percent', val: 5 },
                  { label: '10%', type: 'percent', val: 10 },
                  { label: '₹50', type: 'flat', val: 50 },
                  { label: '₹100', type: 'flat', val: 100 },
                ].map((d, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => applyDiscountPreset(d.type as any, d.val)}
                    className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold"
                  >
                    {d.label}
                  </button>
                ))}
              </div>

              {/* Calculation summary */}
              <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
                <div className="flex justify-between">
                  <span>{t('subtotal', 'Subtotal')}:</span>
                  <span className="font-mono-numbers font-semibold text-slate-900 dark:text-white">
                    {currency} {subtotal}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span>{t('discount', 'Discount')}:</span>
                  <div className="flex items-center gap-1">
                    <span>{currency}</span>
                    <input
                      type="number"
                      min="0"
                      value={billDiscount || ''}
                      onChange={e => setBillDiscount(Number(e.target.value) || 0)}
                      placeholder="0"
                      className="w-16 px-1.5 py-0.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-right font-mono-numbers text-xs text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                {billType === 'gst' && (
                  <div className="flex justify-between">
                    <span>{t('gst_tax', 'GST Tax')}:</span>
                    <span className="font-mono-numbers text-emerald-600 font-semibold">+ {currency} {totalTax}</span>
                  </div>
                )}

                <div className="flex justify-between text-base font-black text-slate-900 dark:text-white pt-2 border-t border-slate-200 dark:border-slate-700">
                  <span>{t('grand_total', 'Grand Total')}:</span>
                  <span className="font-mono-numbers text-emerald-600 dark:text-emerald-400 text-lg">
                    {currency} {grandTotal}
                  </span>
                </div>
              </div>

              {/* Payment Method Selector */}
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                  {t('payment_method', 'Payment Method')}
                </label>
                <div className="grid grid-cols-5 gap-1.5 text-[11px] font-semibold">
                  {[
                    { id: 'cash', label: t('cash', 'Cash'), icon: Banknote },
                    { id: 'upi', label: t('upi_qr', 'UPI / QR'), icon: QrCode },
                    { id: 'card', label: t('card', 'Card'), icon: CreditCard },
                    { id: 'partial', label: t('partial', 'Partial'), icon: Layers },
                    { id: 'credit', label: t('credit_khata', 'Khata'), icon: Tag },
                  ].map(m => {
                    const Icon = m.icon;
                    const isSelected = paymentMethod === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setPaymentMethod(m.id as any)}
                        className={`py-2 px-1 rounded-xl border text-center transition-all flex flex-col items-center gap-1 ${
                          isSelected
                            ? 'bg-emerald-600 text-white border-emerald-600 font-bold shadow-md shadow-emerald-600/20'
                            : 'bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span className="truncate w-full">{m.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Partial / Credit Fields */}
              {(paymentMethod === 'partial' || paymentMethod === 'credit' || pendingAmount > 0) && (
                <div className="p-3 rounded-xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 space-y-2 text-xs animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <span className="text-amber-800 dark:text-amber-300 font-semibold">
                      {t('paid_amount', 'Paid Amount')}:
                    </span>
                    <div className="flex items-center gap-1">
                      <span>{currency}</span>
                      <input
                        type="number"
                        max={grandTotal}
                        min="0"
                        value={paidAmount}
                        onChange={e => setPaidAmount(Number(e.target.value) || 0)}
                        className="w-20 px-2 py-1 bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 rounded-lg text-right font-mono-numbers font-bold"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-rose-700 dark:text-rose-400 font-bold">
                    <span>{t('balance_due', 'Balance Due')}:</span>
                    <span className="font-mono-numbers">{currency} {pendingAmount}</span>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider block">
                      {t('due_date', 'Payment Due Date')} <span className="text-rose-600">*</span>
                    </label>
                    <input
                      type="date"
                      value={dueDate}
                      onChange={e => setDueDate(e.target.value)}
                      required
                      className="w-full mt-1 px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 rounded-lg text-xs font-medium"
                    />
                  </div>
                </div>
              )}

              {/* Error Message */}
              {errorMessage && (
                <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2 border border-rose-200 dark:border-rose-800">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Complete Bill Action Button */}
              <button
                type="button"
                onClick={handleCheckout}
                disabled={isSubmitting || cart.length === 0}
                className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white rounded-xl text-sm font-extrabold shadow-lg shadow-emerald-600/25 active:scale-[0.99] transition-all flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  {isSubmitting
                    ? t('printing_receipt', 'Generating Bill...')
                    : `${t('complete_and_print', 'Complete Bill & Print (F2)')} • ₹${grandTotal}`}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Bill Receipt Modal (Shows immediately after billing with Print & WhatsApp at the bottom) */}
      <BillReceiptModal
        isOpen={showReceiptModal}
        onClose={() => setShowReceiptModal(false)}
        bill={completedBill}
      />
    </div>
  );
};
