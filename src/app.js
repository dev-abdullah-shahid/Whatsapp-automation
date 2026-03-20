require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');
const morgan  = require('morgan');

const webhookRoutes    = require('./routes/webhook.routes');
const leadRoutes       = require('./routes/lead.routes');
const messageRoutes    = require('./routes/message.routes');
const campaignRoutes   = require('./routes/campaign.routes');
const analyticsRoutes  = require('./routes/analytics.routes');
const automationRoutes = require('./routes/automation.routes');
const { errorHandler } = require('./utils/errorHandler');
const { connectDB }    = require('./db');
const logger           = require('./utils/logger');

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined', {
  stream: { write: msg => logger.info(msg.trim()) }
}));

app.get('/', (req, res) => res.json({
  name: 'WhatsApp AI System',
  version: '1.0.0',
  status: 'running',
  endpoints: {
    health:      'GET  /health',
    leads:       'GET  /api/leads',
    messages:    'GET  /api/messages/:leadId',
    campaigns:   'GET  /api/campaigns',
    automations: 'GET  /api/automations',
    analytics:   'GET  /api/analytics/overview',
    webhook:     'POST /webhook/whatsapp'
  }
}));

app.get('/health', (req, res) =>
  res.json({ status: 'ok', provider: 'meta', timestamp: new Date() })
);

app.use('/webhook/whatsapp', webhookRoutes);
app.use('/api/leads',        leadRoutes);
app.use('/api/messages',     messageRoutes);
app.use('/api/campaigns',    campaignRoutes);
app.use('/api/analytics',    analyticsRoutes);
app.use('/api/automations',  automationRoutes);

app.use(errorHandler);

const PORT = process.env.PORT || 3000;

async function startServer() {
  await connectDB();

  app.listen(PORT, () =>
    logger.info(`Server running on port ${PORT}`)
  );

  // Start automation worker in same process
  require('./workers/automationWorker');
}

startServer();

module.exports = app;