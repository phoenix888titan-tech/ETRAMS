const db = require('../db');
const bcrypt = require('bcryptjs');

const gridsData = [
  { code: 'GRID-001', name: 'Katipunan Grid (Loop 1)', color: '#E67E22' },
  { code: 'GRID-002', name: 'Katipunan Grid (Loop 2)', color: '#E74C3C' },
  { code: 'GRID-003', name: 'Katipunan Grid (Loop 3)', color: '#F1C40F' },
  { code: 'GRID-004', name: 'Barangka Grid', color: '#2ECC71' },
  { code: 'GRID-005', name: 'Balara Grid', color: '#5DADE2' },
  { code: 'GRID-006', name: 'Rock Well', color: '#9B59B6' },
  { code: 'GRID-007', name: 'Central Campus', color: '#1ABC9C' },
  { code: 'GRID-008', name: 'North Residence', color: '#34495E' },
  { code: 'GRID-009', name: 'South Complex', color: '#E91E63' }
];

const buildingNames = [
  'Bellarmine Hall', 'MVP Center', 'SOM Building', 'Faber Hall', 'Cervini Hall',
  'Eliazo Hall', 'Kostka Hall', 'Berchmans Hall', 'Gonzaga Hall', 'Matteo Ricci Hall',
  'Old Rizal Library', 'PLDT Hall', 'Chapel of the Eucharist', 'SEC A', 'SEC B',
  'SEC C', 'SEC D', 'Leong Hall', 'Arete', 'Church of the Gesù', 'Loyola Schools',
  'Martial Arts Center', 'Grade School', 'High School', 'University Dormitory',
  'Science Education Complex', 'Administration Building', 'University Health Center',
  'Central Plaza', 'Gonzaga Covered Courts'
];

const areaNames = [
  '1st Floor', '2nd Floor', '3rd Floor', '4th Floor', '5th Floor', '6th Floor',
  'Basement', 'Rooftop', 'Lobby', 'Main Hall', 'Conference Room', 'Server Room',
  'Parking Level 1', 'Parking Level 2', 'Parking Level 3', 'Utility Room',
  'Cafeteria', 'Library', 'Gymnasium', 'Auditorium', 'Laboratory', 'Faculty Room',
  'Student Lounge', 'Clinic', 'Storage Room', 'Electrical Room', 'Mechanical Room',
  'Hallway A', 'Hallway B', 'Atrium'
];

const areaTypes = ['floor', 'room', 'common_area', 'utility', 'parking', 'other'];
const buildingTypes = ['academic', 'residential', 'admin', 'utility', 'recreational'];

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min, max, decimals = 3) {
  const val = Math.random() * (max - min) + min;
  return parseFloat(val.toFixed(decimals));
}

function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomDate(start, end) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

function formatDateTime(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

async function seed() {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    console.log('Clearing existing data...');
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');
    await conn.query('TRUNCATE TABLE power_meters');
    await conn.query('TRUNCATE TABLE areas');
    await conn.query('TRUNCATE TABLE buildings');
    await conn.query('TRUNCATE TABLE grids');
    await conn.query('TRUNCATE TABLE users');
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');

    console.log('Seeding grids...');
    await conn.query(
      'INSERT INTO grids (grid_code, grid_name, grid_color, location_lat, location_lng) VALUES ?',
      [gridsData.map((g, idx) => [g.code, g.name, g.color, 14.638 + idx * 0.005, 121.078 + idx * 0.005])]
    );

    console.log('Seeding users...');
    await conn.query('INSERT INTO users (username, password_hash, full_name, role) VALUES ?', [
      [
        ['admin', bcrypt.hashSync('admin123', 10), 'Administrator', 'admin'],
        ['viewer', bcrypt.hashSync('viewer123', 10), 'Viewer', 'viewer']
      ]
    ]);

    const [allGrids] = await conn.query('SELECT grid_id, grid_code, grid_name FROM grids');

    console.log('Seeding buildings...');
    const buildingsValues = [];
    let buildingNameIndex = 0;
    for (const grid of allGrids) {
      const count = randomInt(8, 15);
      for (let i = 0; i < count; i++) {
        const baseName = buildingNames[buildingNameIndex % buildingNames.length];
        buildingNameIndex++;
        const name = `${baseName} — ${grid.grid_code}`;
        buildingsValues.push([
          grid.grid_id,
          `${grid.grid_code}-BLDG-${String(i + 1).padStart(2, '0')}`,
          name,
          randomChoice(buildingTypes),
          randomInt(1, 10)
        ]);
      }
    }
    await conn.query('INSERT INTO buildings (grid_id, building_code, building_name, building_type, floor_count) VALUES ?', [buildingsValues]);

    const [allBuildings] = await conn.query('SELECT building_id, building_name, floor_count FROM buildings');

    console.log('Seeding areas...');
    const areasValues = [];
    let areaNameIndex = 0;
    for (const building of allBuildings) {
      const count = randomInt(3, 10);
      for (let i = 0; i < count; i++) {
        const areaName = areaNames[areaNameIndex % areaNames.length];
        areaNameIndex++;
        const areaType = areaName.includes('Parking') ? 'parking'
          : areaName.includes('Room') || areaName.includes('Laboratory') || areaName.includes('Clinic') ? 'room'
          : areaName.includes('Utility') || areaName.includes('Electrical') || areaName.includes('Mechanical') ? 'utility'
          : areaName.includes('Lobby') || areaName.includes('Hall') || areaName.includes('Lounge') || areaName.includes('Atrium') ? 'common_area'
          : 'floor';
        const floorNumber = areaType === 'floor' && /^\d/.test(areaName)
          ? parseInt(areaName.match(/\d/)[0], 10)
          : (areaName === 'Basement' ? -1 : (areaName === 'Rooftop' ? building.floor_count : null));

        areasValues.push([
          building.building_id,
          `AREA-${String(areasValues.length + 1).padStart(5, '0')}`,
          areaName,
          areaType,
          floorNumber
        ]);
      }
    }
    await conn.query('INSERT INTO areas (building_id, area_code, area_name, area_type, floor_number) VALUES ?', [areasValues]);

    const [allAreas] = await conn.query('SELECT area_id, area_code FROM areas');

    console.log('Seeding power meters...');
    const startDate = new Date('2026-06-01T00:00:00');
    const endDate = new Date('2026-07-30T23:59:59');
    const meterValues = [];

    for (let i = 1; i <= 500; i++) {
      const area = randomChoice(allAreas);
      const currentReading = randomFloat(1000, 300000, 3);
      const previousReading = Math.random() > 0.8 ? randomFloat(0, currentReading, 3) : 0;
      const totalUsed = parseFloat((currentReading - previousReading).toFixed(3));
      const status = Math.random() < 0.1 ? 'live' : 'down';

      meterValues.push([
        area.area_id,
        String(i).padStart(4, '0'),
        `Power_param_${i}_Total_KWh_db`,
        randomChoice(['main', 'submeter', 'backup']),
        currentReading,
        previousReading,
        totalUsed,
        randomFloat(1, 400, 3),
        randomFloat(0, 100, 3),
        randomFloat(59.5, 60.5, 3),
        randomFloat(0.7, 1.0, 3),
        randomFloat(380, 420, 3),
        randomFloat(220, 240, 3),
        randomFloat(0, 50, 3),
        randomFloat(0, 100, 3),
        currentReading,
        status,
        formatDateTime(randomDate(startDate, endDate))
      ]);
    }

    await conn.query(`
      INSERT INTO power_meters (
        area_id, meter_code, meter_description, meter_type,
        current_reading, previous_reading, total_used,
        active_power, amps, freq, power_factor, vll, vln,
        reactive_power, apparent_power, total_energy,
        status, reading_datetime
      ) VALUES ?
    `, [meterValues]);

    await conn.commit();

    const [[gridCount]] = await conn.query('SELECT COUNT(*) AS c FROM grids');
    const [[buildingCount]] = await conn.query('SELECT COUNT(*) AS c FROM buildings');
    const [[areaCount]] = await conn.query('SELECT COUNT(*) AS c FROM areas');
    const [[meterCount]] = await conn.query('SELECT COUNT(*) AS c FROM power_meters');

    console.log('\nSeed complete:');
    console.log(`  Grids:     ${gridCount.c}`);
    console.log(`  Buildings: ${buildingCount.c}`);
    console.log(`  Areas:     ${areaCount.c}`);
    console.log(`  Meters:    ${meterCount.c}`);
    console.log('  Users:     2 (admin/admin123, viewer/viewer123)');
  } catch (err) {
    await conn.rollback();
    console.error('Seed failed:', err);
    process.exit(1);
  } finally {
    conn.release();
    process.exit(0);
  }
}

seed();
