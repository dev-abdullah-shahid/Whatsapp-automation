const { PrismaClient } = require('@prisma/client');
const logger = require('../utils/logger');

const prisma = new PrismaClient({
  log: [
    { emit: 'event', level: 'query' },
    { emit: 'event', level: 'error' },
    { emit: 'event', level: 'warn' }
  ]
});

// Log slow queries in development
if (process.env.NODE_ENV === 'development') {
  prisma.$on('query', (e) => {
    if (e.duration > 500) {
      logger.warn('Slow query detected', {
        query: e.query,
        duration: `${e.duration}ms`
      });
    }
  });
}

prisma.$on('error', (e) => {
  logger.error('Prisma error', { message: e.message });
});

// Test connection
async function connectDB() {
  try {
    await prisma.$connect();
    logger.info('Database connected successfully');
  } catch (err) {
    logger.error('Database connection failed', { error: err.message });
    process.exit(1);
  }
}

module.exports = { prisma, connectDB };