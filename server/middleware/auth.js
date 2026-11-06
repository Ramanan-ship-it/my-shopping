import jwt from 'jsonwebtoken';
import { get, query } from '../db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'smart_dress_shop_jwt_secret_key_2026_dev_secure';

export function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      user_id: user.user_id,
      email: user.email,
      name: user.name,
      role: user.role,
      assigned_shop: user.assigned_shop,
    },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
}

export function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Authentication token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }

    // Verify user is active in DB
    const user = get('SELECT id, user_id, email, name, role, phone, assigned_shop, is_active FROM users WHERE id = ?', [decoded.id]);
    if (!user) {
      return res.status(401).json({ error: 'User account not found' });
    }

    if (user.is_active !== 1) {
      return res.status(403).json({ error: 'Account has been disabled. Please contact the administrator.' });
    }

    // Load permissions
    const permissions = get('SELECT * FROM user_permissions WHERE user_id = ?', [user.id]) || {};

    // If role is TAILOR, get their tailor_id from tailors table
    let tailorProfile = null;
    if (user.role === 'TAILOR') {
      tailorProfile = get('SELECT id, tailor_code, name, assigned_shop FROM tailors WHERE linked_user_id = ?', [user.id]);
    }

    req.user = {
      ...user,
      tailor_id: tailorProfile?.id || null,
      tailor_code: tailorProfile?.tailor_code || null,
      permissions,
    };

    next();
  });
}

export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Access denied. Role ${req.user.role} is not permitted to access this resource.`,
      });
    }

    next();
  };
}

export function requirePermission(permissionName) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (req.user.role === 'OWNER') {
      return next(); // Owner has complete access
    }

    if (req.user.role === 'TAILOR') {
      return res.status(403).json({ error: 'Permission denied: Tailors cannot access business administrative modules.' });
    }

    if (req.user.permissions && req.user.permissions[permissionName] === 1) {
      return next();
    }

    return res.status(403).json({
      error: `Access denied: Missing '${permissionName}' permission. Please contact the Owner.`,
    });
  };
}

export function requireShopAccess(shopParamField = 'shop_id') {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    if (req.user.role === 'OWNER') return next();

    const targetShop = req.params[shopParamField] || req.query[shopParamField] || req.body[shopParamField];
    if (!targetShop || targetShop === 'all') {
      if (req.user.assigned_shop !== 'all') {
        return res.status(403).json({ error: 'Access denied: You do not have permission to view all shops combined.' });
      }
      return next();
    }

    // Check mapping: 'shop_retail' vs 'retail', 'shop_wholesale' vs 'wholesale'
    const userShop = req.user.assigned_shop;
    const isRetail = targetShop === 'shop_retail' || targetShop === 'retail';
    const isWholesale = targetShop === 'shop_wholesale' || targetShop === 'wholesale';

    if (userShop === 'all') return next();
    if (userShop === 'retail' && isRetail) return next();
    if (userShop === 'wholesale' && isWholesale) return next();

    return res.status(403).json({
      error: `Access denied: Your account is assigned to '${userShop}' and cannot access '${targetShop}'.`,
    });
  };
}

export function strictTailorPrivacy(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });

  // If Owner or authorized Employee, pass
  if (req.user.role === 'OWNER') return next();
  if (req.user.role === 'EMPLOYEE' && req.user.permissions?.can_tailors) return next();

  // If Tailor: MUST match their own tailor_id
  if (req.user.role === 'TAILOR') {
    const requestedTailorId = req.params.tailorId || req.query.tailor_id || req.body.tailor_id;

    if (!requestedTailorId) {
      // Automatically scope to their own tailor_id
      req.query.tailor_id = req.user.tailor_id;
      return next();
    }

    if (requestedTailorId !== req.user.tailor_id) {
      return res.status(403).json({
        error: 'STRICT PRIVACY VIOLATION: You are only authorized to view and manage your own tailor records.',
      });
    }

    return next();
  }

  return res.status(403).json({ error: 'Access denied to tailor module.' });
}
