require('dotenv').config();

console.log('🔥 HOT RELOAD РАБОТАЕТ!');

const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const TelegramBot = require('node-telegram-bot-api');
const rateLimiter = require('./middleware');
const { Pool } = require('pg');
const Docker = require('dockerode');

// Docker connection - используем Unix socket для Linux контейнеров
const docker = new Docker({ socketPath: '/var/run/docker.sock' });

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

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
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
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
        // Добавляем автобусы
        const busResult = await pool.query(`
            INSERT INTO buses (name, type, seats, year, has_ac, has_wifi, price_per_hour, image_url, availability) 
            VALUES 
            ('Mercedes-Benz Sprinter', 'Микроавтобус', 18, 2022, true, true, 2500, '🚐', 'available'),
            ('Volkswagen Crafter', 'Микроавтобус', 16, 2021, true, false, 2200, '🚌', 'available'),
            ('King Long', 'Автобус', 35, 2020, true, true, 4500, '🚍', 'available'),
            ('Mercedes-Benz V-Class', 'Микроавтобус', 8, 2023, true, true, 3500, '🚐', 'available')
            RETURNING id
        `);

        // Добавляем водителей
        await pool.query(`
            INSERT INTO drivers (name, experience, rating, bus_id, phone) 
            VALUES 
            ('Иван Петров', '8 лет', 4.9, $1, '+79780000001'),
            ('Алексей Смирнов', '6 лет', 4.8, $2, '+79780000002'),
            ('Михаил Козлов', '10 лет', 5.0, $3, '+79780000003'),
            ('Дмитрий Волков', '5 лет', 4.7, $4, '+79780000004')
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

// IP-based middleware для Docker monitoring
function dockerMonitoringAuth(req, res, next) {
    // Для разработки разрешаем доступ с localhost и Docker network
    const clientIp = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'];

    console.log('🔍 Docker Monitor Access from IP:', clientIp);

    // Разрешаем доступ для локальных запросов и Docker сети
    const allowedPatterns = [
        '127.0.0.1',
        '::1',
        '::ffff:127.0.0.1',
        'localhost',
        '172.', // Docker network range
        '192.168.', // Local network
    ];

    const isAllowed = allowedPatterns.some(pattern =>
        clientIp && clientIp.toString().includes(pattern)
    );

    if (isAllowed) {
        return next();
    }

    console.log('❌ Access denied for IP:', clientIp);
    res.status(403).json({ error: 'Access denied - Docker monitoring is restricted' });
}

// Docker Monitoring Dashboard Page
app.get('/docker-monitor', dockerMonitoringAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'docker-monitor.html'));
});

// API: Get all containers
app.get('/api/docker/containers', dockerMonitoringAuth, async (req, res) => {
    try {
        const containers = await docker.listContainers({ all: true });
        const detailedContainers = await Promise.all(
            containers.map(async (container) => {
                const containerObj = docker.getContainer(container.Id);
                const stats = await containerObj.stats({ stream: false });
                const inspect = await containerObj.inspect();

                return {
                    id: container.Id.substring(0, 12),
                    name: container.Names[0].replace('/', ''),
                    image: container.Image,
                    state: container.State,
                    status: container.Status,
                    created: container.Created,
                    stats: {
                        cpu: calculateCPUPercent(stats),
                        memory: calculateMemoryUsage(stats),
                        network: calculateNetworkIO(stats)
                    },
                    ports: container.Ports
                };
            })
        );

        res.json(detailedContainers);
    } catch (error) {
        console.error('Docker API Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// API: Get container logs
app.get('/api/docker/logs/:id', dockerMonitoringAuth, async (req, res) => {
    try {
        const container = docker.getContainer(req.params.id);
        const logs = await container.logs({
            stdout: true,
            stderr: true,
            tail: 100,
            timestamps: true
        });

        res.json({ logs: logs.toString('utf8') });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// API: Restart container
app.post('/api/docker/restart/:id', dockerMonitoringAuth, async (req, res) => {
    try {
        const container = docker.getContainer(req.params.id);
        await container.restart();
        res.json({ message: 'Container restarted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// API: System info
app.get('/api/docker/info', dockerMonitoringAuth, async (req, res) => {
    try {
        const info = await docker.info();
        const version = await docker.version();

        res.json({
            containers: info.Containers,
            containersRunning: info.ContainersRunning,
            containersPaused: info.ContainersPaused,
            containersStopped: info.ContainersStopped,
            images: info.Images,
            serverVersion: version.Version,
            memTotal: (info.MemTotal / 1024 / 1024 / 1024).toFixed(2) + ' GB',
            cpus: info.NCPU
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Helper functions for stats calculation
function calculateCPUPercent(stats) {
    if (!stats || !stats.cpu_stats || !stats.precpu_stats) return 0;

    const cpuDelta = stats.cpu_stats.cpu_usage.total_usage - stats.precpu_stats.cpu_usage.total_usage;
    const systemDelta = stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
    const cpuCount = stats.cpu_stats.online_cpus || 1;

    if (systemDelta > 0 && cpuDelta > 0) {
        return ((cpuDelta / systemDelta) * cpuCount * 100).toFixed(2);
    }
    return 0;
}

function calculateMemoryUsage(stats) {
    if (!stats || !stats.memory_stats) return { used: 0, limit: 0, percent: 0 };

    const used = stats.memory_stats.usage || 0;
    const limit = stats.memory_stats.limit || 0;
    const percent = limit > 0 ? ((used / limit) * 100).toFixed(2) : 0;

    return {
        used: (used / 1024 / 1024).toFixed(2) + ' MB',
        limit: (limit / 1024 / 1024).toFixed(2) + ' MB',
        percent: percent
    };
}

function calculateNetworkIO(stats) {
    if (!stats || !stats.networks) return { rx: '0 KB', tx: '0 KB' };

    let rxBytes = 0;
    let txBytes = 0;

    Object.values(stats.networks).forEach(network => {
        rxBytes += network.rx_bytes || 0;
        txBytes += network.tx_bytes || 0;
    });

    return {
        rx: (rxBytes / 1024).toFixed(2) + ' KB',
        tx: (txBytes / 1024).toFixed(2) + ' KB'
    };
}

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
            `INSERT INTO orders (customer_name, customer_phone, from_location, to_location, trip_date, passengers_count, special_requests, bus_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
            [
                orderData.name,
                orderData.phone,
                orderData.from,
                orderData.to,
                orderData.dateTime,
                orderData.passengers,
                orderData.request,
                orderData.busId || null
            ]
        );

        const orderId = orderResult.rows[0].id;

        // Формируем сообщение для Telegram
        let message = `🚐 **Новый заказ #${orderId}**\n\n`;
        message += `👤 Имя: ${orderData.name}\n`;
        message += `📞 Телефон: ${orderData.phone}\n`;
        message += `📍 Откуда: ${orderData.from}\n`;
        message += `🎯 Куда: ${orderData.to}\n`;
        message += `📅 Дата: ${orderData.dateTime}\n`;
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

        // Отправляем в Telegram
        await bot.sendMessage(CHAT_IT, message);
        await bot.sendMessage(CHAT_ID, message);

        console.log('✅ Сообщение успешно отправлено в Telegram');
        res.json({
            message: 'Заказ успешно отправлен! Мы свяжемся с вами в ближайшее время.',
            orderId: orderId
        });

    } catch (error) {
        console.error('❌ Ошибка при обработке заказа:', error);
        res.status(500).json({ error: 'Ошибка при отправке заказа.' });
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