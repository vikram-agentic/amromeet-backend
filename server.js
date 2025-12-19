import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { pool } from './config/database.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import bookingRoutes from './routes/bookings.js';
import eventRoutes from './routes/events.js';
import analyticsRoutes from './routes/analytics.js';
import embedRoutes from './routes/embed.js';
import { errorHandler } from './middleware/errorHandler.js';
import { authMiddleware } from './middleware/auth.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(helmet());
app.use(morgan('combined'));
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Health check
app.get('/health', (req, res) => {
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

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', authMiddleware, userRoutes);
app.use('/api/bookings', authMiddleware, bookingRoutes);
app.use('/api/events', authMiddleware, eventRoutes);
app.use('/api/analytics', authMiddleware, analyticsRoutes);
app.use('/api/embed', embedRoutes); // Public route for embeds

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Amromeet Server running on port ${PORT}`);
  console.log(`📡 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🌐 CORS enabled for: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
});

export default app;
