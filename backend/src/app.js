const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const path = require('path');
const rateLimit = require('express-rate-limit');
const env = require('./config/env');
const errorHandler = require('./middleware/error');

// Routes
const healthRoutes         = require('./modules/health/health.routes');
const authRoutes           = require('./modules/auth/auth.routes');
const usersRoutes          = require('./modules/users/users.routes');
const productsRoutes       = require('./modules/products/products.routes');
const categoriesRoutes     = require('./modules/products/categories.routes');
const vendorsRoutes        = require('./modules/vendors/vendors.routes');
const customersRoutes      = require('./modules/customers/customers.routes');
const workCentersRoutes    = require('./modules/work-centers/workCenters.routes');
const bomRoutes            = require('./modules/bom/bom.routes');
const salesRoutes          = require('./modules/sales/sales.routes');
const purchaseRoutes       = require('./modules/purchase/purchase.routes');
const manufacturingRoutes  = require('./modules/manufacturing/manufacturing.routes');
const intelligenceRoutes   = require('./modules/intelligence/intelligence.routes');
const dashboardRoutes      = require('./modules/dashboard/dashboard.routes');
const passportsRoutes      = require('./modules/passports/passports.routes');
const chatRoutes           = require('./modules/chat/chat.routes');
const auditRoutes          = require('./modules/audit/audit.routes');
const inventoryRoutes      = require('./modules/inventory/inventory.routes');
const reportsRoutes        = require('./modules/reports/reports.routes');

const app = express();

// ── Security & parsing ──────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(cors({
  origin: env.corsOrigin || '*',
  credentials: true,
  exposedHeaders: ['Content-Disposition'],
}));
app.use(cookieParser());
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Logging ─────────────────────────────────────────────────
if (env.nodeEnv !== 'test') {
  app.use(morgan('dev'));
}

// ── Static files (avatars, product images) ───────────────────
app.use('/uploads', express.static(path.join(__dirname, '../public/uploads')));

// ── Rate limiting on auth ────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 60 * 1000,  // 1 minute
  max: 10,
  message: { error: 'Too many login attempts. Try again in a minute.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/auth/login', authLimiter);

// ── Routes ──────────────────────────────────────────────────
app.use('/api/health',         healthRoutes);
app.use('/api/auth',           authRoutes);
app.use('/api/users',          usersRoutes);
app.use('/api/products',       productsRoutes);
app.use('/api/categories',     categoriesRoutes);
app.use('/api/vendors',        vendorsRoutes);
app.use('/api/customers',      customersRoutes);
app.use('/api/work-centers',   workCentersRoutes);
app.use('/api/bom',            bomRoutes);
app.use('/api/sales',          salesRoutes);
app.use('/api/purchase',       purchaseRoutes);
app.use('/api/manufacturing',  manufacturingRoutes);
app.use('/api/intelligence',   intelligenceRoutes);
app.use('/api/dashboard',      dashboardRoutes);
app.use('/api/passports',      passportsRoutes);
app.use('/api/chat',           chatRoutes);
app.use('/api/audit',          auditRoutes);
app.use('/api/inventory',      inventoryRoutes);
app.use('/api/reports',        reportsRoutes);

// ── 404 catch-all ───────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// ── Error handler ───────────────────────────────────────────
app.use(errorHandler);

module.exports = app;
