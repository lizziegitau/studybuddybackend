const mysql = require('mysql2');
const dotenv = require('dotenv');

dotenv.config();

// Database configuration
const dbHost = process.env.DB_HOST;
const dbUser = process.env.DB_USER;
const dbPassword = process.env.DB_PASSWORD;
const dbName = process.env.DB_NAME;
const dbPort = process.env.DB_PORT || 3307;

const pool = mysql.createPool({
    host: dbHost,
    user: dbUser,
    password: dbPassword,
    database: dbName,
    port: parseInt(dbPort),
    ssl: {
        rejectUnauthorized: false
    },
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    acquireTimeout: 60000,
    timeout: 60000,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    reconnect: true
});

const db = pool.promise();

module.exports = db;