import express from 'express';
import { get, query, run } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// GET /api/customers
router.get('/', authenticateToken, (req, res) => {
  const { shop_id, search, customer_type } = req.query;

  let sql = `
    SELECT c.*, s.name as shop_name, s.code as shop_code,
           COUNT(DISTINCT b.id) as total_bills,
           COALESCE(SUM(b.grand_total), 0) as total_purchases,
           COALESCE(SUM(b.paid_amount), 0) as total_paid,
           COALESCE(SUM(b.pending_amount), 0) as outstanding_balance,
           MAX(b.created_at) as last_purchase_date
    FROM customers c
    LEFT JOIN shops s ON c.shop_id = s.id
    LEFT JOIN bills b ON c.id = b.customer_id AND b.status != 'cancelled'
    WHERE 1=1
  `;
  const params = [];

  if (req.user.role !== 'OWNER' && req.user.assigned_shop !== 'all') {
    const sId = req.user.assigned_shop === 'retail' ? 'shop_retail' : 'shop_wholesale';
    sql += ` AND c.shop_id = ?`;
    params.push(sId);
  } else if (shop_id && shop_id !== 'all') {
    sql += ` AND c.shop_id = ?`;
    params.push(shop_id);
  }

  if (customer_type && customer_type !== 'all') {
    sql += ` AND c.customer_type = ?`;
    params.push(customer_type);
  }

  if (search) {
    sql += ` AND (c.name LIKE ? OR c.phone LIKE ? OR c.address LIKE ? OR c.gstin LIKE ?)`;
    const t = `%${search.trim()}%`;
    params.push(t, t, t, t);
  }

  sql += ` GROUP BY c.id ORDER BY c.name ASC`;

  const customers = query(sql, params);
  res.json({ customers });
});

// GET /api/customers/:id
router.get('/:id', authenticateToken, (req, res) => {
  const { id } = req.params;

  const customer = get(
    `SELECT c.*, s.name as shop_name, s.code as shop_code
     FROM customers c
     LEFT JOIN shops s ON c.shop_id = s.id
     WHERE c.id = ?`,
    [id]
  );

  if (!customer) {
    return res.status(404).json({ error: 'Customer not found' });
  }

  const bills = query(
    `SELECT b.*, s.name as shop_name
     FROM bills b
     LEFT JOIN shops s ON b.shop_id = s.id
     WHERE b.customer_id = ?
     ORDER BY b.created_at DESC LIMIT 50`,
    [id]
  );

  const payments = query(
    `SELECT p.*, b.bill_number, u.name as received_by_name
     FROM payments p
     LEFT JOIN bills b ON p.bill_id = b.id
     LEFT JOIN users u ON p.received_by = u.id
     WHERE p.customer_id = ?
     ORDER BY p.payment_date DESC LIMIT 50`,
    [id]
  );

  const totalPurchases = bills.reduce((acc, b) => acc + b.grand_total, 0);
  const totalPaid = payments.reduce((acc, p) => acc + p.amount, 0);
  const outstanding = bills.reduce((acc, b) => acc + b.pending_amount, 0);

  res.json({
    customer: {
      ...customer,
      summary: {
        totalBills: bills.length,
        totalPurchases,
        totalPaid,
        outstandingBalance: outstanding,
      },
      bills,
      payments,
    },
  });
});

// POST /api/customers
router.post('/', authenticateToken, (req, res) => {
  const { name, phone, address = '', gstin = '', customer_type = 'retail', shop_id = 'shop_retail', notes = '' } = req.body;

  if (!name || !phone) {
    return res.status(400).json({ error: 'Customer name and phone number are required.' });
  }

  // Check phone in same shop
  const existing = get('SELECT id, name FROM customers WHERE phone = ? AND shop_id = ?', [phone.trim(), shop_id]);
  if (existing) {
    return res.status(400).json({ error: `Customer with phone ${phone} already exists (${existing.name}).` });
  }

  const custId = `cust_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

  run(
    `INSERT INTO customers (id, name, phone, address, gstin, customer_type, shop_id, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [custId, name.trim(), phone.trim(), address.trim(), gstin.trim().toUpperCase(), customer_type, shop_id, notes]
  );

  run(
    `INSERT INTO audit_logs (id, actor_id, actor_name, action, module, record_id, shop_id, details) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [`audit_${Date.now()}`, req.user.id, req.user.name, 'CREATE_CUSTOMER', 'customers', custId, shop_id, `Created customer ${name} (${phone})`]
  );

  res.status(201).json({ success: true, message: 'Customer created successfully', id: custId });
});

// PUT /api/customers/:id
router.put('/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { name, phone, address, gstin, customer_type, notes } = req.body;

  const cust = get('SELECT * FROM customers WHERE id = ?', [id]);
  if (!cust) return res.status(404).json({ error: 'Customer not found' });

  run(
    `UPDATE customers SET
      name = COALESCE(?, name),
      phone = COALESCE(?, phone),
      address = COALESCE(?, address),
      gstin = COALESCE(?, gstin),
      customer_type = COALESCE(?, customer_type),
      notes = COALESCE(?, notes)
     WHERE id = ?`,
    [name, phone, address, gstin, customer_type, notes, id]
  );

  res.json({ success: true, message: 'Customer updated successfully' });
});

export default router;
