# eTRAMS Admin Meter Dashboard

A responsive, interactive admin dashboard for the **eNERGY Technical Reporting Analysis Management System (eTRAMS)**. It monitors power meter status across a campus grid infrastructure using a MySQL-backed Node.js/Express API.

---

## Project Structure

```
etrams-admin/
├── README.md
├── package.json
├── server.js                 # Express server + API routes
├── db.js                     # MySQL connection pool
├── database/
│   ├── schema.sql            # CREATE TABLE statements
│   └── seed.js               # Seed script for grids, loops, buildings, areas, meters
└── public/
    ├── index.html            # Dashboard UI
    ├── styles.css            # Responsive styles
    └── app.js                # Frontend logic
```

---

## Requirements

- Node.js 18+
- MySQL 8+

MySQL must allow connections from `root` with no password (or set env vars below).

---

## Setup

### 1. Create the database and schema

```bash
cd etrams-admin
mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS etrams CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -u root -p etrams < database/schema.sql
```

If `root` has no password, omit `-p`.

### 2. Install Node dependencies

```bash
npm install
```

### 3. Seed the database

```bash
npm run seed
```

This inserts:
- 9 grids
- 45 loops (5 per grid)
- ~300 buildings (5-10 per loop)
- ~1,500 areas (3-10 per building)
- 500 power meters with realistic readings

### 4. Start the server

```bash
npm start
```

The dashboard will be available at:

```
http://localhost:3000
```

---

## Database Connection

Default credentials (in `db.js`):

| Setting | Default |
|---|---|
| Host | `localhost` |
| User | `root` |
| Password | (empty) |
| Database | `etrams` |

Override with environment variables:

```bash
DB_HOST=localhost DB_USER=root DB_PASSWORD=secret DB_NAME=etrams npm start
```

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/health` | Database health check |
| GET | `/api/filters` | Dropdown options (grids, buildings, statuses, months, years) |
| GET | `/api/summary` | Total / LIVE / DOWN counts |
| GET | `/api/meters` | Paginated meter list with filters |
| GET | `/api/meters/csv` | CSV export with current filters |
| GET | `/api/meters/pdf` | PDF export placeholder (uses browser print) |
| GET | `/api/grids` | All active grids |
| GET | `/api/loops` | Loops, optionally filtered by `grid_id` |
| GET | `/api/buildings` | Buildings, optionally filtered by `grid_id`/`loop_id` |
| GET | `/api/areas` | Areas, optionally filtered by `building_id` |
| GET | `/api/building-demand` | Daily aggregated building kW demand |
| GET | `/api/grid-demand` | Daily aggregated grid kW demand |
| GET | `/api/grid-loop-demand` | Aggregated kW demand per grid-loop combination |

### Query parameters for `/api/meters`

- `grid_id`
- `building_id`
- `status` — `live`, `down`, `maintenance`, `offline`
- `month` — 1-12
- `year` — e.g. 2025, 2026
- `page` — default 1
- `limit` — default 25
- `sort` — `meter_id`, `meter_code`, `current_reading`, `active_power`, `total_energy`
- `order` — `asc` or `desc`

---

## Frontend Sections

1. **AppHeader** — gradient header with logo, title, system settings
2. **SidebarNav** — deep navy navigation with active Meter item
3. **PageHeader** — "Meter Status Report" title with CSV/PDF actions
4. **FilterControlBar** — report type, grid, building, status, month, year
5. **StatusSummaryBar** — total / LIVE / DOWN counts
6. **MeterDataTable** — 15-column table with sortable meter ID, status dots, two-line descriptions
7. **Building Energy Demand page** (`building.html`) — React page connected to DB with power demand chart, building tabs, building/monthly charts, and summary footer
8. **Grid Energy Demand page** (`grid.html`) — React page connected to DB with cascading grid/loop filters, 30-day line chart, building selector tabs, and consumption charts

---

## Responsive Breakpoints

- **Desktop (≥1280px)** — full 240px sidebar, filters in one row, full table
- **Tablet (768–1279px)** — collapsed icon sidebar, wrapping filters, horizontal table scroll
- **Mobile (<768px)** — hamburger drawer sidebar, stacked filters, card view per meter

---

## Scripts

```bash
npm install   # install dependencies
npm run seed  # seed the database
npm start     # start the Express server
```
