const db = require('../db');

async function aggregateYear(year) {
  const dateParams = [`${year}-01-01 00:00:00`, `${parseInt(year) + 1}-01-01 00:00:00`];
  const cte = `
    WITH RankedReadings AS (
      SELECT 
        mr.meter_id,
        MONTH(mr.reading_datetime) as read_month,
        mr.current_reading,
        ROW_NUMBER() OVER (PARTITION BY mr.meter_id, MONTH(mr.reading_datetime) ORDER BY mr.reading_datetime ASC) as rn_asc,
        ROW_NUMBER() OVER (PARTITION BY mr.meter_id, MONTH(mr.reading_datetime) ORDER BY mr.reading_datetime DESC) as rn_desc
      FROM meter_readings mr
      JOIN power_meters pm ON mr.meter_id = pm.meter_id
      JOIN areas a ON pm.area_id = a.area_id
      JOIN buildings b ON a.building_id = b.building_id
      JOIN grids g ON b.grid_id = g.grid_id
      WHERE mr.reading_datetime >= ? AND mr.reading_datetime < ?
    )
  `;
  const query = `
    ${cte}
    SELECT
      g.grid_id AS grid_id,
      ${year} AS year,
      first_read.read_month AS month,
      SUM(COALESCE(last_read.current_reading,0) - COALESCE(first_read.current_reading,0)) AS total_kw
    FROM power_meters pm
    JOIN areas a ON pm.area_id = a.area_id
    JOIN buildings b ON a.building_id = b.building_id
    JOIN grids g ON b.grid_id = g.grid_id
    JOIN RankedReadings first_read ON pm.meter_id = first_read.meter_id AND first_read.rn_asc = 1
    JOIN RankedReadings last_read ON pm.meter_id = last_read.meter_id AND last_read.rn_desc = 1 AND first_read.read_month = last_read.read_month
    GROUP BY g.grid_id, month
  `;
  const [rows] = await db.query(query, [...dateParams, ...dateParams]);
  for (const row of rows) {
    await db.query(
      `INSERT INTO kw_aggregated_monthly (grid_id, year, month, total_kw) VALUES (?,?,?,?) ON DUPLICATE KEY UPDATE total_kw = VALUES(total_kw), updated_at = CURRENT_TIMESTAMP`,
      [row.grid_id, row.year, row.month, row.total_kw]
    );
  }
}

(async () => {
  try {
    const [[{ years }]] = await db.query(`SELECT GROUP_CONCAT(DISTINCT YEAR(reading_datetime)) AS years FROM meter_readings`);
    const yearArray = years ? years.split(',').map(y => parseInt(y, 10)) : [];
    for (const yr of yearArray) {
      await aggregateYear(yr);
      console.log(`Aggregated year ${yr}`);
    }
    console.log('Backfill complete');
    process.exit(0);
  } catch (err) {
    console.error('Backfill error', err);
    process.exit(1);
  }
})();
