import express from 'express';
import 'express-async-errors';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config, validateConfig } from './config';
import { connectRedis, redis } from './utils/redis';
import { prisma } from './utils/prisma';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import authRoutes from './modules/auth/auth.routes';
import eventsRoutes from './modules/events/events.routes';
import venuesRoutes from './modules/venues/venues.routes';
import waitlistRoutes from './modules/waitlist/waitlist.routes';
import showsRoutes from './modules/shows/shows.routes';
import bookingsRoutes from './modules/bookings/bookings.routes';
import { startReleaseHoldWorker } from './jobs/release-hold.worker';
import { startSweepCron } from './jobs/sweep.cron';
import { startExpireOfferWorker } from './jobs/expire-offer.worker';

import { createServer } from 'http';
import { initIo } from './utils/socket';

// Validate config on startup
validateConfig();

const app = express();
const server = createServer(app);
initIo(server);

// Trust proxy for rate limiting behind reverse proxy
app.set('trust proxy', 1);

// Security middleware
app.use(helmet());
app.use(cors({
  origin: config.frontendUrl,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many requests' } },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, _res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// Health check
app.get('/health', async (_req, res) => {
  try {
    // Check DB connectivity
    await prisma.$queryRaw`SELECT 1`;
    // Check Redis connectivity
    await redis.ping();
    
    res.json({
      success: true,
      data: {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      },
    });
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(503).json({
      success: false,
      error: 'Service Unavailable',
    });
  }
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/events', eventsRoutes);
app.use('/api/venues', venuesRoutes);
app.use('/api', waitlistRoutes);
app.use('/api/shows', showsRoutes);
app.use('/api/bookings', bookingsRoutes);

// 404 handler
app.use(notFoundHandler);

// Error handler
app.use(errorHandler);

// Start server
let sweepInterval: NodeJS.Timeout | null = null;

async function start(): Promise<void> {
  try {
    await connectRedis();
    console.log('Redis connected');

    // Start BullMQ worker for releasing expired holds
    startReleaseHoldWorker();
    console.log('Release-hold worker started');

    // Start BullMQ worker for expiring waitlist offers
    startExpireOfferWorker();
    console.log('Expire-offer worker started');

    // Start sweep cron as safety net
    sweepInterval = startSweepCron();
    console.log('Sweep cron started');

    server.listen(config.port, () => {
      console.log(`Server running on port ${config.port} in ${config.nodeEnv} mode`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  if (sweepInterval) clearInterval(sweepInterval);
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  if (sweepInterval) clearInterval(sweepInterval);
  process.exit(0);
});

// Export for testing
export { app };

start();