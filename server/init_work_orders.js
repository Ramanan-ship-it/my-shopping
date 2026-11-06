import { getDb, run, query, saveDatabase } from './db.js';

async function init() {
  await getDb();
  run(`
    CREATE TABLE IF NOT EXISTS tailor_work_orders (
      id TEXT PRIMARY KEY,
      order_number TEXT NOT NULL UNIQUE,
      tailor_id TEXT NOT NULL,
      shop_id TEXT NOT NULL DEFAULT 'shop_retail',
      item_type TEXT NOT NULL,
      given_qty INTEGER NOT NULL,
      stitched_qty INTEGER NOT NULL DEFAULT 0,
      rate_per_piece REAL DEFAULT 50,
      due_date TEXT,
      status TEXT DEFAULT 'in_progress',
      notes TEXT,
      assigned_by TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(tailor_id) REFERENCES tailors(id) ON DELETE CASCADE,
      FOREIGN KEY(shop_id) REFERENCES shops(id)
    );
  `);

  const count = query('SELECT count(*) as c FROM tailor_work_orders')[0].c;
  if (count === 0) {
    run(`
      INSERT INTO tailor_work_orders (id, order_number, tailor_id, shop_id, item_type, given_qty, stitched_qty, rate_per_piece, due_date, status, notes, assigned_by) VALUES
      ('two_1', 'TWO-2026-00001', 'tailor_1', 'shop_retail', 'Shirts', 200, 150, 50, date('now', '+3 days'), 'in_progress', 'Initial batch: Owner assigned 200 shirts, 150 stitched, 50 balance', 'user_owner'),
      ('two_2', 'TWO-2026-00002', 'tailor_2', 'shop_retail', 'Pants', 100, 60, 70, date('now', '+5 days'), 'in_progress', '100 formal pants assigned, 60 stitched, 40 balance', 'user_owner'),
      ('two_3', 'TWO-2026-00003', 'tailor_3', 'shop_retail', 'Blouses', 80, 80, 60, date('now', '-1 days'), 'completed', '80 festival blouses fully stitched and verified by owner', 'user_owner');
    `);
  }
  saveDatabase(true);
  console.log('✅ tailor_work_orders table initialized. Count:', query('SELECT count(*) as c FROM tailor_work_orders')[0].c);
  console.log('Sample work order:', query('SELECT id, order_number, tailor_id, item_type, given_qty, stitched_qty, (given_qty - stitched_qty) as balance_qty FROM tailor_work_orders WHERE tailor_id = "tailor_1"')[0]);
}

init().catch(console.error);
