import express from 'express';
import { get, query, run, transaction } from '../db.js';
import { authenticateToken, requirePermission } from '../middleware/auth.js';

const router = express.Router();

// Helper to generate transfer number
function generateTransferNumber() {
  const year = new Date().getFullYear();
  const last = get(
    "SELECT transfer_number FROM stock_transfers WHERE transfer_number LIKE ? ORDER BY id DESC LIMIT 1",
    [`TRF-${year}-%`]
  );
  let nextSeq = 1;
  if (last && last.transfer_number) {
    const parts = last.transfer_number.split('-');
    const num = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(num)) nextSeq = num + 1;
  }
  return `TRF-${year}-${String(nextSeq).padStart(5, '0')}`;
}

// GET /api/inventory/products
router.get('/products', authenticateToken, (req, res) => {
  const { shop_id, category, search, low_stock } = req.query;

  let sql = `
    SELECT p.*,
           COALESCE(inv_ret.current_stock, 0) as retail_stock,
           COALESCE(inv_who.current_stock, 0) as wholesale_stock,
           (COALESCE(inv_ret.current_stock, 0) + COALESCE(inv_who.current_stock, 0)) as total_stock
    FROM products p
    LEFT JOIN inventory inv_ret ON p.id = inv_ret.product_id AND inv_ret.shop_id = 'shop_retail'
    LEFT JOIN inventory inv_who ON p.id = inv_who.product_id AND inv_who.shop_id = 'shop_wholesale'
    WHERE p.is_active = 1
  `;
  const params = [];

  if (category && category !== 'all') {
    sql += ` AND p.category = ?`;
    params.push(category);
  }

  if (search) {
    sql += ` AND (p.name LIKE ? OR p.code LIKE ? OR p.brand LIKE ?)`;
    const t = `%${search.trim()}%`;
    params.push(t, t, t);
  }

  sql += ` ORDER BY p.name ASC`;

  let products = query(sql, params);

  // Filter by shop if requested
  if (shop_id === 'shop_retail' || shop_id === 'retail') {
    products = products.map(p => ({
      ...p,
      active_shop_stock: p.retail_stock,
      current_stock: p.retail_stock,
    }));
    if (low_stock === 'true') {
      products = products.filter(p => p.retail_stock <= p.min_stock);
    }
  } else if (shop_id === 'shop_wholesale' || shop_id === 'wholesale') {
    products = products.map(p => ({
      ...p,
      active_shop_stock: p.wholesale_stock,
      current_stock: p.wholesale_stock,
    }));
    if (low_stock === 'true') {
      products = products.filter(p => p.wholesale_stock <= p.min_stock);
    }
  } else {
    // All shops
    products = products.map(p => ({
      ...p,
      active_shop_stock: p.total_stock,
      current_stock: p.total_stock,
    }));
    if (low_stock === 'true') {
      products = products.filter(p => p.total_stock <= p.min_stock * 2);
    }
  }

  // Summary counts
  const totalItems = products.reduce((acc, p) => acc + p.active_shop_stock, 0);
  const lowStockCount = products.filter(p => p.active_shop_stock <= p.min_stock && p.active_shop_stock > 0).length;
  const outOfStockCount = products.filter(p => p.active_shop_stock === 0).length;

  // Stock value if authorized
  let totalCostValue = 0;
  let totalRetailValue = 0;
  if (req.user.role === 'OWNER' || req.user.permissions?.can_profit_view) {
    totalCostValue = products.reduce((acc, p) => acc + p.active_shop_stock * p.purchase_price, 0);
    totalRetailValue = products.reduce((acc, p) => acc + p.active_shop_stock * p.retail_price, 0);
  }

  res.json({
    products,
    summary: {
      productTypesCount: products.length,
      totalUnits: totalItems,
      lowStockCount,
      outOfStockCount,
      totalCostValue,
      totalRetailValue,
    },
  });
});

// POST /api/inventory/products (Add new product)
router.post('/products', authenticateToken, requirePermission('can_inventory'), (req, res) => {
  try {
    const {
      name,
      code,
      category,
      brand = 'Smart Dress',
      size = 'Free Size',
      color = 'Standard',
      purchase_price,
      retail_price,
      wholesale_price,
      selling_price,
      min_stock = 10,
      hsn = '',
      gst_rate = 5,
      initial_retail_stock = 0,
      initial_wholesale_stock = 0,
    } = req.body;

    if (!name || !code || !category || purchase_price == null || retail_price == null) {
      return res.status(400).json({ error: 'Name, code, category, purchase price, and retail price are required.' });
    }

    // Check duplicate code
    const existing = get('SELECT id FROM products WHERE code = ?', [code.trim()]);
    if (existing) {
      return res.status(400).json({ error: `Product code '${code}' is already in use.` });
    }

    const prodId = `prod_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    transaction(() => {
      run(
        `INSERT INTO products (
          id, name, code, category, brand, size, color, purchase_price, retail_price,
          wholesale_price, selling_price, min_stock, hsn, gst_rate, is_active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [
          prodId,
          name.trim(),
          code.trim().toUpperCase(),
          category,
          brand,
          size,
          color,
          Number(purchase_price),
          Number(retail_price),
          Number(wholesale_price || retail_price * 0.8),
          Number(selling_price || retail_price),
          Number(min_stock),
          hsn,
          Number(gst_rate),
        ]
      );

      // Initialize inventory records for both shops
      run('INSERT INTO inventory (id, product_id, shop_id, current_stock) VALUES (?, ?, ?, ?)', [
        `inv_ret_${prodId}`,
        prodId,
        'shop_retail',
        Number(initial_retail_stock || 0),
      ]);

      run('INSERT INTO inventory (id, product_id, shop_id, current_stock) VALUES (?, ?, ?, ?)', [
        `inv_who_${prodId}`,
        prodId,
        'shop_wholesale',
        Number(initial_wholesale_stock || 0),
      ]);

      // Stock movements if initial stock provided
      if (Number(initial_retail_stock) > 0) {
        run(
          `INSERT INTO stock_movements (id, product_id, shop_id, movement_type, quantity, previous_stock, new_stock, notes, created_by)
           VALUES (?, ?, ?, 'purchase', ?, 0, ?, 'Initial inventory stock', ?)`,
          [`sm_${Date.now()}_ret`, prodId, 'shop_retail', Number(initial_retail_stock), Number(initial_retail_stock), req.user.id]
        );
      }
      if (Number(initial_wholesale_stock) > 0) {
        run(
          `INSERT INTO stock_movements (id, product_id, shop_id, movement_type, quantity, previous_stock, new_stock, notes, created_by)
           VALUES (?, ?, ?, 'purchase', ?, 0, ?, 'Initial inventory stock', ?)`,
          [`sm_${Date.now()}_who`, prodId, 'shop_wholesale', Number(initial_wholesale_stock), Number(initial_wholesale_stock), req.user.id]
        );
      }

      run(
        `INSERT INTO audit_logs (id, actor_id, actor_name, action, module, record_id, shop_id, details) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [`audit_${Date.now()}`, req.user.id, req.user.name, 'ADD_PRODUCT', 'inventory', prodId, 'all', `Added product ${name} (${code})`]
      );
    });

    res.status(201).json({ success: true, message: 'Product added successfully', id: prodId });
  } catch (err) {
    console.error('Error adding product:', err);
    res.status(500).json({ error: err.message || 'Failed to add product' });
  }
});

// PUT /api/inventory/products/:id
router.put('/products/:id', authenticateToken, requirePermission('can_inventory'), (req, res) => {
  const { id } = req.params;
  const { name, category, brand, size, color, purchase_price, retail_price, wholesale_price, min_stock, hsn, gst_rate } = req.body;

  const prod = get('SELECT * FROM products WHERE id = ?', [id]);
  if (!prod) return res.status(404).json({ error: 'Product not found' });

  run(
    `UPDATE products SET
      name = COALESCE(?, name),
      category = COALESCE(?, category),
      brand = COALESCE(?, brand),
      size = COALESCE(?, size),
      color = COALESCE(?, color),
      purchase_price = COALESCE(?, purchase_price),
      retail_price = COALESCE(?, retail_price),
      wholesale_price = COALESCE(?, wholesale_price),
      min_stock = COALESCE(?, min_stock),
      hsn = COALESCE(?, hsn),
      gst_rate = COALESCE(?, gst_rate)
     WHERE id = ?`,
    [name, category, brand, size, color, purchase_price, retail_price, wholesale_price, min_stock, hsn, gst_rate, id]
  );

  res.json({ success: true, message: 'Product updated successfully' });
});

// POST /api/inventory/adjust (Stock Adjustment)
router.post('/adjust', authenticateToken, requirePermission('can_inventory'), (req, res) => {
  try {
    const { product_id, shop_id, adjustment_type, quantity, reason = '' } = req.body;
    // adjustment_type: 'add' or 'subtract'

    if (!product_id || !shop_id || !quantity || Number(quantity) <= 0) {
      return res.status(400).json({ error: 'Product, shop, and valid quantity required.' });
    }

    const inv = get('SELECT * FROM inventory WHERE product_id = ? AND shop_id = ?', [product_id, shop_id]);
    const prevStock = inv ? inv.current_stock : 0;
    const qty = Number(quantity);
    let newStock = prevStock;

    if (adjustment_type === 'add') {
      newStock = prevStock + qty;
    } else if (adjustment_type === 'subtract') {
      if (prevStock < qty) {
        return res.status(400).json({ error: `Cannot subtract ${qty}. Only ${prevStock} units in stock.` });
      }
      newStock = prevStock - qty;
    } else {
      return res.status(400).json({ error: 'Adjustment type must be add or subtract.' });
    }

    transaction(() => {
      run(
        "UPDATE inventory SET current_stock = ?, updated_at = datetime('now') WHERE product_id = ? AND shop_id = ?",
        [newStock, product_id, shop_id]
      );

      run(
        `INSERT INTO stock_movements (id, product_id, shop_id, movement_type, quantity, previous_stock, new_stock, notes, created_by)
         VALUES (?, ?, ?, 'adjustment', ?, ?, ?, ?, ?)`,
        [`sm_${Date.now()}`, product_id, shop_id, qty, prevStock, newStock, reason || 'Manual stock adjustment', req.user.id]
      );

      run(
        `INSERT INTO audit_logs (id, actor_id, actor_name, action, module, record_id, shop_id, details) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [`audit_${Date.now()}`, req.user.id, req.user.name, 'STOCK_ADJUSTMENT', 'inventory', product_id, shop_id, `Adjusted stock (${adjustment_type} ${qty}): ${prevStock} -> ${newStock}. Reason: ${reason}`]
      );
    });

    res.json({ success: true, message: 'Stock adjusted successfully', previous_stock: prevStock, new_stock: newStock });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to adjust stock' });
  }
});

// POST /api/inventory/transfer (Retail <-> Wholesale Stock Transfer)
// Critical E2E Test 2: Transfer 20 shirts from Wholesale (100) to Retail (10) -> Wholesale: 80, Retail: 30
router.post('/transfer', authenticateToken, requirePermission('can_stock_transfer'), (req, res) => {
  try {
    const { source_shop, dest_shop, product_id, quantity, notes = '' } = req.body;

    if (!source_shop || !dest_shop || !product_id || !quantity || Number(quantity) <= 0) {
      return res.status(400).json({ error: 'Source shop, destination shop, product, and valid quantity are required.' });
    }

    if (source_shop === dest_shop) {
      return res.status(400).json({ error: 'Source and destination shops must be different.' });
    }

    const transferQty = Number(quantity);

    // Verify source shop inventory
    const sourceInv = get('SELECT current_stock FROM inventory WHERE product_id = ? AND shop_id = ?', [product_id, source_shop]);
    const sourceStock = sourceInv ? sourceInv.current_stock : 0;

    if (sourceStock < transferQty) {
      return res.status(400).json({
        error: `Insufficient stock in source shop. Available: ${sourceStock}, Requested transfer: ${transferQty}.`,
      });
    }

    // Verify destination shop inventory
    const destInv = get('SELECT current_stock FROM inventory WHERE product_id = ? AND shop_id = ?', [product_id, dest_shop]);
    const destStock = destInv ? destInv.current_stock : 0;

    const transferNumber = generateTransferNumber();
    const transferId = `trf_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    const result = transaction(() => {
      const newSourceStock = sourceStock - transferQty;
      const newDestStock = destStock + transferQty;

      // 1. Decrement source shop inventory
      run(
        "UPDATE inventory SET current_stock = ?, updated_at = datetime('now') WHERE product_id = ? AND shop_id = ?",
        [newSourceStock, product_id, source_shop]
      );

      // 2. Increment destination shop inventory
      run(
        "UPDATE inventory SET current_stock = ?, updated_at = datetime('now') WHERE product_id = ? AND shop_id = ?",
        [newDestStock, product_id, dest_shop]
      );

      // 3. Record transfer log
      run(
        `INSERT INTO stock_transfers (
          id, transfer_number, source_shop, dest_shop, product_id, quantity,
          status, notes, created_by, approved_by, completed_at
        ) VALUES (?, ?, ?, ?, ?, ?, 'completed', ?, ?, ?, datetime('now'))`,
        [
          transferId,
          transferNumber,
          source_shop,
          dest_shop,
          product_id,
          transferQty,
          notes,
          req.user.id,
          req.user.id,
        ]
      );

      // 4. Record stock movements for source (transfer_out)
      run(
        `INSERT INTO stock_movements (id, product_id, shop_id, movement_type, quantity, previous_stock, new_stock, reference_id, reference_type, notes, created_by)
         VALUES (?, ?, ?, 'transfer_out', ?, ?, ?, ?, 'stock_transfer', ?, ?)`,
        [`sm_${Date.now()}_out`, product_id, source_shop, transferQty, sourceStock, newSourceStock, transferId, `Transfer to ${dest_shop} (${transferNumber})`, req.user.id]
      );

      // 5. Record stock movements for destination (transfer_in)
      run(
        `INSERT INTO stock_movements (id, product_id, shop_id, movement_type, quantity, previous_stock, new_stock, reference_id, reference_type, notes, created_by)
         VALUES (?, ?, ?, 'transfer_in', ?, ?, ?, ?, 'stock_transfer', ?, ?)`,
        [`sm_${Date.now()}_in`, product_id, dest_shop, transferQty, destStock, newDestStock, transferId, `Transfer from ${source_shop} (${transferNumber})`, req.user.id]
      );

      // 6. Audit log
      run(
        `INSERT INTO audit_logs (id, actor_id, actor_name, action, module, record_id, shop_id, details) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          `audit_${Date.now()}`,
          req.user.id,
          req.user.name,
          'STOCK_TRANSFER',
          'inventory',
          transferId,
          'all',
          `Transferred ${transferQty} units from ${source_shop} (${sourceStock}->${newSourceStock}) to ${dest_shop} (${destStock}->${newDestStock}) under ${transferNumber}`,
        ]
      );

      return {
        transferNumber,
        transferId,
        sourceStock: newSourceStock,
        destStock: newDestStock,
      };
    });

    res.json({
      success: true,
      message: `Successfully transferred ${transferQty} units.`,
      ...result,
    });
  } catch (err) {
    console.error('Error transferring stock:', err);
    res.status(500).json({ error: err.message || 'Failed to transfer stock' });
  }
});

// GET /api/inventory/transfers
router.get('/transfers', authenticateToken, (req, res) => {
  const transfers = query(`
    SELECT st.*, p.name as product_name, p.code as product_code,
           s1.name as source_shop_name, s2.name as dest_shop_name,
           u.name as created_by_name
    FROM stock_transfers st
    JOIN products p ON st.product_id = p.id
    JOIN shops s1 ON st.source_shop = s1.id
    JOIN shops s2 ON st.dest_shop = s2.id
    LEFT JOIN users u ON st.created_by = u.id
    ORDER BY st.created_at DESC
  `);
  res.json({ transfers });
});

// GET /api/inventory/movements
router.get('/movements', authenticateToken, (req, res) => {
  const { product_id, shop_id, limit = 100 } = req.query;
  let sql = `
    SELECT sm.*, p.name as product_name, p.code as product_code, s.name as shop_name, u.name as created_by_name
    FROM stock_movements sm
    JOIN products p ON sm.product_id = p.id
    JOIN shops s ON sm.shop_id = s.id
    LEFT JOIN users u ON sm.created_by = u.id
    WHERE 1=1
  `;
  const params = [];

  if (product_id) {
    sql += ` AND sm.product_id = ?`;
    params.push(product_id);
  }
  if (shop_id && shop_id !== 'all') {
    sql += ` AND sm.shop_id = ?`;
    params.push(shop_id);
  }

  sql += ` ORDER BY sm.created_at DESC LIMIT ?`;
  params.push(Number(limit));

  const movements = query(sql, params);
  res.json({ movements });
});

export default router;
