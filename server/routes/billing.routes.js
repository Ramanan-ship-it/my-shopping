import express from 'express';
import { get, query, run, transaction } from '../db.js';
import { authenticateToken, requirePermission } from '../middleware/auth.js';

const router = express.Router();

// Helper to generate next sequential bill number atomically
function generateBillNumber(shopId, billType) {
  const shop = get('SELECT code FROM shops WHERE id = ?', [shopId]);
  const prefix = shop ? shop.code : 'RET';
  const year = new Date().getFullYear();
  const typeTag = billType === 'gst' ? '-GST' : '';
  const searchPattern = `${prefix}${typeTag}-${year}-%`;

  const lastBill = get(
    `SELECT bill_number FROM bills WHERE bill_number LIKE ? ORDER BY bill_number DESC LIMIT 1`,
    [searchPattern]
  );

  let nextSeq = 1;
  if (lastBill && lastBill.bill_number) {
    const parts = lastBill.bill_number.split('-');
    const lastNum = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastNum)) {
      nextSeq = lastNum + 1;
    }
  }

  const seqStr = String(nextSeq).padStart(5, '0');
  return `${prefix}${typeTag}-${year}-${seqStr}`;
}

// POST /api/billing/create
router.post('/create', authenticateToken, requirePermission('can_billing'), (req, res) => {
  try {
    const {
      bill_type = 'normal',
      shop_id,
      customer_id,
      customer_name,
      customer_phone,
      items,
      subtotal,
      discount = 0,
      tax_amount = 0,
      grand_total,
      payment_method, // cash, upi, card, credit, partial
      paid_amount = 0,
      due_date,
      notes = '',
    } = req.body;

    if (!shop_id || !items || !items.length) {
      return res.status(400).json({ error: 'Shop ID and at least one item are required.' });
    }

    if (!customer_name) {
      return res.status(400).json({ error: 'Customer name is required.' });
    }

    const calculatedPending = Math.max(0, Number((grand_total - paid_amount).toFixed(2)));
    let billStatus = 'paid';
    if (calculatedPending > 0) {
      billStatus = paid_amount > 0 ? 'partial' : 'pending';
      if (!due_date) {
        return res.status(400).json({ error: 'Due date is mandatory for credit or partial payment bills.' });
      }
    }

    // Check shop permission
    if (req.user.role !== 'OWNER' && req.user.assigned_shop !== 'all') {
      const allowed =
        (req.user.assigned_shop === 'retail' && (shop_id === 'shop_retail' || shop_id === 'retail')) ||
        (req.user.assigned_shop === 'wholesale' && (shop_id === 'shop_wholesale' || shop_id === 'wholesale'));
      if (!allowed) {
        return res.status(403).json({ error: 'Access denied: You cannot bill for this shop.' });
      }
    }

    // Step 1: Pre-validate inventory before starting transaction
    for (const item of items) {
      const inv = get('SELECT current_stock FROM inventory WHERE product_id = ? AND shop_id = ?', [
        item.product_id,
        shop_id,
      ]);
      const available = inv ? inv.current_stock : 0;
      if (available < item.quantity) {
        const prod = get('SELECT name FROM products WHERE id = ?', [item.product_id]);
        return res.status(400).json({
          error: `Insufficient stock for '${prod?.name || item.product_name}'. Available: ${available}, Requested: ${item.quantity}.`,
        });
      }
    }

    // Step 2: Atomic transaction for billing & stock reduction
    const result = transaction(() => {
      const billId = `bill_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const billNumber = generateBillNumber(shop_id, bill_type);

      // Insert bill
      run(
        `INSERT INTO bills (
          id, bill_number, bill_type, shop_id, customer_id, customer_name, customer_phone,
          subtotal, discount, tax_amount, grand_total, payment_method, paid_amount, pending_amount,
          due_date, status, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          billId,
          billNumber,
          bill_type,
          shop_id,
          customer_id || null,
          customer_name.trim(),
          customer_phone?.trim() || null,
          Number(subtotal),
          Number(discount),
          Number(tax_amount),
          Number(grand_total),
          payment_method,
          Number(paid_amount),
          calculatedPending,
          due_date || null,
          billStatus,
          req.user.id,
        ]
      );

      // Insert bill items and decrement inventory
      for (const item of items) {
        const itemId = `bi_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        run(
          `INSERT INTO bill_items (
            id, bill_id, product_id, product_name, product_code, quantity,
            unit_price, discount, tax_rate, tax_amount, total_price
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            itemId,
            billId,
            item.product_id,
            item.product_name,
            item.product_code || '',
            Number(item.quantity),
            Number(item.unit_price),
            Number(item.discount || 0),
            Number(item.tax_rate || 0),
            Number(item.tax_amount || 0),
            Number(item.total_price),
          ]
        );

        // Fetch current stock
        const inv = get('SELECT current_stock FROM inventory WHERE product_id = ? AND shop_id = ?', [
          item.product_id,
          shop_id,
        ]);
        const prevStock = inv ? inv.current_stock : 0;
        const newStock = prevStock - Number(item.quantity);

        // Update inventory
        run(
          "UPDATE inventory SET current_stock = ?, updated_at = datetime('now') WHERE product_id = ? AND shop_id = ?",
          [newStock, item.product_id, shop_id]
        );

        // Record stock movement
        run(
          `INSERT INTO stock_movements (
            id, product_id, shop_id, movement_type, quantity, previous_stock, new_stock,
            reference_id, reference_type, notes, created_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            `sm_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            item.product_id,
            shop_id,
            'sale',
            Number(item.quantity),
            prevStock,
            newStock,
            billId,
            'bill',
            `Sale via ${billNumber}`,
            req.user.id,
          ]
        );

        // Low stock notification check
        const prod = get('SELECT name, min_stock FROM products WHERE id = ?', [item.product_id]);
        if (prod && newStock <= prod.min_stock) {
          const existingNotif = get(
            "SELECT id FROM notifications WHERE related_id = ? AND type = 'low_stock' AND is_read = 0",
            [item.product_id]
          );
          if (!existingNotif) {
            run(
              `INSERT INTO notifications (id, type, title, message, related_id, related_type, shop_id, target_role) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                `notif_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
                'low_stock',
                `Low Stock Alert: ${prod.name}`,
                `Only ${newStock} units left in stock. Reorder threshold is ${prod.min_stock}.`,
                item.product_id,
                'product',
                shop_id,
                'OWNER',
              ]
            );
          }
        }
      }

      // Record payment transaction if paid amount > 0
      if (Number(paid_amount) > 0) {
        const payId = `pay_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        const payNum = `PAY-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`;
        run(
          `INSERT INTO payments (id, payment_number, bill_id, customer_id, amount, payment_method, notes, received_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            payId,
            payNum,
            billId,
            customer_id || null,
            Number(paid_amount),
            payment_method === 'partial' || payment_method === 'credit' ? 'cash' : payment_method,
            'Initial payment at billing',
            req.user.id,
          ]
        );
      }

      // Audit Log
      run(
        `INSERT INTO audit_logs (id, actor_id, actor_name, action, module, record_id, shop_id, details) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          `audit_${Date.now()}`,
          req.user.id,
          req.user.name,
          'CREATE_BILL',
          'billing',
          billId,
          shop_id,
          `Created ${bill_type.toUpperCase()} bill ${billNumber} for ₹${grand_total} (Paid: ₹${paid_amount}, Due: ₹${calculatedPending})`,
        ]
      );

      return { billId, billNumber, grand_total, paid_amount, pending_amount: calculatedPending, status: billStatus };
    });

    res.status(201).json({
      success: true,
      message: 'Bill created successfully.',
      ...result,
    });
  } catch (err) {
    console.error('Error creating bill:', err);
    res.status(500).json({ error: err.message || 'Failed to create bill' });
  }
});

// GET /api/billing/bills
router.get('/bills', authenticateToken, (req, res) => {
  const { shop_id, date, start_date, end_date, bill_type, status, search, limit = 100 } = req.query;

  let sql = `
    SELECT b.*, s.name as shop_name, s.code as shop_code, u.name as created_by_name
    FROM bills b
    LEFT JOIN shops s ON b.shop_id = s.id
    LEFT JOIN users u ON b.created_by = u.id
    WHERE 1=1
  `;
  const params = [];

  // Scoped shop check
  if (req.user.role !== 'OWNER' && req.user.assigned_shop !== 'all') {
    const sId = req.user.assigned_shop === 'retail' ? 'shop_retail' : 'shop_wholesale';
    sql += ` AND b.shop_id = ?`;
    params.push(sId);
  } else if (shop_id && shop_id !== 'all') {
    sql += ` AND b.shop_id = ?`;
    params.push(shop_id);
  }

  if (bill_type && bill_type !== 'all') {
    sql += ` AND b.bill_type = ?`;
    params.push(bill_type);
  }

  if (status && status !== 'all') {
    sql += ` AND b.status = ?`;
    params.push(status);
  }

  if (date) {
    sql += ` AND date(b.created_at) = date(?)`;
    params.push(date);
  } else if (start_date && end_date) {
    sql += ` AND date(b.created_at) BETWEEN date(?) AND date(?)`;
    params.push(start_date, end_date);
  }

  if (search) {
    sql += ` AND (b.bill_number LIKE ? OR b.customer_name LIKE ? OR b.customer_phone LIKE ?)`;
    const term = `%${search.trim()}%`;
    params.push(term, term, term);
  }

  sql += ` ORDER BY b.created_at DESC LIMIT ?`;
  params.push(Number(limit));

  const bills = query(sql, params);
  const totalRevenue = bills.reduce((acc, b) => acc + (Number(b.grand_total) || 0), 0);
  const totalPaid = bills.reduce((acc, b) => acc + (Number(b.paid_amount) || 0), 0);
  const totalPending = bills.reduce((acc, b) => acc + (Number(b.pending_amount) || 0), 0);
  res.json({
    bills,
    summary: {
      total_bills: bills.length,
      total_revenue: totalRevenue,
      total_paid: totalPaid,
      total_pending: totalPending,
    },
  });
});

// GET /api/billing/bills/:id
router.get('/bills/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const bill = get(
    `SELECT b.*, s.name as shop_name, s.code as shop_code, s.address as shop_address,
            s.phone as shop_phone, s.gstin as shop_gstin, u.name as created_by_name
     FROM bills b
     LEFT JOIN shops s ON b.shop_id = s.id
     LEFT JOIN users u ON b.created_by = u.id
     WHERE b.id = ? OR b.bill_number = ?`,
    [id, id]
  );

  if (!bill) {
    return res.status(404).json({ error: 'Bill not found' });
  }

  // Check shop authorization
  if (req.user.role !== 'OWNER' && req.user.assigned_shop !== 'all') {
    const userShop = req.user.assigned_shop === 'retail' ? 'shop_retail' : 'shop_wholesale';
    if (bill.shop_id !== userShop) {
      return res.status(403).json({ error: 'Access denied to this bill.' });
    }
  }

  const items = query('SELECT * FROM bill_items WHERE bill_id = ?', [bill.id]);
  const payments = query('SELECT * FROM payments WHERE bill_id = ? ORDER BY payment_date ASC', [bill.id]);
  const returns = query('SELECT * FROM returns WHERE bill_id = ?', [bill.id]);

  res.json({
    bill: {
      ...bill,
      items,
      payments,
      returns,
    },
  });
});

// POST /api/billing/return
router.post('/return', authenticateToken, requirePermission('can_billing'), (req, res) => {
  try {
    const { bill_id, items, return_amount, restock_inventory = true, refund_method = 'cash', notes = '' } = req.body;

    const bill = get('SELECT * FROM bills WHERE id = ?', [bill_id]);
    if (!bill) {
      return res.status(404).json({ error: 'Original bill not found.' });
    }

    const returnResult = transaction(() => {
      const returnId = `ret_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const returnNumber = `RET-TX-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`;

      run(
        `INSERT INTO returns (id, return_number, bill_id, customer_id, shop_id, return_amount, restock_inventory, refund_method, notes, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          returnId,
          returnNumber,
          bill.id,
          bill.customer_id,
          bill.shop_id,
          Number(return_amount),
          restock_inventory ? 1 : 0,
          refund_method,
          notes,
          req.user.id,
        ]
      );

      // Process items
      if (items && items.length) {
        for (const item of items) {
          run(
            `INSERT INTO return_items (id, return_id, product_id, product_name, quantity, refund_rate, total_amount)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
              `ri_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
              returnId,
              item.product_id,
              item.product_name,
              Number(item.quantity),
              Number(item.refund_rate),
              Number(item.total_amount),
            ]
          );

          if (restock_inventory) {
            const inv = get('SELECT current_stock FROM inventory WHERE product_id = ? AND shop_id = ?', [
              item.product_id,
              bill.shop_id,
            ]);
            const prev = inv ? inv.current_stock : 0;
            const updated = prev + Number(item.quantity);

            run(
              "UPDATE inventory SET current_stock = ?, updated_at = datetime('now') WHERE product_id = ? AND shop_id = ?",
              [updated, item.product_id, bill.shop_id]
            );

            run(
              `INSERT INTO stock_movements (id, product_id, shop_id, movement_type, quantity, previous_stock, new_stock, reference_id, reference_type, notes, created_by)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                `sm_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
                item.product_id,
                bill.shop_id,
                'return',
                Number(item.quantity),
                prev,
                updated,
                returnId,
                'return',
                `Return under ${bill.bill_number}`,
                req.user.id,
              ]
            );
          }
        }
      }

      // If credit adjustment, reduce pending amount
      if (refund_method === 'credit_adjustment' && bill.pending_amount > 0) {
        const newPending = Math.max(0, bill.pending_amount - Number(return_amount));
        const newStatus = newPending === 0 ? 'paid' : 'partial';
        run('UPDATE bills SET pending_amount = ?, status = ? WHERE id = ?', [newPending, newStatus, bill.id]);
      }

      // Audit Log
      run(
        `INSERT INTO audit_logs (id, actor_id, actor_name, action, module, record_id, shop_id, details) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          `audit_${Date.now()}`,
          req.user.id,
          req.user.name,
          'PROCESS_RETURN',
          'billing',
          returnId,
          bill.shop_id,
          `Processed return ${returnNumber} for ₹${return_amount} on bill ${bill.bill_number}`,
        ]
      );

      return { returnNumber, returnId };
    });

    res.json({ success: true, message: 'Return recorded successfully', ...returnResult });
  } catch (err) {
    console.error('Error in return:', err);
    res.status(500).json({ error: err.message || 'Failed to process return' });
  }
});

export default router;
