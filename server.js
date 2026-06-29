require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const TelegramBot = require('node-telegram-bot-api');
const rateLimiter = require('./middleware');
const { Pool } = require('pg');

const app = express();
const port = process.env.PORT || 3000;

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;
const CHAT_IT = process.env.CHAT_IT;

// Настройка подключения к PostgreSQL
const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'pickadrive',
    password: process.env.DB_PASSWORD || '1',
    port: process.env.DB_PORT || 5432,
});

// Инициализация Telegram бота (только если указан токен)
let bot = null;
if (BOT_TOKEN && BOT_TOKEN !== 'your_telegram_bot_token_here') {
    try {
        bot = new TelegramBot(BOT_TOKEN, { polling: true });
        console.log('✅ Telegram бот инициализирован');
    } catch (error) {
        console.error('❌ Ошибка инициализации Telegram бота:', error.message);
        bot = null;
    }
} else {
    console.log('⚠️ Telegram бот не инициализирован - отсутствует BOT_TOKEN');
}

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

const faviconIco = Buffer.from(
    'AAABAAEAEBAAAAEAIABoBAAAFgAAACgAAAAQAAAAIAAAAAEAIAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD///8A////AP///wD/////w==',
    'base64'
);

const faviconPath = path.join(__dirname, 'public', 'favicon.ico');
if (!require('fs').existsSync(faviconPath)) {
    require('fs').writeFileSync(faviconPath, faviconIco);
}

app.get('/favicon.ico', (req, res) => {
    res.type('image/x-icon').send(faviconIco);
});

app.use(express.static('public'));

// Инициализация базы данных
async function initDatabase() {
    try {
        // Создаем таблицы если их нет
        await pool.query(`
            CREATE TABLE IF NOT EXISTS buses (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                type VARCHAR(50) NOT NULL,
                seats INTEGER NOT NULL,
                year INTEGER NOT NULL,
                has_ac BOOLEAN DEFAULT true,
                has_wifi BOOLEAN DEFAULT false,
                price_per_hour DECIMAL(10,2) NOT NULL,
                price_per_km DECIMAL(10,2) NOT NULL,
                image_url VARCHAR(255),
                availability VARCHAR(20) DEFAULT 'available',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE TABLE IF NOT EXISTS drivers (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                experience VARCHAR(50) NOT NULL,
                rating DECIMAL(3,2) DEFAULT 5.0,
                bus_id INTEGER REFERENCES buses(id),
                phone VARCHAR(20),
                license_number VARCHAR(50),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE TABLE IF NOT EXISTS orders (
                id SERIAL PRIMARY KEY,
                customer_name VARCHAR(100) NOT NULL,
                customer_phone VARCHAR(20) NOT NULL,
                from_location VARCHAR(255) NOT NULL,
                to_location VARCHAR(255) NOT NULL,
                trip_date VARCHAR(100) NOT NULL,
                passengers_count INTEGER NOT NULL,
                special_requests TEXT,
                bus_id INTEGER REFERENCES buses(id),
                status VARCHAR(20) DEFAULT 'pending',
                is_active BOOLEAN DEFAULT true,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS rate_limits (
                id SERIAL PRIMARY KEY,
                ip VARCHAR(45) NOT NULL,
                user_agent TEXT,
                request_count INTEGER DEFAULT 1,
                last_request TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                date DATE DEFAULT CURRENT_DATE,
                UNIQUE(ip, user_agent, date)
            );
        `);
        console.log('✅ Таблицы БД созданы/проверены');

        // Проверяем есть ли тестовые данные
        const busCount = await pool.query('SELECT COUNT(*) FROM buses');
        if (parseInt(busCount.rows[0].count) === 0) {
            await addTestData();
        }
    } catch (error) {
        console.error('❌ Ошибка инициализации БД:', error);
    }
}

// Добавление тестовых данных
async function addTestData() {
    try {
        // Сначала очищаем старые данные
        await pool.query('DELETE FROM drivers');
        await pool.query('DELETE FROM buses');

        // Добавляем автобусы с реальными данными
        const busResult = await pool.query(`
            INSERT INTO buses (name, type, seats, year, has_ac, has_wifi, price_per_hour, price_per_km, image_url, availability)
            VALUES
            ('Mercedes Sprinter 2014 комфорт', 'Микроавтобус', 19, 2014, true, false, 2500, 80, '🚐', 'available'),
            ('Mercedes Sprinter 2016', 'Микроавтобус', 19, 2016, true, false, 2500, 85, '🚐', 'available'),
            ('Mercedes Sprinter 2017 дельфин', 'Микроавтобус', 19, 2017, true, false, 2700, 90, '🚐', 'available'),
            ('Man 2000', 'Автобус', 40, 2000, true, false, 3500, 120, '�', 'available')
            RETURNING id
        `);

        // Добавляем водителей с реальными данными
        await pool.query(`
            INSERT INTO drivers (name, experience, rating, bus_id, phone)
            VALUES
            ('Александр Иванов', '12 лет', 4.8, $1, '+79780000001'),
            ('Сергей Петров', '8 лет', 4.9, $2, '+79780000002'),
            ('Дмитрий Козлов', '10 лет', 4.7, $3, '+79780000003'),
            ('Михаил Волков', '15 лет', 5.0, $4, '+79780000004')
        `, [busResult.rows[0].id, busResult.rows[1].id, busResult.rows[2].id, busResult.rows[3].id]);

        console.log('✅ Тестовые данные добавлены в PostgreSQL');
    } catch (error) {
        console.error('❌ Ошибка добавления тестовых данных:', error);
    }
}

// Главная страница
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Страница выбора автобусов
app.get('/bus-selection', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'bus-selection.html'));
});

// API для получения списка автобусов
app.get('/api/buses', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT b.*, d.name as driver_name, d.experience, d.rating, d.phone as driver_phone
            FROM buses b
            LEFT JOIN drivers d ON b.id = d.bus_id
            WHERE b.availability = 'available'
            ORDER BY b.id
        `);
        res.json(result.rows);
    } catch (error) {
        console.error('❌ Ошибка получения автобусов:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// API для получения конкретного автобуса
app.get('/api/buses/:id', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT b.*, d.name as driver_name, d.experience, d.rating, d.phone as driver_phone
            FROM buses b
            LEFT JOIN drivers d ON b.id = d.bus_id
            WHERE b.id = $1
        `, [req.params.id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Автобус не найден' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('❌ Ошибка получения автобуса:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Обработка заказов
app.post('/api/orders', rateLimiter, async (req, res) => {
    console.log('📦 Получен заказ:', req.body);

    const orderData = req.body;

    if (!orderData.name || !orderData.phone || !orderData.from || !orderData.to) {
        return res.status(400).json({ error: 'Заполните все обязательные поля' });
    }

    try {
        // Сохраняем заказ в базу данных
        const orderResult = await pool.query(
            `INSERT INTO orders (customer_name, customer_phone, from_location, to_location, trip_date, passengers_count, special_requests, bus_id, is_active)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
            [
                orderData.name,
                orderData.phone,
                orderData.from,
                orderData.to,
                `${orderData.date} ${orderData.time}`,
                orderData.passengers,
                orderData.request,
                orderData.busId || null,
                true
            ]
        );

        const orderId = orderResult.rows[0].id;

        // Формируем сообщение для Telegram
        let message = `🚐 **Новый заказ #${orderId}**\n\n`;
        message += `👤 Имя: ${orderData.name}\n`;
        message += `📞 Телефон: ${orderData.phone}\n`;
        message += `📍 Откуда: ${orderData.from}\n`;
        message += `🎯 Куда: ${orderData.to}\n`;
        if (orderData.distance) {
            message += `📏 Расстояние: ${orderData.distance} км\n`;
        }
        message += `📅 Дата: ${orderData.date}\n`;
        message += `⏰ Время: ${orderData.time}\n`;
        message += `👥 Пассажиры: ${orderData.passengers}\n`;

        // Если выбран автобус
        if (orderData.busId) {
            const busResult = await pool.query(
                'SELECT name, seats FROM buses WHERE id = $1',
                [orderData.busId]
            );
            if (busResult.rows.length > 0) {
                const bus = busResult.rows[0];
                message += `🚌 Автобус: ${bus.name} (${bus.seats} мест)\n`;
            }
        }

        message += ` Пожелания: ${orderData.request || 'нет'}\n`;
        message += `\n Время заказа: ${new Date().toLocaleString('ru-RU')}`;

        // Отправляем в Telegram (если бот инициализирован)
        if (bot && CHAT_IT && CHAT_ID) {
            try {
                await bot.sendMessage(CHAT_IT, message);
                await bot.sendMessage(CHAT_ID, message);
                console.log('✅ Сообщение успешно отправлено в Telegram');
            } catch (error) {
                console.error('❌ Ошибка отправки в Telegram:', error.message);
            }
        } else {
            console.log('⚠️ Сообщение не отправлено в Telegram - бот не инициализирован или отсутствуют CHAT_ID');
        }
        res.json({
            message: 'Заказ успешно отправлен! Мы свяжемся с вами в ближайшее время.',
            orderId: orderId
        });

    } catch (error) {
        console.error('❌ Ошибка при обработке заказа:', error);
        res.status(500).json({ error: 'Ошибка при отправке заказа.' });
    }
});

// API для сброса rate limits (для тестирования)
app.get('/api/admin/reset-rate-limit', async (req, res) => {
    try {
        await pool.query('DELETE FROM rate_limits');
        console.log('✅ Rate limits сброшены');
        res.json({ message: 'Rate limits успешно сброшены' });
    } catch (error) {
        console.error('❌ Ошибка при сбросе rate limits:', error);
        res.status(500).json({ error: 'Ошибка при сбросе rate limits' });
    }
});

// API для изменения статуса заказа
app.patch('/api/orders/:id', async (req, res) => {
    try {
        const { status, is_active } = req.body;
        const orderId = req.params.id;

        const updateFields = [];
        const updateValues = [];
        let paramCount = 1;

        if (status !== undefined) {
            updateFields.push(`status = $${paramCount}`);
            updateValues.push(status);
            paramCount++;
        }

        if (is_active !== undefined) {
            updateFields.push(`is_active = $${paramCount}`);
            updateValues.push(is_active);
            paramCount++;
        }

        if (updateFields.length === 0) {
            return res.status(400).json({ error: 'Не указаны поля для обновления' });
        }

        updateValues.push(orderId);

        const result = await pool.query(
            `UPDATE orders SET ${updateFields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
            updateValues
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Заказ не найден' });
        }

        res.json({ message: 'Статус заказа обновлен', order: result.rows[0] });
    } catch (error) {
        console.error('❌ Ошибка при обновлении заказа:', error);
        res.status(500).json({ error: 'Ошибка при обновлении заказа' });
    }
});

// API для добавления нового автобуса
app.post('/api/admin/buses', async (req, res) => {
    try {
        const { name, type, seats, year, has_ac, has_wifi, price_per_hour, image_url } = req.body;

        const result = await pool.query(
            `INSERT INTO buses (name, type, seats, year, has_ac, has_wifi, price_per_hour, image_url)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
            [name, type, seats, year, has_ac, has_wifi, price_per_hour, image_url]
        );

        res.json({ message: 'Автобус добавлен', bus: result.rows[0] });
    } catch (error) {
        console.error('❌ Ошибка добавления автобуса:', error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Запуск сервера
initDatabase().then(() => {
    app.listen(port, () => {
        console.log(` Сервер запущен на порту ${port}`);
        console.log(` PostgreSQL база: ${process.env.DB_NAME || 'pickadrive'}`);
    });
});