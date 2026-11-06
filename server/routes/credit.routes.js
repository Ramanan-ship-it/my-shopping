import express from 'express';
import { get, query, run, transaction } from '../db.js';
import { authenticateToken, requirePermission } from '../middleware/auth.js';

const router = express.Router();

// GET /api/credit/dashboard
router.get('/dashboard', authenticateToken, requirePermission('can_credit'), (req, res) => {
  const { shop_id } = req.query;

  let baseSql = `FROM bills WHERE pending_amount > 0 AND status != 'cancelled'`;
  const params = [];

  if (req.user.role !== 'OWNER' && req.user.assigned_shop !== 'all') {
    const sId = req.user.assigned_shop === 'retail' ? 'shop_retail' : 'shop_wholesale';
    baseSql += ` AND shop_id = ?`;
    params.push(sId);
  } else if (shop_id && shop_id !== 'all') {
    baseSql += ` AND shop_id = ?`;
    params.push(shop_id);
  }

  // Aggregate stats
  const totalOutstanding = get(`SELECT COALESCE(SUM(pending_amount), 0) as total, COUNT(*) as count ${baseSql}`, params)?.total || 0;
  const totalCount = get(`SELECT COUNT(*) as count ${baseSql}`, params)?.count || 0;

  // Due today
  const dueToday = get(`SELECT COALESCE(SUM(pending_amount), 0) as total, COUNT(*) as count ${baseSql} AND date(due_date) = date('now')`, params) || { total: 0, count: 0 };

  // Due tomorrow
  const dueTomorrow = get(`SELECT COALESCE(SUM(pending_amount), 0) as total, COUNT(*) as count ${baseSql} AND date(due_date) = date('now', '+1 day')`, params) || { total: 0, count: 0 };

  // Due soon (within next 3 days)
  const dueSoon = get(`SELECT COALESCE(SUM(pending_amount), 0) as total, COUNT(*) as count ${baseSql} AND date(due_date) BETWEEN date('now') AND date('now', '+3 days')`, params) || { total: 0, count: 0 };

  // Overdue
  const overdue = get(`SELECT COALESCE(SUM(pending_amount), 0) as total, COUNT(*) as count ${baseSql} AND date(due_date) < date('now')`, params) || { total: 0, count: 0 };

  // Partially paid
  const partiallyPaid = get(`SELECT COALESCE(SUM(pending_amount), 0) as total, COUNT(*) as count ${baseSql} AND paid_amount > 0`, params) || { total: 0, count: 0 };

  res.json({
    summary: {
      totalOutstanding: Number(totalOutstanding),
      totalCount: Number(totalCount),
      dueToday: { amount: Number(dueToday.total), count: Number(dueToday.count) },
      dueTomorrow: { amount: Number(dueTomorrow.total), count: Number(dueTomorrow.count) },
      dueSoon: { amount: Number(dueSoon.total), count: Number(dueSoon.count) },
      overdue: { amount: Number(overdue.total), count: Number(overdue.count) },
      partiallyPaid: { amount: Number(partiallyPaid.total), count: Number(partiallyPaid.count) },
    },
  });
});

// GET /api/credit/list
router.get('/list', authenticateToken, requirePermission('can_credit'), (req, res) => {
  const { shop_id, status, search, filter } = req.query;

  let sql = `
    SELECT b.id, b.bill_number, b.bill_type, b.shop_id, b.customer_id, b.customer_name,
           b.customer_phone, b.grand_total, b.paid_amount, b.pending_amount, b.due_date,
           b.status, b.created_at, s.name as shop_name, s.code as shop_code,
           CASE 
             WHEN date(b.due_date) < date('now') THEN CAST((julianday('now') - julianday(b.due_date)) AS INT)
             ELSE 0 
           END as days_overdue
    FROM bills b
    LEFT JOIN shops s ON b.shop_id = s.id
    WHERE b.pending_amount > 0 AND b.status != 'cancelled'
  `;
  const params = [];

  if (req.user.role !== 'OWNER' && req.user.assigned_shop !== 'all') {
    const sId = req.user.assigned_shop === 'retail' ? 'shop_retail' : 'shop_wholesale';
    sql += ` AND b.shop_id = ?`;
    params.push(sId);
  } else if (shop_id && shop_id !== 'all') {
    sql += ` AND b.shop_id = ?`;
    params.push(shop_id);
  }

  if (filter === 'due_today') {
    sql += ` AND date(b.due_date) = date('now')`;
  } else if (filter === 'due_tomorrow') {
    sql += ` AND date(b.due_date) = date('now', '+1 day')`;
  } else if (filter === 'overdue') {
    sql += ` AND date(b.due_date) < date('now')`;
  } else if (filter === 'partial') {
    sql += ` AND b.paid_amount > 0`;
  }

  if (search) {
    sql += ` AND (b.customer_name LIKE ? OR b.customer_phone LIKE ? OR b.bill_number LIKE ?)`;
    const t = `%${search.trim()}%`;
    params.push(t, t, t);
  }

  sql += ` ORDER BY b.due_date ASC, b.pending_amount DESC`;

  const records = query(sql, params);
  res.json({ records });
});

// POST /api/credit/payment (Record payment against a credit bill)
router.post('/payment', authenticateToken, requirePermission('can_credit'), (req, res) => {
  try {
    const { bill_id, amount, payment_method = 'cash', payment_date, notes = '' } = req.body;

    if (!bill_id || !amount || Number(amount) <= 0) {
      return res.status(400).json({ error: 'Valid bill ID and positive payment amount are required.' });
    }

    const bill = get('SELECT * FROM bills WHERE id = ?', [bill_id]);
    if (!bill) {
      return res.status(404).json({ error: 'Bill not found' });
    }

    if (bill.pending_amount <= 0) {
      return res.status(400).json({ error: 'This bill has already been fully settled.' });
    }

    const payAmount = Number(amount);
    if (payAmount > bill.pending_amount) {
      return res.status(400).json({
        error: `Payment amount (₹${payAmount}) exceeds outstanding balance (₹${bill.pending_amount}). Overpayment not permitted.`,
      });
    }

    const result = transaction(() => {
      const newPaid = Number((bill.paid_amount + payAmount).toFixed(2));
      const newPending = Number((bill.pending_amount - payAmount).toFixed(2));
      const newStatus = newPending === 0 ? 'paid' : 'partial';

      // Update bill balance & status
      run(
        "UPDATE bills SET paid_amount = ?, pending_amount = ?, status = ? WHERE id = ?",
        [newPaid, newPending, newStatus, bill.id]
      );

      // Insert new payment transaction
      const payId = `pay_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const payNum = `PAY-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`;
      run(
        `INSERT INTO payments (id, payment_number, bill_id, customer_id, amount, payment_method, notes, received_by, payment_date)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          payId,
          payNum,
          bill.id,
          bill.customer_id,
          payAmount,
          payment_method,
          notes || `Credit payment for bill ${bill.bill_number}`,
          req.user.id,
          payment_date || new Date().toISOString(),
        ]
      );

      // If bill is now fully paid, cancel/clear any active unread payment reminders for this bill
      if (newPending === 0) {
        run(
          "UPDATE notifications SET is_read = 1 WHERE related_id = ? AND type IN ('payment_due', 'payment_overdue')",
          [bill.id]
        );
      }

      // Audit Log
      run(
        `INSERT INTO audit_logs (id, actor_id, actor_name, action, module, record_id, shop_id, details) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          `audit_${Date.now()}`,
          req.user.id,
          req.user.name,
          'RECORD_PAYMENT',
          'credit',
          payId,
          bill.shop_id,
          `Recorded payment ${payNum} of ₹${payAmount} for bill ${bill.bill_number}. Remaining balance: ₹${newPending}. Status: ${newStatus.toUpperCase()}`,
        ]
      );

      return {
        payment_number: payNum,
        paid_amount: newPaid,
        pending_amount: newPending,
        status: newStatus,
      };
    });

    res.json({
      success: true,
      message: result.pending_amount === 0 ? 'Bill fully paid!' : 'Payment recorded successfully.',
      ...result,
    });
  } catch (err) {
    console.error('Error recording payment:', err);
    res.status(500).json({ error: err.message || 'Failed to record payment' });
  }
});

// GET /api/credit/payments/:billId
router.get('/payments/:billId', authenticateToken, requirePermission('can_credit'), (req, res) => {
  const { billId } = req.params;
  const payments = query(
    `SELECT p.*, u.name as received_by_name
     FROM payments p
     LEFT JOIN users u ON p.received_by = u.id
     WHERE p.bill_id = ?
     ORDER BY p.payment_date ASC`,
    [billId]
  );
  res.json({ payments });
});

export default router;
