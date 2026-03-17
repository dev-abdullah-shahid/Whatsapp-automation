require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');
const morgan  = require('morgan');

const webhookRoutes  = require('./routes/webhook.routes');
const { errorHandler } = require('./utils/errorHandler');
const logger = require('./utils/logger');

const app = express();

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors());

// IMPORTANT: Meta sends JSON for webhooks (unlike Twilio which sends form data)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(morgan('combined', {
  stream: { write: msg => logger.info(msg.trim()) }
}));

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (req, res) =>
  res.json({ status: 'ok', provider: 'meta', timestamp: new Date() })
);

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/webhook/whatsapp', webhookRoutes);

// ── Error handler (always last) ───────────────────────────────────────────────
app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  logger.info(`Server running on port ${PORT} — Meta WhatsApp Cloud API`)
);

module.exports = app;