const { Pool } = require('pg');

// Инициализация пула соединений с БД
const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'pickadrive',
    password: process.env.DB_PASSWORD || '1',
    port: process.env.DB_PORT || 5432,
});

const MAX_REQUESTS_PER_DAY = 3;

// Middleware для rate limiting через БД
async function rateLimiter(req, res, next) {
    const ip = req.ip;
    const userAgent = req.headers['user-agent'] || 'unknown';
    const today = new Date().toISOString().split('T')[0];

    try {
        // Проверяем или создаем запись для данного IP и user_agent
        const result = await pool.query(
            `INSERT INTO rate_limits (ip, user_agent, request_count, date)
             VALUES ($1, $2, 1, $3)
             ON CONFLICT (ip, user_agent, date)
             DO UPDATE SET
                 request_count = rate_limits.request_count + 1,
                 last_request = CURRENT_TIMESTAMP
             RETURNING request_count`,
            [ip, userAgent, today]
        );

        const requestCount = result.rows[0].request_count;

        if (requestCount > MAX_REQUESTS_PER_DAY) {
            return res.status(429).json({ 
                error: 'Превышен лимит запросов: максимум 3 запроса в сутки с вашего устройства.' 
            });
        }

        next();
    } catch (error) {
        console.error('Ошибка rate limiter:', error);
        // В случае ошибки пропускаем запрос
        next();
    }
}

module.exports = rateLimiter;

