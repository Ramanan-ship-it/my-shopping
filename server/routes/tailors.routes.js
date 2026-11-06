import express from 'express';
import bcrypt from 'bcryptjs';
import { get, query, run, transaction } from '../db.js';
import { authenticateToken, requireRole, strictTailorPrivacy } from '../middleware/auth.js';

const router = express.Router();

// Helper: Generate next sequential work order number
function generateWorkOrderNumber() {
  const year = new Date().getFullYear();
  const last = get(
    "SELECT order_number FROM tailor_work_orders WHERE order_number LIKE ? ORDER BY order_number DESC LIMIT 1",
    [`TWO-${year}-%`]
  );
  let nextSeq = 1;
  if (last && last.order_number) {
    const parts = last.order_number.split('-');
    const num = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(num)) nextSeq = num + 1;
  }
  return `TWO-${year}-${String(nextSeq).padStart(5, '0')}`;
}

// =========================================================================
// 1. DRESS TYPES (MODULE 3.B - Dynamic Dress Types)
// =========================================================================

// GET /api/tailors/dress-types (List all available dress types)
router.get('/dress-types', authenticateToken, (req, res) => {
  try {
    const dressTypes = query(
      `SELECT * FROM dress_types WHERE is_active = 1 ORDER BY name ASC`
    );
    res.json({ dress_types: dressTypes });
  } catch (err) {
    console.error('Error fetching dress types:', err);
    res.status(500).json({ error: 'Failed to fetch dress types' });
  }
});

// POST /api/tailors/dress-types (Owner adds new custom dress type)
router.post('/dress-types', authenticateToken, requireRole('OWNER'), (req, res) => {
  try {
    const { name, default_rate = 50, category = 'General' } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Dress type name is required.' });
    }

    const cleanName = name.trim();
    const existing = get('SELECT id FROM dress_types WHERE LOWER(name) = LOWER(?)', [cleanName]);
    if (existing) {
      return res.status(400).json({ error: `Dress type "${cleanName}" already exists.` });
    }

    const id = `dt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const rate = Math.max(0, Number(default_rate) || 50);

    run(
      `INSERT INTO dress_types (id, name, default_rate, category, is_active)
       VALUES (?, ?, ?, ?, 1)`,
      [id, cleanName, rate, category]
    );

    res.status(201).json({
      success: true,
      message: `Dress type "${cleanName}" created successfully.`,
      dress_type: { id, name: cleanName, default_rate: rate, category, is_active: 1 },
    });
  } catch (err) {
    console.error('Error creating dress type:', err);
    res.status(500).json({ error: err.message || 'Failed to create dress type' });
  }
});

// =========================================================================
// 2. STITCHING RETURNS & HISTORY (MODULE 3.C & 3.G - Permanent Return Logs)
// =========================================================================

// GET /api/tailors/returns/history (Permanent transaction history of completed returns)
router.get('/returns/history', authenticateToken, (req, res) => {
  try {
    const { tailor_id, dress_type, start_date, end_date, assignment_id } = req.query;

    let effectiveTailorId = tailor_id;
    // STRICT TAILOR PRIVACY: Tailor can only see their own returns!
    if (req.user.role === 'TAILOR') {
      effectiveTailorId = req.user.tailor_id;
    }

    let sql = `
      SELECT sr.*,
             t.name as tailor_name,
             t.tailor_code,
             two.order_number,
             two.given_qty as original_assigned_qty,
             two.stitched_qty as current_total_completed,
             (two.given_qty - two.stitched_qty) as current_remaining_qty,
             u.name as recorded_by_name
      FROM stitching_returns sr
      JOIN tailors t ON sr.tailor_id = t.id
      JOIN tailor_work_orders two ON sr.assignment_id = two.id
      LEFT JOIN users u ON sr.recorded_by = u.id
      WHERE 1=1
    `;
    const params = [];

    if (effectiveTailorId && effectiveTailorId !== 'all') {
      sql += ` AND sr.tailor_id = ?`;
      params.push(effectiveTailorId);
    }

    if (dress_type && dress_type !== 'all') {
      sql += ` AND sr.dress_type = ?`;
      params.push(dress_type);
    }

    if (assignment_id) {
      sql += ` AND sr.assignment_id = ?`;
      params.push(assignment_id);
    }

    if (start_date && end_date) {
      sql += ` AND date(sr.return_date) BETWEEN date(?) AND date(?)`;
      params.push(start_date, end_date);
    } else if (start_date) {
      sql += ` AND date(sr.return_date) >= date(?)`;
      params.push(start_date);
    }

    sql += ` ORDER BY sr.return_date DESC, sr.created_at DESC`;

    const returns = query(sql, params);
    const totalReturnedPieces = returns.reduce((sum, r) => sum + (Number(r.completed_qty) || 0), 0);
    const totalEarnedAmount = returns.reduce((sum, r) => sum + (Number(r.earned_amount) || 0), 0);

    res.json({
      returns,
      summary: {
        total_records: returns.length,
        total_returned_pieces: totalReturnedPieces,
        total_earned_amount: totalEarnedAmount,
      },
    });
  } catch (err) {
    console.error('Error fetching returns history:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch returns history' });
  }
});

// POST /api/tailors/work-orders/return (Record completed work & auto-update remaining - ONLY OWNER)
// Validation: completed quantity cannot exceed remaining, non-negative, permanent transaction history
router.post('/work-orders/return', authenticateToken, requireRole('OWNER'), (req, res) => {
  try {
    const {
      assignment_id,
      completed_qty,
      return_date = new Date().toISOString().split('T')[0],
      notes = '',
    } = req.body;

    if (!assignment_id) {
      return res.status(400).json({ error: 'Stitching assignment selection is required.' });
    }

    const returnQty = parseInt(completed_qty, 10);
    if (isNaN(returnQty) || returnQty <= 0) {
      return res.status(400).json({ error: 'Completed quantity must be a positive integer.' });
    }

    // 1. Fetch assignment and lock details
    const assignment = get(
      `SELECT two.*, t.name as tailor_name, t.tailor_code
       FROM tailor_work_orders two
       JOIN tailors t ON two.tailor_id = t.id
       WHERE two.id = ?`,
      [assignment_id]
    );

    if (!assignment) {
      return res.status(404).json({ error: 'Stitching work assignment not found.' });
    }

    const currentRemaining = assignment.given_qty - assignment.stitched_qty;
    if (currentRemaining <= 0) {
      return res.status(400).json({
        error: `Assignment ${assignment.order_number} (${assignment.item_type}) is already 100% completed. Remaining quantity is 0.`,
      });
    }

    if (returnQty > currentRemaining) {
      return res.status(400).json({
        error: `Completed quantity (${returnQty}) cannot exceed remaining pending quantity (${currentRemaining}).`,
      });
    }

    const retId = `ret_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const returnNumber = `RET-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`;
    const ratePerPiece = Number(assignment.rate_per_piece) || 0;
    const earnedAmount = returnQty * ratePerPiece;
    const newStitchedQty = assignment.stitched_qty + returnQty;
    const newRemaining = assignment.given_qty - newStitchedQty;
    const newStatus = newRemaining === 0 ? 'completed' : 'in_progress';

    transaction(() => {
      // A. Insert permanent return transaction
      run(
        `INSERT INTO stitching_returns (
          id, return_number, assignment_id, tailor_id, dress_type, completed_qty,
          rate_per_piece, earned_amount, return_date, notes, recorded_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          retId,
          returnNumber,
          assignment.id,
          assignment.tailor_id,
          assignment.item_type,
          returnQty,
          ratePerPiece,
          earnedAmount,
          return_date,
          notes,
          req.user.id,
        ]
      );

      // B. Update work assignment totals and status
      run(
        `UPDATE tailor_work_orders SET
          stitched_qty = ?,
          status = ?,
          updated_at = datetime('now')
         WHERE id = ?`,
        [newStitchedQty, newStatus, assignment.id]
      );

      // C. Also credit tailor salary balance for this month
      const monthStart = `${return_date.substring(0, 7)}-01`;
      const monthEnd = `${return_date.substring(0, 7)}-31`;
      let currentSal = get(
        "SELECT * FROM tailor_salaries WHERE tailor_id = ? AND period_start = ?",
        [assignment.tailor_id, monthStart]
      );

      if (currentSal) {
        const newEarned = currentSal.earned_amount + earnedAmount;
        const newNet = newEarned - currentSal.advance_deductions;
        const newPending = newNet - currentSal.paid_amount;
        const status = newPending <= 0 ? 'paid' : (currentSal.paid_amount > 0 ? 'partial' : 'pending');

        run(
          `UPDATE tailor_salaries SET
            total_pieces = total_pieces + ?,
            earned_amount = ?,
            net_salary = ?,
            pending_amount = ?,
            status = ?
           WHERE id = ?`,
          [returnQty, newEarned, newNet, newPending, status, currentSal.id]
        );
      } else {
        const salId = `sal_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`;
        run(
          `INSERT INTO tailor_salaries (
            id, tailor_id, period_start, period_end, salary_type, total_pieces,
            earned_amount, advance_deductions, net_salary, paid_amount, pending_amount, status
          ) VALUES (?, ?, ?, ?, 'per_piece', ?, ?, 0, ?, 0, ?, 'pending')`,
          [salId, assignment.tailor_id, monthStart, monthEnd, returnQty, earnedAmount, earnedAmount, earnedAmount]
        );
      }

      // D. Audit log
      run(
        `INSERT INTO audit_logs (id, actor_id, actor_name, action, module, record_id, shop_id, details)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          `audit_${Date.now()}`,
          req.user.id,
          req.user.name,
          'RECORD_STITCHING_RETURN',
          'tailors',
          retId,
          assignment.shop_id,
          `Recorded ${returnQty} completed ${assignment.item_type} from ${assignment.tailor_name} (${assignment.order_number}). Remaining: ${newRemaining}`,
        ]
      );
    });

    res.status(201).json({
      success: true,
      message: `Successfully recorded return of ${returnQty} ${assignment.item_type}. Remaining pending: ${newRemaining}.`,
      return_id: retId,
      return_number: returnNumber,
      assignment_id: assignment.id,
      tailor_name: assignment.tailor_name,
      dress_type: assignment.item_type,
      completed_qty: returnQty,
      originally_assigned: assignment.given_qty,
      total_completed: newStitchedQty,
      remaining_qty: newRemaining,
      status: newStatus,
      earned_amount: earnedAmount,
    });
  } catch (err) {
    console.error('Error recording return:', err);
    res.status(500).json({ error: err.message || 'Failed to record return' });
  }
});

// =========================================================================
// 3. WORK ORDERS / ASSIGNMENTS (MODULE 3.B - Assign Stitching Work)
// =========================================================================

// GET /api/tailors/work-orders/list (Tailor sees ONLY their own; Owner sees all)
router.get('/work-orders/list', authenticateToken, (req, res) => {
  const { tailor_id, status, item_type } = req.query;

  let sql = `
    SELECT two.*,
           (two.given_qty - two.stitched_qty) AS balance_qty,
           (two.stitched_qty * two.rate_per_piece) AS earned_amount,
           (two.given_qty * two.rate_per_piece) AS total_assigned_amount,
           t.name AS tailor_name,
           t.tailor_code,
           u.name AS assigned_by_name
    FROM tailor_work_orders two
    JOIN tailors t ON two.tailor_id = t.id
    LEFT JOIN users u ON two.assigned_by = u.id
    WHERE 1=1
  `;
  const params = [];

  // Strict Tailor Privacy: Tailors can ONLY view their own assigned work
  if (req.user.role === 'TAILOR') {
    sql += ` AND two.tailor_id = ?`;
    params.push(req.user.tailor_id);
  } else if (tailor_id && tailor_id !== 'all') {
    sql += ` AND two.tailor_id = ?`;
    params.push(tailor_id);
  }

  if (status && status !== 'all') {
    sql += ` AND two.status = ?`;
    params.push(status);
  }

  if (item_type && item_type !== 'all') {
    sql += ` AND two.item_type = ?`;
    params.push(item_type);
  }

  sql += ` ORDER BY two.created_at DESC`;

  const workOrders = query(sql, params);

  // Compute summary totals
  const totalGiven = workOrders.reduce((sum, wo) => sum + (Number(wo.given_qty) || 0), 0);
  const totalStitched = workOrders.reduce((sum, wo) => sum + (Number(wo.stitched_qty) || 0), 0);
  const totalBalance = workOrders.reduce((sum, wo) => sum + (Number(wo.balance_qty) || 0), 0);
  const totalEarned = workOrders.reduce((sum, wo) => sum + (Number(wo.earned_amount) || 0), 0);

  res.json({
    work_orders: workOrders,
    summary: {
      total_given: totalGiven,
      total_stitched: totalStitched,
      total_balance: totalBalance,
      total_earned: totalEarned,
      active_jobs: workOrders.filter(w => w.status === 'in_progress').length,
      completed_jobs: workOrders.filter(w => w.status === 'completed').length,
    },
  });
});

// POST /api/tailors/work-orders (Owner gives items to tailor - ONLY OWNER CAN CREATE)
router.post('/work-orders', authenticateToken, requireRole('OWNER'), (req, res) => {
  try {
    const {
      tailor_id,
      shop_id = 'shop_retail',
      item_type = 'Shirts',
      given_qty,
      stitched_qty = 0,
      rate_per_piece = 50,
      due_date,
      notes = '',
    } = req.body;

    if (!tailor_id) {
      return res.status(400).json({ error: 'Tailor selection is required.' });
    }

    if (!given_qty || Number(given_qty) <= 0) {
      return res.status(400).json({ error: 'Given items quantity must be greater than zero.' });
    }

    const orderId = `two_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const orderNumber = generateWorkOrderNumber();
    const gQty = Number(given_qty);
    const sQty = Number(stitched_qty) || 0;
    const rate = Number(rate_per_piece) || 50;
    const status = sQty >= gQty ? 'completed' : 'in_progress';

    transaction(() => {
      run(
        `INSERT INTO tailor_work_orders (
          id, order_number, tailor_id, shop_id, item_type, given_qty, stitched_qty,
          rate_per_piece, due_date, status, notes, assigned_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          orderId,
          orderNumber,
          tailor_id,
          shop_id,
          item_type,
          gQty,
          sQty,
          rate,
          due_date || null,
          status,
          notes,
          req.user.id,
        ]
      );

      // Audit Log
      run(
        `INSERT INTO audit_logs (id, actor_id, actor_name, action, module, record_id, shop_id, details) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          `audit_${Date.now()}`,
          req.user.id,
          req.user.name,
          'ASSIGN_TAILOR_WORK',
          'tailors',
          orderId,
          shop_id,
          `Assigned ${gQty} ${item_type} to tailor ${tailor_id} (${orderNumber}) @ ₹${rate}/pc`,
        ]
      );
    });

    res.status(201).json({
      success: true,
      message: `Successfully assigned ${gQty} ${item_type} to tailor.`,
      order_id: orderId,
      order_number: orderNumber,
      total_amount: gQty * rate,
    });
  } catch (err) {
    console.error('Error creating work order:', err);
    res.status(500).json({ error: err.message || 'Failed to create work order' });
  }
});

// PUT /api/tailors/work-orders/:id (Owner updates given or stitched pieces - ONLY OWNER CAN EDIT)
router.put('/work-orders/:id', authenticateToken, requireRole('OWNER'), (req, res) => {
  try {
    const { id } = req.params;
    const { given_qty, stitched_qty, rate_per_piece, status, due_date, notes } = req.body;

    const existing = get('SELECT * FROM tailor_work_orders WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'Work order not found.' });
    }

    const newGiven = given_qty !== undefined ? Number(given_qty) : existing.given_qty;
    const newStitched = stitched_qty !== undefined ? Number(stitched_qty) : existing.stitched_qty;
    const newRate = rate_per_piece !== undefined ? Number(rate_per_piece) : existing.rate_per_piece;
    const newNotes = notes !== undefined ? notes : existing.notes;
    const newDueDate = due_date !== undefined ? due_date : existing.due_date;

    let newStatus = status || existing.status;
    if (newStitched >= newGiven) {
      newStatus = 'completed';
    } else if (newStatus === 'completed' && newStitched < newGiven) {
      newStatus = 'in_progress';
    }

    run(
      `UPDATE tailor_work_orders SET
        given_qty = ?,
        stitched_qty = ?,
        rate_per_piece = ?,
        status = ?,
        due_date = ?,
        notes = ?,
        updated_at = datetime('now')
      WHERE id = ?`,
      [newGiven, newStitched, newRate, newStatus, newDueDate, newNotes, id]
    );

    const balance = Math.max(0, newGiven - newStitched);

    // Audit Log
    run(
      `INSERT INTO audit_logs (id, actor_id, actor_name, action, module, record_id, shop_id, details) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        `audit_${Date.now()}`,
        req.user.id,
        req.user.name,
        'UPDATE_TAILOR_WORK',
        'tailors',
        id,
        existing.shop_id,
        `Updated work order ${existing.order_number}: Given=${newGiven}, Stitched=${newStitched}, Balance=${balance}`,
      ]
    );

    res.json({
      success: true,
      message: `Work order updated successfully. Balance remaining: ${balance}`,
      order: {
        id,
        given_qty: newGiven,
        stitched_qty: newStitched,
        balance_qty: balance,
        status: newStatus,
      },
    });
  } catch (err) {
    console.error('Error updating work order:', err);
    res.status(500).json({ error: err.message || 'Failed to update work order' });
  }
});

// DELETE /api/tailors/work-orders/:id (Owner deletes work order - ONLY OWNER)
router.delete('/work-orders/:id', authenticateToken, requireRole('OWNER'), (req, res) => {
  try {
    const { id } = req.params;
    const existing = get('SELECT * FROM tailor_work_orders WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'Work order not found.' });
    }

    run('DELETE FROM tailor_work_orders WHERE id = ?', [id]);

    run(
      `INSERT INTO audit_logs (id, actor_id, actor_name, action, module, record_id, shop_id, details) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        `audit_${Date.now()}`,
        req.user.id,
        req.user.name,
        'DELETE_TAILOR_WORK',
        'tailors',
        id,
        existing.shop_id,
        `Deleted work order ${existing.order_number}`,
      ]
    );

    res.json({ success: true, message: 'Work order deleted successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to delete work order' });
  }
});

// =========================================================================
// 4. PRODUCTION & ATTENDANCE (Existing Working Features Preserved)
// =========================================================================

// GET /api/tailors/production/list (List production records with STRICT PRIVACY)
router.get('/production/list', authenticateToken, (req, res) => {
  const { tailor_id, date, start_date, end_date, shop_id } = req.query;

  let effectiveTailorId = tailor_id;
  if (req.user.role === 'TAILOR') {
    effectiveTailorId = req.user.tailor_id;
  }

  let sql = `
    SELECT tp.*, t.name as tailor_name, t.tailor_code, s.name as shop_name, u.name as created_by_name
    FROM tailor_production tp
    JOIN tailors t ON tp.tailor_id = t.id
    LEFT JOIN shops s ON tp.shop_id = s.id
    LEFT JOIN users u ON tp.created_by = u.id
    WHERE 1=1
  `;
  const params = [];

  if (effectiveTailorId) {
    sql += ` AND tp.tailor_id = ?`;
    params.push(effectiveTailorId);
  }

  if (date) {
    sql += ` AND date(tp.date) = date(?)`;
    params.push(date);
  } else if (start_date && end_date) {
    sql += ` AND date(tp.date) BETWEEN date(?) AND date(?)`;
    params.push(start_date, end_date);
  }

  if (shop_id && shop_id !== 'all') {
    sql += ` AND tp.shop_id = ?`;
    params.push(shop_id);
  }

  sql += ` ORDER BY tp.date DESC, tp.created_at DESC`;

  const records = query(sql, params);
  res.json({ production: records });
});

// POST /api/tailors/production/record (Record daily production)
router.post('/production/record', authenticateToken, (req, res) => {
  try {
    let {
      tailor_id,
      date = new Date().toISOString().split('T')[0],
      shop_id = 'shop_retail',
      shirts_qty = 0,
      pants_qty = 0,
      blouses_qty = 0,
      others_qty = 0,
      notes = '',
    } = req.body;

    if (req.user.role === 'TAILOR') {
      tailor_id = req.user.tailor_id;
    }

    if (!tailor_id) {
      return res.status(400).json({ error: 'Tailor ID is required.' });
    }

    const tailor = get('SELECT * FROM tailors WHERE id = ?', [tailor_id]);
    if (!tailor) {
      return res.status(404).json({ error: 'Tailor not found.' });
    }

    const sQty = Math.max(0, parseInt(shirts_qty, 10) || 0);
    const pQty = Math.max(0, parseInt(pants_qty, 10) || 0);
    const bQty = Math.max(0, parseInt(blouses_qty, 10) || 0);
    const oQty = Math.max(0, parseInt(others_qty, 10) || 0);
    const totalPieces = sQty + pQty + bQty + oQty;

    if (totalPieces <= 0) {
      return res.status(400).json({ error: 'Please enter at least 1 produced piece.' });
    }

    const shirtEarned = sQty * (tailor.shirt_rate || 50);
    const pantEarned = pQty * (tailor.pant_rate || 70);
    const blouseEarned = bQty * (tailor.blouse_rate || 60);
    const otherEarned = oQty * (tailor.other_rate || 40);
    const totalEarned = shirtEarned + pantEarned + blouseEarned + otherEarned;

    const prodId = `prod_rec_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    const result = transaction(() => {
      run(
        `INSERT INTO tailor_production (
          id, tailor_id, date, shop_id, shirts_qty, pants_qty, blouses_qty, others_qty,
          total_pieces, earned_amount, notes, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          prodId,
          tailor.id,
          date,
          shop_id,
          sQty,
          pQty,
          bQty,
          oQty,
          totalPieces,
          totalEarned,
          notes,
          req.user.id,
        ]
      );

      const monthStart = `${date.substring(0, 7)}-01`;
      const monthEnd = `${date.substring(0, 7)}-31`;

      let currentSal = get(
        "SELECT * FROM tailor_salaries WHERE tailor_id = ? AND period_start = ?",
        [tailor.id, monthStart]
      );

      if (currentSal) {
        const newEarned = currentSal.earned_amount + totalEarned;
        const newNet = newEarned - currentSal.advance_deductions;
        const newPending = newNet - currentSal.paid_amount;
        const newStatus = newPending <= 0 ? 'paid' : (currentSal.paid_amount > 0 ? 'partial' : 'pending');

        run(
          `UPDATE tailor_salaries SET
            total_pieces = total_pieces + ?,
            earned_amount = ?,
            net_salary = ?,
            pending_amount = ?,
            status = ?
           WHERE id = ?`,
          [totalPieces, newEarned, newNet, newPending, newStatus, currentSal.id]
        );
      } else {
        const salId = `sal_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`;
        run(
          `INSERT INTO tailor_salaries (
            id, tailor_id, period_start, period_end, salary_type, total_pieces,
            earned_amount, advance_deductions, net_salary, paid_amount, pending_amount, status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, 0, ?, 'pending')`,
          [
            salId,
            tailor.id,
            monthStart,
            monthEnd,
            tailor.salary_type,
            totalPieces,
            totalEarned,
            totalEarned,
            totalEarned,
          ]
        );
      }

      run(
        `INSERT INTO audit_logs (id, actor_id, actor_name, action, module, record_id, shop_id, details) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          `audit_${Date.now()}`,
          req.user.id,
          req.user.name,
          'RECORD_PRODUCTION',
          'tailors',
          prodId,
          shop_id,
          `Recorded production for ${tailor.name}: ${sQty} Shirts, ${pQty} Pants, ${bQty} Blouses (Total: ${totalPieces} pcs, Earned: ₹${totalEarned})`,
        ]
      );

      return {
        tailor_name: tailor.name,
        total_pieces: totalPieces,
        earned_amount: totalEarned,
        breakdown: {
          shirts: { qty: sQty, rate: tailor.shirt_rate, total: shirtEarned },
          pants: { qty: pQty, rate: tailor.pant_rate, total: pantEarned },
          blouses: { qty: bQty, rate: tailor.blouse_rate, total: blouseEarned },
          others: { qty: oQty, rate: tailor.other_rate, total: otherEarned },
        },
      };
    });

    res.status(201).json({
      success: true,
      message: 'Production recorded and salary credited successfully.',
      ...result,
    });
  } catch (err) {
    console.error('Error recording production:', err);
    res.status(500).json({ error: err.message || 'Failed to record production' });
  }
});

// GET /api/tailors/attendance/list (Attendance with STRICT PRIVACY)
router.get('/attendance/list', authenticateToken, (req, res) => {
  const { tailor_id, date, month, shop_id } = req.query;

  let effectiveTailorId = tailor_id;
  if (req.user.role === 'TAILOR') {
    effectiveTailorId = req.user.tailor_id;
  }

  let sql = `
    SELECT ta.*, t.name as tailor_name, t.tailor_code, u.name as marked_by_name
    FROM tailor_attendance ta
    JOIN tailors t ON ta.tailor_id = t.id
    LEFT JOIN users u ON ta.marked_by = u.id
    WHERE 1=1
  `;
  const params = [];

  if (effectiveTailorId) {
    sql += ` AND ta.tailor_id = ?`;
    params.push(effectiveTailorId);
  }

  if (date) {
    sql += ` AND date(ta.date) = date(?)`;
    params.push(date);
  } else if (month) {
    sql += ` AND ta.date LIKE ?`;
    params.push(`${month}%`);
  }

  sql += ` ORDER BY ta.date DESC, t.tailor_code ASC`;

  const attendance = query(sql, params);
  res.json({ attendance });
});

// POST /api/tailors/attendance/mark (Mark attendance)
router.post('/attendance/mark', authenticateToken, (req, res) => {
  try {
    let { tailor_id, date = new Date().toISOString().split('T')[0], status = 'present', notes = '', shop_id = 'retail' } = req.body;

    if (req.user.role === 'TAILOR') {
      tailor_id = req.user.tailor_id;
    }

    if (!tailor_id) return res.status(400).json({ error: 'Tailor ID required' });

    const existing = get('SELECT id FROM tailor_attendance WHERE tailor_id = ? AND date = ?', [tailor_id, date]);

    if (existing) {
      run('UPDATE tailor_attendance SET status = ?, notes = ?, marked_by = ? WHERE id = ?', [
        status,
        notes,
        req.user.id,
        existing.id,
      ]);
    } else {
      run(
        `INSERT INTO tailor_attendance (id, tailor_id, date, shop_id, status, notes, marked_by)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [`att_${Date.now()}`, tailor_id, date, shop_id, status, notes, req.user.id]
      );
    }

    res.json({ success: true, message: `Attendance marked as ${status.toUpperCase()} for ${date}` });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to mark attendance' });
  }
});

// =========================================================================
// 5. SALARY & PAYMENTS
// =========================================================================

// GET /api/tailors/salary/dashboard (Salary Overview & History with STRICT PRIVACY)
router.get('/salary/dashboard', authenticateToken, (req, res) => {
  let effectiveTailorId = req.query.tailor_id;
  if (req.user.role === 'TAILOR') {
    effectiveTailorId = req.user.tailor_id;
  }

  let sql = `
    SELECT ts.*, t.name as tailor_name, t.tailor_code, t.salary_type, t.phone as tailor_phone
    FROM tailor_salaries ts
    JOIN tailors t ON ts.tailor_id = t.id
    WHERE 1=1
  `;
  const params = [];

  if (effectiveTailorId) {
    sql += ` AND ts.tailor_id = ?`;
    params.push(effectiveTailorId);
  }

  sql += ` ORDER BY ts.period_start DESC`;

  const salaries = query(sql, params);

  let totalDue = salaries.reduce((acc, s) => acc + s.net_salary, 0);
  let totalPaid = salaries.reduce((acc, s) => acc + s.paid_amount, 0);
  let totalPending = salaries.reduce((acc, s) => acc + s.pending_amount, 0);

  let paySql = `
    SELECT tsp.*, t.name as tailor_name, t.tailor_code, u.name as recorded_by_name
    FROM tailor_salary_payments tsp
    JOIN tailors t ON tsp.tailor_id = t.id
    LEFT JOIN users u ON tsp.recorded_by = u.id
    WHERE 1=1
  `;
  const payParams = [];
  if (effectiveTailorId) {
    paySql += ` AND tsp.tailor_id = ?`;
    payParams.push(effectiveTailorId);
  }
  paySql += ` ORDER BY tsp.payment_date DESC LIMIT 50`;

  const payments = query(paySql, payParams);

  res.json({
    summary: { totalDue, totalPaid, totalPending },
    salaries,
    payments,
  });
});

// POST /api/tailors/salary/payment (Record salary payment or advance - Owner only)
router.post('/salary/payment', authenticateToken, requireRole('OWNER'), (req, res) => {
  try {
    const { tailor_id, salary_id, payment_type = 'salary', amount, payment_method = 'cash', notes = '' } = req.body;

    if (!tailor_id || !amount || Number(amount) <= 0) {
      return res.status(400).json({ error: 'Tailor and valid payment amount are required.' });
    }

    const payAmt = Number(amount);

    transaction(() => {
      const payId = `sal_pay_${Date.now()}`;
      run(
        `INSERT INTO tailor_salary_payments (id, tailor_id, salary_id, payment_type, amount, payment_method, notes, recorded_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [payId, tailor_id, salary_id || null, payment_type, payAmt, payment_method, notes, req.user.id]
      );

      if (salary_id) {
        const sal = get('SELECT * FROM tailor_salaries WHERE id = ?', [salary_id]);
        if (sal) {
          const newPaid = sal.paid_amount + payAmt;
          const newPending = Math.max(0, sal.net_salary - newPaid);
          const newStatus = newPending === 0 ? 'paid' : 'partial';

          run(
            'UPDATE tailor_salaries SET paid_amount = ?, pending_amount = ?, status = ? WHERE id = ?',
            [newPaid, newPending, newStatus, sal.id]
          );
        }
      }

      run(
        `INSERT INTO expenses (id, date, category, amount, shop_id, description, payment_method, created_by)
         VALUES (?, date('now'), 'Tailor Salary', ?, 'shop_retail', ?, ?, ?)`,
        [`exp_${Date.now()}`, payAmt, `Tailor salary payment to ${tailor_id} (${payment_type})`, payment_method, req.user.id]
      );

      run(
        `INSERT INTO audit_logs (id, actor_id, actor_name, action, module, record_id, shop_id, details) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [`audit_${Date.now()}`, req.user.id, req.user.name, 'TAILOR_SALARY_PAYMENT', 'tailors', payId, 'all', `Paid ₹${payAmt} to tailor ${tailor_id} (${payment_type}) via ${payment_method}`]
      );
    });

    res.json({ success: true, message: `Recorded payment of ₹${payAmt} successfully.` });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to record salary payment' });
  }
});

// =========================================================================
// 6. TAILOR LIST & PROFILE (MODULE 3.A, 3.D, 3.E, 3.F - Strict Privacy)
// =========================================================================

// GET /api/tailors (Owner lists all tailors; Tailor gets only their own profile)
router.get('/', authenticateToken, (req, res) => {
  if (req.user.role === 'TAILOR') {
    const myProfile = query(
      `SELECT t.*, u.user_id, u.email, u.name as user_name
       FROM tailors t
       JOIN users u ON t.linked_user_id = u.id
       WHERE t.id = ?`,
      [req.user.tailor_id]
    );
    return res.json({ tailors: myProfile });
  }

  // Owner or authorized employee
  const { shop_id, status } = req.query;
  let sql = `
    SELECT t.*, u.user_id as login_user_id, u.email, u.is_active as user_active,
           COALESCE(SUM(two.given_qty), 0) as total_work_assigned,
           COALESCE(SUM(two.stitched_qty), 0) as total_work_completed,
           COALESCE(SUM(two.given_qty - two.stitched_qty), 0) as total_work_pending,
           COUNT(DISTINCT two.id) as total_orders_count
    FROM tailors t
    LEFT JOIN users u ON t.linked_user_id = u.id
    LEFT JOIN tailor_work_orders two ON t.id = two.tailor_id
    WHERE 1=1
  `;
  const params = [];

  if (shop_id && shop_id !== 'all') {
    sql += ` AND t.assigned_shop = ?`;
    params.push(shop_id);
  }

  if (status && status !== 'all') {
    sql += ` AND t.account_status = ?`;
    params.push(status);
  }

  sql += ` GROUP BY t.id ORDER BY t.tailor_code ASC`;

  const tailors = query(sql, params);
  res.json({ tailors });
});

// POST /api/tailors (Create new tailor profile & user account - Owner only)
router.post('/', authenticateToken, requireRole('OWNER'), (req, res) => {
  try {
    const {
      name,
      phone,
      assigned_shop = 'retail',
      salary_type = 'per_piece',
      monthly_rate = 0,
      daily_rate = 0,
      shirt_rate = 50,
      pant_rate = 70,
      blouse_rate = 60,
      other_rate = 40,
      login_user_id,
      password,
    } = req.body;

    if (!name || !phone) {
      return res.status(400).json({ error: 'Name and phone are required.' });
    }

    const countRow = get('SELECT COUNT(*) as count FROM tailors');
    const nextNum = (countRow?.count || 0) + 1;
    const tailorCode = login_user_id ? login_user_id.trim().toUpperCase() : `TAILOR${String(nextNum).padStart(3, '0')}`;

    const exists = get('SELECT id FROM tailors WHERE tailor_code = ?', [tailorCode]);
    if (exists) {
      return res.status(400).json({ error: `Tailor code '${tailorCode}' is already registered.` });
    }

    const tailorId = `tailor_${Date.now()}`;
    const userId = `user_tailor_${Date.now()}`;
    const email = `${tailorCode.toLowerCase()}@smartdress.com`;
    const pwd = password || 'Tailor@123';
    const pwdHash = bcrypt.hashSync(pwd, 10);

    transaction(() => {
      // 1. Create user account
      run(
        `INSERT INTO users (id, user_id, email, password_hash, name, role, phone, assigned_shop, is_active)
         VALUES (?, ?, ?, ?, ?, 'TAILOR', ?, ?, 1)`,
        [userId, tailorCode, email, pwdHash, name, phone, assigned_shop]
      );

      // 2. Grant tailor permissions
      run(
        `INSERT INTO user_permissions (user_id, can_billing, can_credit, can_inventory, can_stock_transfer, can_tailors, can_salary, can_expenses, can_suppliers, can_reports, can_profit_view, can_settings, can_users)
         VALUES (?, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0)`,
        [userId]
      );

      // 3. Create tailor profile linked to user account
      run(
        `INSERT INTO tailors (
          id, tailor_code, name, phone, joining_date, assigned_shop, salary_type,
          monthly_rate, daily_rate, shirt_rate, pant_rate, blouse_rate, other_rate,
          account_status, linked_user_id
        ) VALUES (?, ?, ?, ?, date('now'), ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)`,
        [
          tailorId,
          tailorCode,
          name,
          phone,
          assigned_shop,
          salary_type,
          Number(monthly_rate),
          Number(daily_rate),
          Number(shirt_rate),
          Number(pant_rate),
          Number(blouse_rate),
          Number(other_rate),
          userId,
        ]
      );

      // Audit Log
      run(
        `INSERT INTO audit_logs (id, actor_id, actor_name, action, module, record_id, shop_id, details) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [`audit_${Date.now()}`, req.user.id, req.user.name, 'CREATE_TAILOR', 'tailors', tailorId, assigned_shop, `Created tailor ${name} (${tailorCode})`]
      );
    });

    res.status(201).json({
      success: true,
      message: `Tailor ${name} created with login ID: ${tailorCode}`,
      tailor_code: tailorCode,
      tailor_id: tailorId,
    });
  } catch (err) {
    console.error('Error creating tailor:', err);
    res.status(500).json({ error: err.message || 'Failed to create tailor' });
  }
});

// GET /api/tailors/:tailorId/profile (Comprehensive Individual Tailor Profile with MODULE 3.E requirements)
router.get('/:tailorId/profile', authenticateToken, (req, res) => {
  try {
    const { tailorId } = req.params;
    const { time_range = 'all', start_date, end_date, dress_type = 'all' } = req.query;

    // STRICT TAILOR PRIVACY: Tailor cannot open another tailor's profile!
    if (req.user.role === 'TAILOR' && req.user.tailor_id !== tailorId) {
      return res.status(403).json({
        error: 'Access denied: Strict Tailor Privacy policy prevents viewing other tailor profiles.',
      });
    }

    const tailor = get(
      `SELECT t.*, u.user_id as login_user_id, u.email, u.is_active as user_active
       FROM tailors t
       LEFT JOIN users u ON t.linked_user_id = u.id
       WHERE t.id = ? OR t.tailor_code = ?`,
      [tailorId, tailorId]
    );

    if (!tailor) {
      return res.status(404).json({ error: 'Tailor profile not found' });
    }

    // Date filtering clause
    let dateClause = '';
    const dateParams = [tailor.id];

    if (time_range === 'today') {
      dateClause = " AND date(created_at) = date('now')";
    } else if (time_range === 'this_week') {
      dateClause = " AND date(created_at) >= date('now', '-6 days')";
    } else if (time_range === 'this_month') {
      dateClause = " AND date(created_at) >= date('now', 'start of month')";
    } else if (time_range === 'custom' && start_date && end_date) {
      dateClause = " AND date(created_at) BETWEEN date(?) AND date(?)";
      dateParams.push(start_date, end_date);
    }

    let dressTypeClause = '';
    if (dress_type && dress_type !== 'all') {
      dressTypeClause = ' AND item_type = ?';
      dateParams.push(dress_type);
    }

    // 1. Overall Stitching Assignments KPI Summary
    const kpiSummary = get(
      `SELECT
         COUNT(*) as total_assignments,
         COALESCE(SUM(given_qty), 0) as total_assigned,
         COALESCE(SUM(stitched_qty), 0) as total_completed,
         COALESCE(SUM(given_qty - stitched_qty), 0) as total_pending,
         COALESCE(SUM(stitched_qty * rate_per_piece), 0) as total_earned,
         COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as active_jobs_count,
         COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_jobs_count
       FROM tailor_work_orders
       WHERE tailor_id = ? ${dateClause} ${dressTypeClause}`,
      dateParams
    );

    // 2. Dress-type-wise breakdown (Skirts, Palazzo Pants, Blouses, Chudithars, etc.)
    // Independent quantities per dress type as strictly demanded by user prompt
    const dressTypeBreakdown = query(
      `SELECT
         item_type as dress_type,
         COUNT(*) as order_count,
         COALESCE(SUM(given_qty), 0) as assigned_qty,
         COALESCE(SUM(stitched_qty), 0) as completed_qty,
         COALESCE(SUM(given_qty - stitched_qty), 0) as pending_qty,
         COALESCE(SUM(stitched_qty * rate_per_piece), 0) as earned_amount,
         COALESCE(AVG(rate_per_piece), 0) as avg_rate
       FROM tailor_work_orders
       WHERE tailor_id = ? ${dateClause}
       GROUP BY item_type
       ORDER BY assigned_qty DESC`,
      [tailor.id, ...(dateClause.includes('BETWEEN') ? [start_date, end_date] : [])]
    );

    // 3. Date-wise Assignment History
    const assignmentHistory = query(
      `SELECT two.*,
              (two.given_qty - two.stitched_qty) as remaining_qty,
              (two.stitched_qty * two.rate_per_piece) as current_earned,
              (two.given_qty * two.rate_per_piece) as total_expected_amount,
              u.name as assigned_by_name
       FROM tailor_work_orders two
       LEFT JOIN users u ON two.assigned_by = u.id
       WHERE two.tailor_id = ? ${dateClause} ${dressTypeClause}
       ORDER BY two.created_at DESC`,
      dateParams
    );

    // 4. Date-wise Completed Work History (from permanent stitching_returns table)
    let retDateClause = '';
    const retParams = [tailor.id];
    if (time_range === 'today') {
      retDateClause = " AND date(sr.return_date) = date('now')";
    } else if (time_range === 'this_week') {
      retDateClause = " AND date(sr.return_date) >= date('now', '-6 days')";
    } else if (time_range === 'this_month') {
      retDateClause = " AND date(sr.return_date) >= date('now', 'start of month')";
    } else if (time_range === 'custom' && start_date && end_date) {
      retDateClause = " AND date(sr.return_date) BETWEEN date(?) AND date(?)";
      retParams.push(start_date, end_date);
    }
    if (dress_type && dress_type !== 'all') {
      retDateClause += ' AND sr.dress_type = ?';
      retParams.push(dress_type);
    }

    const returnHistory = query(
      `SELECT sr.*,
              two.order_number,
              two.given_qty as original_given_qty,
              two.stitched_qty as current_total_stitched,
              (two.given_qty - two.stitched_qty) as current_assignment_remaining,
              u.name as recorded_by_name
       FROM stitching_returns sr
       JOIN tailor_work_orders two ON sr.assignment_id = two.id
       LEFT JOIN users u ON sr.recorded_by = u.id
       WHERE sr.tailor_id = ? ${retDateClause}
       ORDER BY sr.return_date DESC, sr.created_at DESC`,
      retParams
    );

    // 5. Payment Information
    const salarySummary = get(
      `SELECT COALESCE(SUM(net_salary), 0) as total_salary,
              COALESCE(SUM(paid_amount), 0) as total_paid,
              COALESCE(SUM(pending_amount), 0) as pending_salary
       FROM tailor_salaries WHERE tailor_id = ?`,
      [tailor.id]
    );

    const paymentRecords = query(
      `SELECT tsp.*, u.name as recorded_by_name
       FROM tailor_salary_payments tsp
       LEFT JOIN users u ON tsp.recorded_by = u.id
       WHERE tsp.tailor_id = ?
       ORDER BY tsp.payment_date DESC LIMIT 20`,
      [tailor.id]
    );

    res.json({
      tailor,
      kpis: {
        total_assigned: Number(kpiSummary?.total_assigned || 0),
        total_completed: Number(kpiSummary?.total_completed || 0),
        total_pending: Number(kpiSummary?.total_pending || 0),
        total_earned: Number(kpiSummary?.total_earned || 0),
        total_assignments: Number(kpiSummary?.total_assignments || 0),
        active_jobs: Number(kpiSummary?.active_jobs_count || 0),
        completed_jobs: Number(kpiSummary?.completed_jobs_count || 0),
      },
      dress_types_breakdown: dressTypeBreakdown,
      assignments: assignmentHistory,
      returns: returnHistory,
      financials: {
        ...salarySummary,
        recent_payments: paymentRecords,
      },
    });
  } catch (err) {
    console.error('Error fetching tailor profile:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch tailor profile' });
  }
});

// GET /api/tailors/:tailorId (Tailor Summary for existing components)
router.get('/:tailorId', authenticateToken, (req, res) => {
  const { tailorId } = req.params;

  if (req.user.role === 'TAILOR' && req.user.tailor_id !== tailorId) {
    return res.status(403).json({
      error: 'Access denied: Strict Tailor Privacy policy prevents viewing other tailors profiles.',
    });
  }

  const tailor = get(
    `SELECT t.*, u.user_id as login_user_id, u.email, u.is_active as user_active
     FROM tailors t
     LEFT JOIN users u ON t.linked_user_id = u.id
     WHERE t.id = ? OR t.tailor_code = ?`,
    [tailorId, tailorId]
  );

  if (!tailor) {
    return res.status(404).json({ error: 'Tailor profile not found' });
  }

  const productionSummary = get(
    `SELECT COUNT(*) as days_worked, COALESCE(SUM(total_pieces), 0) as total_pieces,
            COALESCE(SUM(earned_amount), 0) as total_earned
     FROM tailor_production WHERE tailor_id = ?`,
    [tailor.id]
  );

  const workOrderSummary = get(
    `SELECT COALESCE(SUM(given_qty), 0) as total_given,
            COALESCE(SUM(stitched_qty), 0) as total_stitched,
            COALESCE(SUM(given_qty - stitched_qty), 0) as total_pending
     FROM tailor_work_orders WHERE tailor_id = ?`,
    [tailor.id]
  );

  const salarySummary = get(
    `SELECT COALESCE(SUM(net_salary), 0) as total_salary,
            COALESCE(SUM(paid_amount), 0) as total_paid,
            COALESCE(SUM(pending_amount), 0) as pending_salary
     FROM tailor_salaries WHERE tailor_id = ?`,
    [tailor.id]
  );

  res.json({
    tailor: {
      ...tailor,
      metrics: {
        ...productionSummary,
        work_orders: workOrderSummary,
        salary: salarySummary,
      },
    },
  });
});

// PUT /api/tailors/:id (Edit tailor details & deactivate/activate without deleting historical records)
router.put('/:id', authenticateToken, requireRole('OWNER'), (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      phone,
      assigned_shop,
      salary_type,
      monthly_rate,
      daily_rate,
      shirt_rate,
      pant_rate,
      blouse_rate,
      other_rate,
      account_status,
    } = req.body;

    const existing = get('SELECT * FROM tailors WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'Tailor not found.' });
    }

    const newName = name !== undefined ? name : existing.name;
    const newPhone = phone !== undefined ? phone : existing.phone;
    const newShop = assigned_shop !== undefined ? assigned_shop : existing.assigned_shop;
    const newSalType = salary_type !== undefined ? salary_type : existing.salary_type;
    const newMonthly = monthly_rate !== undefined ? Number(monthly_rate) : existing.monthly_rate;
    const newDaily = daily_rate !== undefined ? Number(daily_rate) : existing.daily_rate;
    const newShirt = shirt_rate !== undefined ? Number(shirt_rate) : existing.shirt_rate;
    const newPant = pant_rate !== undefined ? Number(pant_rate) : existing.pant_rate;
    const newBlouse = blouse_rate !== undefined ? Number(blouse_rate) : existing.blouse_rate;
    const newOther = other_rate !== undefined ? Number(other_rate) : existing.other_rate;
    const newStatus = account_status !== undefined ? account_status : existing.account_status;

    transaction(() => {
      run(
        `UPDATE tailors SET
          name = ?, phone = ?, assigned_shop = ?, salary_type = ?,
          monthly_rate = ?, daily_rate = ?, shirt_rate = ?, pant_rate = ?,
          blouse_rate = ?, other_rate = ?, account_status = ?
         WHERE id = ?`,
        [
          newName,
          newPhone,
          newShop,
          newSalType,
          newMonthly,
          newDaily,
          newShirt,
          newPant,
          newBlouse,
          newOther,
          newStatus,
          id,
        ]
      );

      // If tailor is deactivated or activated, also update the linked user account
      if (existing.linked_user_id) {
        const userActive = newStatus === 'active' ? 1 : 0;
        run('UPDATE users SET is_active = ?, name = ?, phone = ? WHERE id = ?', [
          userActive,
          newName,
          newPhone,
          existing.linked_user_id,
        ]);
      }

      // Audit Log
      run(
        `INSERT INTO audit_logs (id, actor_id, actor_name, action, module, record_id, shop_id, details)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          `audit_${Date.now()}`,
          req.user.id,
          req.user.name,
          'UPDATE_TAILOR_PROFILE',
          'tailors',
          id,
          newShop,
          `Updated tailor ${newName} (${existing.tailor_code}). Status: ${newStatus}`,
        ]
      );
    });

    res.json({
      success: true,
      message: `Tailor ${newName} profile updated successfully. Status: ${newStatus}`,
      tailor: {
        id,
        name: newName,
        phone: newPhone,
        account_status: newStatus,
      },
    });
  } catch (err) {
    console.error('Error updating tailor:', err);
    res.status(500).json({ error: err.message || 'Failed to update tailor' });
  }
});

export default router;
