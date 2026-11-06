import express from 'express';
import bcrypt from 'bcryptjs';
import { get, run, query } from '../db.js';
import { generateToken, authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { identifier, password } = req.body;

  if (!identifier || !password) {
    return res.status(400).json({ error: 'Please enter User ID / Email and Password.' });
  }

  // Find user by user_id or email
  const user = get(
    'SELECT * FROM users WHERE (user_id = ? OR email = ?)',
    [identifier.trim(), identifier.trim().toLowerCase()]
  );

  if (!user) {
    return res.status(401).json({ error: 'Invalid User ID or Password.' });
  }

  if (user.is_active !== 1) {
    return res.status(403).json({ error: 'Account has been disabled. Please contact the administrator.' });
  }

  // Check password
  const isValid = bcrypt.compareSync(password, user.password_hash);
  if (!isValid) {
    return res.status(401).json({ error: 'Invalid User ID or Password.' });
  }

  // Update last login
  run("UPDATE users SET last_login = datetime('now') WHERE id = ?", [user.id]);

  // Load user permissions
  const permissions = get('SELECT * FROM user_permissions WHERE user_id = ?', [user.id]) || {};

  // If tailor, load tailor profile
  let tailorProfile = null;
  if (user.role === 'TAILOR') {
    tailorProfile = get('SELECT * FROM tailors WHERE linked_user_id = ?', [user.id]);
  }

  // Generate JWT
  const token = generateToken(user);

  // Audit log
  run(
    "INSERT INTO audit_logs (id, actor_id, actor_name, action, module, record_id, shop_id, details) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    [`audit_${Date.now()}`, user.id, user.name, 'USER_LOGIN', 'auth', user.id, user.assigned_shop, `User logged in with role ${user.role}`]
  );

  res.json({
    token,
    user: {
      id: user.id,
      user_id: user.user_id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone,
      assigned_shop: user.assigned_shop,
      tailor_id: tailorProfile?.id || null,
      tailor_code: tailorProfile?.tailor_code || null,
      tailor_profile: tailorProfile,
      permissions,
    },
  });
});

// GET /api/auth/me
router.get('/me', authenticateToken, (req, res) => {
  let tailorProfile = null;
  if (req.user.role === 'TAILOR' && req.user.tailor_id) {
    tailorProfile = get('SELECT * FROM tailors WHERE id = ?', [req.user.tailor_id]);
  }

  res.json({
    user: {
      ...req.user,
      tailor_profile: tailorProfile,
    },
  });
});

// POST /api/auth/logout
router.post('/logout', authenticateToken, (req, res) => {
  run(
    "INSERT INTO audit_logs (id, actor_id, actor_name, action, module, record_id, shop_id, details) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    [`audit_${Date.now()}`, req.user.id, req.user.name, 'USER_LOGOUT', 'auth', req.user.id, req.user.assigned_shop, 'User logged out']
  );
  res.json({ message: 'Logged out successfully' });
});

// POST /api/auth/reset-password (Owner initiated or self)
router.post('/reset-password', authenticateToken, (req, res) => {
  const { user_id, new_password } = req.body;

  if (req.user.role !== 'OWNER' && req.user.id !== user_id) {
    return res.status(403).json({ error: 'Permission denied: Only Owner can reset other users passwords.' });
  }

  if (!new_password || new_password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
  }

  const hash = bcrypt.hashSync(new_password, 10);
  run('UPDATE users SET password_hash = ? WHERE id = ? OR user_id = ?', [hash, user_id, user_id]);

  run(
    "INSERT INTO audit_logs (id, actor_id, actor_name, action, module, record_id, shop_id, details) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    [`audit_${Date.now()}`, req.user.id, req.user.name, 'PASSWORD_RESET', 'auth', user_id, 'all', `Password reset for user ${user_id}`]
  );

  res.json({ success: true, message: 'Password has been updated successfully.' });
});

export default router;
