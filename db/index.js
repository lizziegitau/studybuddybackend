const mysql = require('mysql2');
const dotenv = require('dotenv');

dotenv.config();

// Database configuration
const dbHost = process.env.DB_HOST;
const dbUser = process.env.DB_USER;
const dbPassword = process.env.DB_PASSWORD;
const dbName = process.env.DB_NAME;

const pool = mysql.createPool({
    host: dbHost,
    user: dbUser,
    password: dbPassword,
    database: dbName,
    port: 3307
});

const db = pool.promise();

module.exports = db;