import express from 'express';
import bcrypt from 'bcryptjs';
import { get, query, run, transaction } from '../db.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

// GET /api/users (Owner only)
router.get('/', authenticateToken, requireRole('OWNER'), (req, res) => {
  const users = query(`
    SELECT u.id, u.user_id, u.email, u.name, u.role, u.phone, u.assigned_shop,
           u.is_active, u.created_at, u.last_login,
           up.can_billing, up.can_credit, up.can_inventory, up.can_stock_transfer,
           up.can_tailors, up.can_salary, up.can_expenses, up.can_suppliers,
           up.can_reports, up.can_profit_view, up.can_settings, up.can_users,
           t.tailor_code, t.id as tailor_id
    FROM users u
    LEFT JOIN user_permissions up ON u.id = up.user_id
    LEFT JOIN tailors t ON u.id = t.linked_user_id
    ORDER BY u.created_at ASC
  `);

  res.json({ users });
});

// POST /api/users (Create new employee or tailor account - Owner only)
router.post('/', authenticateToken, requireRole('OWNER'), (req, res) => {
  try {
    const {
      user_id,
      email,
      password,
      name,
      role = 'EMPLOYEE', // EMPLOYEE, TAILOR
      phone = '',
      assigned_shop = 'retail',
      permissions = {},
    } = req.body;

    if (!user_id || !password || !name) {
      return res.status(400).json({ error: 'User ID, Password, and Name are required.' });
    }

    // Check unique user_id
    const existing = get('SELECT id FROM users WHERE user_id = ? OR email = ?', [user_id.trim(), email?.trim()]);
    if (existing) {
      return res.status(400).json({ error: `User ID or Email is already registered.` });
    }

    const userId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`;
    const hash = bcrypt.hashSync(password, 10);
    const userEmail = email ? email.trim().toLowerCase() : `${user_id.toLowerCase()}@smartdress.com`;

    transaction(() => {
      run(
        `INSERT INTO users (id, user_id, email, password_hash, name, role, phone, assigned_shop, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [userId, user_id.trim().toUpperCase(), userEmail, hash, name.trim(), role, phone, assigned_shop]
      );

      run(
        `INSERT INTO user_permissions (
          user_id, can_billing, can_credit, can_inventory, can_stock_transfer,
          can_tailors, can_salary, can_expenses, can_suppliers, can_reports,
          can_profit_view, can_settings, can_users
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          userId,
          permissions.can_billing ? 1 : 0,
          permissions.can_credit ? 1 : 0,
          permissions.can_inventory ? 1 : 0,
          permissions.can_stock_transfer ? 1 : 0,
          permissions.can_tailors ? 1 : 0,
          permissions.can_salary ? 1 : 0,
          permissions.can_expenses ? 1 : 0,
          permissions.can_suppliers ? 1 : 0,
          permissions.can_reports ? 1 : 0,
          permissions.can_profit_view ? 1 : 0,
          permissions.can_settings ? 1 : 0,
          permissions.can_users ? 1 : 0,
        ]
      );

      run(
        `INSERT INTO audit_logs (id, actor_id, actor_name, action, module, record_id, shop_id, details) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [`audit_${Date.now()}`, req.user.id, req.user.name, 'CREATE_USER', 'users', userId, assigned_shop, `Created user ${name} (${user_id}) as ${role}`]
      );
    });

    res.status(201).json({ success: true, message: `User ${name} created successfully.` });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to create user' });
  }
});

// PUT /api/users/:id/permissions
router.put('/:id/permissions', authenticateToken, requireRole('OWNER'), (req, res) => {
  const { id } = req.params;
  const { permissions, assigned_shop } = req.body;

  if (assigned_shop) {
    run('UPDATE users SET assigned_shop = ? WHERE id = ?', [assigned_shop, id]);
  }

  if (permissions) {
    run(
      `UPDATE user_permissions SET
        can_billing = ?,
        can_credit = ?,
        can_inventory = ?,
        can_stock_transfer = ?,
        can_tailors = ?,
        can_salary = ?,
        can_expenses = ?,
        can_suppliers = ?,
        can_reports = ?,
        can_profit_view = ?,
        can_settings = ?,
        can_users = ?
       WHERE user_id = ?`,
      [
        permissions.can_billing ? 1 : 0,
        permissions.can_credit ? 1 : 0,
        permissions.can_inventory ? 1 : 0,
        permissions.can_stock_transfer ? 1 : 0,
        permissions.can_tailors ? 1 : 0,
        permissions.can_salary ? 1 : 0,
        permissions.can_expenses ? 1 : 0,
        permissions.can_suppliers ? 1 : 0,
        permissions.can_reports ? 1 : 0,
        permissions.can_profit_view ? 1 : 0,
        permissions.can_settings ? 1 : 0,
        permissions.can_users ? 1 : 0,
        id,
      ]
    );
  }

  run(
    `INSERT INTO audit_logs (id, actor_id, actor_name, action, module, record_id, shop_id, details) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [`audit_${Date.now()}`, req.user.id, req.user.name, 'UPDATE_PERMISSIONS', 'users', id, 'all', `Updated permissions for user ${id}`]
  );

  res.json({ success: true, message: 'Permissions updated successfully' });
});

// POST /api/users/:id/toggle-status
router.post('/:id/toggle-status', authenticateToken, requireRole('OWNER'), (req, res) => {
  const { id } = req.params;
  const user = get('SELECT * FROM users WHERE id = ?', [id]);
  if (!user) return res.status(404).json({ error: 'User not found' });

  if (user.role === 'OWNER') {
    return res.status(400).json({ error: 'Cannot disable the Owner account.' });
  }

  const newStatus = user.is_active === 1 ? 0 : 1;
  run('UPDATE users SET is_active = ? WHERE id = ?', [newStatus, id]);

  run(
    `INSERT INTO audit_logs (id, actor_id, actor_name, action, module, record_id, shop_id, details) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [`audit_${Date.now()}`, req.user.id, req.user.name, 'TOGGLE_USER_STATUS', 'users', id, 'all', `${newStatus === 1 ? 'Enabled' : 'Disabled'} account for user ${user.name}`]
  );

  res.json({ success: true, is_active: newStatus, message: `User account has been ${newStatus === 1 ? 'enabled' : 'disabled'}.` });
});

// GET /api/users/audit-logs
router.get('/audit-logs', authenticateToken, requireRole('OWNER'), (req, res) => {
  const { module, limit = 100 } = req.query;
  let sql = 'SELECT * FROM audit_logs WHERE 1=1';
  const params = [];

  if (module && module !== 'all') {
    sql += ' AND module = ?';
    params.push(module);
  }

  sql += ' ORDER BY created_at DESC LIMIT ?';
  params.push(Number(limit));

  const logs = query(sql, params);
  res.json({ logs });
});

export default router;
