import express from 'express';
import { get, query, run } from '../db.js';
import { authenticateToken, requirePermission } from '../middleware/auth.js';

const router = express.Router();

// GET /api/expenses
router.get('/', authenticateToken, requirePermission('can_expenses'), (req, res) => {
  const { shop_id, category, start_date, end_date } = req.query;

  let sql = `
    SELECT e.*, s.name as shop_name, s.code as shop_code, u.name as created_by_name
    FROM expenses e
    JOIN shops s ON e.shop_id = s.id
    LEFT JOIN users u ON e.created_by = u.id
    WHERE 1=1
  `;
  const params = [];

  if (req.user.role !== 'OWNER' && req.user.assigned_shop !== 'all') {
    const sId = req.user.assigned_shop === 'retail' ? 'shop_retail' : 'shop_wholesale';
    sql += ` AND e.shop_id = ?`;
    params.push(sId);
  } else if (shop_id && shop_id !== 'all') {
    sql += ` AND e.shop_id = ?`;
    params.push(shop_id);
  }

  if (category && category !== 'all') {
    sql += ` AND e.category = ?`;
    params.push(category);
  }

  if (start_date && end_date) {
    sql += ` AND date(e.date) BETWEEN date(?) AND date(?)`;
    params.push(start_date, end_date);
  }

  sql += ` ORDER BY e.date DESC, e.created_at DESC`;

  const expenses = query(sql, params);

  // Group by category summary
  const totalAmount = expenses.reduce((acc, e) => acc + e.amount, 0);
  const byCategory = {};
  expenses.forEach(e => {
    byCategory[e.category] = (byCategory[e.category] || 0) + e.amount;
  });

  res.json({ expenses, totalAmount, byCategory });
});

// POST /api/expenses
router.post('/', authenticateToken, requirePermission('can_expenses'), (req, res) => {
  try {
    const {
      date = new Date().toISOString().split('T')[0],
      category,
      amount,
      shop_id = 'shop_retail',
      description = '',
      payment_method = 'cash',
      receipt_ref = '',
    } = req.body;

    if (!category || !amount || Number(amount) <= 0) {
      return res.status(400).json({ error: 'Category and positive amount are required.' });
    }

    const expId = `exp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    run(
      `INSERT INTO expenses (id, date, category, amount, shop_id, description, payment_method, receipt_ref, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [expId, date, category, Number(amount), shop_id, description, payment_method, receipt_ref, req.user.id]
    );

    run(
      `INSERT INTO audit_logs (id, actor_id, actor_name, action, module, record_id, shop_id, details) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [`audit_${Date.now()}`, req.user.id, req.user.name, 'ADD_EXPENSE', 'expenses', expId, shop_id, `Added expense of ₹${amount} under ${category}`]
    );

    res.status(201).json({ success: true, message: 'Expense recorded successfully', id: expId });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to record expense' });
  }
});

export default router;
