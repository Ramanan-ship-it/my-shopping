import express from 'express';
import { get, query, run, transaction } from '../db.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

// GET /api/settings
router.get('/', authenticateToken, (req, res) => {
  const rows = query('SELECT key, value FROM settings');
  const settings = {};
  rows.forEach(r => {
    settings[r.key] = r.value;
  });

  // Also include shop details
  const shops = query('SELECT * FROM shops');

  res.json({ settings, shops });
});

// POST /api/settings (Owner only)
router.post('/', authenticateToken, requireRole('OWNER'), (req, res) => {
  const { settings, shops } = req.body;

  transaction(() => {
    if (settings) {
      for (const [k, v] of Object.entries(settings)) {
        run(
          "INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
          [k, String(v)]
        );
      }
    }

    if (shops && Array.isArray(shops)) {
      for (const s of shops) {
        run(
          `UPDATE shops SET
            name = COALESCE(?, name),
            address = COALESCE(?, address),
            phone = COALESCE(?, phone),
            email = COALESCE(?, email),
            gstin = COALESCE(?, gstin)
           WHERE id = ?`,
          [s.name, s.address, s.phone, s.email, s.gstin, s.id]
        );
      }
    }

    run(
      `INSERT INTO audit_logs (id, actor_id, actor_name, action, module, record_id, shop_id, details) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [`audit_${Date.now()}`, req.user.id, req.user.name, 'UPDATE_SETTINGS', 'settings', 'app_settings', 'all', 'Updated application settings and shop profiles']
    );
  });

  res.json({ success: true, message: 'Settings saved successfully' });
});

// GET /api/settings/backup (Download full JSON database backup - Owner only)
router.get('/backup', authenticateToken, requireRole('OWNER'), (req, res) => {
  const backup = {
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    system: 'SMART DRESS SHOP MANAGEMENT SYSTEM',
    tables: {
      shops: query('SELECT * FROM shops'),
      users: query('SELECT id, user_id, email, name, role, phone, assigned_shop, is_active, created_at FROM users'),
      user_permissions: query('SELECT * FROM user_permissions'),
      tailors: query('SELECT * FROM tailors'),
      products: query('SELECT * FROM products'),
      inventory: query('SELECT * FROM inventory'),
      stock_movements: query('SELECT * FROM stock_movements'),
      stock_transfers: query('SELECT * FROM stock_transfers'),
      customers: query('SELECT * FROM customers'),
      bills: query('SELECT * FROM bills'),
      bill_items: query('SELECT * FROM bill_items'),
      payments: query('SELECT * FROM payments'),
      returns: query('SELECT * FROM returns'),
      return_items: query('SELECT * FROM return_items'),
      tailor_production: query('SELECT * FROM tailor_production'),
      tailor_attendance: query('SELECT * FROM tailor_attendance'),
      tailor_salaries: query('SELECT * FROM tailor_salaries'),
      tailor_salary_payments: query('SELECT * FROM tailor_salary_payments'),
      expenses: query('SELECT * FROM expenses'),
      suppliers: query('SELECT * FROM suppliers'),
      supplier_payments: query('SELECT * FROM supplier_payments'),
      settings: query('SELECT * FROM settings'),
    },
  };

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename=smart_dress_shop_backup_${new Date().toISOString().split('T')[0]}.json`);
  res.send(JSON.stringify(backup, null, 2));
});

export default router;
