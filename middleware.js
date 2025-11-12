const fs = require('fs');
const path = require('path');

const RATE_LIMIT_FILE = path.join(__dirname, 'rateLimitData.json');
const MAX_REQUESTS_PER_DAY = 3;
const WINDOW_MS = 24 * 60 * 60 * 1000; // 24 часа

let rateLimitData = {};
if (fs.existsSync(RATE_LIMIT_FILE)) {
  try {
    rateLimitData = JSON.parse(fs.readFileSync(RATE_LIMIT_FILE, 'utf8'));
  } catch {
    rateLimitData = {};
  }
}

function saveRateLimitData() {
  fs.writeFileSync(RATE_LIMIT_FILE, JSON.stringify(rateLimitData, null, 2));
}

function rateLimiter(req, res, next) {
  const ip = req.ip;
  const userAgent = req.headers['user-agent'] || 'unknown';
  const key = `${ip}__${userAgent}`;

  const now = Date.now();

  if (!rateLimitData[key]) {
    rateLimitData[key] = [];
  }

  rateLimitData[key] = rateLimitData[key].filter(timestamp => now - timestamp < WINDOW_MS);

  if (rateLimitData[key].length >= MAX_REQUESTS_PER_DAY) {
    return res.status(429).json({ error: 'Превышен лимит запросов: максимум 3 запроса в сутки с вашего устройства.' });
  }

  rateLimitData[key].push(now);
  saveRateLimitData();

  next();
}

module.exports = rateLimiter;

