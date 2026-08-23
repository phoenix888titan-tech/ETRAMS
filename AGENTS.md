# AGENTS.md — eTRAMS Admin Meter Dashboard

Guidance for AI coding agents working in this repository. Assumes no prior knowledge of the project.

## Project Overview

**eTRAMS** (eNERGY Technical Reporting Analysis Management System) is an admin dashboard that monitors power meter status and energy demand across a campus grid infrastructure. It is a small, monolithic Node.js application: a MySQL-backed Express API that also serves a static frontend. There is **no build step, no bundler, no transpiler** — everything runs as plain JavaScript.

- Package name: `etrams-admin-dashboard` (see `package.json`)
- Entry point: `server.js`
- Runtime requirements: Node.js 18+, MySQL 8+
- Not a git repository (no version control initialized, no `.gitignore`)

## Technology Stack

- **Backend**: Node.js + Express 4 (`express`, `cors`), MySQL via `mysql2/promise` connection pool, `bcryptjs` for password hashing. All code is CommonJS (`require`/`module.exports`).
- **Database**: MySQL 8, database name `etrams` (utf8mb4). Schema in `database/schema.sql`, seed data generator in `database/seed.js`.
- **Frontend** (all static files in `public/`, served by `express.static`):
  - `login.html` + `login.js` + `login.css` — Login page (vanilla JS, Tailwind CDN, `etrams.jpg` logo). Authenticates against `/api/auth/login`, stores the user in `sessionStorage('etrams_user')`, redirects to `/index.html`.
  - `auth.js` — shared client guard included by every authenticated page: redirects to `/login.html` when no session user exists, gates `settings.html` to admins, wraps `fetch` to bounce on 401, injects the header user-chip/sign-out styles, wires `#btn-logout`.
  - `sidebar.js` — shared sidebar navigation as the `<etrams-sidebar>` custom element (classic script IIFE, light DOM, no shadow DOM). The host element itself gets `class="SidebarNav" id="SidebarNav"` (replacing the old per-page `<aside>` copies), so existing per-page CSS and `.SidebarNav.collapsed ~ .main-content` sibling selectors keep working. It owns the toggle button, mobile overlay (`mobile-open` class), and navigation; the `active` attribute (e.g. `<etrams-sidebar active="btn-nav-grid">`) selects the highlighted item, which gets no click handler. Every page loads it via `<script src="sidebar.js"></script>` before its page script.
  - `index.html` + `app.js` + `styles.css` — Meter Status Report page, **vanilla JS** (DOM manipulation, module-level `state` object) with hand-written responsive CSS.
  - `building.html` + `building.js` + `building.css` — Building Energy Demand page, **React 18 loaded from esm.sh CDN** with `htm` tagged templates instead of JSX (no compilation), Chart.js 4 + chartjs-plugin-datalabels from esm.sh, Tailwind via the CDN play script.
  - `grid.html` + `grid.js` + `grid.css` — Grid Energy Demand page, same React/htm/Chart.js/Tailwind-CDN approach, plus `html2canvas` and `jsPDF` from cdnjs for client-side PDF export.
  - `settings.html` + `settings.js` + `settings.css` — System Settings page, same React/htm/Tailwind-CDN approach (no Chart.js). Tabs: Themes (empty placeholder), Grid, Loop, Building, Area, Meters, Users — full CRUD over the grid hierarchy and user accounts via the `/api/settings/*` endpoints. **Admin role only.**

## Build and Run Commands

```bash
npm install        # install dependencies (express, cors, mysql2)
npm run schema     # apply database/schema.sql (mysql -u root -p etrams < database/schema.sql)
npm run seed       # node database/seed.js — DESTRUCTIVE: truncates and re-seeds all tables
npm start          # node server.js — serves API + frontend at http://localhost:3000
```

There is **no test suite, no linter, no formatter, and no build script** (`devDependencies` is empty, no `test` script). Verify changes manually:

- `curl http://localhost:3000/api/health` — should return `{"status":"ok","database":"connected"}`
- Exercise endpoints with query params, e.g. `curl "http://localhost:3000/api/meters?status=live&page=1&limit=5"`

### Database connection

Configured in `db.js` via a `mysql2` pool (`connectionLimit: 10`, `dateStrings: true`). Overridable with environment variables: `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, plus `PORT` for the server.

## Code Organization

```
etrams-admin/
├── server.js          # Express app + ALL API routes (single file, ~900 lines)
├── db.js              # mysql2/promise connection pool, reads DB_* env vars
├── database/
│   ├── schema.sql     # CREATE TABLE statements (drops and recreates tables)
│   ├── add-users.sql  # Non-destructive migration: adds users table + default accounts only
│   └── seed.js        # Randomized seed: 9 grids, 45 loops, ~300 buildings, ~1500 areas, 500 meters, 2 users
└── public/            # Static frontend (four independent pages, see above)
```

### Data model hierarchy

Every meter query joins through this fixed chain:

```
grids → loops → buildings → areas → power_meters
```

- `power_meters.status` is an ENUM: `live`, `down`, `maintenance`, `offline`
- All other tables have `status` ENUM `active`/`inactive`; list endpoints filter `WHERE status = "active"`
- `power_meters.reading_datetime` drives the month/year filters and the daily demand aggregations (`SUM(active_power)` grouped by `DATE(reading_datetime)`)
- The `users` table (login accounts) is independent of the hierarchy: `username` (unique), `password_hash` (bcrypt), `full_name`, `role` ENUM `admin`/`viewer`, `status` ENUM `active`/`inactive`, `last_login`

### Authentication

The app requires login. `POST /api/auth/login` verifies a bcrypt hash and issues a random token stored in an **in-memory `Map`** (server restart logs everyone out), set as an HttpOnly `etrams_token` cookie (parsed manually — no `cookie-parser` dependency). Middleware in `server.js`:

- Every `/api/*` route returns `401` without a valid session, except `/api/health` and `/api/auth/login`.
- Every `/api/settings/*` route additionally requires role `admin` (`403` otherwise).
- Requests for `.html` pages (and `/`) redirect to `/login.html` when unauthenticated.

Auth routes: `POST /api/auth/login` (`{ username, password }` → `{ id, username, fullName, role }`), `POST /api/auth/logout`, `GET /api/auth/me`.

Default seeded accounts: **`admin`/`admin123`** and **`viewer`/`viewer123`** — change these before any real deployment. `database/add-users.sql` is a non-destructive migration that adds the `users` table (with the default accounts) to an existing database.

### API routes (all in `server.js`)

Read-only GET routes for the dashboard pages:

| Endpoint | Purpose |
|---|---|
| `/api/health` | DB connectivity check |
| `/api/filters` | Dropdown options (grids, buildings, statuses, months, years) |
| `/api/summary` | Total / live / down counts with the same filters as `/api/meters` |
| `/api/meters` | Paginated, filterable, sortable meter list (filters include `area_id`) |
| `/api/meters/csv` | CSV export with the current filters |
| `/api/meters/pdf` | Placeholder — tells the client to use browser print-to-PDF |
| `/api/meter-readings`, `/api/meter-averages` | Per-meter readings (`meter_id`, optional `start_date`/`end_date`) and column averages for the Meter Status page |
| `/api/monthly-grid-kw` | Monthly kW demand per `year`, optional `grid_id` (rows: `month_num`, `month_name`, `total_kw`) |
| `/api/grids`, `/api/loops`, `/api/buildings`, `/api/areas` | Cascading lookup lists for the Building/Grid pages |
| `/api/building-demand`, `/api/building-area-demand` | Building/area kW demand aggregations |
| `/api/grid-demand`, `/api/grid-loop-demand` | Grid/loop kW demand aggregations |

CRUD routes for the Settings page (`GET` lists **all** rows including inactive, with parent names joined in; bodies/responses are camelCase JSON):

| Endpoint | Purpose |
|---|---|
| `GET/POST /api/settings/grids`, `PUT/DELETE /api/settings/grids/:id` | Grid CRUD (`grid_code`, `grid_name`, `grid_color`, `location_lat/lng`, `status`) |
| `GET/POST /api/settings/loops`, `PUT/DELETE /api/settings/loops/:id` | Loop CRUD (`grid_id`, `loop_code`, `loop_name`, `status`) |
| `GET/POST /api/settings/buildings`, `PUT/DELETE /api/settings/buildings/:id` | Building CRUD (`loop_id`, `building_code`, `building_name`, `building_type`, `floor_count`, `status`) |
| `GET/POST /api/settings/areas`, `PUT/DELETE /api/settings/areas/:id` | Area CRUD (`building_id`, `area_code`, `area_name`, `area_type`, `floor_number`, `status`) |
| `GET/POST /api/settings/meters`, `PUT/DELETE /api/settings/meters/:id` | Meter CRUD (`area_id`, `meter_code`, `meter_description`, `meter_type`, `status`; telemetry/reading columns are not editable) |
| `GET/POST /api/settings/users`, `PUT/DELETE /api/settings/users/:id` | User CRUD (`username`, `full_name`, `role` admin/viewer, `status`; `password` required on create, optional reset on edit — always bcrypt-hashed server-side, never returned) |

Delete semantics: grids/loops/buildings/areas/users are **soft-deleted** (`status = 'inactive'`, so they vanish from the active-only lookup endpoints); meters are **hard-deleted**. User delete additionally refuses to deactivate your own account or the last active admin (`400`). Validation errors return `400`, duplicate codes/usernames return `409` (via the `sendCrudError` helper), not-found returns `404`.

## Conventions and Patterns

Follow these when modifying the code; they are the established style of the repo.

### Backend (`server.js`, `db.js`, `database/seed.js`)

- One route handler per endpoint, written inline as `app.get('/api/...', async (req, res) => { ... })` — no routers, controllers, or middleware layers. New endpoints should follow the same shape.
- **Always use parameterized queries** (`?` placeholders with a `params` array). Dynamic `WHERE` clauses are built by appending to a `where` string starting from `'WHERE 1=1'` (or `WHERE pm.reading_datetime IS NOT NULL` for demand endpoints) and pushing values onto `params`. Never interpolate user input into SQL.
- The only allowed string interpolation into SQL is the sort column in `/api/meters`, which is protected by a whitelist (`validSortColumns`) and an asc/desc check. Reuse this whitelist pattern if adding sortable endpoints.
- Responses: success returns `res.json(rows)` or `res.json({ data, pagination })`; errors return `res.status(500).json({ error: err.message })`.
- Result columns are aliased to camelCase for the frontend (e.g. `grid_id AS id`, `building_name AS buildingName`) on the Building/Grid page endpoints; the meter table endpoints return snake_case column names directly.
- Seed script (`database/seed.js`) is fully randomized and **truncates every table** inside a transaction before inserting. Run it only on a disposable database.

### Frontend

- All pages call the API same-origin via `const API_BASE = '';` and `fetch()` — keep it that way.
- `index.html`/`app.js`: vanilla JS with a module-level `state` object (filters, pagination, sort), an `els` map of DOM references, and re-render functions called after each state change. Element IDs use `filter-*`, `btn-*`, `summary-*` prefixes; CSS classes use PascalCase component names (`AppHeader`, `SidebarNav`, `MeterDataTable`). The sidebar markup/wiring lives entirely in the shared `sidebar.js` custom element — `index.html` just places `<etrams-sidebar active="btn-nav-meter">` and `app.js` has no sidebar code.
- `building.js`/`grid.js`/`settings.js`: React 18 via esm.sh imports at the top of the file, JSX-free through `const html = htm.bind(React.createElement)`. Components are plain functions returning `` html`...` ``; everything lives in the one JS file per page. Chart.js instances are created in `useEffect` refs and destroyed on cleanup.
- `settings.js` drives all five CRUD tabs from one `ENTITIES` config object (columns, form fields, FK cascade chain, payload mapping) feeding generic `CrudTable`/`CrudModal` components; extend the config rather than writing per-entity components.
- Tailwind is configured inline in each HTML file with a shared custom palette (`sidebar`, `primary`, `primary-dark`, `text-primary`, `text-secondary`, Inter font). Match these tokens rather than inventing new colors; page-specific styling goes in the page's own CSS file.
- Responsive design breakpoints used across the CSS: desktop ≥1280px (full sidebar), tablet 768–1279px (collapsed icon sidebar), mobile <768px (drawer sidebar, stacked filters, card view).
- The sidebar "Dashboard" link points to the local `/dashboard.html`; Grid/Building/Meter Status links are local too (`/grid.html`, `/building.html`, `/meterstatus.html`); the Settings nav item links to `/settings.html` (and is hidden for non-admin users by `auth.js`), while the header gear button on every page navigates to `/settings.html`. All nav targets are defined once in the `NAV_ITEMS` array in `public/sidebar.js`.

## Testing Instructions

There is no automated testing infrastructure. When changing behavior:

1. Ensure MySQL is running and the `etrams` database is seeded (`npm run seed`).
2. Start the server (`npm start`) and hit `/api/health`.
3. Exercise the affected endpoint(s) directly with `curl`, including filter/pagination/sort combinations.
4. For frontend changes, load the page in a browser and check both the rendered UI and the browser console for errors.

## Security Considerations

- **Hardcoded credential fallback**: `db.js` defaults `DB_PASSWORD` to a real-looking password (`'1nt3gr1ty'`). Do not commit additional secrets; prefer env vars. (Note: `README.md` claims the default is an empty password — the code is the source of truth.)
- The API now requires login (see **Authentication** above), but sessions are in-memory tokens and `cors()` is still wide open. Treat it as internal-network-only; do not expose it publicly without hardening auth (persistent sessions, rate limiting, HTTPS-only cookies).
- Passwords are bcrypt-hashed (`bcryptjs`); never store or log plaintext. The seeded default passwords (`admin123`, `viewer123`) must be changed for any real deployment.
- SQL injection surface is currently controlled (parameterized queries + sort whitelist) — preserve both patterns when editing or adding queries.
- CSV export (`/api/meters/csv`) quotes and escapes values; keep the escaping (`"` → `""`) intact if modifying it.
- `database/seed.js` and `database/schema.sql` both destroy existing data (TRUNCATE / DROP TABLE). Never run them against production data.

## Deployment

No deployment tooling exists in the repo (no Dockerfile, CI config, or process manager). Deployment is simply: provision MySQL, apply schema, seed, `npm install`, and run `npm start` (or `node server.js`) with the `DB_*`/`PORT` env vars set. The Express process serves both the API and the static frontend on a single port (default 3000).

## Known Quirks

- `README.md` is slightly out of date: it omits the `/api/building-area-demand` endpoint and the `public/building.*` / `public/grid.*` files from its structure listing, and its DB-password default contradicts `db.js`.
- `server.js` uses double-quoted string literals for SQL `status = "active"` comparisons, which works in MySQL's default (non-ANSI) SQL mode.
- Seed data generates `reading_datetime` values only within June–July 2026, so month/year filters outside that range return empty results on a freshly seeded database.
