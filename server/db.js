import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../data');
const DB_FILE = path.join(DATA_DIR, 'smart_dress_shop.db');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

let dbInstance = null;
let saveTimeout = null;

export async function getDb() {
  if (dbInstance) return dbInstance;

  const SQL = await initSqlJs();
  let buffer = null;
  if (fs.existsSync(DB_FILE)) {
    try {
      buffer = fs.readFileSync(DB_FILE);
    } catch (e) {
      console.error('Error reading db file:', e);
    }
  }

  dbInstance = new SQL.Database(buffer);
  
  // Enable foreign keys
  dbInstance.run('PRAGMA foreign_keys = ON;');

  // Initialize tables
  initSchema(dbInstance);

  // Seed initial data if newly created
  seedInitialData(dbInstance);

  // Ensure extensions, dress types & Ramanan tailoring hub records
  ensureExtensions(dbInstance);

  saveDatabase(true);

  return dbInstance;
}

export function saveDatabase(immediate = false) {
  if (!dbInstance) return;

  const doSave = () => {
    try {
      const data = dbInstance.export();
      const buffer = Buffer.from(data);
      fs.writeFileSync(DB_FILE, buffer);
    } catch (err) {
      console.error('Error saving SQLite database to disk:', err);
    }
  };

  if (immediate) {
    if (saveTimeout) clearTimeout(saveTimeout);
    doSave();
  } else {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(doSave, 300);
  }
}

export function query(sql, params = []) {
  if (!dbInstance) throw new Error('Database not initialized');
  const stmt = dbInstance.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

export function get(sql, params = []) {
  const rows = query(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

export function run(sql, params = []) {
  if (!dbInstance) throw new Error('Database not initialized');
  const stmt = dbInstance.prepare(sql);
  stmt.bind(params);
  stmt.step();
  stmt.free();
  
  // Get changes & last insert id
  const changesRes = query('SELECT changes() as ch, last_insert_rowid() as id');
  const changes = changesRes[0]?.ch || 0;
  const lastInsertRowid = changesRes[0]?.id || 0;

  saveDatabase();
  return { changes, lastInsertRowid };
}

export function transaction(fn) {
  if (!dbInstance) throw new Error('Database not initialized');
  dbInstance.run('BEGIN TRANSACTION;');
  try {
    const result = fn();
    dbInstance.run('COMMIT;');
    saveDatabase(true);
    return result;
  } catch (err) {
    dbInstance.run('ROLLBACK;');
    throw err;
  }
}

function initSchema(db) {
  db.run(`
    CREATE TABLE IF NOT EXISTS shops (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      code TEXT NOT NULL UNIQUE,
      type TEXT NOT NULL, -- retail, wholesale
      address TEXT,
      phone TEXT,
      email TEXT,
      gstin TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL, -- OWNER, EMPLOYEE, TAILOR
      phone TEXT,
      assigned_shop TEXT NOT NULL DEFAULT 'all', -- retail, wholesale, all
      is_active INTEGER NOT NULL DEFAULT 1,
      session_token TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      last_login TEXT
    );

    CREATE TABLE IF NOT EXISTS user_permissions (
      user_id TEXT PRIMARY KEY,
      can_billing INTEGER DEFAULT 1,
      can_credit INTEGER DEFAULT 0,
      can_inventory INTEGER DEFAULT 1,
      can_stock_transfer INTEGER DEFAULT 0,
      can_tailors INTEGER DEFAULT 0,
      can_salary INTEGER DEFAULT 0,
      can_expenses INTEGER DEFAULT 0,
      can_suppliers INTEGER DEFAULT 0,
      can_reports INTEGER DEFAULT 0,
      can_profit_view INTEGER DEFAULT 0,
      can_settings INTEGER DEFAULT 0,
      can_users INTEGER DEFAULT 0,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS tailors (
      id TEXT PRIMARY KEY,
      tailor_code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      phone TEXT,
      joining_date TEXT,
      assigned_shop TEXT DEFAULT 'retail',
      salary_type TEXT NOT NULL DEFAULT 'per_piece', -- per_piece, monthly, daily, hybrid
      monthly_rate REAL DEFAULT 0,
      daily_rate REAL DEFAULT 0,
      shirt_rate REAL DEFAULT 50,
      pant_rate REAL DEFAULT 70,
      blouse_rate REAL DEFAULT 60,
      other_rate REAL DEFAULT 40,
      account_status TEXT DEFAULT 'active',
      linked_user_id TEXT UNIQUE,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(linked_user_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      code TEXT NOT NULL UNIQUE,
      category TEXT NOT NULL,
      brand TEXT,
      size TEXT,
      color TEXT,
      purchase_price REAL NOT NULL,
      retail_price REAL NOT NULL,
      wholesale_price REAL NOT NULL,
      selling_price REAL NOT NULL,
      min_stock INTEGER DEFAULT 10,
      hsn TEXT,
      gst_rate REAL DEFAULT 5, -- 0, 5, 12, 18, 28
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS inventory (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      shop_id TEXT NOT NULL,
      current_stock INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE(product_id, shop_id),
      FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE,
      FOREIGN KEY(shop_id) REFERENCES shops(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS stock_movements (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      shop_id TEXT NOT NULL,
      movement_type TEXT NOT NULL, -- sale, transfer_in, transfer_out, return, adjustment, purchase
      quantity INTEGER NOT NULL,
      previous_stock INTEGER NOT NULL,
      new_stock INTEGER NOT NULL,
      reference_id TEXT,
      reference_type TEXT,
      notes TEXT,
      created_by TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(product_id) REFERENCES products(id),
      FOREIGN KEY(shop_id) REFERENCES shops(id)
    );

    CREATE TABLE IF NOT EXISTS stock_transfers (
      id TEXT PRIMARY KEY,
      transfer_number TEXT NOT NULL UNIQUE,
      source_shop TEXT NOT NULL,
      dest_shop TEXT NOT NULL,
      product_id TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'completed', -- pending, approved, completed, cancelled
      notes TEXT,
      created_by TEXT,
      approved_by TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      completed_at TEXT,
      FOREIGN KEY(source_shop) REFERENCES shops(id),
      FOREIGN KEY(dest_shop) REFERENCES shops(id),
      FOREIGN KEY(product_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      address TEXT,
      gstin TEXT,
      customer_type TEXT DEFAULT 'retail', -- retail, wholesale
      shop_id TEXT NOT NULL,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(shop_id) REFERENCES shops(id)
    );

    CREATE TABLE IF NOT EXISTS bills (
      id TEXT PRIMARY KEY,
      bill_number TEXT NOT NULL UNIQUE,
      bill_type TEXT NOT NULL DEFAULT 'normal', -- normal, gst
      shop_id TEXT NOT NULL,
      customer_id TEXT,
      customer_name TEXT NOT NULL,
      customer_phone TEXT,
      subtotal REAL NOT NULL,
      discount REAL DEFAULT 0,
      tax_amount REAL DEFAULT 0,
      grand_total REAL NOT NULL,
      payment_method TEXT NOT NULL, -- cash, upi, card, credit, partial
      paid_amount REAL NOT NULL,
      pending_amount REAL NOT NULL DEFAULT 0,
      due_date TEXT,
      status TEXT NOT NULL DEFAULT 'paid', -- paid, pending, partial, overdue, cancelled
      created_by TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(shop_id) REFERENCES shops(id),
      FOREIGN KEY(customer_id) REFERENCES customers(id)
    );

    CREATE TABLE IF NOT EXISTS bill_items (
      id TEXT PRIMARY KEY,
      bill_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      product_name TEXT NOT NULL,
      product_code TEXT,
      quantity INTEGER NOT NULL,
      unit_price REAL NOT NULL,
      discount REAL DEFAULT 0,
      tax_rate REAL DEFAULT 0,
      tax_amount REAL DEFAULT 0,
      total_price REAL NOT NULL,
      FOREIGN KEY(bill_id) REFERENCES bills(id) ON DELETE CASCADE,
      FOREIGN KEY(product_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      payment_number TEXT NOT NULL UNIQUE,
      bill_id TEXT NOT NULL,
      customer_id TEXT,
      amount REAL NOT NULL,
      payment_method TEXT NOT NULL, -- cash, upi, card, other
      payment_date TEXT DEFAULT (datetime('now')),
      notes TEXT,
      received_by TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(bill_id) REFERENCES bills(id) ON DELETE CASCADE,
      FOREIGN KEY(customer_id) REFERENCES customers(id)
    );

    CREATE TABLE IF NOT EXISTS returns (
      id TEXT PRIMARY KEY,
      return_number TEXT NOT NULL UNIQUE,
      bill_id TEXT NOT NULL,
      customer_id TEXT,
      shop_id TEXT NOT NULL,
      return_amount REAL NOT NULL,
      restock_inventory INTEGER DEFAULT 1,
      refund_method TEXT DEFAULT 'cash', -- cash, credit_adjustment
      notes TEXT,
      created_by TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(bill_id) REFERENCES bills(id),
      FOREIGN KEY(shop_id) REFERENCES shops(id)
    );

    CREATE TABLE IF NOT EXISTS return_items (
      id TEXT PRIMARY KEY,
      return_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      product_name TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      refund_rate REAL NOT NULL,
      total_amount REAL NOT NULL,
      FOREIGN KEY(return_id) REFERENCES returns(id) ON DELETE CASCADE,
      FOREIGN KEY(product_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS tailor_production (
      id TEXT PRIMARY KEY,
      tailor_id TEXT NOT NULL,
      date TEXT NOT NULL,
      shop_id TEXT NOT NULL,
      shirts_qty INTEGER DEFAULT 0,
      pants_qty INTEGER DEFAULT 0,
      blouses_qty INTEGER DEFAULT 0,
      others_qty INTEGER DEFAULT 0,
      total_pieces INTEGER NOT NULL,
      earned_amount REAL NOT NULL,
      notes TEXT,
      created_by TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(tailor_id) REFERENCES tailors(id) ON DELETE CASCADE,
      FOREIGN KEY(shop_id) REFERENCES shops(id)
    );

    CREATE TABLE IF NOT EXISTS dress_types (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      default_rate REAL DEFAULT 50,
      category TEXT DEFAULT 'Women',
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS tailor_work_orders (
      id TEXT PRIMARY KEY,
      order_number TEXT NOT NULL UNIQUE,
      tailor_id TEXT NOT NULL,
      shop_id TEXT NOT NULL DEFAULT 'shop_retail',
      item_type TEXT NOT NULL, -- Shirts, Pants, Blouses, Suits, Kurtis, Traditional, Custom
      given_qty INTEGER NOT NULL, -- Items given by owner (e.g. 200)
      stitched_qty INTEGER NOT NULL DEFAULT 0, -- Items stitched by tailor (e.g. 150)
      rate_per_piece REAL DEFAULT 50,
      due_date TEXT,
      status TEXT DEFAULT 'in_progress', -- pending, in_progress, completed, cancelled
      notes TEXT,
      assigned_by TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(tailor_id) REFERENCES tailors(id) ON DELETE CASCADE,
      FOREIGN KEY(shop_id) REFERENCES shops(id)
    );

    CREATE TABLE IF NOT EXISTS stitching_returns (
      id TEXT PRIMARY KEY,
      return_number TEXT NOT NULL UNIQUE,
      assignment_id TEXT NOT NULL,
      tailor_id TEXT NOT NULL,
      dress_type TEXT NOT NULL,
      completed_qty INTEGER NOT NULL,
      rate_per_piece REAL NOT NULL,
      earned_amount REAL NOT NULL,
      return_date TEXT NOT NULL,
      notes TEXT,
      recorded_by TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(assignment_id) REFERENCES tailor_work_orders(id) ON DELETE CASCADE,
      FOREIGN KEY(tailor_id) REFERENCES tailors(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS tailor_attendance (
      id TEXT PRIMARY KEY,
      tailor_id TEXT NOT NULL,
      date TEXT NOT NULL,
      shop_id TEXT DEFAULT 'retail',
      status TEXT NOT NULL, -- present, absent, leave, half_day
      notes TEXT,
      marked_by TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(tailor_id, date),
      FOREIGN KEY(tailor_id) REFERENCES tailors(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS tailor_salaries (
      id TEXT PRIMARY KEY,
      tailor_id TEXT NOT NULL,
      period_start TEXT NOT NULL,
      period_end TEXT NOT NULL,
      salary_type TEXT NOT NULL,
      total_pieces INTEGER DEFAULT 0,
      earned_amount REAL NOT NULL,
      advance_deductions REAL DEFAULT 0,
      net_salary REAL NOT NULL,
      paid_amount REAL DEFAULT 0,
      pending_amount REAL NOT NULL,
      status TEXT DEFAULT 'pending', -- pending, partial, paid
      calculated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(tailor_id) REFERENCES tailors(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS tailor_salary_payments (
      id TEXT PRIMARY KEY,
      tailor_id TEXT NOT NULL,
      salary_id TEXT,
      payment_type TEXT DEFAULT 'salary', -- salary, advance
      amount REAL NOT NULL,
      payment_method TEXT DEFAULT 'cash',
      payment_date TEXT DEFAULT (datetime('now')),
      notes TEXT,
      recorded_by TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(tailor_id) REFERENCES tailors(id) ON DELETE CASCADE,
      FOREIGN KEY(salary_id) REFERENCES tailor_salaries(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      category TEXT NOT NULL, -- Electricity, Rent, Transport, Maintenance, Staff Salary, Tailor Salary, Supplier Payments, Packaging, Other
      amount REAL NOT NULL,
      shop_id TEXT NOT NULL,
      description TEXT,
      payment_method TEXT DEFAULT 'cash',
      receipt_ref TEXT,
      created_by TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(shop_id) REFERENCES shops(id)
    );

    CREATE TABLE IF NOT EXISTS suppliers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT,
      address TEXT,
      products_supplied TEXT,
      payable_balance REAL DEFAULT 0,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS supplier_payments (
      id TEXT PRIMARY KEY,
      supplier_id TEXT NOT NULL,
      amount REAL NOT NULL,
      payment_method TEXT DEFAULT 'bank_transfer',
      payment_date TEXT DEFAULT (datetime('now')),
      notes TEXT,
      recorded_by TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL, -- payment_due, payment_overdue, low_stock, pending_salary, stock_transfer, system
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      related_id TEXT,
      related_type TEXT,
      shop_id TEXT,
      is_read INTEGER DEFAULT 0,
      target_role TEXT DEFAULT 'OWNER', -- OWNER, EMPLOYEE, TAILOR
      target_user_id TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      actor_id TEXT,
      actor_name TEXT,
      action TEXT NOT NULL,
      module TEXT NOT NULL,
      record_id TEXT,
      shop_id TEXT,
      details TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);
}

function seedInitialData(db) {
  const shopCount = query('SELECT COUNT(*) as count FROM shops')[0]?.count || 0;
  if (shopCount > 0) return; // already seeded

  console.log('Seeding initial demo data for Smart Dress Shop...');

  // 1. Shops
  db.run(`
    INSERT INTO shops (id, name, code, type, address, phone, email, gstin) VALUES
    ('shop_retail', 'Smart Dress Shop - Retail', 'RET', 'retail', '142 Bazaar Street, Commercial Complex, Chennai, TN', '+91 98765 43210', 'retail@smartdress.com', '33AABCS1429B1Z1'),
    ('shop_wholesale', 'Smart Dress Shop - Wholesale', 'WHO', 'wholesale', '88 Textile Market Road, Goods Hub, Chennai, TN', '+91 98765 43211', 'wholesale@smartdress.com', '33AABCS1429B2Z2');
  `);

  // Default password hashes
  const ownerPassHash = bcrypt.hashSync('Owner@123', 10);
  const employeePassHash = bcrypt.hashSync('Employee@123', 10);
  const arunPassHash = bcrypt.hashSync('Arun@123', 10);
  const tailorPassHash = bcrypt.hashSync('Tailor@123', 10);

  // 2. Users
  db.run(`
    INSERT INTO users (id, user_id, email, password_hash, name, role, phone, assigned_shop, is_active) VALUES
    ('user_owner', 'OWNER01', 'owner@smartdress.com', '${ownerPassHash}', 'K. Balasubramanian (Owner)', 'OWNER', '+91 98765 43200', 'all', 1),
    ('user_emp1', 'EMP001', 'arun@smartdress.com', '${arunPassHash}', 'Arun Kumar (Sales Rep)', 'EMPLOYEE', '+91 98765 43201', 'retail', 1),
    ('user_emp2', 'EMP002', 'meena@smartdress.com', '${employeePassHash}', 'Meena Sundaram (Store Incharge)', 'EMPLOYEE', '+91 98765 43202', 'wholesale', 1);
  `);

  // Permissions for employees
  db.run(`
    INSERT INTO user_permissions (user_id, can_billing, can_credit, can_inventory, can_stock_transfer, can_tailors, can_salary, can_expenses, can_suppliers, can_reports, can_profit_view, can_settings, can_users) VALUES
    ('user_owner', 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1),
    ('user_emp1', 1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0), -- Arun: Retail billing & inventory, no credit/profit/users
    ('user_emp2', 1, 1, 1, 1, 0, 0, 1, 1, 1, 0, 0, 0); -- Meena: Wholesale operations
  `);

  // 3. Ten Tailors and Tailor User Accounts
  const tailorNames = [
    { code: 'TAILOR001', name: 'Kumar S.', pass: 'Kumar@123', phone: '+91 98111 00001', shop: 'retail' },
    { code: 'TAILOR002', name: 'Ravi M.', pass: 'Ravi@123', phone: '+91 98111 00002', shop: 'retail' },
    { code: 'TAILOR003', name: 'Arun V.', pass: 'Tailor3@123', phone: '+91 98111 00003', shop: 'retail' },
    { code: 'TAILOR004', name: 'Suresh R.', pass: 'Tailor4@123', phone: '+91 98111 00004', shop: 'wholesale' },
    { code: 'TAILOR005', name: 'Vijay P.', pass: 'Tailor5@123', phone: '+91 98111 00005', shop: 'retail' },
    { code: 'TAILOR006', name: 'Manoj G.', pass: 'Tailor6@123', phone: '+91 98111 00006', shop: 'wholesale' },
    { code: 'TAILOR007', name: 'Karthik N.', pass: 'Tailor7@123', phone: '+91 98111 00007', shop: 'retail' },
    { code: 'TAILOR008', name: 'Prakash T.', pass: 'Tailor8@123', phone: '+91 98111 00008', shop: 'wholesale' },
    { code: 'TAILOR009', name: 'Dinesh K.', pass: 'Tailor9@123', phone: '+91 98111 00009', shop: 'retail' },
    { code: 'TAILOR010', name: 'Surya L.', pass: 'Tailor10@123', phone: '+91 98111 00010', shop: 'wholesale' },
  ];

  tailorNames.forEach((t, idx) => {
    const tailorId = `tailor_${idx + 1}`;
    const userId = `user_tailor_${idx + 1}`;
    const email = `${t.code.toLowerCase()}@smartdress.com`;
    const hash = bcrypt.hashSync(t.pass, 10);

    // Create user account for tailor
    db.run(`
      INSERT INTO users (id, user_id, email, password_hash, name, role, phone, assigned_shop, is_active) VALUES
      ('${userId}', '${t.code}', '${email}', '${hash}', '${t.name}', 'TAILOR', '${t.phone}', '${t.shop}', 1);
    `);

    // Tailor permissions (restricted)
    db.run(`
      INSERT INTO user_permissions (user_id, can_billing, can_credit, can_inventory, can_stock_transfer, can_tailors, can_salary, can_expenses, can_suppliers, can_reports, can_profit_view, can_settings, can_users) VALUES
      ('${userId}', 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0);
    `);

    // Create tailor profile linked to user account
    db.run(`
      INSERT INTO tailors (id, tailor_code, name, phone, joining_date, assigned_shop, salary_type, shirt_rate, pant_rate, blouse_rate, other_rate, account_status, linked_user_id) VALUES
      ('${tailorId}', '${t.code}', '${t.name}', '${t.phone}', '2025-01-15', '${t.shop}', 'per_piece', 50.0, 70.0, 60.0, 40.0, 'active', '${userId}');
    `);
  });

  // 4. Products (Clothing items)
  const products = [
    { id: 'prod_1', name: 'Premium Cotton Formal Shirt', code: 'SHIRT-001', category: 'Shirts', size: '40', color: 'Sky Blue', purchase: 450, retail: 850, wholesale: 650, selling: 850, min: 15, hsn: '6205', gst: 5 },
    { id: 'prod_2', name: 'Slim Fit Denim Jeans', code: 'JEANS-001', category: 'Pants', size: '32', color: 'Dark Indigo', purchase: 600, retail: 1200, wholesale: 900, selling: 1200, min: 10, hsn: '6203', gst: 5 },
    { id: 'prod_3', name: 'Pure Silk Kanchipuram Saree', code: 'SAREE-001', category: 'Sarees', size: 'Free Size', color: 'Maroon & Gold', purchase: 2800, retail: 5500, wholesale: 4200, selling: 5500, min: 5, hsn: '5007', gst: 5 },
    { id: 'prod_4', name: 'Handcrafted Embroidery Kurti', code: 'KURTI-001', category: 'Ethnic Wear', size: 'M', color: 'Olive Green', purchase: 350, retail: 750, wholesale: 550, selling: 750, min: 12, hsn: '6204', gst: 5 },
    { id: 'prod_5', name: 'Linen Casual Chino Trousers', code: 'TROUS-001', category: 'Pants', size: '34', color: 'Beige', purchase: 550, retail: 1100, wholesale: 800, selling: 1100, min: 8, hsn: '6203', gst: 5 },
    { id: 'prod_6', name: 'Traditional Dhoti with Gold Zari', code: 'DHOTI-001', category: 'Traditional', size: '4 Mtrs', color: 'Off-White', purchase: 220, retail: 490, wholesale: 350, selling: 490, min: 20, hsn: '5208', gst: 5 },
    { id: 'prod_7', name: 'Festive Designer Anarkali Suit', code: 'SUIT-001', category: 'Ethnic Wear', size: 'L', color: 'Navy Blue', purchase: 1100, retail: 2400, wholesale: 1750, selling: 2400, min: 6, hsn: '6204', gst: 12 },
    { id: 'prod_8', name: 'Bio-Washed Cotton Polo T-Shirt', code: 'POLO-001', category: 'T-Shirts', size: 'XL', color: 'Burgundy', purchase: 240, retail: 550, wholesale: 380, selling: 550, min: 15, hsn: '6109', gst: 5 },
    { id: 'prod_9', name: 'Executive Wool Blend Blazer', code: 'BLAZER-001', category: 'Suits', size: '42', color: 'Charcoal Grey', purchase: 2100, retail: 4500, wholesale: 3400, selling: 4500, min: 4, hsn: '6201', gst: 12 },
    { id: 'prod_10', name: 'Embroidered Chiffon Dupatta', code: 'DUP-001', category: 'Accessories', size: '2.5 Mtrs', color: 'Peach', purchase: 120, retail: 290, wholesale: 200, selling: 290, min: 25, hsn: '6214', gst: 5 },
  ];

  products.forEach(p => {
    db.run(`
      INSERT INTO products (id, name, code, category, brand, size, color, purchase_price, retail_price, wholesale_price, selling_price, min_stock, hsn, gst_rate, is_active) VALUES
      ('${p.id}', '${p.name}', '${p.code}', '${p.category}', 'Smart Dress Classic', '${p.size}', '${p.color}', ${p.purchase}, ${p.retail}, ${p.wholesale}, ${p.selling}, ${p.min}, '${p.hsn}', ${p.gst}, 1);
    `);
  });

  // 5. Inventory for both shops
  // Initial stock for critical test 2: Wholesale 100 formal shirts, Retail 10 formal shirts
  products.forEach((p, idx) => {
    const retailStock = idx === 0 ? 10 : (idx === 1 ? 8 : (15 + idx * 3));
    const wholesaleStock = idx === 0 ? 100 : (idx === 1 ? 80 : (50 + idx * 5));

    db.run(`
      INSERT INTO inventory (id, product_id, shop_id, current_stock) VALUES
      ('inv_ret_${p.id}', '${p.id}', 'shop_retail', ${retailStock}),
      ('inv_who_${p.id}', '${p.id}', 'shop_wholesale', ${wholesaleStock});
    `);
  });

  // 6. Customers (Retail & Wholesale)
  const customers = [
    { id: 'cust_1', name: 'Ravi Kumar', phone: '+91 98401 23456', address: '12 Gandhi Road, T. Nagar, Chennai', gstin: '', type: 'retail', shop: 'shop_retail' },
    { id: 'cust_2', name: 'Priya Sundaram', phone: '+91 98402 34567', address: '45 Anna Nagar West, Chennai', gstin: '', type: 'retail', shop: 'shop_retail' },
    { id: 'cust_3', name: 'Karthikeyan Textiles', phone: '+91 98403 45678', address: '77 Wholesale Hub, Erode', gstin: '33AABCK9988C1Z3', type: 'wholesale', shop: 'shop_wholesale' },
    { id: 'cust_4', name: 'Murugan Menswear', phone: '+91 98404 56789', address: '109 Cross Cut Road, Coimbatore', gstin: '33AABCM1122D1Z4', type: 'wholesale', shop: 'shop_wholesale' },
    { id: 'cust_5', name: 'Anitha Ramesh', phone: '+91 98405 67890', address: '28 Velachery Main Road, Chennai', gstin: '', type: 'retail', shop: 'shop_retail' },
    { id: 'cust_6', name: 'Senthil Nathan', phone: '+91 98406 78901', address: '55 North Usman Road, Chennai', gstin: '', type: 'retail', shop: 'shop_retail' },
    { id: 'cust_7', name: 'Vasanth Garments', phone: '+91 98407 89012', address: '30 Salem Market Yard, Salem', gstin: '33AABCV5566F1Z5', type: 'wholesale', shop: 'shop_wholesale' },
    { id: 'cust_8', name: 'Deepa Natarajan', phone: '+91 98408 90123', address: '63 Mylapore High Road, Chennai', gstin: '', type: 'retail', shop: 'shop_retail' },
    { id: 'cust_9', name: 'Raghavan Pillai', phone: '+91 98409 01234', address: '14 Adyar Gate, Chennai', gstin: '', type: 'retail', shop: 'shop_retail' },
    { id: 'cust_10', name: 'City Choice Apparels', phone: '+91 98410 12345', address: '82 Flower Bazaar, Madurai', gstin: '33AABCC7788H1Z8', type: 'wholesale', shop: 'shop_wholesale' },
  ];

  customers.forEach(c => {
    db.run(`
      INSERT INTO customers (id, name, phone, address, gstin, customer_type, shop_id) VALUES
      ('${c.id}', '${c.name}', '${c.phone}', '${c.address}', '${c.gstin}', '${c.type}', '${c.shop}');
    `);
  });

  // 7. Initial Bills & Payments
  // Bill 1: Paid Cash Normal bill
  db.run(`
    INSERT INTO bills (id, bill_number, bill_type, shop_id, customer_id, customer_name, customer_phone, subtotal, discount, tax_amount, grand_total, payment_method, paid_amount, pending_amount, due_date, status, created_by, created_at) VALUES
    ('bill_1', 'RET-2026-00001', 'normal', 'shop_retail', 'cust_2', 'Priya Sundaram', '+91 98402 34567', 1500, 100, 0, 1400, 'cash', 1400, 0, null, 'paid', 'user_owner', datetime('now', '-2 days'));

    INSERT INTO bill_items (id, bill_id, product_id, product_name, product_code, quantity, unit_price, discount, tax_rate, tax_amount, total_price) VALUES
    ('bi_1', 'bill_1', 'prod_4', 'Handcrafted Embroidery Kurti', 'KURTI-001', 2, 750, 100, 0, 0, 1400);

    INSERT INTO payments (id, payment_number, bill_id, customer_id, amount, payment_method, notes, received_by, payment_date) VALUES
    ('pay_1', 'PAY-2026-00001', 'bill_1', 'cust_2', 1400, 'cash', 'Full payment at billing', 'user_owner', datetime('now', '-2 days'));
  `);

  // Bill 2: GST Bill on Wholesale
  db.run(`
    INSERT INTO bills (id, bill_number, bill_type, shop_id, customer_id, customer_name, customer_phone, subtotal, discount, tax_amount, grand_total, payment_method, paid_amount, pending_amount, due_date, status, created_by, created_at) VALUES
    ('bill_2', 'WHO-GST-2026-00001', 'gst', 'shop_wholesale', 'cust_3', 'Karthikeyan Textiles', '+91 98403 45678', 21000, 1000, 1000, 21000, 'upi', 21000, 0, null, 'paid', 'user_emp2', datetime('now', '-1 days'));

    INSERT INTO bill_items (id, bill_id, product_id, product_name, product_code, quantity, unit_price, discount, tax_rate, tax_amount, total_price) VALUES
    ('bi_2', 'bill_2', 'prod_3', 'Pure Silk Kanchipuram Saree', 'SAREE-001', 5, 4200, 1000, 5, 1000, 21000);

    INSERT INTO payments (id, payment_number, bill_id, customer_id, amount, payment_method, notes, received_by, payment_date) VALUES
    ('pay_2', 'PAY-2026-00002', 'bill_2', 'cust_3', 21000, 'upi', 'UPI GPay transfer', 'user_emp2', datetime('now', '-1 days'));
  `);

  // 8. Tailor Production and Attendance
  // Tailor 1 (Kumar) initial production: 10 shirts (₹50 ea = ₹500) and 8 pants (₹70 ea = ₹560) -> Total = ₹1,060
  db.run(`
    INSERT INTO tailor_production (id, tailor_id, date, shop_id, shirts_qty, pants_qty, blouses_qty, others_qty, total_pieces, earned_amount, notes, created_by, created_at) VALUES
    ('prod_rec_1', 'tailor_1', date('now'), 'shop_retail', 10, 8, 0, 0, 18, 1060, '10 Shirts @ 50 + 8 Pants @ 70', 'user_owner', datetime('now')),
    ('prod_rec_2', 'tailor_2', date('now'), 'shop_retail', 5, 4, 3, 0, 12, 710, '5 Shirts + 4 Pants + 3 Blouses', 'user_owner', datetime('now'));

    INSERT INTO tailor_attendance (id, tailor_id, date, shop_id, status, notes, marked_by) VALUES
    ('att_1', 'tailor_1', date('now'), 'shop_retail', 'present', 'On-time morning shift', 'user_owner'),
    ('att_2', 'tailor_2', date('now'), 'shop_retail', 'present', 'On-time morning shift', 'user_owner'),
    ('att_3', 'tailor_3', date('now'), 'shop_retail', 'present', 'Regular', 'user_owner');
  `);

  // Tailor Salaries
  db.run(`
    INSERT INTO tailor_salaries (id, tailor_id, period_start, period_end, salary_type, total_pieces, earned_amount, advance_deductions, net_salary, paid_amount, pending_amount, status) VALUES
    ('sal_1', 'tailor_1', date('now', 'start of month'), date('now'), 'per_piece', 18, 1060, 0, 1060, 200, 860, 'partial'),
    ('sal_2', 'tailor_2', date('now', 'start of month'), date('now'), 'per_piece', 12, 710, 0, 710, 0, 710, 'pending');

    INSERT INTO tailor_salary_payments (id, tailor_id, salary_id, payment_type, amount, payment_method, notes, recorded_by) VALUES
    ('sal_pay_1', 'tailor_1', 'sal_1', 'advance', 200, 'cash', 'Emergency cash advance', 'user_owner');

    -- Tailor Work Orders (Owner assigns items to stitch, records stitched pieces & tracks balance)
    INSERT INTO tailor_work_orders (id, order_number, tailor_id, shop_id, item_type, given_qty, stitched_qty, rate_per_piece, due_date, status, notes, assigned_by) VALUES
    ('two_1', 'TWO-2026-00001', 'tailor_1', 'shop_retail', 'Shirts', 200, 150, 50, date('now', '+3 days'), 'in_progress', 'Initial batch: Owner assigned 200 shirts, 150 stitched, 50 balance', 'user_owner'),
    ('two_2', 'TWO-2026-00002', 'tailor_2', 'shop_retail', 'Pants', 100, 60, 70, date('now', '+5 days'), 'in_progress', '100 formal pants assigned, 60 stitched, 40 balance', 'user_owner'),
    ('two_3', 'TWO-2026-00003', 'tailor_3', 'shop_retail', 'Blouses', 80, 80, 60, date('now', '-1 days'), 'completed', '80 festival blouses fully stitched and verified by owner', 'user_owner');
  `);

  // 9. Expenses
  db.run(`
    INSERT INTO expenses (id, date, category, amount, shop_id, description, payment_method, created_by) VALUES
    ('exp_1', date('now', '-3 days'), 'Electricity', 2400, 'shop_retail', 'Monthly TNEB electricity bill for retail showroom', 'upi', 'user_owner'),
    ('exp_2', date('now', '-1 days'), 'Packaging', 850, 'shop_retail', 'Branded carry bags and garment covers', 'cash', 'user_owner'),
    ('exp_3', date('now'), 'Transport', 1200, 'shop_wholesale', 'Tempo delivery charges for bulk shipment', 'cash', 'user_emp2');
  `);

  // 10. Suppliers
  db.run(`
    INSERT INTO suppliers (id, name, phone, address, products_supplied, payable_balance, notes) VALUES
    ('sup_1', 'Sri Lakshmi Cotton Mills', '+91 94432 11223', 'Cotton City, Tirupur, TN', 'Cotton Shirting & Suiting Fabric', 15000, 'Reliable 40-count cotton vendor'),
    ('sup_2', 'Royal Threads & Yarns India', '+91 94432 44556', 'Ring Road, Surat, Gujarat', 'Polyester, Silk Threads, Zari', 6500, 'Thread and accessories supplier'),
    ('sup_3', 'Vardhman Textiles Ltd', '+91 94432 77889', 'Ludhiana, Punjab', 'Linen & Blended Trouser Cloth', 24000, 'Quarterly contract supplier');
  `);

  // 11. Notifications
  db.run(`
    INSERT INTO notifications (id, type, title, message, related_id, related_type, shop_id, is_read, target_role) VALUES
    ('notif_1', 'low_stock', 'Low Stock Alert: Executive Blazer', 'Executive Wool Blend Blazer has only 4 units remaining in retail.', 'prod_9', 'product', 'shop_retail', 0, 'OWNER'),
    ('notif_2', 'system', 'System Online', 'Smart Dress Shop management system initialized successfully.', null, 'system', 'all', 0, 'OWNER');
  `);

  // 12. Settings
  db.run(`
    INSERT INTO settings (key, value) VALUES
    ('business_name', 'SMART DRESS SHOP'),
    ('business_subtitle', 'Smart Retail & Wholesale Management System'),
    ('currency_symbol', '₹'),
    ('default_language', 'en'),
    ('theme', 'system'),
    ('reminder_days_before', '2'),
    ('auto_sms_whatsapp', '1'),
    ('invoice_footer', 'Thank you for shopping at Smart Dress Shop! Exchange within 7 days with bill.'),
    ('allow_negative_stock', '0');
  `);

  // 13. Audit Log
  db.run(`
    INSERT INTO audit_logs (id, actor_id, actor_name, action, module, record_id, shop_id, details) VALUES
    ('audit_1', 'user_owner', 'K. Balasubramanian (Owner)', 'INITIALIZE_SYSTEM', 'system', 'system', 'all', 'Smart Dress Shop business system initialized with Retail & Wholesale entities');
  `);

  console.log('Seeding completed successfully!');
}

function ensureExtensions(db) {
  // 1. Ensure dress_types table exists
  db.run(`
    CREATE TABLE IF NOT EXISTS dress_types (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      default_rate REAL DEFAULT 50,
      category TEXT DEFAULT 'Women',
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // 2. Ensure stitching_returns table exists
  db.run(`
    CREATE TABLE IF NOT EXISTS stitching_returns (
      id TEXT PRIMARY KEY,
      return_number TEXT NOT NULL UNIQUE,
      assignment_id TEXT NOT NULL,
      tailor_id TEXT NOT NULL,
      dress_type TEXT NOT NULL,
      completed_qty INTEGER NOT NULL,
      rate_per_piece REAL NOT NULL,
      earned_amount REAL NOT NULL,
      return_date TEXT NOT NULL,
      notes TEXT,
      recorded_by TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(assignment_id) REFERENCES tailor_work_orders(id) ON DELETE CASCADE,
      FOREIGN KEY(tailor_id) REFERENCES tailors(id) ON DELETE CASCADE
    );
  `);

  // 3. Populate default dress types if none
  const dtCount = query('SELECT COUNT(*) as count FROM dress_types')[0]?.count || 0;
  if (dtCount === 0) {
    const defaults = [
      ['dt_1', 'Skirts', 60, 'Women'],
      ['dt_2', 'Palazzo Pants', 70, 'Women'],
      ['dt_3', 'Blouses', 80, 'Women'],
      ['dt_4', 'Chudithars', 75, 'Women'],
      ['dt_5', 'Shirts', 50, 'Men'],
      ['dt_6', 'Pants', 70, 'Men'],
      ['dt_7', 'Salwar Suits', 90, 'Women'],
      ['dt_8', 'Kurtis', 65, 'Women'],
      ['dt_9', 'Frocks', 85, 'Kids'],
      ['dt_10', 'Suits', 120, 'Men'],
    ];
    for (const [id, name, rate, cat] of defaults) {
      db.run(
        `INSERT OR IGNORE INTO dress_types (id, name, default_rate, category, is_active) VALUES (?, ?, ?, ?, 1)`,
        [id, name, rate, cat]
      );
    }
  }

  // 4. Ensure Ramanan (TAILOR011) exists
  const ramanan = get("SELECT id FROM tailors WHERE tailor_code = 'TAILOR011' OR name LIKE '%Ramanan%'");
  let ramananId = ramanan?.id;
  if (!ramananId) {
    ramananId = 'tailor_ramanan';
    const salt = bcrypt.genSaltSync(10);
    const passHash = bcrypt.hashSync('Tailor@123', salt);
    const userId = 'user_tailor_ramanan';

    // Insert user
    db.run(
      `INSERT OR IGNORE INTO users (id, user_id, email, password_hash, name, role, phone, assigned_shop, is_active)
       VALUES (?, 'TAILOR011', 'ramanan@smartdress.com', ?, 'Ramanan M. (Tailor Master)', 'TAILOR', '+91 98401 99887', 'retail', 1)`,
      [userId, passHash]
    );

    // Insert user permissions
    db.run(
      `INSERT OR IGNORE INTO user_permissions (user_id, can_billing, can_credit, can_inventory, can_stock_transfer, can_tailors, can_salary, can_expenses, can_suppliers, can_reports, can_profit_view, can_settings, can_users)
       VALUES (?, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0)`,
      [userId]
    );

    // Insert tailor
    db.run(
      `INSERT OR IGNORE INTO tailors (id, tailor_code, name, phone, joining_date, assigned_shop, salary_type, shirt_rate, pant_rate, blouse_rate, other_rate, account_status, linked_user_id, notes)
       VALUES (?, 'TAILOR011', 'Ramanan M.', '+91 98401 99887', '2026-01-15', 'retail', 'per_piece', 60, 70, 80, 75, 'active', ?, 'Master tailor specializing in Skirts, Palazzo Pants, Blouses & Chudithars')`,
      [ramananId, userId]
    );
  }

  // 5. Ensure Ramanan's 4 exact assignments and returns from the prompt exist
  const ramananOrders = query("SELECT id FROM tailor_work_orders WHERE tailor_id = ?", [ramananId]);
  if (ramananOrders.length === 0) {
    // 1. Skirt: 100 assigned, 95 completed, 5 pending
    const wo1 = 'two_ramanan_skirt';
    db.run(
      `INSERT OR IGNORE INTO tailor_work_orders (id, order_number, tailor_id, shop_id, item_type, given_qty, stitched_qty, rate_per_piece, due_date, status, notes, assigned_by)
       VALUES (?, 'TWO-2026-00010', ?, 'shop_retail', 'Skirts', 100, 95, 60, date('now', '+2 days'), 'in_progress', '100 Skirts assigned: 95 completed, 5 pending', 'user_owner')`,
      [wo1, ramananId]
    );
    // Returns for Skirts: 40 + 35 + 20 = 95
    db.run(
      `INSERT OR IGNORE INTO stitching_returns (id, return_number, assignment_id, tailor_id, dress_type, completed_qty, rate_per_piece, earned_amount, return_date, notes, recorded_by)
       VALUES ('ret_1', 'RET-2026-00001', ?, ?, 'Skirts', 40, 60, 2400, date('now', '-8 days'), 'First return batch: 40 skirts', 'user_owner'),
              ('ret_2', 'RET-2026-00002', ?, ?, 'Skirts', 35, 60, 2100, date('now', '-5 days'), 'Second return batch: 35 skirts', 'user_owner'),
              ('ret_3', 'RET-2026-00003', ?, ?, 'Skirts', 20, 60, 1200, date('now', '-1 days'), 'Third return batch: 20 skirts', 'user_owner')`,
      [wo1, ramananId, wo1, ramananId, wo1, ramananId]
    );

    // 2. Palazzo Pant: 50 assigned, 30 completed, 20 pending
    const wo2 = 'two_ramanan_palazzo';
    db.run(
      `INSERT OR IGNORE INTO tailor_work_orders (id, order_number, tailor_id, shop_id, item_type, given_qty, stitched_qty, rate_per_piece, due_date, status, notes, assigned_by)
       VALUES (?, 'TWO-2026-00011', ?, 'shop_retail', 'Palazzo Pants', 50, 30, 70, date('now', '+4 days'), 'in_progress', '50 Palazzo Pants assigned: 30 completed, 20 pending', 'user_owner')`,
      [wo2, ramananId]
    );
    db.run(
      `INSERT OR IGNORE INTO stitching_returns (id, return_number, assignment_id, tailor_id, dress_type, completed_qty, rate_per_piece, earned_amount, return_date, notes, recorded_by)
       VALUES ('ret_4', 'RET-2026-00004', ?, ?, 'Palazzo Pants', 30, 70, 2100, date('now', '-3 days'), 'First return batch: 30 palazzo pants', 'user_owner')`,
      [wo2, ramananId]
    );

    // 3. Blouse: 40 assigned, 40 completed, 0 pending (Completed)
    const wo3 = 'two_ramanan_blouse';
    db.run(
      `INSERT OR IGNORE INTO tailor_work_orders (id, order_number, tailor_id, shop_id, item_type, given_qty, stitched_qty, rate_per_piece, due_date, status, notes, assigned_by)
       VALUES (?, 'TWO-2026-00012', ?, 'shop_retail', 'Blouses', 40, 40, 80, date('now', '-1 days'), 'completed', '40 Blouses fully completed and verified', 'user_owner')`,
      [wo3, ramananId]
    );
    db.run(
      `INSERT OR IGNORE INTO stitching_returns (id, return_number, assignment_id, tailor_id, dress_type, completed_qty, rate_per_piece, earned_amount, return_date, notes, recorded_by)
       VALUES ('ret_5', 'RET-2026-00005', ?, ?, 'Blouses', 40, 80, 3200, date('now', '-2 days'), 'All 40 blouses returned', 'user_owner')`,
      [wo3, ramananId]
    );

    // 4. Chudithar: 60 assigned, 45 completed, 15 pending
    const wo4 = 'two_ramanan_chudithar';
    db.run(
      `INSERT OR IGNORE INTO tailor_work_orders (id, order_number, tailor_id, shop_id, item_type, given_qty, stitched_qty, rate_per_piece, due_date, status, notes, assigned_by)
       VALUES (?, 'TWO-2026-00013', ?, 'shop_retail', 'Chudithars', 60, 45, 75, date('now', '+3 days'), 'in_progress', '60 Chudithars assigned: 45 completed, 15 pending', 'user_owner')`,
      [wo4, ramananId]
    );
    db.run(
      `INSERT OR IGNORE INTO stitching_returns (id, return_number, assignment_id, tailor_id, dress_type, completed_qty, rate_per_piece, earned_amount, return_date, notes, recorded_by)
       VALUES ('ret_6', 'RET-2026-00006', ?, ?, 'Chudithars', 45, 75, 3375, date('now', '-1 days'), 'Batch return: 45 chudithars received', 'user_owner')`,
      [wo4, ramananId]
    );
  }
}
