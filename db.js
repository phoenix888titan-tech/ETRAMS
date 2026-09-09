const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD === '' ? undefined : (process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : '1nt3gr1ty'),
  database: process.env.DB_NAME || 'etrams',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  dateStrings: true
});

module.exports = pool;
