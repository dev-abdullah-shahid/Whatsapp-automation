const logger = require('./logger');

// WhatsApp rate limits:
// - Max 80 messages/second per phone number
// - Recommended: 1 message per second for cold outreach to avoid bans
class RateLimiter {
  constructor({ maxPerSecond = 1, maxPerMinute = 60 } = {}) {
    this.maxPerSecond = maxPerSecond;
    this.maxPerMinute = maxPerMinute;
    this.sentThisSecond = 0;
    this.sentThisMinute = 0;
    this.queue = [];
    this.processing = false;

    // Reset counters
    setInterval(() => { this.sentThisSecond = 0; }, 1000);
    setInterval(() => { this.sentThisMinute = 0; }, 60000);
  }

  async throttle(fn) {
    return new Promise((resolve, reject) => {
      this.queue.push({ fn, resolve, reject });
      if (!this.processing) this.processQueue();
    });
  }

  async processQueue() {
    this.processing = true;

    while (this.queue.length > 0) {
      if (
        this.sentThisSecond >= this.maxPerSecond ||
        this.sentThisMinute >= this.maxPerMinute
      ) {
        await this.sleep(500);
        continue;
      }

      const { fn, resolve, reject } = this.queue.shift();

      try {
        this.sentThisSecond++;
        this.sentThisMinute++;
        const result = await fn();
        resolve(result);
      } catch (err) {
        logger.error('Rate limiter function error', { error: err.message });
        reject(err);
      }

      await this.sleep(1000 / this.maxPerSecond);
    }

    this.processing = false;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Default limiter for bulk campaigns (safe: 1 msg/sec)
const campaignLimiter = new RateLimiter({ maxPerSecond: 1, maxPerMinute: 50 });

// Faster limiter for direct replies (safe: 10 msg/sec)
const replyLimiter = new RateLimiter({ maxPerSecond: 10, maxPerMinute: 200 });

module.exports = { RateLimiter, campaignLimiter, replyLimiter };