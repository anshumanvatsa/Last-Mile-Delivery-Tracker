import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';

import { errorHandler } from './middleware/errorHandler';
import authRoutes from './routes/auth';
import orderRoutes from './routes/orders';
import zoneRoutes from './routes/zones';
import rateCardRoutes from './routes/rateCards';
import agentRoutes from './routes/agents';
import adminRoutes from './routes/admin';

const app = express();

// ─────────────────────────────────────────────────────────────
// MIDDLEWARE
// ─────────────────────────────────────────────────────────────

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000').split(',');
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (curl, Postman, mobile apps)
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: Origin ${origin} not allowed`));
      }
    },
    credentials: true,
  })
);

app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ─────────────────────────────────────────────────────────────
// ROUTES
// ─────────────────────────────────────────────────────────────

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' });
});

app.use('/api/auth', authRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/zones', zoneRoutes);
app.use('/api/rate-cards', rateCardRoutes);
app.use('/api/agents', agentRoutes);
app.use('/api/admin', adminRoutes);

// ─────────────────────────────────────────────────────────────
// 404 HANDLER
// ─────────────────────────────────────────────────────────────

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Route ${req.method} ${req.path} not found`,
    code: 'NOT_FOUND',
  });
});

// ─────────────────────────────────────────────────────────────
// GLOBAL ERROR HANDLER
// ─────────────────────────────────────────────────────────────

app.use(errorHandler);

// ─────────────────────────────────────────────────────────────
// START SERVER
// ─────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`\n🚀 LastMile API running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}\n`);
});

export default app;
