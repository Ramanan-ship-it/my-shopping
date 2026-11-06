import express from 'express';
import { get, query, run } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Helper to run automated reminder engine
export function runReminderEngine() {
  try {
    const todayStr = new Date().toISOString().split('T')[0];

    // 1. Credit Payment Reminders
    const creditBills = query(`
      SELECT b.id, b.bill_number, b.customer_id, b.customer_name, b.customer_phone,
             b.grand_total, b.paid_amount, b.pending_amount, b.due_date, b.shop_id,
             CAST((julianday(b.due_date) - julianday('now')) AS INT) as days_diff
      FROM bills b
      WHERE b.pending_amount > 0 AND b.status != 'cancelled' AND b.due_date IS NOT NULL
    `);

    for (const b of creditBills) {
      const days = b.days_diff;
      let reminderTitle = null;
      let reminderMsg = null;
      let reminderType = 'payment_due';

      if (days === 2) {
        reminderTitle = `Payment Reminder: ${b.customer_name}`;
        reminderMsg = `Payment is due in 2 days for bill ${b.bill_number}. Outstanding amount: ₹${b.pending_amount}.`;
      } else if (days === 1) {
        reminderTitle = `Payment Due Tomorrow: ${b.customer_name}`;
        reminderMsg = `Payment for bill ${b.bill_number} is due tomorrow. Outstanding amount: ₹${b.pending_amount}.`;
      } else if (days === 0) {
        reminderTitle = `Payment Due Today: ${b.customer_name}`;
        reminderMsg = `Payment for bill ${b.bill_number} is due TODAY! Outstanding amount: ₹${b.pending_amount}.`;
      } else if (days < 0) {
        const overdueDays = Math.abs(days);
        reminderTitle = `Payment Overdue: ${b.customer_name}`;
        reminderMsg = `Payment for bill ${b.bill_number} is OVERDUE by ${overdueDays} day(s). Outstanding amount: ₹${b.pending_amount}.`;
        reminderType = 'payment_overdue';
      }

      if (reminderTitle) {
        // Prevent duplicate creation for this bill today
        const existing = get(
          `SELECT id FROM notifications
           WHERE related_id = ? AND type = ? AND date(created_at) = date(?)`,
          [b.id, reminderType, todayStr]
        );

        if (!existing) {
          run(
            `INSERT INTO notifications (id, type, title, message, related_id, related_type, shop_id, target_role)
             VALUES (?, ?, ?, ?, ?, 'bill', ?, 'OWNER')`,
            [`notif_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`, reminderType, reminderTitle, reminderMsg, b.id, b.shop_id]
          );
        }
      }
    }

    // 2. Low Stock Alerts
    const lowStockProducts = query(`
      SELECT p.id, p.name, p.code, p.min_stock, inv.shop_id, inv.current_stock, s.name as shop_name
      FROM products p
      JOIN inventory inv ON p.id = inv.product_id
      JOIN shops s ON inv.shop_id = s.id
      WHERE inv.current_stock <= p.min_stock AND p.is_active = 1
    `);

    for (const p of lowStockProducts) {
      const existing = get(
        `SELECT id FROM notifications
         WHERE related_id = ? AND type = 'low_stock' AND is_read = 0 AND shop_id = ?`,
        [p.id, p.shop_id]
      );

      if (!existing) {
        run(
          `INSERT INTO notifications (id, type, title, message, related_id, related_type, shop_id, target_role)
           VALUES (?, 'low_stock', ?, ?, ?, 'product', ?, 'OWNER')`,
          [
            `notif_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
            `Low Stock: ${p.name}`,
            `Only ${p.current_stock} units left in ${p.shop_name}. Reorder threshold is ${p.min_stock}.`,
            p.id,
            p.shop_id,
          ]
        );
      }
    }
  } catch (err) {
    console.error('Error running reminder engine:', err);
  }
}

// GET /api/notifications
router.get('/', authenticateToken, (req, res) => {
  // Run reminder scan automatically to keep alerts fresh
  runReminderEngine();

  let sql = `
    SELECT n.*, s.name as shop_name
    FROM notifications n
    LEFT JOIN shops s ON n.shop_id = s.id
    WHERE 1=1
  `;
  const params = [];

  // Tailors only see notifications targeted to them or system
  if (req.user.role === 'TAILOR') {
    sql += ` AND (n.target_role = 'TAILOR' OR n.target_user_id = ?)`;
    params.push(req.user.id);
  } else if (req.user.role === 'EMPLOYEE') {
    sql += ` AND n.target_role IN ('OWNER', 'EMPLOYEE')`;
  }

  sql += ` ORDER BY n.created_at DESC LIMIT 50`;

  const notifications = query(sql, params);
  const unreadCount = notifications.filter(n => n.is_read === 0).length;

  res.json({ notifications, unreadCount });
});

// POST /api/notifications/:id/read
router.post('/:id/read', authenticateToken, (req, res) => {
  const { id } = req.params;
  if (id === 'all') {
    run('UPDATE notifications SET is_read = 1');
  } else {
    run('UPDATE notifications SET is_read = 1 WHERE id = ?', [id]);
  }
  res.json({ success: true, message: 'Notification marked as read' });
});

// POST /api/notifications/trigger-reminders (Manual trigger)
router.post('/trigger-reminders', authenticateToken, (req, res) => {
  runReminderEngine();
  res.json({ success: true, message: 'Reminder engine executed.' });
});

export default router;
