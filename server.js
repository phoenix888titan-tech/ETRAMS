const express = require('express');
const path = require('path');
const cors = require('cors');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
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
  return token ? sessions.get(token) || null : null;
}

function setSession(res, user) {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, user);
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=${token}; HttpOnly; Path=/; SameSite=Lax`);
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
    res.status(500).json({ error: err.message });
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
    res.status(500).json({ error: err.message });
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
    res.status(500).json({ error: err.message });
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

    const offset = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);
    const pageLimit = parseInt(limit, 10);

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
      where += ' AND pm.area_id = ?';
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

    const validSortColumns = ['meter_id', 'meter_code', 'current_reading', 'active_power', 'total_energy'];
    const sortColumn = validSortColumns.includes(sort) ? sort : 'meter_id';
    const sortOrder = order.toLowerCase() === 'desc' ? 'DESC' : 'ASC';

    const countQuery = `
      SELECT COUNT(*) AS total
      FROM power_meters pm
      JOIN areas a ON pm.area_id = a.area_id
      JOIN buildings b ON a.building_id = b.building_id
      JOIN grids g ON b.grid_id = g.grid_id
      ${where}
    `;

    const dataQuery = `
      SELECT
        pm.meter_id,
        pm.meter_code,
        pm.meter_description,
        pm.current_reading,
        pm.previous_reading,
        (pm.current_reading - pm.previous_reading) AS total_used,
        pm.active_power,
        pm.amps,
        pm.freq,
        pm.power_factor,
        pm.vll,
        pm.vln,
        pm.reactive_power,
        pm.apparent_power,
        pm.total_energy,
        pm.status,
        pm.reading_datetime,
        a.area_name,
        b.building_name,
        g.grid_name
      FROM power_meters pm
      JOIN areas a ON pm.area_id = a.area_id
      JOIN buildings b ON a.building_id = b.building_id
      JOIN grids g ON b.grid_id = g.grid_id
      ${where}
      ORDER BY ${sortColumn} ${sortOrder}
      LIMIT ? OFFSET ?
    `;

    const [[countResult]] = await db.query(countQuery, params);
    const [rows] = await db.query(dataQuery, [...params, pageLimit, offset]);

    res.json({
      data: rows,
      pagination: {
        page: parseInt(page, 10),
        limit: pageLimit,
        total: countResult.total,
        totalPages: Math.ceil(countResult.total / pageLimit)
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// CSV export
app.get('/api/meters/csv', async (req, res) => {
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
        pm.meter_code AS MeterID,
        pm.meter_description AS Description,
        b.building_name AS Building,
        a.area_name AS AreaFloor,
        g.grid_name AS Grid,
        pm.current_reading AS CurrentReading,
        pm.previous_reading AS PreviousReading,
        (pm.current_reading - pm.previous_reading) AS TotalUsed,
        pm.active_power AS ActivePower,
        pm.amps AS Amps,
        pm.power_factor AS PowerFactor,
        pm.vll AS VLL,
        pm.vln AS VLN,
        pm.total_energy AS TotalEnergy,
        pm.status AS Status,
        pm.reading_datetime AS ReadingDateTime
      FROM power_meters pm
      JOIN areas a ON pm.area_id = a.area_id
      JOIN buildings b ON a.building_id = b.building_id
      JOIN grids g ON b.grid_id = g.grid_id
      ${where}
      ORDER BY pm.meter_id
    `, params);

    const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
    const lines = [headers.join(','), ...rows.map((row) => headers.map((h) => `"${String(row[h] ?? '').replace(/"/g, '""')}"`).join(','))];
    const csv = lines.join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="etrams-report.csv"');
    res.send(csv);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PDF export placeholder
app.get('/api/meters/pdf', async (req, res) => {
  res.json({ message: 'Use browser print and select Save as PDF for now.' });
});

// --- Grid / Building endpoints ---

app.get('/api/grids', async (req, res) => {
  try {
    const [rows] = await db.query(`SELECT grid_id AS id, grid_code AS code, grid_name AS name, grid_color AS color, location_lat AS lat, location_lng AS lng FROM grids WHERE status = 'active' ORDER BY grid_id`);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/loops', async (req, res) => {
  try {
    res.json([]);
  } catch (err) {
    res.status(500).json({ error: err.message });
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
    res.status(500).json({ error: err.message });
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
    res.status(500).json({ error: err.message });
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
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/grid-demand', async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    let where = 'WHERE pm.reading_datetime IS NOT NULL';
    const params = [];

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
        g.grid_id AS gridId,
        g.grid_name AS gridName,
        g.grid_color AS gridColor,
        SUM(pm.active_power) AS totalKw
      FROM power_meters pm
      JOIN areas a ON pm.area_id = a.area_id
      JOIN buildings b ON a.building_id = b.building_id
      JOIN grids g ON b.grid_id = g.grid_id
      ${where}
      GROUP BY DATE(pm.reading_datetime), g.grid_id, g.grid_name, g.grid_color
      ORDER BY DATE(pm.reading_datetime), g.grid_id
    `, params);

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/grid-loop-demand', async (req, res) => {
  try {
    const { grid_id, start_date, end_date } = req.query;
    let where = 'WHERE pm.reading_datetime IS NOT NULL';
    const params = [];

    if (grid_id) {
      where += ' AND g.grid_id = ?';
      params.push(grid_id);
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
        g.grid_id AS gridId,
        g.grid_name AS gridName,
        g.grid_color AS gridColor,
        b.building_id AS buildingId,
        b.building_code AS buildingCode,
        b.building_name AS buildingName,
        SUM(pm.active_power) AS totalKw
      FROM power_meters pm
      JOIN areas a ON pm.area_id = a.area_id
      JOIN buildings b ON a.building_id = b.building_id
      JOIN grids g ON b.grid_id = g.grid_id
      ${where}
      GROUP BY g.grid_id, g.grid_name, g.grid_color, b.building_id, b.building_code, b.building_name
      ORDER BY g.grid_id, b.building_id
    `, params);

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/building-area-demand', async (req, res) => {
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
        b.building_id AS buildingId,
        b.building_name AS buildingName,
        a.area_id AS areaId,
        a.area_name AS areaName,
        g.grid_color AS gridColor,
        SUM(pm.active_power) AS totalKw
      FROM power_meters pm
      JOIN areas a ON pm.area_id = a.area_id
      JOIN buildings b ON a.building_id = b.building_id
      JOIN grids g ON b.grid_id = g.grid_id
      ${where}
      GROUP BY b.building_id, b.building_name, a.area_id, a.area_name, g.grid_color
      ORDER BY b.building_name, a.area_name
    `, params);

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
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
    res.status(500).json({ error: err.message });
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
        meter_code,
        reading_datetime,
        vll,
        vln,
        amps,
        power_factor,
        active_power,
        freq,
        reactive_power,
        apparent_power,
        total_energy,
        status
      FROM power_meters
      ${where}
      ORDER BY reading_datetime ASC
    `, params);

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
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
      FROM power_meters
      ${where}
    `, params);

    res.json(rows[0] || {});
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Settings CRUD endpoints ---

// Send a validation (400), duplicate-code (409), or server (500) error response
function sendCrudError(res, err) {
  if (err && err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ error: 'A record with this code already exists.' });
  }
  res.status(500).json({ error: err.message });
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
    res.status(500).json({ error: err.message });
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
    res.status(500).json({ error: err.message });
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
    res.status(500).json({ error: err.message });
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
    res.status(500).json({ error: err.message });
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
    res.status(500).json({ error: err.message });
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
    res.status(500).json({ error: err.message });
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
    res.status(500).json({ error: err.message });
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
    res.status(500).json({ error: err.message });
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
    res.status(500).json({ error: err.message });
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
    res.status(500).json({ error: err.message });
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
    res.status(500).json({ error: err.message });
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

app.listen(PORT, () => {
  console.log(`eTRAMS Admin Dashboard server running at http://localhost:${PORT}`);
});
