import assert from 'assert';
import http from 'http';
import { app, startServer } from '../server/index.js';
import { getDb } from '../server/db.js';

const PORT = 5055;
process.env.PORT = PORT;

let server = null;
let baseUrl = `http://127.0.0.1:${PORT}/api`;

async function fetchJson(endpoint, options = {}) {
  const url = `${baseUrl}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  const res = await fetch(url, { ...options, headers });
  const data = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok, data };
}

async function runTests() {
  console.log('====================================================');
  console.log('🚀 SMART DRESS SHOP - COMPREHENSIVE CRITICAL E2E TESTS');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      process.stdout.write(`⏳ Testing: ${name}... `);
      await fn();
      console.log('✅ PASSED');
      passed++;
    } catch (err) {
      console.log('❌ FAILED');
      console.error(err);
      failed++;
    }
  }

  try {
    // Start test server
    await getDb();
    server = await new Promise((resolve) => {
      const s = app.listen(PORT, '127.0.0.1', () => resolve(s));
    });

    // Test 1: System Health Check
    await test('1. System Health API is Online', async () => {
      const res = await fetchJson('/health');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.status, 'online');
      assert.strictEqual(res.data.system, 'SMART DRESS SHOP MANAGEMENT SYSTEM');
    });

    // Test 2: Multi-Role Authentication
    let ownerToken = '';
    let empToken = '';
    let tailorToken = '';
    let tailorId = '';

    await test('2.1. Owner Authentication (OWNER01)', async () => {
      const res = await fetchJson('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ identifier: 'OWNER01', password: 'Owner@123' }),
      });
      assert.strictEqual(res.status, 200);
      assert.ok(res.data.token);
      assert.strictEqual(res.data.user.role, 'OWNER');
      ownerToken = res.data.token;
    });

    await test('2.2. Employee Authentication (EMP001 - Arun)', async () => {
      const res = await fetchJson('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ identifier: 'EMP001', password: 'Arun@123' }),
      });
      assert.strictEqual(res.status, 200);
      assert.ok(res.data.token);
      assert.strictEqual(res.data.user.role, 'EMPLOYEE');
      assert.strictEqual(res.data.user.assigned_shop, 'retail');
      empToken = res.data.token;
    });

    await test('2.3. Tailor Authentication (TAILOR001 - Kumar)', async () => {
      const res = await fetchJson('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ identifier: 'TAILOR001', password: 'Kumar@123' }),
      });
      assert.strictEqual(res.status, 200);
      assert.ok(res.data.token);
      assert.strictEqual(res.data.user.role, 'TAILOR');
      assert.ok(res.data.user.tailor_id);
      tailorToken = res.data.token;
      tailorId = res.data.user.tailor_id;
    });

    await test('2.4. Invalid Password Rejection', async () => {
      const res = await fetchJson('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ identifier: 'OWNER01', password: 'WrongPassword!' }),
      });
      assert.strictEqual(res.status, 401);
    });

    // Test 3: Critical E2E Test 2 - Wholesale to Retail Stock Transfer
    await test('3. Critical E2E Test 2: Transfer 20 shirts from Wholesale to Retail (Stock conservation)', async () => {
      const productId = 'prod_1'; // Premium Cotton Formal Shirt

      // Query current stock levels
      const invW = await fetchJson('/inventory/products?shop_id=shop_wholesale', { headers: { Authorization: `Bearer ${ownerToken}` } });
      const invR = await fetchJson('/inventory/products?shop_id=shop_retail', { headers: { Authorization: `Bearer ${ownerToken}` } });
      const startW = invW.data.products.find(p => p.id === productId)?.wholesale_stock ?? 100;
      const startR = invR.data.products.find(p => p.id === productId)?.retail_stock ?? 10;

      // Execute transfer of 20 shirts
      const res = await fetchJson('/inventory/transfer', {
        method: 'POST',
        headers: { Authorization: `Bearer ${ownerToken}` },
        body: JSON.stringify({
          source_shop: 'shop_wholesale',
          dest_shop: 'shop_retail',
          product_id: productId,
          quantity: 20,
          notes: 'Replenishing retail stock for weekend demand',
        }),
      });

      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.data.success, true);
      assert.strictEqual(res.data.sourceStock, startW - 20);
      assert.strictEqual(res.data.destStock, startR + 20);
    });

    // Test 4: POS Billing & Atomic Stock Deduction
    await test('4. Billing 2 Formal Shirts in Retail -> Stock decrements by 2', async () => {
      const invBefore = await fetchJson('/inventory/products?shop_id=shop_retail', {
        headers: { Authorization: `Bearer ${ownerToken}` },
      });
      const stockBefore = invBefore.data.products.find(p => p.id === 'prod_1')?.retail_stock ?? 30;

      const billRes = await fetchJson('/billing/create', {
        method: 'POST',
        headers: { Authorization: `Bearer ${ownerToken}` },
        body: JSON.stringify({
          bill_type: 'normal',
          shop_id: 'shop_retail',
          customer_name: 'Anitha Ramesh',
          customer_phone: '+91 98405 67890',
          items: [
            {
              product_id: 'prod_1',
              product_name: 'Premium Cotton Formal Shirt',
              product_code: 'SHIRT-001',
              quantity: 2,
              unit_price: 850,
              discount: 0,
              tax_rate: 0,
              tax_amount: 0,
              total_price: 1700,
            },
          ],
          subtotal: 1700,
          discount: 0,
          tax_amount: 0,
          grand_total: 1700,
          payment_method: 'cash',
          paid_amount: 1700,
        }),
      });

      assert.ok(billRes.status === 200 || billRes.status === 201);
      assert.strictEqual(billRes.data.success, true);
      const billNum = billRes.data.billNumber || billRes.data.bill?.bill_number;
      assert.ok(billNum);

      // Verify Retail Stock decremented by 2
      const invAfter = await fetchJson('/inventory/products?shop_id=shop_retail', {
        headers: { Authorization: `Bearer ${ownerToken}` },
      });
      const stockAfter = invAfter.data.products.find(p => p.id === 'prod_1')?.retail_stock;
      assert.strictEqual(stockAfter, stockBefore - 2);
    });

    // Test 5: Customer Khata / Credit Bill & Due Date Verification
    let creditBillId = '';
    await test('5.1. Create Credit Bill with Partial Payment & Mandatory Due Date', async () => {
      const billRes = await fetchJson('/billing/create', {
        method: 'POST',
        headers: { Authorization: `Bearer ${ownerToken}` },
        body: JSON.stringify({
          bill_type: 'gst',
          shop_id: 'shop_wholesale',
          customer_name: 'Murugan Menswear',
          customer_phone: '+91 98404 56789',
          items: [
            {
              product_id: 'prod_2',
              product_name: 'Slim Fit Denim Jeans',
              product_code: 'JEANS-001',
              quantity: 10,
              unit_price: 900,
              discount: 0,
              tax_rate: 5,
              tax_amount: 450,
              total_price: 9450,
            },
          ],
          subtotal: 9000,
          discount: 0,
          tax_amount: 450,
          grand_total: 9450,
          payment_method: 'partial',
          paid_amount: 4450,
          due_date: '2026-11-15',
        }),
      });

      assert.ok(billRes.status === 200 || billRes.status === 201);
      const pendingAmt = billRes.data.pending_amount !== undefined ? billRes.data.pending_amount : billRes.data.bill?.pending_amount;
      assert.strictEqual(pendingAmt, 5000);
      creditBillId = billRes.data.billId || billRes.data.bill?.id;
      assert.ok(creditBillId);
    });

    await test('5.2. Settle Customer Credit via Payment Collection API', async () => {
      const payRes = await fetchJson('/credit/payment', {
        method: 'POST',
        headers: { Authorization: `Bearer ${ownerToken}` },
        body: JSON.stringify({
          bill_id: creditBillId,
          amount: 5000,
          payment_method: 'upi',
          notes: 'Full settlement via GPay',
        }),
      });

      assert.strictEqual(payRes.status, 200);
      assert.strictEqual(payRes.data.success, true);
      assert.strictEqual(payRes.data.pending_amount, 0);
    });

    // Test 6: Critical E2E Test 4 - Kumar logs 10 shirts + 8 pants = ₹1,060
    await test('6. Critical E2E Test 4: Kumar records 10 shirts + 8 pants. Shirt: 50, Pant: 70 -> Total = 10*50 + 8*70 = 1060', async () => {
      const res = await fetchJson('/tailors/production/record', {
        method: 'POST',
        headers: { Authorization: `Bearer ${tailorToken}` },
        body: JSON.stringify({
          shirts_qty: 10,
          pants_qty: 8,
          blouses_qty: 0,
          others_qty: 0,
          date: '2026-10-19',
          notes: '10 shirts and 8 pants completed',
        }),
      });

      assert.ok(res.status === 200 || res.status === 201);
      assert.strictEqual(res.data.success, true);
      const totalPieces = res.data.total_pieces !== undefined ? res.data.total_pieces : res.data.record?.total_pieces;
      const earnedAmount = res.data.earned_amount !== undefined ? res.data.earned_amount : res.data.record?.earned_amount;
      assert.strictEqual(totalPieces, 18);
      assert.strictEqual(earnedAmount, 1060);
    });

    // Test 7: Strict Tailor Privacy Validation
    await test('7.1. Tailor cannot access another tailor profile (Strict Privacy)', async () => {
      const res = await fetchJson('/tailors/tailor_2', {
        headers: { Authorization: `Bearer ${tailorToken}` },
      });
      // Should be blocked
      assert.strictEqual(res.status, 403);
    });

    await test('7.2. Tailor cannot access Owner-only Users/Staff endpoint', async () => {
      const res = await fetchJson('/users', {
        headers: { Authorization: `Bearer ${tailorToken}` },
      });
      assert.strictEqual(res.status, 403);
    });

    await test('7.3. Tailor cannot access Store Profit & Loss', async () => {
      const res = await fetchJson('/reports/profit-loss', {
        headers: { Authorization: `Bearer ${tailorToken}` },
      });
      assert.strictEqual(res.status, 403);
    });

    // Test 8: Owner Profit & Loss Statement
    await test('8. Profit & Loss Report calculates Gross Revenue, COGS, Wages, Expenses & Net Margin', async () => {
      const res = await fetchJson('/reports/profit-loss', {
        headers: { Authorization: `Bearer ${ownerToken}` },
      });
      assert.strictEqual(res.status, 200);
      assert.ok(res.data.metrics);
      assert.ok(res.data.metrics.grossRevenue > 0);
      assert.ok(res.data.metrics.cogs >= 0);
      assert.ok(res.data.metrics.netProfit !== undefined);
      assert.ok(res.data.metrics.marginPct !== undefined);
    });

    console.log('\n====================================================');
    console.log(`📊 TEST RUN COMPLETE: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================\n');

    if (failed > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }
  } catch (err) {
    console.error('Fatal test runner error:', err);
    process.exit(1);
  } finally {
    if (server) {
      server.close();
    }
  }
}

runTests();
