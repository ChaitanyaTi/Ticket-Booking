import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  // Database
  databaseUrl: process.env.DATABASE_URL || '',

  // Redis
  redis: {
    url: process.env.REDIS_URL,
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
  },

  // JWT
  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },

  // Frontend URL (for CORS)
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',

  // Seat hold TTL (minutes)
  holdTtlMinutes: parseInt(process.env.HOLD_TTL_MINUTES || '10', 10),

  // Waitlist offer TTL (minutes)
  waitlistOfferTtlMinutes: parseInt(process.env.WAITLIST_OFFER_TTL_MINUTES || '15', 10),

  // Gmail
  gmail: {
    user: process.env.GMAIL_USER || '',
    appPassword: process.env.GMAIL_APP_PASSWORD || '',
  },

  // App URL (for email links)
  appUrl: process.env.APP_URL || 'http://localhost:5173',
};

export function validateConfig(): void {
  const required = ['DATABASE_URL', 'JWT_SECRET', 'GMAIL_USER', 'GMAIL_APP_PASSWORD'];
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}