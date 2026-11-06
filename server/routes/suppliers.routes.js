import express from 'express';
import { get, query, run, transaction } from '../db.js';
import { authenticateToken, requirePermission } from '../middleware/auth.js';

const router = express.Router();

// GET /api/suppliers
router.get('/', authenticateToken, requirePermission('can_suppliers'), (req, res) => {
  const suppliers = query('SELECT * FROM suppliers ORDER BY name ASC');
  const totalPayable = suppliers.reduce((acc, s) => acc + (s.payable_balance || 0), 0);
  res.json({ suppliers, totalPayable });
});

// POST /api/suppliers
router.post('/', authenticateToken, requirePermission('can_suppliers'), (req, res) => {
  const { name, phone = '', address = '', products_supplied = '', payable_balance = 0, notes = '' } = req.body;

  if (!name) return res.status(400).json({ error: 'Supplier name is required.' });

  const supId = `sup_${Date.now()}`;
  run(
    `INSERT INTO suppliers (id, name, phone, address, products_supplied, payable_balance, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [supId, name.trim(), phone.trim(), address.trim(), products_supplied, Number(payable_balance), notes]
  );

  res.status(201).json({ success: true, message: 'Supplier added successfully', id: supId });
});

// POST /api/suppliers/payment
router.post('/payment', authenticateToken, requirePermission('can_suppliers'), (req, res) => {
  const { supplier_id, amount, payment_method = 'bank_transfer', notes = '' } = req.body;

  if (!supplier_id || !amount || Number(amount) <= 0) {
    return res.status(400).json({ error: 'Supplier and positive payment amount required.' });
  }

  const sup = get('SELECT * FROM suppliers WHERE id = ?', [supplier_id]);
  if (!sup) return res.status(404).json({ error: 'Supplier not found.' });

  const payAmt = Number(amount);

  transaction(() => {
    const payId = `spay_${Date.now()}`;
    run(
      `INSERT INTO supplier_payments (id, supplier_id, amount, payment_method, notes, recorded_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [payId, supplier_id, payAmt, payment_method, notes, req.user.id]
    );

    // Reduce payable balance
    const newBal = Math.max(0, (sup.payable_balance || 0) - payAmt);
    run('UPDATE suppliers SET payable_balance = ? WHERE id = ?', [newBal, supplier_id]);

    // Record as business expense under 'Supplier Payments'
    run(
      `INSERT INTO expenses (id, date, category, amount, shop_id, description, payment_method, created_by)
       VALUES (?, date('now'), 'Supplier Payments', ?, 'shop_retail', ?, ?, ?)`,
      [`exp_${Date.now()}`, payAmt, `Payment to supplier ${sup.name}`, payment_method, req.user.id]
    );

    run(
      `INSERT INTO audit_logs (id, actor_id, actor_name, action, module, record_id, shop_id, details) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [`audit_${Date.now()}`, req.user.id, req.user.name, 'SUPPLIER_PAYMENT', 'suppliers', payId, 'all', `Paid ₹${payAmt} to supplier ${sup.name}. Remaining balance: ₹${newBal}`]
    );
  });

  res.json({ success: true, message: `Payment of ₹${payAmt} recorded for supplier.` });
});

export default router;
