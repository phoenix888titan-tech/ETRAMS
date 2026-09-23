const express = require('express');
const path = require('path');
const cors = require('cors');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('./db');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:3000' }));
app.use(express.json());

// --- Authentication (token cookie, in-memory sessions) ---

const SESSION_COOKIE = 'etrams_token';
const sessions = new Map(); // token -> { id, username, fullName, role }

function parseCookies(req) {
  const header = req.headers.cookie || '';
  const cookies = {};
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    cookies[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  }
  return cookies;
}

function getSessionUser(req) {
  const token = parseCookies(req)[SESSION_COOKIE];
  if (!token) return null;
  const session = sessions.get(token);
  if (!session) return null;
  if (Date.now() > session.expires) {
    sessions.delete(token);
    return null;
  }
  return session.user;
}

function setSession(res, user) {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { user, expires: Date.now() + 12 * 60 * 60 * 1000 });
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=${token}; HttpOnly; Secure; Path=/; SameSite=Lax`);
}

function clearSession(req, res) {
  const token = parseCookies(req)[SESSION_COOKIE];
  if (token) sessions.delete(token);
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; HttpOnly; Path=/; Max-Age=0`);
}

// All /api/* routes require a valid session, except health check and login.
app.use('/api', (req, res, next) => {
  if (req.path === '/health' || req.path === '/auth/login') return next();
  const user = getSessionUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated.' });
  req.user = user;
  next();
});

// Settings (CRUD) routes additionally require the admin role.
app.use('/api/settings', (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin role required.' });
  }
  next();
});

// Auth endpoints
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 login requests per `window`
  message: { error: 'Too many login attempts, please try again after 15 minutes.' }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }
    const [rows] = await db.query(
      `SELECT user_id, username, password_hash, full_name, role FROM users WHERE username = ? AND status = 'active'`,
      [username]
    );
    const user = rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }
    await db.query('UPDATE users SET last_login = NOW() WHERE user_id = ?', [user.user_id]);
    const sessionUser = { id: user.user_id, username: user.username, fullName: user.full_name, role: user.role };
    setSession(res, sessionUser);
    res.json(sessionUser);
  } catch (err) {
    console.error('API Error:', err.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  clearSession(req, res);
  res.json({ loggedOut: true });
});

app.get('/api/auth/me', (req, res) => {
  res.json(req.user);
});

// Redirect unauthenticated page requests to the login page.
app.use((req, res, next) => {
  if (req.path === '/login.html' || !req.path.endsWith('.html') && req.path !== '/') return next();
  if (!getSessionUser(req)) return res.redirect('/login.html');
  next();
});

app.use(express.static(path.join(__dirname, 'public')));

// Health check
app.get('/api/health', async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({ status: 'ok', database: 'connected' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// Get filter options
app.get('/api/filters', async (req, res) => {
  try {
    const [grids] = await db.query(`SELECT grid_id, grid_code, grid_name FROM grids WHERE status = 'active' ORDER BY grid_id`);
    const [buildings] = await db.query(`SELECT building_id, building_code, building_name FROM buildings WHERE status = 'active' ORDER BY building_name`);
    res.json({
      grids,
      buildings,
      statuses: ['live', 'down', 'maintenance', 'offline'],
      months: [
        { value: 1, label: 'January' },
        { value: 2, label: 'February' },
        { value: 3, label: 'March' },
        { value: 4, label: 'April' },
        { value: 5, label: 'May' },
        { value: 6, label: 'June' },
        { value: 7, label: 'July' },
        { value: 8, label: 'August' },
        { value: 9, label: 'September' },
        { value: 10, label: 'October' },
        { value: 11, label: 'November' },
        { value: 12, label: 'December' }
      ],
      years: [2025, 2026, 2027]
    });
  } catch (err) {
    console.error('API Error:', err.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Get summary counts
app.get('/api/summary', async (req, res) => {
  try {
    const { grid_id, building_id, area_id, status, month, year, start_date, end_date } = req.query;
    let where = 'WHERE 1=1';
    const params = [];

    if (grid_id) {
      where += ' AND g.grid_id = ?';
      params.push(grid_id);
    }
    if (building_id) {
      where += ' AND b.building_id = ?';
      params.push(building_id);
    }
    if (area_id) {
      where += ' AND a.area_id = ?';
      params.push(area_id);
    }
    if (status) {
      where += ' AND pm.status = ?';
      params.push(status);
    }
    if (start_date) {
      where += ' AND pm.reading_datetime >= ?';
      params.push(start_date.includes(' ') || start_date.includes('T') ? start_date.replace('T', ' ') : `${start_date} 00:00:00`);
    }
    if (end_date) {
      where += ' AND pm.reading_datetime <= ?';
      params.push(end_date.includes(' ') || end_date.includes('T') ? end_date.replace('T', ' ') : `${end_date} 23:59:59`);
    }
    if (month) {
      where += ' AND MONTH(pm.reading_datetime) = ?';
      params.push(month);
    }
    if (year) {
      where += ' AND YEAR(pm.reading_datetime) = ?';
      params.push(year);
    }

    const [rows] = await db.query(`
      SELECT
        COUNT(*) AS total,
        COALESCE(SUM(CASE WHEN pm.status = 'live' THEN 1 ELSE 0 END), 0) AS live,
        COALESCE(SUM(CASE WHEN pm.status = 'down' THEN 1 ELSE 0 END), 0) AS down
      FROM power_meters pm
      JOIN areas a ON pm.area_id = a.area_id
      JOIN buildings b ON a.building_id = b.building_id
      JOIN grids g ON b.grid_id = g.grid_id
      ${where}
    `, params);

    res.json(rows[0]);
  } catch (err) {
    console.error('API Error:', err.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Get paginated meters
app.get('/api/meters', async (req, res) => {
  try {
    const {
      grid_id,
      building_id,
      area_id,
      status,
      month,
      year,
      start_date,
      end_date,
      page = 1,
      limit = 25,
      sort = 'meter_id',
      order = 'asc'
    } = req.query;

    const pageLimit = Math.min(parseInt(limit, 10) || 25, 10000);
    const offset = (Math.max(1, parseInt(page, 10) || 1) - 1) * pageLimit;

    let where = 'WHERE 1=1';
    const params = [];

    if (start_date) {
      where += ' AND mr.reading_datetime >= ?';
      params.push(start_date.includes(' ') || start_date.includes('T') ? start_date.replace('T', ' ') : `${start_date} 00:00:00`);
    }
    if (end_date) {
      where += ' AND mr.reading_datetime <= ?';
      params.push(end_date.includes(' ') || end_date.includes('T') ? end_date.replace('T', ' ') : `${end_date} 23:59:59`);
    }
    if (month) {
      where += ' AND MONTH(mr.reading_datetime) = ?';
      params.push(month);
    }
    if (year) {
      where += ' AND YEAR(mr.reading_datetime) = ?';
      params.push(year);
    }

    let hierarchyWhere = 'WHERE 1=1';
    const hierarchyParams = [];

    if (grid_id) {
      hierarchyWhere += ' AND g.grid_id = ?';
      hierarchyParams.push(grid_id);
    }
    if (building_id) {
      hierarchyWhere += ' AND b.building_id = ?';
      hierarchyParams.push(building_id);
    }
    if (area_id) {
      hierarchyWhere += ' AND pm.area_id = ?';
      hierarchyParams.push(area_id);
    }
    if (status) {
      hierarchyWhere += ' AND pm.status = ?';
      hierarchyParams.push(status);
    }

    const validSortColumns = ['meter_id', 'meter_code', 'current_reading', 'active_power', 'total_energy'];
    const sortColumn = validSortColumns.includes(sort) ? sort : 'meter_id';
    const sortOrder = order.toLowerCase() === 'desc' ? 'DESC' : 'ASC';

    // Build the query to get first/last readings per meter within the date range
    const cte = `
      WITH RankedReadings AS (
        SELECT 
          mr.meter_id,
          mr.current_reading,
          mr.active_power,
          mr.amps,
          mr.freq,
          mr.power_factor,
          mr.vll,
          mr.vln,
          mr.reading_datetime,
          ROW_NUMBER() OVER (PARTITION BY mr.meter_id ORDER BY mr.reading_datetime ASC) as rn_asc,
          ROW_NUMBER() OVER (PARTITION BY mr.meter_id ORDER BY mr.reading_datetime DESC) as rn_desc
        FROM meter_readings mr
        ${where}
      )
    `;

    const countQuery = `
      ${cte}
      SELECT COUNT(*) AS total
      FROM power_meters pm
      JOIN areas a ON pm.area_id = a.area_id
      JOIN buildings b ON a.building_id = b.building_id
      JOIN grids g ON b.grid_id = g.grid_id
      ${hierarchyWhere}
    `;

    const dataQuery = `
      ${cte}
      SELECT
        pm.meter_id,
        pm.meter_code,
        pm.meter_description,
        g.grid_name,
        b.building_name,
        a.area_name,
        COALESCE(last_read.current_reading, 0) AS current_reading,
        COALESCE(first_read.current_reading, 0) AS previous_reading,
        (COALESCE(last_read.current_reading, 0) - COALESCE(first_read.current_reading, 0)) AS total_used,
        COALESCE(last_read.active_power, 0) AS active_power,
        COALESCE(last_read.amps, 0) AS amps,
        COALESCE(last_read.freq, 0) AS freq,
        COALESCE(last_read.power_factor, 0) AS power_factor,
        COALESCE(last_read.vll, 0) AS vll,
        COALESCE(last_read.vln, 0) AS vln,
        pm.status,
        last_read.reading_datetime
      FROM power_meters pm
      JOIN areas a ON pm.area_id = a.area_id
      JOIN buildings b ON a.building_id = b.building_id
      JOIN grids g ON b.grid_id = g.grid_id
      LEFT JOIN RankedReadings first_read ON pm.meter_id = first_read.meter_id AND first_read.rn_asc = 1
      LEFT JOIN RankedReadings last_read ON pm.meter_id = last_read.meter_id AND last_read.rn_desc = 1
      ${hierarchyWhere}
      ORDER BY ${sortColumn} ${sortOrder}
      LIMIT ? OFFSET ?
    `;

    const [countRows] = await db.query(countQuery, [...params, ...hierarchyParams]);
    const total = countRows[0].total;

    const [dataRows] = await db.query(dataQuery, [...params, ...hierarchyParams, pageLimit, offset]);

    res.json({
      data: dataRows,
      pagination: {
        total,
        page: parseInt(page, 10),
        limit: pageLimit,
        totalPages: Math.ceil(total / pageLimit)
      }
    });
  } catch (err) {
    console.error('API Error:', err.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/api/meters/csv', async (req, res) => {
  try {
    const { grid_id, building_id, area_id, status, month, year, start_date, end_date } = req.query;

    let where = 'WHERE 1=1';
    const params = [];

    if (start_date) {
      where += ' AND mr.reading_datetime >= ?';
      params.push(start_date.includes(' ') || start_date.includes('T') ? start_date.replace('T', ' ') : `${start_date} 00:00:00`);
    }
    if (end_date) {
      where += ' AND mr.reading_datetime <= ?';
      params.push(end_date.includes(' ') || end_date.includes('T') ? end_date.replace('T', ' ') : `${end_date} 23:59:59`);
    }
    if (month) {
      where += ' AND MONTH(mr.reading_datetime) = ?';
      params.push(month);
    }
    if (year) {
      where += ' AND YEAR(mr.reading_datetime) = ?';
      params.push(year);
    }

    let hierarchyWhere = 'WHERE 1=1';
    const hierarchyParams = [];

    if (grid_id) {
      hierarchyWhere += ' AND g.grid_id = ?';
      hierarchyParams.push(grid_id);
    }
    if (building_id) {
      hierarchyWhere += ' AND b.building_id = ?';
      hierarchyParams.push(building_id);
    }
    if (area_id) {
      hierarchyWhere += ' AND pm.area_id = ?';
      hierarchyParams.push(area_id);
    }
    if (status) {
      hierarchyWhere += ' AND pm.status = ?';
      hierarchyParams.push(status);
    }

    const cte = `
      WITH RankedReadings AS (
        SELECT 
          mr.meter_id,
          mr.current_reading,
          mr.active_power,
          mr.amps,
          mr.freq,
          mr.power_factor,
          mr.vll,
          mr.vln,
          mr.reading_datetime,
          ROW_NUMBER() OVER (PARTITION BY mr.meter_id ORDER BY mr.reading_datetime ASC) as rn_asc,
          ROW_NUMBER() OVER (PARTITION BY mr.meter_id ORDER BY mr.reading_datetime DESC) as rn_desc
        FROM meter_readings mr
        ${where}
      )
    `;

    const csvQuery = `
      ${cte}
      SELECT
        pm.meter_code AS MeterID,
        pm.meter_description AS Description,
        b.building_name AS Building,
        a.area_name AS AreaFloor,
        g.grid_name AS Grid,
        COALESCE(last_read.current_reading, 0) AS CurrentReading,
        COALESCE(first_read.current_reading, 0) AS PreviousReading,
        (COALESCE(last_read.current_reading, 0) - COALESCE(first_read.current_reading, 0)) AS TotalUsed,
        COALESCE(last_read.active_power, 0) AS ActivePower,
        COALESCE(last_read.amps, 0) AS Amps,
        COALESCE(last_read.power_factor, 0) AS PowerFactor,
        COALESCE(last_read.vll, 0) AS VLL,
        COALESCE(last_read.vln, 0) AS VLN,
        pm.status AS Status,
        last_read.reading_datetime AS ReadingDatetime
      FROM power_meters pm
      JOIN areas a ON pm.area_id = a.area_id
      JOIN buildings b ON a.building_id = b.building_id
      JOIN grids g ON b.grid_id = g.grid_id
      LEFT JOIN RankedReadings first_read ON pm.meter_id = first_read.meter_id AND first_read.rn_asc = 1
      LEFT JOIN RankedReadings last_read ON pm.meter_id = last_read.meter_id AND last_read.rn_desc = 1
      ${hierarchyWhere}
      ORDER BY pm.meter_id ASC
    `;

    const [rows] = await db.query(csvQuery, [...params, ...hierarchyParams]);

    if (!rows.length) {
      return res.status(404).send('No data found for the selected filters.');
    }

    const fields = Object.keys(rows[0]);
    const csvRows = [fields.join(',')];

    for (const row of rows) {
      const values = fields.map(field => {
        const val = row[field];
        if (val === null || val === undefined) return '';
        if (typeof val === 'string' && val.includes(',')) return `"${val.replace(/"/g, '""')}"`;
        return val;
      });
      csvRows.push(values.join(','));
    }

    res.header('Content-Type', 'text/csv');
    res.attachment('meter_report.csv');
    res.send(csvRows.join('\n'));
  } catch (err) {
    console.error('API Error:', err.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/api/meters/pdf', async (req, res) => {
  res.json({ message: 'Use browser print and select Save as PDF for now.' });
});

// --- Grid / Building endpoints ---

app.get('/api/grids', async (req, res) => {
  try {
    const [rows] = await db.query(`SELECT grid_id AS id, grid_code AS code, grid_name AS name, grid_color AS color, location_lat AS lat, location_lng AS lng FROM grids WHERE status = 'active' ORDER BY grid_id`);
    res.json(rows);
  } catch (err) {
    console.error('API Error:', err.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/api/loops', async (req, res) => {
  try {
    res.json([]);
  } catch (err) {
    console.error('API Error:', err.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/api/buildings', async (req, res) => {
  try {
    const { grid_id } = req.query;
    let sql = `
      SELECT
        b.building_id AS id,
        b.grid_id AS gridId,
        g.grid_name AS gridName,
        b.building_code AS code,
        b.building_name AS name,
        b.floor_count AS floorCount
      FROM buildings b
      JOIN grids g ON b.grid_id = g.grid_id
      WHERE b.status = 'active'
    `;
    const params = [];
    if (grid_id) {
      sql += ' AND b.grid_id = ?';
      params.push(grid_id);
    }
    sql += ' ORDER BY b.building_name';
    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error('API Error:', err.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/api/areas', async (req, res) => {
  try {
    const { building_id } = req.query;
    let sql = `
      SELECT
        a.area_id AS id,
        a.building_id AS buildingId,
        a.area_code AS code,
        a.area_name AS name,
        a.area_type AS type,
        a.floor_number AS floorNumber
      FROM areas a
      JOIN buildings b ON a.building_id = b.building_id
      WHERE a.status = 'active'
    `;
    const params = [];
    if (building_id) {
      sql += ' AND a.building_id = ?';
      params.push(building_id);
    }
    sql += ' ORDER BY a.area_name';
    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error('API Error:', err.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/api/building-demand', async (req, res) => {
  try {
    const { grid_id, building_id, area_id, start_date, end_date } = req.query;
    let where = 'WHERE pm.reading_datetime IS NOT NULL';
    const params = [];

    if (grid_id) {
      where += ' AND g.grid_id = ?';
      params.push(grid_id);
    }
    if (building_id) {
      where += ' AND b.building_id = ?';
      params.push(building_id);
    }
    if (area_id) {
      where += ' AND a.area_id = ?';
      params.push(area_id);
    }
    if (start_date) {
      where += ' AND DATE(pm.reading_datetime) >= ?';
      params.push(start_date);
    }
    if (end_date) {
      where += ' AND DATE(pm.reading_datetime) <= ?';
      params.push(end_date);
    }

    const [rows] = await db.query(`
      SELECT
        DATE(pm.reading_datetime) AS date,
        b.building_id AS buildingId,
        b.building_name AS buildingName,
        SUM(pm.active_power) AS totalKw
      FROM power_meters pm
      JOIN areas a ON pm.area_id = a.area_id
      JOIN buildings b ON a.building_id = b.building_id
      JOIN grids g ON b.grid_id = g.grid_id
      ${where}
      GROUP BY DATE(pm.reading_datetime), b.building_id, b.building_name
      ORDER BY DATE(pm.reading_datetime), b.building_id
    `, params);

    res.json(rows);
  } catch (err) {
    console.error('API Error:', err.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/api/grid-demand', async (req, res) => {
  try {
    const { start_date, end_date, grid_id } = req.query;
    
    let mrWhere = 'WHERE 1=1';
    const mrParams = [];
    if (start_date) {
      mrWhere += ' AND mr.reading_datetime >= ?';
      mrParams.push(start_date.includes(' ') || start_date.includes('T') ? start_date.replace('T', ' ') : `${start_date} 00:00:00`);
    }
    if (end_date) {
      mrWhere += ' AND mr.reading_datetime <= ?';
      mrParams.push(end_date.includes(' ') || end_date.includes('T') ? end_date.replace('T', ' ') : `${end_date} 23:59:59`);
    }

    const cte = `
      WITH RankedReadings AS (
        SELECT 
          mr.meter_id,
          mr.current_reading,
          mr.reading_datetime,
          ROW_NUMBER() OVER (PARTITION BY mr.meter_id ORDER BY mr.reading_datetime ASC) as rn_asc,
          ROW_NUMBER() OVER (PARTITION BY mr.meter_id ORDER BY mr.reading_datetime DESC) as rn_desc
        FROM meter_readings mr
        ${mrWhere}
      )
    `;

    let mainWhere = '';
    const mainParams = [...mrParams];
    if (grid_id) {
      mainWhere = 'WHERE g.grid_id = ?';
      mainParams.push(grid_id);
    }

    const query = `
      ${cte}
      SELECT
        g.grid_id AS gridId,
        g.grid_name AS gridName,
        g.grid_color AS gridColor,
        SUM(COALESCE(last_read.current_reading, 0) - COALESCE(first_read.current_reading, 0)) AS totalKw
      FROM power_meters pm
      JOIN areas a ON pm.area_id = a.area_id
      JOIN buildings b ON a.building_id = b.building_id
      JOIN grids g ON b.grid_id = g.grid_id
      LEFT JOIN RankedReadings first_read ON pm.meter_id = first_read.meter_id AND first_read.rn_asc = 1
      LEFT JOIN RankedReadings last_read ON pm.meter_id = last_read.meter_id AND last_read.rn_desc = 1
      ${mainWhere}
      GROUP BY g.grid_id, g.grid_name, g.grid_color
      ORDER BY g.grid_id
    `;

    const [rows] = await db.query(query, mainParams);
    res.json(rows);
  } catch (err) {
    console.error('API Error:', err.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/api/grid-loop-demand', async (req, res) => {
  try {
    const { grid_id, start_date, end_date } = req.query;
    
    let mrWhere = 'WHERE 1=1';
    const mrParams = [];
    if (start_date) {
      mrWhere += ' AND mr.reading_datetime >= ?';
      mrParams.push(start_date.includes(' ') || start_date.includes('T') ? start_date.replace('T', ' ') : `${start_date} 00:00:00`);
    }
    if (end_date) {
      mrWhere += ' AND mr.reading_datetime <= ?';
      mrParams.push(end_date.includes(' ') || end_date.includes('T') ? end_date.replace('T', ' ') : `${end_date} 23:59:59`);
    }

    let hierarchyWhere = 'WHERE 1=1';
    const hierarchyParams = [];

    if (grid_id) {
      hierarchyWhere += ' AND g.grid_id = ?';
      hierarchyParams.push(grid_id);
    }

    const cte = `
      WITH RankedReadings AS (
        SELECT 
          mr.meter_id,
          mr.current_reading,
          mr.reading_datetime,
          ROW_NUMBER() OVER (PARTITION BY mr.meter_id ORDER BY mr.reading_datetime ASC) as rn_asc,
          ROW_NUMBER() OVER (PARTITION BY mr.meter_id ORDER BY mr.reading_datetime DESC) as rn_desc
        FROM meter_readings mr
        ${mrWhere}
      )
    `;

    const query = `
      ${cte}
      SELECT
        g.grid_id AS gridId,
        g.grid_name AS gridName,
        g.grid_color AS gridColor,
        b.building_id AS buildingId,
        b.building_code AS buildingCode,
        b.building_name AS buildingName,
        SUM(COALESCE(last_read.current_reading, 0) - COALESCE(first_read.current_reading, 0)) AS totalKw
      FROM power_meters pm
      JOIN areas a ON pm.area_id = a.area_id
      JOIN buildings b ON a.building_id = b.building_id
      JOIN grids g ON b.grid_id = g.grid_id
      LEFT JOIN RankedReadings first_read ON pm.meter_id = first_read.meter_id AND first_read.rn_asc = 1
      LEFT JOIN RankedReadings last_read ON pm.meter_id = last_read.meter_id AND last_read.rn_desc = 1
      ${hierarchyWhere}
      GROUP BY g.grid_id, g.grid_name, g.grid_color, b.building_id, b.building_code, b.building_name
      ORDER BY g.grid_id, b.building_id
    `;

    const [rows] = await db.query(query, [...mrParams, ...hierarchyParams]);
    res.json(rows);
  } catch (err) {
    console.error('API Error:', err.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/api/building-area-demand', async (req, res) => {
  try {
    const { grid_id, building_id, area_id, start_date, end_date } = req.query;
    
    let mrWhere = 'WHERE 1=1';
    const mrParams = [];
    if (start_date) {
      mrWhere += ' AND mr.reading_datetime >= ?';
      mrParams.push(start_date.includes(' ') || start_date.includes('T') ? start_date.replace('T', ' ') : `${start_date} 00:00:00`);
    }
    if (end_date) {
      mrWhere += ' AND mr.reading_datetime <= ?';
      mrParams.push(end_date.includes(' ') || end_date.includes('T') ? end_date.replace('T', ' ') : `${end_date} 23:59:59`);
    }

    let hierarchyWhere = 'WHERE 1=1';
    const hierarchyParams = [];

    if (grid_id) {
      hierarchyWhere += ' AND g.grid_id = ?';
      hierarchyParams.push(grid_id);
    }
    if (building_id) {
      hierarchyWhere += ' AND b.building_id = ?';
      hierarchyParams.push(building_id);
    }
    if (area_id) {
      hierarchyWhere += ' AND a.area_id = ?';
      hierarchyParams.push(area_id);
    }

    const cte = `
      WITH RankedReadings AS (
        SELECT 
          mr.meter_id,
          mr.current_reading,
          mr.reading_datetime,
          ROW_NUMBER() OVER (PARTITION BY mr.meter_id ORDER BY mr.reading_datetime ASC) as rn_asc,
          ROW_NUMBER() OVER (PARTITION BY mr.meter_id ORDER BY mr.reading_datetime DESC) as rn_desc
        FROM meter_readings mr
        ${mrWhere}
      )
    `;

    const query = `
      ${cte}
      SELECT
        b.building_id AS buildingId,
        b.building_name AS buildingName,
        a.area_id AS areaId,
        a.area_name AS areaName,
        g.grid_color AS gridColor,
        SUM(COALESCE(last_read.current_reading, 0) - COALESCE(first_read.current_reading, 0)) AS totalKw
      FROM power_meters pm
      JOIN areas a ON pm.area_id = a.area_id
      JOIN buildings b ON a.building_id = b.building_id
      JOIN grids g ON b.grid_id = g.grid_id
      LEFT JOIN RankedReadings first_read ON pm.meter_id = first_read.meter_id AND first_read.rn_asc = 1
      LEFT JOIN RankedReadings last_read ON pm.meter_id = last_read.meter_id AND last_read.rn_desc = 1
      ${hierarchyWhere}
      GROUP BY b.building_id, b.building_name, a.area_id, a.area_name, g.grid_color
      ORDER BY b.building_name, a.area_name
    `;

    const [rows] = await db.query(query, [...mrParams, ...hierarchyParams]);
    res.json(rows);
  } catch (err) {
    console.error('API Error:', err.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/api/monthly-grid-kw', async (req, res) => {
  try {
    const { year, grid_id } = req.query;
    let where = 'WHERE pm.reading_datetime IS NOT NULL AND YEAR(pm.reading_datetime) = ?';
    const params = [year || new Date().getFullYear()];

    if (grid_id) {
      where += ' AND g.grid_id = ?';
      params.push(grid_id);
    }

    const [rows] = await db.query(`
      SELECT
        MONTH(pm.reading_datetime) AS month_num,
        MONTHNAME(pm.reading_datetime) AS month_name,
        SUM(pm.active_power) AS total_kw
      FROM power_meters pm
      JOIN areas a ON pm.area_id = a.area_id
      JOIN buildings b ON a.building_id = b.building_id
      JOIN grids g ON b.grid_id = g.grid_id
      ${where}
      GROUP BY MONTH(pm.reading_datetime), MONTHNAME(pm.reading_datetime)
      ORDER BY month_num
    `, params);

    res.json(rows);
  } catch (err) {
    console.error('API Error:', err.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/api/meter-readings', async (req, res) => {
  try {
    const { meter_id, start_date, end_date } = req.query;
    if (!meter_id) {
      return res.status(400).json({ error: 'Missing required parameter: meter_id' });
    }

    let where = 'WHERE meter_id = ? AND reading_datetime IS NOT NULL';
    const params = [meter_id];

    if (start_date) {
      where += ' AND reading_datetime >= ?';
      params.push(start_date);
    }
    if (end_date) {
      where += ' AND reading_datetime <= ?';
      params.push(`${end_date} 23:59:59`);
    }

    const [rows] = await db.query(`
      SELECT
        meter_id,
        DATE(reading_datetime) as reading_datetime,
        AVG(vll) as vll,
        AVG(vln) as vln,
        AVG(amps) as amps,
        AVG(power_factor) as power_factor,
        AVG(active_power) as active_power,
        AVG(freq) as freq,
        AVG(reactive_power) as reactive_power,
        AVG(apparent_power) as apparent_power,
        MAX(total_energy) as total_energy
      FROM meter_readings
      ${where}
      GROUP BY meter_id, DATE(reading_datetime)
      ORDER BY DATE(reading_datetime) ASC
    `, params);

    res.json(rows);
  } catch (err) {
    console.error('API Error:', err.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/api/meter-averages', async (req, res) => {
  try {
    const { meter_id, start_date, end_date } = req.query;
    if (!meter_id) {
      return res.status(400).json({ error: 'Missing required parameter: meter_id' });
    }

    let where = 'WHERE meter_id = ? AND reading_datetime IS NOT NULL';
    const params = [meter_id];

    if (start_date) {
      where += ' AND reading_datetime >= ?';
      params.push(start_date);
    }
    if (end_date) {
      where += ' AND reading_datetime <= ?';
      params.push(`${end_date} 23:59:59`);
    }

    const [rows] = await db.query(`
      SELECT
        AVG(vll) AS avg_vll,
        AVG(vln) AS avg_vln,
        AVG(amps) AS avg_amp,
        AVG(power_factor) AS avg_pf,
        AVG(active_power) AS avg_act_p
      FROM meter_readings
      ${where}
    `, params);

    res.json(rows[0] || {});
  } catch (err) {
    console.error('API Error:', err.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// --- Settings CRUD endpoints ---

// Send a validation (400), duplicate-code (409), or server (500) error response
function sendCrudError(res, err) {
  console.error('Database Error:', err.message);
  if (err && err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ error: 'A record with this code already exists.' });
  }
  res.status(500).json({ error: 'Internal Server Error' });
}

function requireFields(body, fields) {
  const missing = fields.filter((f) => body[f] === undefined || body[f] === null || body[f] === '');
  return missing.length > 0 ? `Missing required field(s): ${missing.join(', ')}` : null;
}

// Grids
app.get('/api/settings/grids', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT
        grid_id AS id,
        grid_code AS code,
        grid_name AS name,
        grid_color AS color,
        location_lat AS lat,
        location_lng AS lng,
        status
      FROM grids
      ORDER BY grid_id
    `);
    res.json(rows);
  } catch (err) {
    console.error('API Error:', err.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/api/settings/grids', async (req, res) => {
  try {
    const invalid = requireFields(req.body, ['code', 'name']);
    if (invalid) return res.status(400).json({ error: invalid });
    const { code, name, color = '#3B82F6', lat = null, lng = null, status = 'active' } = req.body;
    const [result] = await db.query(
      'INSERT INTO grids (grid_code, grid_name, grid_color, location_lat, location_lng, status) VALUES (?, ?, ?, ?, ?, ?)',
      [code, name, color, lat, lng, status]
    );
    res.status(201).json({ id: result.insertId });
  } catch (err) {
    sendCrudError(res, err);
  }
});

app.put('/api/settings/grids/:id', async (req, res) => {
  try {
    const invalid = requireFields(req.body, ['code', 'name']);
    if (invalid) return res.status(400).json({ error: invalid });
    const { code, name, color = '#3B82F6', lat = null, lng = null, status = 'active' } = req.body;
    const [result] = await db.query(
      'UPDATE grids SET grid_code = ?, grid_name = ?, grid_color = ?, location_lat = ?, location_lng = ?, status = ? WHERE grid_id = ?',
      [code, name, color, lat, lng, status, req.params.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Grid not found.' });
    res.json({ id: parseInt(req.params.id, 10) });
  } catch (err) {
    sendCrudError(res, err);
  }
});

app.delete('/api/settings/grids/:id', async (req, res) => {
  try {
    const [result] = await db.query('UPDATE grids SET status = "inactive" WHERE grid_id = ?', [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Grid not found.' });
    res.json({ id: parseInt(req.params.id, 10), status: 'inactive' });
  } catch (err) {
    console.error('API Error:', err.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Loops
app.get('/api/settings/loops', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT
        l.loop_id AS id,
        l.grid_id AS gridId,
        g.grid_name AS gridName,
        l.loop_code AS code,
        l.loop_name AS name,
        l.status
      FROM loops l
      JOIN grids g ON l.grid_id = g.grid_id
      ORDER BY l.grid_id, l.loop_id
    `);
    res.json(rows);
  } catch (err) {
    console.error('API Error:', err.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/api/settings/loops', async (req, res) => {
  try {
    const invalid = requireFields(req.body, ['gridId', 'code', 'name']);
    if (invalid) return res.status(400).json({ error: invalid });
    const { gridId, code, name, status = 'active' } = req.body;
    const [result] = await db.query(
      'INSERT INTO loops (grid_id, loop_code, loop_name, status) VALUES (?, ?, ?, ?)',
      [gridId, code, name, status]
    );
    res.status(201).json({ id: result.insertId });
  } catch (err) {
    sendCrudError(res, err);
  }
});

app.put('/api/settings/loops/:id', async (req, res) => {
  try {
    const invalid = requireFields(req.body, ['gridId', 'code', 'name']);
    if (invalid) return res.status(400).json({ error: invalid });
    const { gridId, code, name, status = 'active' } = req.body;
    const [result] = await db.query(
      'UPDATE loops SET grid_id = ?, loop_code = ?, loop_name = ?, status = ? WHERE loop_id = ?',
      [gridId, code, name, status, req.params.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Loop not found.' });
    res.json({ id: parseInt(req.params.id, 10) });
  } catch (err) {
    sendCrudError(res, err);
  }
});

app.delete('/api/settings/loops/:id', async (req, res) => {
  try {
    const [result] = await db.query('UPDATE loops SET status = "inactive" WHERE loop_id = ?', [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Loop not found.' });
    res.json({ id: parseInt(req.params.id, 10), status: 'inactive' });
  } catch (err) {
    console.error('API Error:', err.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Buildings
app.get('/api/settings/buildings', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT
        b.building_id AS id,
        b.grid_id AS gridId,
        g.grid_name AS gridName,
        b.building_code AS code,
        b.building_name AS name,
        b.building_type AS type,
        b.floor_count AS floorCount,
        b.status
      FROM buildings b
      JOIN grids g ON b.grid_id = g.grid_id
      ORDER BY b.building_name
    `);
    res.json(rows);
  } catch (err) {
    console.error('API Error:', err.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/api/settings/buildings', async (req, res) => {
  try {
    const invalid = requireFields(req.body, ['gridId', 'code', 'name']);
    if (invalid) return res.status(400).json({ error: invalid });
    const { gridId, code, name, type = 'academic', floorCount = 1, status = 'active' } = req.body;
    const [result] = await db.query(
      'INSERT INTO buildings (grid_id, building_code, building_name, building_type, floor_count, status) VALUES (?, ?, ?, ?, ?, ?)',
      [gridId, code, name, type, floorCount, status]
    );
    res.status(201).json({ id: result.insertId });
  } catch (err) {
    sendCrudError(res, err);
  }
});

app.put('/api/settings/buildings/:id', async (req, res) => {
  try {
    const invalid = requireFields(req.body, ['gridId', 'code', 'name']);
    if (invalid) return res.status(400).json({ error: invalid });
    const { gridId, code, name, type = 'academic', floorCount = 1, status = 'active' } = req.body;
    const [result] = await db.query(
      'UPDATE buildings SET grid_id = ?, building_code = ?, building_name = ?, building_type = ?, floor_count = ?, status = ? WHERE building_id = ?',
      [gridId, code, name, type, floorCount, status, req.params.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Building not found.' });
    res.json({ id: parseInt(req.params.id, 10) });
  } catch (err) {
    sendCrudError(res, err);
  }
});

app.delete('/api/settings/buildings/:id', async (req, res) => {
  try {
    const [areas] = await db.query(`SELECT COUNT(*) as count FROM areas WHERE building_id = ? AND status = 'active'`, [req.params.id]);
    if (areas[0].count > 0) {
      return res.status(400).json({ error: 'Cannot delete building: It still contains active areas. Please reassign or delete them first.' });
    }

    const [result] = await db.query(`UPDATE buildings SET status = 'inactive' WHERE building_id = ?`, [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Building not found.' });
    res.json({ id: parseInt(req.params.id, 10), status: 'inactive' });
  } catch (err) {
    console.error('API Error:', err.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Areas
app.get('/api/settings/areas', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT
        a.area_id AS id,
        a.building_id AS buildingId,
        b.building_name AS buildingName,
        a.area_code AS code,
        a.area_name AS name,
        a.area_type AS type,
        a.floor_number AS floorNumber,
        a.status
      FROM areas a
      JOIN buildings b ON a.building_id = b.building_id
      ORDER BY b.building_name, a.area_name
    `);
    res.json(rows);
  } catch (err) {
    console.error('API Error:', err.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/api/settings/areas', async (req, res) => {
  try {
    const invalid = requireFields(req.body, ['buildingId', 'code', 'name']);
    if (invalid) return res.status(400).json({ error: invalid });
    const { buildingId, code, name, type = 'floor', floorNumber = null, status = 'active' } = req.body;
    const [result] = await db.query(
      'INSERT INTO areas (building_id, area_code, area_name, area_type, floor_number, status) VALUES (?, ?, ?, ?, ?, ?)',
      [buildingId, code, name, type, floorNumber, status]
    );
    res.status(201).json({ id: result.insertId });
  } catch (err) {
    sendCrudError(res, err);
  }
});

app.put('/api/settings/areas/:id', async (req, res) => {
  try {
    const invalid = requireFields(req.body, ['buildingId', 'code', 'name']);
    if (invalid) return res.status(400).json({ error: invalid });
    const { buildingId, code, name, type = 'floor', floorNumber = null, status = 'active' } = req.body;
    const [result] = await db.query(
      'UPDATE areas SET building_id = ?, area_code = ?, area_name = ?, area_type = ?, floor_number = ?, status = ? WHERE area_id = ?',
      [buildingId, code, name, type, floorNumber, status, req.params.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Area not found.' });
    res.json({ id: parseInt(req.params.id, 10) });
  } catch (err) {
    sendCrudError(res, err);
  }
});

app.delete('/api/settings/areas/:id', async (req, res) => {
  try {
    const [result] = await db.query('UPDATE areas SET status = "inactive" WHERE area_id = ?', [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Area not found.' });
    res.json({ id: parseInt(req.params.id, 10), status: 'inactive' });
  } catch (err) {
    console.error('API Error:', err.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Meters
app.get('/api/settings/meters', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT
        pm.meter_id AS id,
        pm.area_id AS areaId,
        a.area_name AS areaName,
        b.building_id AS buildingId,
        b.building_name AS buildingName,
        pm.meter_code AS code,
        pm.meter_description AS description,
        pm.meter_type AS type,
        pm.status
      FROM power_meters pm
      JOIN areas a ON pm.area_id = a.area_id
      JOIN buildings b ON a.building_id = b.building_id
      ORDER BY pm.meter_id
    `);
    res.json(rows);
  } catch (err) {
    console.error('API Error:', err.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/api/settings/meters', async (req, res) => {
  try {
    const invalid = requireFields(req.body, ['areaId', 'code', 'description']);
    if (invalid) return res.status(400).json({ error: invalid });
    const { areaId, code, description, type = 'main', status = 'down' } = req.body;
    const [result] = await db.query(
      'INSERT INTO power_meters (area_id, meter_code, meter_description, meter_type, status) VALUES (?, ?, ?, ?, ?)',
      [areaId, code, description, type, status]
    );
    res.status(201).json({ id: result.insertId });
  } catch (err) {
    sendCrudError(res, err);
  }
});

app.put('/api/settings/meters/:id', async (req, res) => {
  try {
    const invalid = requireFields(req.body, ['areaId', 'code', 'description']);
    if (invalid) return res.status(400).json({ error: invalid });
    const { areaId, code, description, type = 'main', status = 'down' } = req.body;
    const [result] = await db.query(
      'UPDATE power_meters SET area_id = ?, meter_code = ?, meter_description = ?, meter_type = ?, status = ? WHERE meter_id = ?',
      [areaId, code, description, type, status, req.params.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Meter not found.' });
    res.json({ id: parseInt(req.params.id, 10) });
  } catch (err) {
    sendCrudError(res, err);
  }
});

app.delete('/api/settings/meters/:id', async (req, res) => {
  try {
    const [result] = await db.query('DELETE FROM power_meters WHERE meter_id = ?', [req.params.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Meter not found.' });
    res.json({ id: parseInt(req.params.id, 10), deleted: true });
  } catch (err) {
    console.error('API Error:', err.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Users
app.get('/api/settings/users', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT
        user_id AS id,
        username,
        full_name AS fullName,
        role,
        status,
        last_login AS lastLogin
      FROM users
      ORDER BY user_id
    `);
    res.json(rows);
  } catch (err) {
    console.error('API Error:', err.message);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/api/settings/users', async (req, res) => {
  try {
    const invalid = requireFields(req.body, ['username', 'fullName', 'password', 'role']);
    if (invalid) return res.status(400).json({ error: invalid });
    const { username, fullName, password, role, status = 'active' } = req.body;
    if (!['admin', 'viewer'].includes(role)) {
      return res.status(400).json({ error: 'Role must be admin or viewer.' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long.' });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const [result] = await db.query(
      'INSERT INTO users (username, password_hash, full_name, role, status) VALUES (?, ?, ?, ?, ?)',
      [username, passwordHash, fullName, role, status]
    );
    res.status(201).json({ id: result.insertId });
  } catch (err) {
    sendCrudError(res, err);
  }
});

app.put('/api/settings/users/:id', async (req, res) => {
  try {
    const invalid = requireFields(req.body, ['username', 'fullName', 'role']);
    if (invalid) return res.status(400).json({ error: invalid });
    const { username, fullName, password, role, status = 'active' } = req.body;
    if (!['admin', 'viewer'].includes(role)) {
      return res.status(400).json({ error: 'Role must be admin or viewer.' });
    }
    if (password && password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long.' });
    }
    let result;
    if (password) {
      const passwordHash = await bcrypt.hash(password, 10);
      [result] = await db.query(
        'UPDATE users SET username = ?, full_name = ?, role = ?, status = ?, password_hash = ? WHERE user_id = ?',
        [username, fullName, role, status, passwordHash, req.params.id]
      );
    } else {
      [result] = await db.query(
        'UPDATE users SET username = ?, full_name = ?, role = ?, status = ? WHERE user_id = ?',
        [username, fullName, role, status, req.params.id]
      );
    }
    if (result.affectedRows === 0) return res.status(404).json({ error: 'User not found.' });
    res.json({ id: parseInt(req.params.id, 10) });
  } catch (err) {
    sendCrudError(res, err);
  }
});

app.delete('/api/settings/users/:id', async (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);
    if (req.user && req.user.id === userId) {
      return res.status(400).json({ error: 'You cannot deactivate your own account.' });
    }
    const [[target]] = await db.query('SELECT role, status FROM users WHERE user_id = ?', [userId]);
    if (!target) return res.status(404).json({ error: 'User not found.' });
    if (target.role === 'admin' && target.status === 'active') {
      const [[{ c }]] = await db.query(`SELECT COUNT(*) AS c FROM users WHERE role = 'admin' AND status = 'active'`);
      if (c <= 1) {
        return res.status(400).json({ error: 'Cannot deactivate the last active admin account.' });
      }
    }
    await db.query('UPDATE users SET status = "inactive" WHERE user_id = ?', [userId]);
    res.json({ id: userId, status: 'inactive' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`eTRAMS Admin Dashboard server running at http://localhost:${PORT}`);
});
