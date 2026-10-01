const db = require('../db');

async function aggregateMonth(year, month) {
  const start_dt = `${year}-${String(month).padStart(2, '0')}-01 00:00:00`;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const end_dt = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01 00:00:00`;

  const query = `
    WITH RankedReadings AS (
      SELECT 
        mr.meter_id,
        mr.current_reading,
        ROW_NUMBER() OVER (PARTITION BY mr.meter_id ORDER BY mr.reading_datetime ASC) as rn_asc,
        ROW_NUMBER() OVER (PARTITION BY mr.meter_id ORDER BY mr.reading_datetime DESC) as rn_desc
      FROM meter_readings mr
      WHERE mr.reading_datetime >= ? AND mr.reading_datetime < ?
    ),
    MeterBounds AS (
      SELECT 
        meter_id,
        MAX(CASE WHEN rn_asc = 1 THEN current_reading END) as first_reading,
        MAX(CASE WHEN rn_desc = 1 THEN current_reading END) as last_reading
      FROM RankedReadings
      WHERE rn_asc = 1 OR rn_desc = 1
      GROUP BY meter_id
    )
    SELECT
      g.grid_id AS grid_id,
      g.grid_name AS grid_name,
      ? AS year,
      ? AS month,
      SUM(COALESCE(mb.last_reading, 0) - COALESCE(mb.first_reading, 0)) AS total_kw
    FROM power_meters pm
    JOIN areas a ON pm.area_id = a.area_id
    JOIN buildings b ON a.building_id = b.building_id
    JOIN grids g ON b.grid_id = g.grid_id
    JOIN MeterBounds mb ON pm.meter_id = mb.meter_id
    GROUP BY g.grid_id, g.grid_name
    ORDER BY g.grid_id
  `;

  const [rows] = await db.query(query, [start_dt, end_dt, year, month]);
  console.log(`Year ${year}, Month ${month}: found ${rows.length} grid records`);
  for (const row of rows) {
    console.log(`  -> Grid ${row.grid_id} (${row.grid_name}): ${row.total_kw} kW`);
    await db.query(
      `INSERT INTO kw_aggregated_monthly (grid_id, year, month, total_kw) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE total_kw = VALUES(total_kw), updated_at = CURRENT_TIMESTAMP`,
      [row.grid_id, row.year, row.month, row.total_kw]
    );
  }
}

(async () => {
  try {
    const [monthRows] = await db.query(
      `SELECT DISTINCT YEAR(reading_datetime) AS yr, MONTH(reading_datetime) AS mo 
       FROM meter_readings 
       WHERE reading_datetime IS NOT NULL 
       ORDER BY yr, mo`
    );
    console.log(`Found ${monthRows.length} distinct (year, month) period(s) in meter_readings:`, monthRows);
    for (const { yr, mo } of monthRows) {
      console.log(`Processing Year ${yr}, Month ${mo}...`);
      await aggregateMonth(yr, mo);
    }
    console.log('Backfill complete!');
    process.exit(0);
  } catch (err) {
    console.error('Backfill error:', err);
    process.exit(1);
  }
})();
