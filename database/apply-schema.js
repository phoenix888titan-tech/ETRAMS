const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const dbConfig = require('../db');

async function applySchema() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '1nt3gr1ty',
    database: process.env.DB_NAME || 'etrams',
    multipleStatements: true
  });

  try {
    console.log('Applying full schema...');
    const schemaPath = path.join(__dirname, 'schema.sql');
    const sql = fs.readFileSync(schemaPath, 'utf8');

    await connection.query('SET FOREIGN_KEY_CHECKS = 0;');
    await connection.query(sql);
    await connection.query('SET FOREIGN_KEY_CHECKS = 1;');
    console.log('Full schema applied successfully!');
  } catch (err) {
    console.error('Schema application error:', err);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

applySchema();
