import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { getDb } from './db.js';
import { runReminderEngine } from './routes/notifications.routes.js';

import authRoutes from './routes/auth.routes.js';
import billingRoutes from './routes/billing.routes.js';
import creditRoutes from './routes/credit.routes.js';
import inventoryRoutes from './routes/inventory.routes.js';
import tailorsRoutes from './routes/tailors.routes.js';
import customersRoutes from './routes/customers.routes.js';
import expensesRoutes from './routes/expenses.routes.js';
import suppliersRoutes from './routes/suppliers.routes.js';
import notificationsRoutes from './routes/notifications.routes.js';
import reportsRoutes from './routes/reports.routes.js';
import usersRoutes from './routes/users.routes.js';
import settingsRoutes from './routes/settings.routes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Request logging in dev
app.use((req, res, next) => {
  if (process.env.NODE_ENV !== 'test') {
    // console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  }
  next();
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    system: 'SMART DRESS SHOP MANAGEMENT SYSTEM',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/credit', creditRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/tailors', tailorsRoutes);
app.use('/api/customers', customersRoutes);
app.use('/api/expenses', expensesRoutes);
app.use('/api/suppliers', suppliersRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/settings', settingsRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  res.status(500).json({ error: err.message || 'Internal Server Error' });
});

// Start Server
async function startServer() {
  try {
    await getDb();
    console.log('✅ SQLite Database initialized and schema verified.');

    // Run reminder engine on startup
    runReminderEngine();

    // Schedule reminder scan periodically (every 30 minutes)
    setInterval(() => {
      runReminderEngine();
    }, 30 * 60 * 1000);

    const server = app.listen(PORT, () => {
      console.log(`🚀 Smart Dress Shop Backend running on http://localhost:${PORT}`);
    });

    return server;
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

// Only start when run directly
if (process.argv[1]?.endsWith('index.js')) {
  startServer();
}

export { app, startServer };
