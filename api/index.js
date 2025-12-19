import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { pool } from '../config/database.js';
import authRoutes from '../routes/auth.js';
import userRoutes from '../routes/users.js';
import bookingRoutes from '../routes/bookings.js';
import eventRoutes from '../routes/events.js';
import analyticsRoutes from '../routes/analytics.js';
import embedRoutes from '../routes/embed.js';
import { errorHandler } from '../middleware/errorHandler.js';
import { authMiddleware } from '../middleware/auth.js';

dotenv.config();

const app = express();

// Middleware
app.use(helmet());
app.use(morgan('combined'));

// CORS configuration - handle with or without trailing slash
const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');
console.log('CORS enabled for:', frontendUrl);

// CORS should be very permissive for public routes
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin || origin === frontendUrl || origin === 'https://amromeet.vercel.app' || origin?.includes('localhost')) {
      callback(null, true);
    } else {
      callback(null, true); // Allow all for now to debug
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Health check - support both /health and /api/health
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Database connection check
app.get('/health/db', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({
      status: 'connected',
      database: 'PostgreSQL',
      timestamp: result.rows[0].now
    });
  } catch (error) {
    res.status(500).json({
      status: 'disconnected',
      error: error.message
    });
  }
});

app.get('/api/health/db', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({
      status: 'connected',
      database: 'PostgreSQL',
      timestamp: result.rows[0].now
    });
  } catch (error) {
    res.status(500).json({
      status: 'disconnected',
      error: error.message
    });
  }
});

// Routes - mount under both /api and without prefix for compatibility
app.use('/api/auth', authRoutes);
app.use('/api/users', authMiddleware, userRoutes);
app.use('/api/bookings', authMiddleware, bookingRoutes);
app.use('/api/events', authMiddleware, eventRoutes);
app.use('/api/analytics', authMiddleware, analyticsRoutes);
app.use('/api/embed', embedRoutes); // Public route for embeds

// Also mount without /api prefix for development
app.use('/auth', authRoutes);
app.use('/users', authMiddleware, userRoutes);
app.use('/bookings', authMiddleware, bookingRoutes);
app.use('/events', authMiddleware, eventRoutes);
app.use('/analytics', authMiddleware, analyticsRoutes);
app.use('/embed', embedRoutes); // Public route for embeds

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use(errorHandler);

// Export as both default and named export for Vercel compatibility
export default app;
export { app };
