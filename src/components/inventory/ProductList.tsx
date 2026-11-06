import React, { useState, useEffect } from 'react';
import {
  Search,
  Plus,
  ArrowRightLeft,
  AlertTriangle,
  Edit2,
  RefreshCw,
  Boxes,
  SlidersHorizontal,
} from 'lucide-react';
import { Product } from '../../types';
import { useShop } from '../../context/ShopContext';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { Badge } from '../common/Badge';
import { ProductModal } from './ProductModal';
import { StockTransferModal } from './StockTransferModal';

export const ProductList: React.FC = () => {
  const { activeShop, shops, currency } = useShop();
  const { user } = useAuth();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [lowStockOnly, setLowStockOnly] = useState<boolean>(false);

  // Modals
  const [showProductModal, setShowProductModal] = useState<boolean>(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showTransferModal, setShowTransferModal] = useState<boolean>(false);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const res = await api.inventory.getProducts({
        category: categoryFilter === 'All' ? undefined : categoryFilter,
        search: search || undefined,
        low_stock: lowStockOnly || undefined,
      });
      setProducts(res.products || []);
    } catch (err) {
      console.error('Failed to load products:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [categoryFilter, lowStockOnly]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchProducts();
  };

  const handleEdit = (p: Product) => {
    setEditingProduct(p);
    setShowProductModal(true);
  };

  const handleAdd = () => {
    setEditingProduct(null);
    setShowProductModal(true);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Primary Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-card p-6 border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Inventory & Multi-Shop Stock
            </h2>
            <Badge variant="emerald" size="sm">
              Live Sync
            </Badge>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Real-time stock tracking across Retail Showroom and Wholesale Warehouse.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {(user?.role === 'OWNER' || user?.permissions?.can_stock_transfer === 1) && (
            <button
              onClick={() => setShowTransferModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold shadow-sm transition-all"
            >
              <ArrowRightLeft className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              Stock Transfer
            </button>
          )}

          {(user?.role === 'OWNER' || user?.permissions?.can_inventory === 1) && (
            <button
              onClick={handleAdd}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 active:scale-95 transition-all"
            >
              <Plus className="w-4 h-4" />
              Add Product
            </button>
          )}

          <button
            onClick={fetchProducts}
            title="Refresh stock levels"
            className="p-2 text-slate-500 hover:text-slate-800 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-500' : ''}`} />
          </button>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="glass-card p-4 border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row gap-3 items-center justify-between">
        <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search SKU code, name, brand..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-1 focus:ring-emerald-500"
          />
        </form>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-400 font-medium">Category:</span>
            <select
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium"
            >
              {['All', 'Shirts', 'Pants', 'Sarees', 'Ethnic Wear', 'Traditional', 'T-Shirts', 'Suits', 'Accessories'].map(
                c => (
                  <option key={c} value={c}>{c}</option>
                )
              )}
            </select>
          </div>

          <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 font-semibold cursor-pointer select-none">
            <input
              type="checkbox"
              checked={lowStockOnly}
              onChange={e => setLowStockOnly(e.target.checked)}
              className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
            />
            <span>Low Stock Alert</span>
          </label>
        </div>
      </div>

      {/* Inventory Table */}
      <div className="glass-card overflow-hidden border-slate-200 dark:border-slate-800">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-950/50 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">SKU Code</th>
                <th className="py-3 px-4">Garment Item</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Size & Color</th>
                <th className="py-3 px-4 text-right">Retail Stock</th>
                <th className="py-3 px-4 text-right">Wholesale Stock</th>
                <th className="py-3 px-4 text-right">Total Units</th>
                <th className="py-3 px-4 text-right">Retail (₹)</th>
                <th className="py-3 px-4 text-right">Wholesale (₹)</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {products.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-400">
                    No products found matching filters.
                  </td>
                </tr>
              ) : (
                products.map(prod => {
                  const retStock = prod.retail_stock ?? 0;
                  const whoStock = prod.wholesale_stock ?? 0;
                  const total = retStock + whoStock;
                  const isLow = total <= (prod.min_stock || 10);

                  return (
                    <tr
                      key={prod.id}
                      className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-white">
                        {prod.code}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 dark:text-white">{prod.name}</div>
                        <div className="text-[10px] text-slate-400">HSN: {prod.hsn || '6205'} • GST: {prod.gst_rate}%</div>
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant="slate" size="sm">{prod.category}</Badge>
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                        {prod.size || '-'} / {prod.color || '-'}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {retStock}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-blue-600 dark:text-blue-400">
                        {whoStock}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-black text-slate-900 dark:text-white">
                        {total}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 dark:text-white">
                        ₹{prod.retail_price}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-600 dark:text-slate-300">
                        ₹{prod.wholesale_price}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Badge variant={total <= 5 ? 'rose' : isLow ? 'amber' : 'emerald'} size="sm" dot>
                          {total <= 5 ? 'Critical' : isLow ? 'Low Stock' : 'In Stock'}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => handleEdit(prod)}
                          title="Edit Product"
                          className="p-1.5 text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      <ProductModal
        isOpen={showProductModal}
        onClose={() => setShowProductModal(false)}
        product={editingProduct}
        onSuccess={fetchProducts}
      />

      <StockTransferModal
        isOpen={showTransferModal}
        onClose={() => setShowTransferModal(false)}
        products={products}
        shops={shops}
        onTransferSuccess={fetchProducts}
      />
    </div>
  );
};
