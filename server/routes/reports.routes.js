import express from 'express';
import { get, query } from '../db.js';
import { authenticateToken, requirePermission } from '../middleware/auth.js';

const router = express.Router();

// GET /api/reports/dashboard (Owner Dashboard Metrics)
router.get('/dashboard', authenticateToken, (req, res) => {
  const { shop_id = 'all', date_filter = 'today' } = req.query;

  let shopSql = '';
  const params = [];

  if (req.user.role !== 'OWNER' && req.user.assigned_shop !== 'all') {
    const sId = req.user.assigned_shop === 'retail' ? 'shop_retail' : 'shop_wholesale';
    shopSql += ` AND shop_id = ?`;
    params.push(sId);
  } else if (shop_id && shop_id !== 'all') {
    shopSql += ` AND shop_id = ?`;
    params.push(shop_id);
  }

  // 1. Today's Sales & Bills
  const todaySalesRow = get(
    `SELECT COALESCE(SUM(grand_total), 0) as total, COUNT(*) as count
     FROM bills WHERE date(created_at) = date('now') AND status != 'cancelled' ${shopSql}`,
    params
  );

  // 2. Payments Collected Today (Cash + UPI + Card)
  const paymentsCollectedRow = get(
    `SELECT COALESCE(SUM(p.amount), 0) as total
     FROM payments p
     JOIN bills b ON p.bill_id = b.id
     WHERE date(p.payment_date) = date('now') ${shopSql.replace(/shop_id/g, 'b.shop_id')}`,
    params
  );

  // 3. Customer Credit Metrics
  const creditRow = get(
    `SELECT COALESCE(SUM(pending_amount), 0) as total_pending
     FROM bills WHERE pending_amount > 0 AND status != 'cancelled' ${shopSql}`,
    params
  );

  const dueTodayRow = get(
    `SELECT COALESCE(SUM(pending_amount), 0) as due_today
     FROM bills WHERE pending_amount > 0 AND date(due_date) = date('now') AND status != 'cancelled' ${shopSql}`,
    params
  );

  const overdueRow = get(
    `SELECT COALESCE(SUM(pending_amount), 0) as overdue, COUNT(*) as overdue_count
     FROM bills WHERE pending_amount > 0 AND date(due_date) < date('now') AND status != 'cancelled' ${shopSql}`,
    params
  );

  // 4. Low stock count
  const lowStockRow = get(
    `SELECT COUNT(DISTINCT p.id) as count
     FROM products p
     JOIN inventory inv ON p.id = inv.product_id
     WHERE inv.current_stock <= p.min_stock AND p.is_active = 1 ${shopSql.replace(/shop_id/g, 'inv.shop_id')}`,
    params
  );

  // 5. Pending Tailor Salary
  const pendingSalaryRow = get(
    `SELECT COALESCE(SUM(pending_amount), 0) as pending_salary, COUNT(*) as tailors_pending
     FROM tailor_salaries WHERE pending_amount > 0`
  );

  // 6. Payment breakdown today (Cash, UPI, Card, Credit)
  const paymentBreakdown = query(
    `SELECT p.payment_method, COALESCE(SUM(p.amount), 0) as total
     FROM payments p
     JOIN bills b ON p.bill_id = b.id
     WHERE date(p.payment_date) = date('now') ${shopSql.replace(/shop_id/g, 'b.shop_id')}
     GROUP BY p.payment_method`,
    params
  );

  // 7. Last 7 Days Sales Trend
  const salesTrend = query(
    `SELECT date(created_at) as date,
            COALESCE(SUM(grand_total), 0) as sales,
            COALESCE(SUM(paid_amount), 0) as collected,
            COUNT(*) as bills_count
     FROM bills
     WHERE date(created_at) >= date('now', '-6 days') AND status != 'cancelled' ${shopSql}
     GROUP BY date(created_at)
     ORDER BY date(created_at) ASC`,
    params
  );

  // 8. Top Selling Products
  const topProducts = query(
    `SELECT bi.product_name, SUM(bi.quantity) as total_sold, SUM(bi.total_price) as total_revenue
     FROM bill_items bi
     JOIN bills b ON bi.bill_id = b.id
     WHERE b.status != 'cancelled' ${shopSql.replace(/shop_id/g, 'b.shop_id')}
     GROUP BY bi.product_id
     ORDER BY total_sold DESC LIMIT 5`,
    params
  );

  // 9. Quick Tailor Performance Summary
  const tailorProductionToday = query(
    `SELECT t.name as tailor_name, t.tailor_code,
            COALESCE(SUM(tp.total_pieces), 0) as pieces_today,
            COALESCE(SUM(tp.earned_amount), 0) as earned_today
     FROM tailors t
     LEFT JOIN tailor_production tp ON t.id = tp.tailor_id AND date(tp.date) = date('now')
     GROUP BY t.id
     ORDER BY pieces_today DESC LIMIT 5`
  );

  res.json({
    todaySales: Number(todaySalesRow?.total || 0),
    todayBills: Number(todaySalesRow?.count || 0),
    paymentsCollected: Number(paymentsCollectedRow?.total || 0),
    pendingCredit: Number(creditRow?.total_pending || 0),
    dueToday: Number(dueTodayRow?.due_today || 0),
    overduePayments: Number(overdueRow?.overdue || 0),
    overdueCount: Number(overdueRow?.overdue_count || 0),
    lowStockCount: Number(lowStockRow?.count || 0),
    pendingTailorSalary: Number(pendingSalaryRow?.pending_salary || 0),
    paymentBreakdown,
    salesTrend,
    topProducts,
    tailorProductionToday,
  });
});

// GET /api/reports/business-overview (Combined Business Analytics: Wholesale vs Retail)
router.get('/business-overview', authenticateToken, (req, res) => {
  const { filter = 'this_month', start_date, end_date } = req.query;

  let dateClause = '';
  const dateParams = [];

  if (filter === 'today') {
    dateClause = "date(created_at) = date('now')";
  } else if (filter === 'yesterday') {
    dateClause = "date(created_at) = date('now', '-1 day')";
  } else if (filter === 'this_week') {
    dateClause = "date(created_at) >= date('now', '-6 days')";
  } else if (filter === 'this_month') {
    dateClause = "date(created_at) >= date('now', 'start of month')";
  } else if (filter === 'custom' && start_date && end_date) {
    dateClause = "date(created_at) BETWEEN date(?) AND date(?)";
    dateParams.push(start_date, end_date);
  } else {
    // default to this month
    dateClause = "date(created_at) >= date('now', 'start of month')";
  }

  // 1. Retail Sales & Bill Count
  const retailStats = get(
    `SELECT COALESCE(SUM(grand_total), 0) as sales,
            COUNT(*) as bill_count,
            COALESCE(AVG(grand_total), 0) as avg_bill_value,
            COALESCE(SUM(paid_amount), 0) as paid_amount,
            COALESCE(SUM(pending_amount), 0) as pending_amount
     FROM bills
     WHERE shop_id = 'shop_retail' AND status != 'cancelled' AND ${dateClause}`,
    dateParams
  );

  // 2. Wholesale Sales & Bill Count
  const wholesaleStats = get(
    `SELECT COALESCE(SUM(grand_total), 0) as sales,
            COUNT(*) as bill_count,
            COALESCE(AVG(grand_total), 0) as avg_bill_value,
            COALESCE(SUM(paid_amount), 0) as paid_amount,
            COALESCE(SUM(pending_amount), 0) as pending_amount
     FROM bills
     WHERE shop_id = 'shop_wholesale' AND status != 'cancelled' AND ${dateClause}`,
    dateParams
  );

  const retailSales = Number(retailStats?.sales || 0);
  const wholesaleSales = Number(wholesaleStats?.sales || 0);
  const combinedSales = retailSales + wholesaleSales;

  const retailBills = Number(retailStats?.bill_count || 0);
  const wholesaleBills = Number(wholesaleStats?.bill_count || 0);
  const combinedBills = retailBills + wholesaleBills;

  // Best Performing Shop
  let bestShop = 'Equal Performance';
  let bestShopReason = 'Both shops are performing equally.';
  if (retailSales > wholesaleSales) {
    const diff = retailSales - wholesaleSales;
    const pct = wholesaleSales > 0 ? ((diff / wholesaleSales) * 100).toFixed(1) : '100';
    bestShop = 'Smart Dress Shop - Retail';
    bestShopReason = `Retail leads by ₹${diff.toLocaleString('en-IN')} (+${pct}%) in revenue with ${retailBills} bills generated.`;
  } else if (wholesaleSales > retailSales) {
    const diff = wholesaleSales - retailSales;
    const pct = retailSales > 0 ? ((diff / retailSales) * 100).toFixed(1) : '100';
    bestShop = 'Smart Dress Shop - Wholesale';
    bestShopReason = `Wholesale leads by ₹${diff.toLocaleString('en-IN')} (+${pct}%) with higher average ticket size (₹${Math.round(wholesaleStats?.avg_bill_value || 0)}).`;
  }

  // Daily Sales Comparison (past 14 days)
  const dailyComparison = query(
    `SELECT date(created_at) as date,
            COALESCE(SUM(CASE WHEN shop_id = 'shop_retail' THEN grand_total ELSE 0 END), 0) as retail_sales,
            COALESCE(SUM(CASE WHEN shop_id = 'shop_wholesale' THEN grand_total ELSE 0 END), 0) as wholesale_sales,
            COUNT(CASE WHEN shop_id = 'shop_retail' THEN 1 END) as retail_bills,
            COUNT(CASE WHEN shop_id = 'shop_wholesale' THEN 1 END) as wholesale_bills
     FROM bills
     WHERE status != 'cancelled' AND date(created_at) >= date('now', '-13 days')
     GROUP BY date(created_at)
     ORDER BY date(created_at) ASC`
  );

  // Monthly Sales Comparison (last 6 months)
  const monthlyComparison = query(
    `SELECT strftime('%Y-%m', created_at) as month,
            COALESCE(SUM(CASE WHEN shop_id = 'shop_retail' THEN grand_total ELSE 0 END), 0) as retail_sales,
            COALESCE(SUM(CASE WHEN shop_id = 'shop_wholesale' THEN grand_total ELSE 0 END), 0) as wholesale_sales,
            COUNT(CASE WHEN shop_id = 'shop_retail' THEN 1 END) as retail_bills,
            COUNT(CASE WHEN shop_id = 'shop_wholesale' THEN 1 END) as wholesale_bills
     FROM bills
     WHERE status != 'cancelled' AND date(created_at) >= date('now', '-6 months')
     GROUP BY strftime('%Y-%m', created_at)
     ORDER BY month ASC`
  );

  // Category comparison across shops
  const categoryShare = query(
    `SELECT p.category,
            COALESCE(SUM(CASE WHEN b.shop_id = 'shop_retail' THEN bi.total_price ELSE 0 END), 0) as retail_sales,
            COALESCE(SUM(CASE WHEN b.shop_id = 'shop_wholesale' THEN bi.total_price ELSE 0 END), 0) as wholesale_sales,
            SUM(bi.quantity) as total_qty
     FROM bill_items bi
     JOIN bills b ON bi.bill_id = b.id
     JOIN products p ON bi.product_id = p.id
     WHERE b.status != 'cancelled' AND ${dateClause.replace(/created_at/g, 'b.created_at')}
     GROUP BY p.category
     ORDER BY (retail_sales + wholesale_sales) DESC LIMIT 8`,
    dateParams
  );

  res.json({
    metrics: {
      combinedSales,
      combinedBills,
      retailSales,
      wholesaleSales,
      retailBills,
      wholesaleBills,
      retailAvgBill: Math.round(Number(retailStats?.avg_bill_value || 0)),
      wholesaleAvgBill: Math.round(Number(wholesaleStats?.avg_bill_value || 0)),
      retailPaid: Number(retailStats?.paid_amount || 0),
      wholesalePaid: Number(wholesaleStats?.paid_amount || 0),
      retailPending: Number(retailStats?.pending_amount || 0),
      wholesalePending: Number(wholesaleStats?.pending_amount || 0),
      bestShop,
      bestShopReason,
    },
    dailyComparison,
    monthlyComparison,
    categoryShare,
  });
});

// GET /api/reports/sales
router.get('/sales', authenticateToken, requirePermission('can_reports'), (req, res) => {
  const { shop_id, bill_type, start_date, end_date } = req.query;

  let sql = `
    SELECT b.*, s.name as shop_name, s.code as shop_code, u.name as created_by_name
    FROM bills b
    JOIN shops s ON b.shop_id = s.id
    LEFT JOIN users u ON b.created_by = u.id
    WHERE b.status != 'cancelled'
  `;
  const params = [];

  if (shop_id && shop_id !== 'all') {
    sql += ` AND b.shop_id = ?`;
    params.push(shop_id);
  }
  if (bill_type && bill_type !== 'all') {
    sql += ` AND b.bill_type = ?`;
    params.push(bill_type);
  }
  if (start_date && end_date) {
    sql += ` AND date(b.created_at) BETWEEN date(?) AND date(?)`;
    params.push(start_date, end_date);
  }

  sql += ` ORDER BY b.created_at DESC`;

  const bills = query(sql, params);

  const totalSales = bills.reduce((acc, b) => acc + b.grand_total, 0);
  const totalPaid = bills.reduce((acc, b) => acc + b.paid_amount, 0);
  const totalCredit = bills.reduce((acc, b) => acc + b.pending_amount, 0);
  const totalTax = bills.reduce((acc, b) => acc + (b.tax_amount || 0), 0);
  const totalDiscount = bills.reduce((acc, b) => acc + (b.discount || 0), 0);

  res.json({
    summary: {
      totalBills: bills.length,
      totalSales,
      totalPaid,
      totalCredit,
      totalTax,
      totalDiscount,
    },
    bills,
  });
});

// GET /api/reports/profit-loss (Actual Financial Profit & Loss calculation)
router.get('/profit-loss', authenticateToken, requirePermission('can_profit_view'), (req, res) => {
  const { shop_id, start_date, end_date } = req.query;

  let billFilter = "WHERE b.status != 'cancelled'";
  let expFilter = 'WHERE 1=1';
  let prodFilter = 'WHERE 1=1';
  const billParams = [];
  const expParams = [];
  const prodParams = [];

  if (shop_id && shop_id !== 'all') {
    billFilter += ` AND b.shop_id = ?`;
    billParams.push(shop_id);
    expFilter += ` AND e.shop_id = ?`;
    expParams.push(shop_id);
    prodFilter += ` AND tp.shop_id = ?`;
    prodParams.push(shop_id);
  }

  if (start_date && end_date) {
    billFilter += ` AND date(b.created_at) BETWEEN date(?) AND date(?)`;
    billParams.push(start_date, end_date);
    expFilter += ` AND date(e.date) BETWEEN date(?) AND date(?)`;
    expParams.push(start_date, end_date);
    prodFilter += ` AND date(tp.date) BETWEEN date(?) AND date(?)`;
    prodParams.push(start_date, end_date);
  }

  // 1. Gross Revenue
  const revRow = get(
    `SELECT COALESCE(SUM(b.grand_total), 0) as gross_revenue,
            COALESCE(SUM(b.discount), 0) as total_discounts
     FROM bills b ${billFilter}`,
    billParams
  );
  const grossRevenue = Number(revRow?.gross_revenue || 0);

  // 2. Cost of Goods Sold (COGS)
  const cogsRow = get(
    `SELECT COALESCE(SUM(bi.quantity * p.purchase_price), 0) as cogs
     FROM bill_items bi
     JOIN bills b ON bi.bill_id = b.id
     JOIN products p ON bi.product_id = p.id
     ${billFilter}`,
    billParams
  );
  const cogs = Number(cogsRow?.cogs || 0);
  const grossProfit = grossRevenue - cogs;

  // 3. Operating Expenses
  const expRow = get(
    `SELECT COALESCE(SUM(e.amount), 0) as total_expenses FROM expenses e ${expFilter}`,
    expParams
  );
  const operatingExpenses = Number(expRow?.total_expenses || 0);

  // 4. Tailor Production Labor
  const prodRow = get(
    `SELECT COALESCE(SUM(tp.earned_amount), 0) as tailor_wages FROM tailor_production tp ${prodFilter}`,
    prodParams
  );
  const tailorWages = Number(prodRow?.tailor_wages || 0);

  // 5. Net Profit
  const netProfit = grossProfit - operatingExpenses - tailorWages;
  const marginPct = grossRevenue > 0 ? ((netProfit / grossRevenue) * 100).toFixed(1) : '0';

  // Expense breakdown
  const expenseBreakdown = query(
    `SELECT category, SUM(amount) as amount FROM expenses e ${expFilter} GROUP BY category`,
    expParams
  );

  res.json({
    metrics: {
      grossRevenue,
      cogs,
      grossProfit,
      operatingExpenses,
      tailorWages,
      netProfit,
      marginPct: Number(marginPct),
    },
    expenseBreakdown,
  });
});

export default router;
