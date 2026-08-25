import React, { useEffect, useState, useMemo, Component } from 'https://esm.sh/react@18.2.0';
import ReactDOM from 'https://esm.sh/react-dom@18.2.0/client';
import htm from 'https://esm.sh/htm@3.1.1';

const html = htm.bind(React.createElement);
const API_BASE = '';

// --- Error Boundary ---
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error('Settings ErrorBoundary caught:', error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return html`
        <div style=${{ padding: '40px', textAlign: 'center', color: '#ef4444', fontFamily: 'sans-serif', background: '#fff', margin: '40px auto', maxWidth: '600px', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
          <h2 style=${{ fontSize: '20px', fontWeight: '700', marginBottom: '8px' }}>Something went wrong loading Settings</h2>
          <p style=${{ color: '#64748b', fontSize: '14px', marginBottom: '20px' }}>${this.state.error ? this.state.error.message : 'Unknown runtime error'}</p>
          <button
            style=${{ padding: '8px 20px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: '600', cursor: 'pointer' }}
            onClick=${() => window.location.reload()}
          >
            Reload Page
          </button>
        </div>
      `;
    }
    return this.props.children;
  }
}

// --- Icons ---
const SettingsIcon = () => html`
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
`;

const PlusIcon = () => html`
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
`;

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// --- API helper ---
async function apiFetch(url, options = {}) {
  const res = await fetch(API_BASE + url, options);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
  return body;
}

// --- Entity configuration ---
const BUILDING_TYPES = ['academic', 'residential', 'admin', 'utility', 'recreational'];
const AREA_TYPES = ['floor', 'room', 'common_area', 'utility', 'parking', 'other'];
const METER_TYPES = ['main', 'submeter', 'backup'];
const USER_ROLES = ['admin', 'viewer'];

function chainFor(entity, row, lists) {
  const chain = { gridId: '', buildingId: '', areaId: '' };
  if (!row) return chain;
  const buildings = lists?.buildings || [];
  if (entity === 'building') {
    chain.gridId = String(row.gridId || '');
  } else if (entity === 'area') {
    const building = buildings.find((b) => b.id === row.buildingId);
    chain.gridId = building ? String(building.gridId) : '';
    chain.buildingId = String(row.buildingId || '');
  } else if (entity === 'meter') {
    const building = buildings.find((b) => b.id === row.buildingId);
    chain.gridId = building ? String(building.gridId) : '';
    chain.buildingId = String(row.buildingId || '');
    chain.areaId = String(row.areaId || '');
  }
  return chain;
}

const renderStatus = (row) => {
  let color = '#3b82f6';
  const s = String(row.status || '').toLowerCase();
  if (s === 'active' || s === 'live') color = '#22c55e';
  else if (s === 'inactive' || s === 'down' || s === 'offline') color = '#ef4444';
  else if (s === 'maintenance') color = '#f59e0b';
  return html`<span style=${{ display: 'inline-block', padding: '2px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: '600', color: '#fff', backgroundColor: color }}>${row.status || 'unknown'}</span>`;
};

const ENTITIES = {
  grid: {
    label: 'Grid',
    endpoint: '/api/settings/grids',
    softDelete: true,
    chain: [],
    columns: [
      { key: 'code', label: 'Code' },
      { key: 'name', label: 'Name' },
      {
        key: 'color',
        label: 'Color',
        render: (row) => html`
          <span class="color-swatch">
            <span class="swatch" style=${{ background: row.color || '#3B82F6' }}></span>
            ${row.color || ''}
          </span>
        `
      },
      { key: 'lat', label: 'Latitude' },
      { key: 'lng', label: 'Longitude' },
      { key: 'status', label: 'Status', render: renderStatus }, // Patched grid
    ],
    fields: [
      { key: 'code', label: 'Grid Code', type: 'text', required: true },
      { key: 'name', label: 'Grid Name', type: 'text', required: true },
      { key: 'color', label: 'Color', type: 'color' },
      { key: 'lat', label: 'Latitude', type: 'number', step: 'any' },
      { key: 'lng', label: 'Longitude', type: 'number', step: 'any' },
      { key: 'status', label: 'Status', type: 'select', options: ['active', 'inactive'] }
    ],
    initialForm: (row) => ({
      code: row?.code ?? '',
      name: row?.name ?? '',
      color: row?.color ?? '#3B82F6',
      lat: row?.lat ?? '',
      lng: row?.lng ?? '',
      status: row?.status ?? 'active'
    }),
    payload: (form) => ({
      code: form.code,
      name: form.name,
      color: form.color || '#3B82F6',
      lat: form.lat === '' || form.lat === null ? null : Number(form.lat),
      lng: form.lng === '' || form.lng === null ? null : Number(form.lng),
      status: form.status
    })
  },
  building: {
    label: 'Building',
    endpoint: '/api/settings/buildings',
    softDelete: true,
    chain: [
      { key: 'gridId', label: 'Grid' }
    ],
    columns: [
      { key: 'code', label: 'Code' },
      { key: 'name', label: 'Name' },
      { key: 'type', label: 'Type' },
      { key: 'floorCount', label: 'Floors' },
      { key: 'gridName', label: 'Grid' },
      { key: 'status', label: 'Status', render: renderStatus }, // Patched building
    ],
    fields: [
      { key: 'code', label: 'Building Code', type: 'text', required: true },
      { key: 'name', label: 'Building Name', type: 'text', required: true },
      { key: 'type', label: 'Building Type', type: 'select', options: BUILDING_TYPES },
      { key: 'floorCount', label: 'Floor Count', type: 'number', min: 1 },
      { key: 'status', label: 'Status', type: 'select', options: ['active', 'inactive'] }
    ],
    initialForm: (row, lists) => ({
      ...chainFor('building', row, lists),
      code: row?.code ?? '',
      name: row?.name ?? '',
      type: row?.type ?? 'academic',
      floorCount: row?.floorCount ?? 1,
      status: row?.status ?? 'active'
    }),
    payload: (form) => ({
      gridId: Number(form.gridId),
      code: form.code,
      name: form.name,
      type: form.type,
      status: form.status,
      floorCount: form.floorCount === '' || form.floorCount === null ? 1 : Number(form.floorCount),
      status: form.status
    })
  },
  area: {
    label: 'Area',
    endpoint: '/api/settings/areas',
    softDelete: true,
    chain: [
      { key: 'gridId', label: 'Grid' },
      { key: 'buildingId', label: 'Building' }
    ],
    columns: [
      { key: 'code', label: 'Code' },
      { key: 'name', label: 'Name' },
      { key: 'type', label: 'Type' },
      { key: 'floorNumber', label: 'Floor' },
      { key: 'buildingName', label: 'Building' },
      { key: 'status', label: 'Status', render: renderStatus }, // Patched area
    ],
    fields: [
      { key: 'code', label: 'Area Code', type: 'text', required: true },
      { key: 'name', label: 'Area Name', type: 'text', required: true },
      { key: 'type', label: 'Area Type', type: 'select', options: AREA_TYPES },
      { key: 'floorNumber', label: 'Floor Number', type: 'number' },
      { key: 'status', label: 'Status', type: 'select', options: ['active', 'inactive'] }
    ],
    initialForm: (row, lists) => ({
      ...chainFor('area', row, lists),
      code: row?.code ?? '',
      name: row?.name ?? '',
      type: row?.type ?? 'floor',
      floorNumber: row?.floorNumber ?? '',
      status: row?.status ?? 'active'
    }),
    payload: (form) => ({
      buildingId: Number(form.buildingId),
      code: form.code,
      name: form.name,
      type: form.type,
      floorNumber: form.floorNumber === '' || form.floorNumber === null ? null : Number(form.floorNumber),
      status: form.status
    })
  },
  meter: {
    label: 'Meter',
    endpoint: '/api/settings/meters',
    softDelete: false,
    chain: [
      { key: 'gridId', label: 'Grid' },
      { key: 'buildingId', label: 'Building' },
      { key: 'areaId', label: 'Area' }
    ],
    columns: [
      { key: 'code', label: 'Code' },
      { key: 'description', label: 'Description' },
      { key: 'type', label: 'Type' },
      { key: 'areaName', label: 'Area' },
      { key: 'status', label: 'Status', render: renderStatus }, // Patched meter,
      { key: 'buildingName', label: 'Building' }
    ],
    fields: [
      { key: 'code', label: 'Meter Code', type: 'text', required: true },
      { key: 'description', label: 'Description', type: 'text', required: true },
      { key: 'type', label: 'Meter Type', type: 'select', options: METER_TYPES },
      { key: 'status', label: 'Status', type: 'select', options: ['live', 'down', 'maintenance', 'offline'] }
    ],
    initialForm: (row, lists) => ({
      ...chainFor('meter', row, lists),
      code: row?.code ?? '',
      description: row?.description ?? '',
      type: row?.type ?? 'main',
      status: row?.status ?? 'down'
    }),
    payload: (form) => ({
      areaId: Number(form.areaId),
      code: form.code,
      description: form.description,
      type: form.type
    })
  },
  user: {
    label: 'User',
    endpoint: '/api/settings/users',
    softDelete: true,
    chain: [],
    columns: [
      { key: 'username', label: 'Username' },
      { key: 'fullName', label: 'Full Name' },
      { key: 'role', label: 'Role' },
      { key: 'lastLogin', label: 'Last Login' },
      { key: 'status', label: 'Status', render: renderStatus }, // Patched user
    ],
    fields: [
      { key: 'username', label: 'Username', type: 'text', required: true },
      { key: 'fullName', label: 'Full Name', type: 'text', required: true },
      { key: 'password', label: 'Password (required for new users; blank = unchanged on edit)', type: 'password' },
      { key: 'role', label: 'Role', type: 'select', options: USER_ROLES }
    ],
    initialForm: (row) => ({
      username: row?.username ?? '',
      fullName: row?.fullName ?? '',
      password: '',
      status: row?.status ?? 'active',
      role: row?.role ?? 'viewer'
    }),
    payload: (form) => ({
      username: form.username,
      fullName: form.fullName,
      password: form.password,
      role: form.role
    })
  }
};

const TABS = [
  { key: 'themes', label: 'Themes & Section Titles' },
  { key: 'grid', label: 'Grid' },
  { key: 'building', label: 'Building' },
  { key: 'area', label: 'Area' },
  { key: 'meter', label: 'Meters' },
  { key: 'user', label: 'Users' }
];

// --- Shared chrome ---

function AppHeader() {
  const user = window.ETRAMS_USER || {};
  return html`
    <header class="AppHeader" id="AppHeader">
      <div class="header-logo">
        <img src="etrams.jpg" alt="eTRAMS logo" class="header-logo-img" />
      </div>
      <h1 class="header-title">
        <span class="highlight">e</span>NERGY Technical Reporting <span class="highlight">A</span>nalysis <span class="highlight">M</span>anagement <span class="highlight">S</span>ystem
      </h1>
      <div class="etrams-header-user">
        <span class="etrams-username">${user.fullName || user.username || ''}</span>
        <button class="etrams-logout-btn" type="button" onClick=${() => window.etramsLogout && window.etramsLogout()}>Sign Out</button>
      </div>
    </header>
  `;
}

function PageHeader() {
  return html`
    <section class="PageHeader" id="PageHeader">
      <div class="page-title-cluster">
        <span class="page-icon"><${SettingsIcon} /></span>
        <h2 class="page-title">System Settings</h2>
        <span class="record-badge">Configuration</span>
      </div>
    </section>
  `;
}

function chainOptions(levelKey, form, lists) {
  const grids = lists?.grids || [];
  const buildings = lists?.buildings || [];
  const areas = lists?.areas || [];
  if (levelKey === 'gridId') return grids;
  if (levelKey === 'buildingId') return buildings.filter((b) => String(b.gridId) === String(form.gridId));
  if (levelKey === 'areaId') return areas.filter((a) => String(a.buildingId) === String(form.buildingId));
  return [];
}

function CrudModal({ entity, row, lists, onClose, onSaved }) {
  const config = ENTITIES[entity];
  if (!config) return null;
  const isEdit = Boolean(row);
  const [form, setForm] = useState(() => config.initialForm(row, lists));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const setField = (key, value) => {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === 'gridId') {
        next.buildingId = '';
        next.areaId = '';
      }
      if (key === 'buildingId') {
        next.areaId = '';
      }
      return next;
    });
  };

  const submit = async () => {
    setSaving(true);
    setError('');
    try {
      const payload = config.payload(form);
      if (isEdit) {
        await apiFetch(`${config.endpoint}/${row.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } else {
        await apiFetch(config.endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return html`
    <div class="modal-overlay" onClick=${(e) => e.target === e.currentTarget && onClose()}>
      <div class="modal-card">
        <div class="modal-title">${isEdit ? 'Edit' : 'Add'} ${config.label}</div>
        <div class="modal-form">
          ${config.chain.map((level, i) => {
            const parentKey = i === 0 ? null : config.chain[i - 1].key;
            const disabled = parentKey ? !form[parentKey] : false;
            const options = chainOptions(level.key, form, lists);
            return html`
              <div class="form-group" key=${level.key}>
                <label>${level.label}</label>
                <select value=${form[level.key]} disabled=${disabled} onChange=${(e) => setField(level.key, e.target.value)}>
                  <option value="">-- Select ${level.label} --</option>
                  ${options.map((o) => html`<option key=${o.id} value=${o.id}>${o.name}</option>`)}
                </select>
              </div>
            `;
          })}
          ${config.fields.map((field) => html`
            <div class="form-group" key=${field.key}>
              <label>${field.label}${field.required ? ' *' : ''}</label>
              ${field.type === 'select'
                ? html`
                    <select value=${form[field.key]} onChange=${(e) => setField(field.key, e.target.value)}>
                      ${field.options.map((opt) => html`<option key=${opt} value=${opt}>${opt}</option>`)}
                    </select>
                  `
                : html`
                    <input
                      type=${field.type}
                      value=${form[field.key]}
                      step=${field.step}
                      min=${field.min}
                      onChange=${(e) => setField(field.key, e.target.value)}
                    />
                  `}
            </div>
          `)}
          ${error && html`<div class="form-error">${error}</div>`}
          <div class="modal-actions">
            <button class="btn btn-text" onClick=${onClose} disabled=${saving}>Cancel</button>
            <button class="btn btn-primary" onClick=${submit} disabled=${saving}>
              ${saving ? 'Saving...' : isEdit ? 'Save Changes' : `Add ${config.label}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function CrudTable({ entity, lists, reloadLists }) {
  const config = ENTITIES[entity];
  if (!config) return html`<div class="card p-4">Unknown entity</div>`;
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(null);
  const [sortConfig, setSortConfig] = useState(null);
  const [showInactive, setShowInactive] = useState(false);

  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedRows = useMemo(() => {
    let sortableItems = rows.filter(r => {
      if (showInactive) return true;
      return String(r.status || '').toLowerCase() !== 'inactive';
    });
    
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        let valA = a[sortConfig.key] ?? '';
        let valB = b[sortConfig.key] ?? '';
        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();
        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return sortableItems;
  }, [rows, sortConfig, showInactive]);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      setRows(await apiFetch(config.endpoint));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [entity]);

  const onSaved = () => {
    load();
    reloadLists();
  };

  const onDelete = async (row) => {
    const label = row.name || row.description || row.code || row.username;
    const message = config.softDelete
      ? `Deactivate ${config.label} "${label}"?`
      : `Permanently delete ${config.label} "${label}"? This cannot be undone.`;
    if (!window.confirm(message)) return;
    try {
      await apiFetch(`${config.endpoint}/${row.id}`, { method: 'DELETE' });
      onSaved();
    } catch (err) {
      alert(err.message);
    }
  };

  return html`
    <div class="card">
      <div class="crud-toolbar">
        <span class="crud-toolbar-title">${config.label} Management</span>
        <div style=${{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          <label style=${{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#64748b', cursor: 'pointer', userSelect: 'none' }}>
            <input type="checkbox" checked=${showInactive} onChange=${(e) => setShowInactive(e.target.checked)} />
            Show inactive records
          </label>
          <button class="btn btn-primary" onClick=${() => setModal({})}>
            <${PlusIcon} />
            Add ${config.label}
          </button>
        </div>
      </div>
      ${error && html`<div class="form-error" style=${{ marginBottom: '12px' }}>${error}</div>`}
      <div class="crud-table-wrapper">
        <table class="crud-table">
          <thead>
            <tr>
              <th onClick=${() => requestSort('id')} style=${{ cursor: 'pointer', userSelect: 'none' }}>
                ID ${sortConfig?.key === 'id' ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
              </th>
              ${config.columns.map((col) => html`
                <th key=${col.key} onClick=${() => requestSort(col.key)} style=${{ cursor: 'pointer', userSelect: 'none' }}>
                  ${col.label} ${sortConfig?.key === col.key ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
                </th>
              `)}
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${loading
              ? html`<tr><td colspan=${config.columns.length + 2} class="crud-empty">Loading...</td></tr>`
              : sortedRows.length === 0
                ? html`<tr><td colspan=${config.columns.length + 2} class="crud-empty">No records found.</td></tr>`
                : sortedRows.map((row) => html`
                    <tr key=${row.id}>
                      <td>${row.id}</td>
                      ${config.columns.map((col) => html`
                        <td key=${col.key}>${col.render ? col.render(row) : row[col.key] ?? ''}</td>
                      `)}
                      <td>
                        <div class="crud-actions">
                          <button class="btn btn-text" onClick=${() => setModal({ row })}>Edit</button>
                          <button class="btn btn-danger" onClick=${() => onDelete(row)}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  `)}
          </tbody>
        </table>
      </div>
      ${modal && html`
        <${CrudModal}
          entity=${entity}
          row=${modal.row || null}
          lists=${lists}
          onClose=${() => setModal(null)}
          onSaved=${onSaved}
        />
      `}
    </div>
  `;
}

function ThemesTab() {
  const [theme, setTheme] = useState({
    mapImage: '',
    headerColor: '#3B82F6',
    sidebarColor: '#0F172A',
    sidebarTextColor: '#94A3B8',
    contentColor: '#B5BBC7'
  });

  useEffect(() => {
    async function loadSavedTheme() {
      try {
        let savedStr = null;
        if (window.etramsThemeStorage) {
          savedStr = await window.etramsThemeStorage.getItem('etrams_theme_settings');
        } else {
          savedStr = localStorage.getItem('etrams_theme_settings');
        }
        if (savedStr) {
          const saved = JSON.parse(savedStr);
          setTheme({
            mapImage: saved.mapImage || '',
            headerColor: saved.headerColor || '#3B82F6',
            sidebarColor: saved.sidebarColor || '#0F172A',
            sidebarTextColor: saved.sidebarTextColor || '#94A3B8',
            contentColor: saved.contentColor || '#B5BBC7'
          });
        }
      } catch (e) {}
    }
    loadSavedTheme();
  }, []);

  const [titles, setTitles] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('etrams_section_titles') || '{}');
      return {
        gridStatistics: saved.gridStatistics || 'Grid Active Energy Demand',
        gridReport: saved.gridReport || 'Grid Demand Report',
        buildingStatistics: saved.buildingStatistics || 'Building Active Power Demand',
        buildingReport: saved.buildingReport || 'Building Demand Report',
        meterStatistics: saved.meterStatistics || 'Meter Detail',
        meterReport: saved.meterReport || 'Building Meter Status Report'
      };
    } catch (e) {
      return {
        gridStatistics: 'Grid Active Energy Demand',
        gridReport: 'Grid Demand Report',
        buildingStatistics: 'Building Active Power Demand',
        buildingReport: 'Building Demand Report',
        meterStatistics: 'Meter Detail',
        meterReport: 'Building Meter Status Report'
      };
    }
  });

  const [message, setMessage] = useState(null);

  const handleImageUpload = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try {
      const dataUrl = await readFileAsDataURL(file);
      setTheme((prev) => ({ ...prev, mapImage: dataUrl }));
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to process image file.' });
    }
  };

  const handleSaveTheme = async () => {
    try {
      if (window.etramsThemeStorage) {
        await window.etramsThemeStorage.setItem('etrams_theme_settings', JSON.stringify(theme));
      } else {
        localStorage.setItem('etrams_theme_settings', JSON.stringify(theme));
      }
      if (window.applyGlobalTheme) {
        window.applyGlobalTheme(theme);
      }
      setMessage({ type: 'success', text: 'Theme appearance saved successfully!' });
      setTimeout(() => setMessage(null), 3000);
    } catch (e) {
      console.error('Storage error:', e);
      setMessage({ type: 'error', text: 'Failed to save theme settings.' });
    }
  };

  const handleResetTheme = async () => {
    const defaults = {
      mapImage: '',
      headerColor: '#3B82F6',
      sidebarColor: '#0F172A',
      sidebarTextColor: '#94A3B8',
      contentColor: '#B5BBC7'
    };
    setTheme(defaults);
    if (window.etramsThemeStorage) {
      await window.etramsThemeStorage.removeItem('etrams_theme_settings');
    } else {
      localStorage.removeItem('etrams_theme_settings');
    }
    if (window.applyGlobalTheme) {
      window.applyGlobalTheme(defaults);
    }
    setMessage({ type: 'info', text: 'Theme reset to default colors.' });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleSaveTitles = () => {
    try {
      localStorage.setItem('etrams_section_titles', JSON.stringify(titles));
      setMessage({ type: 'success', text: 'Section titles saved successfully!' });
      setTimeout(() => setMessage(null), 3000);
    } catch (e) {
      setMessage({ type: 'error', text: 'Failed to save section titles.' });
    }
  };

  return html`
    <div class="card themes-container space-y-6" style=${{ padding: '24px' }}>
      ${message && html`
        <div class=${`theme-message p-3 rounded text-xs mb-4`} style=${{
          background: message.type === 'error' ? '#fef2f2' : message.type === 'success' ? '#dcfce7' : '#e0f2fe',
          color: message.type === 'error' ? '#991b1b' : message.type === 'success' ? '#166534' : '#075985',
          border: `1px solid ${message.type === 'error' ? '#fecaca' : message.type === 'success' ? '#bbf7d0' : '#bae6fd'}`
        }}>
          ${message.text}
        </div>
      `}

      <div style=${{ borderBottom: '1px solid #e2e8f0', paddingBottom: '20px', marginBottom: '20px' }}>
        <h3 style=${{ fontSize: '16px', fontWeight: '700', color: '#1e293b', marginBottom: '4px' }}>Theme & Appearance</h3>
        <p style=${{ fontSize: '12px', color: '#64748b', marginBottom: '16px' }}>Configure application interface colors and campus map background image.</p>

        <div style=${{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
          <div>
            <label style=${{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#334155', marginBottom: '4px' }}>Campus Map Image</label>
            <div style=${{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <input type="file" accept="image/*" onChange=${handleImageUpload} id="upload-map-image" style=${{ display: 'none' }} />
              <label htmlFor="upload-map-image" class="btn btn-secondary cursor-pointer" style=${{ fontSize: '12px', padding: '6px 12px' }}>
                Choose Image...
              </label>
              ${theme.mapImage && html`
                <button class="btn btn-text" style=${{ color: '#ef4444', fontSize: '12px' }} onClick=${() => setTheme((prev) => ({ ...prev, mapImage: '' }))}>
                  Remove Image
                </button>
              `}
            </div>
            ${theme.mapImage && html`
              <div style=${{ marginTop: '8px' }}>
                <img src=${theme.mapImage} alt="Campus Map" style=${{ maxHeight: '80px', borderRadius: '6px', border: '1px solid #cbd5e1' }} />
              </div>
            `}
          </div>

          <div>
            <label style=${{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#334155', marginBottom: '4px' }}>Header Color</label>
            <div style=${{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <input type="color" value=${theme.headerColor} onChange=${(e) => setTheme((prev) => ({ ...prev, headerColor: e.target.value }))} style=${{ width: '36px', height: '32px', padding: '2px', cursor: 'pointer' }} />
              <input type="text" value=${theme.headerColor} onChange=${(e) => setTheme((prev) => ({ ...prev, headerColor: e.target.value }))} style=${{ width: '100px', padding: '6px', fontSize: '13px', border: '1px solid #cbd5e1', borderRadius: '6px' }} />
            </div>
          </div>

          <div>
            <label style=${{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#334155', marginBottom: '4px' }}>Sidebar Color</label>
            <div style=${{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <input type="color" value=${theme.sidebarColor} onChange=${(e) => setTheme((prev) => ({ ...prev, sidebarColor: e.target.value }))} style=${{ width: '36px', height: '32px', padding: '2px', cursor: 'pointer' }} />
              <input type="text" value=${theme.sidebarColor} onChange=${(e) => setTheme((prev) => ({ ...prev, sidebarColor: e.target.value }))} style=${{ width: '100px', padding: '6px', fontSize: '13px', border: '1px solid #cbd5e1', borderRadius: '6px' }} />
            </div>
          </div>

          <div>
            <label style=${{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#334155', marginBottom: '4px' }}>Page Background Color</label>
            <div style=${{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <input type="color" value=${theme.contentColor} onChange=${(e) => setTheme((prev) => ({ ...prev, contentColor: e.target.value }))} style=${{ width: '36px', height: '32px', padding: '2px', cursor: 'pointer' }} />
              <input type="text" value=${theme.contentColor} onChange=${(e) => setTheme((prev) => ({ ...prev, contentColor: e.target.value }))} style=${{ width: '100px', padding: '6px', fontSize: '13px', border: '1px solid #cbd5e1', borderRadius: '6px' }} />
            </div>
          </div>
        </div>

        <div style=${{ display: 'flex', gap: '10px' }}>
          <button class="btn btn-primary" onClick=${handleSaveTheme}>Save Theme Appearance</button>
          <button class="btn btn-secondary" onClick=${handleResetTheme}>Reset Default Colors</button>
        </div>
      </div>

      <div>
        <h3 style=${{ fontSize: '16px', fontWeight: '700', color: '#1e293b', marginBottom: '4px' }}>Custom Section Titles</h3>
        <p style=${{ fontSize: '12px', color: '#64748b', marginBottom: '16px' }}>Customize page headers and section titles across eTRAMS dashboard and reports.</p>

        <div style=${{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div>
            <label style=${{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#334155', marginBottom: '4px' }}>Grid Statistics Title</label>
            <input
              type="text"
              value=${titles.gridStatistics}
              onChange=${(e) => setTitles((prev) => ({ ...prev, gridStatistics: e.target.value }))}
              style=${{ width: '100%', padding: '8px 12px', fontSize: '13px', border: '1px solid #cbd5e1', borderRadius: '6px' }}
            />
          </div>

          <div>
            <label style=${{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#334155', marginBottom: '4px' }}>Grid Report Title</label>
            <input
              type="text"
              value=${titles.gridReport}
              onChange=${(e) => setTitles((prev) => ({ ...prev, gridReport: e.target.value }))}
              style=${{ width: '100%', padding: '8px 12px', fontSize: '13px', border: '1px solid #cbd5e1', borderRadius: '6px' }}
            />
          </div>

          <div>
            <label style=${{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#334155', marginBottom: '4px' }}>Building Statistics Title</label>
            <input
              type="text"
              value=${titles.buildingStatistics}
              onChange=${(e) => setTitles((prev) => ({ ...prev, buildingStatistics: e.target.value }))}
              style=${{ width: '100%', padding: '8px 12px', fontSize: '13px', border: '1px solid #cbd5e1', borderRadius: '6px' }}
            />
          </div>

          <div>
            <label style=${{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#334155', marginBottom: '4px' }}>Building Report Title</label>
            <input
              type="text"
              value=${titles.buildingReport}
              onChange=${(e) => setTitles((prev) => ({ ...prev, buildingReport: e.target.value }))}
              style=${{ width: '100%', padding: '8px 12px', fontSize: '13px', border: '1px solid #cbd5e1', borderRadius: '6px' }}
            />
          </div>

          <div>
            <label style=${{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#334155', marginBottom: '4px' }}>Meter Statistics Title</label>
            <input
              type="text"
              value=${titles.meterStatistics}
              onChange=${(e) => setTitles((prev) => ({ ...prev, meterStatistics: e.target.value }))}
              style=${{ width: '100%', padding: '8px 12px', fontSize: '13px', border: '1px solid #cbd5e1', borderRadius: '6px' }}
            />
          </div>

          <div>
            <label style=${{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#334155', marginBottom: '4px' }}>Meter Report Title</label>
            <input
              type="text"
              value=${titles.meterReport}
              onChange=${(e) => setTitles((prev) => ({ ...prev, meterReport: e.target.value }))}
              style=${{ width: '100%', padding: '8px 12px', fontSize: '13px', border: '1px solid #cbd5e1', borderRadius: '6px' }}
            />
          </div>
        </div>

        <div style=${{ marginTop: '20px' }}>
          <button class="btn btn-primary" onClick=${handleSaveTitles}>Save Custom Titles</button>
        </div>
      </div>
    </div>
  `;
}

function useLists() {
  const [lists, setLists] = useState({ grids: [], buildings: [], areas: [] });

  const reloadLists = async () => {
    try {
      const [grids, buildings, areas] = await Promise.all([
        apiFetch('/api/settings/grids'),
        apiFetch('/api/settings/buildings'),
        apiFetch('/api/settings/areas')
      ]);
      setLists({ grids, buildings, areas });
    } catch (err) {
      console.error('Failed to load lookup lists:', err);
    }
  };

  useEffect(() => {
    reloadLists();
  }, []);

  return { lists, reloadLists };
}

function SettingsPage() {
  const [activeTab, setActiveTab] = useState('themes');
  const { lists, reloadLists } = useLists();

  return html`
    <div>
      <${AppHeader} />
      <div class="app-layout">
        <etrams-sidebar active="btn-nav-settings"></etrams-sidebar>
        <main class="main-content">
          <${PageHeader} />
          <div class="card settings-tabs-card">
            ${TABS.map((tab) => html`
              <button
                key=${tab.key}
                class=${`tab-btn ${activeTab === tab.key ? 'active' : ''}`}
                onClick=${() => setActiveTab(tab.key)}
              >
                ${tab.label}
              </button>
            `)}
          </div>
          ${activeTab === 'themes'
            ? html`<${ThemesTab} />`
            : html`<${CrudTable} key=${activeTab} entity=${activeTab} lists=${lists} reloadLists=${reloadLists} />`}
        </main>
      </div>
    </div>
  `;
}

function mount() {
  const container = document.getElementById('root');
  if (container) {
    if (!container._reactRoot) {
      container._reactRoot = ReactDOM.createRoot(container);
    }
    container._reactRoot.render(html`<${ErrorBoundary}><${SettingsPage} /><//>`);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mount);
} else {
  mount();
}
