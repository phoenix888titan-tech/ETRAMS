/* eTRAMS Admin Meter Report Frontend */

const API_BASE = '';

const now = new Date();
const year = now.getFullYear();
const month = String(now.getMonth() + 1).padStart(2, '0');
const day = String(now.getDate()).padStart(2, '0');
const defaultStart = `${year}-${month}-${day}T00:00`;
const defaultEnd = `${year}-${month}-${day}T23:59`;

const state = {
  filters: {
    gridId: '',
    buildingId: '',
    areaId: '',
    startDate: defaultStart,
    endDate: defaultEnd,
    meterType: 'main'
  },
  pagination: {
    page: 1,
    limit: 25,
    total: 0,
    totalPages: 1
  },
  sort: {
    column: 'meter_id',
    order: 'asc'
  }
};

const els = {
  gridSelect: document.getElementById('filter-grid'),
  buildingSelect: document.getElementById('filter-building'),
  areaSelect: document.getElementById('filter-area'),
  meterTypeSelect: document.getElementById('filter-meter-type'),
  startTimeInput: document.getElementById('filter-start-time'),
  endTimeInput: document.getElementById('filter-end-time'),
  summaryTotal: document.getElementById('summary-total'),
  summaryLive: document.getElementById('summary-live'),
  summaryDown: document.getElementById('summary-down'),
  tbody: document.getElementById('meters-tbody'),
  currentPage: document.getElementById('current-page'),
  totalPages: document.getElementById('total-pages'),
  prevPage: document.getElementById('btn-prev-page'),
  nextPage: document.getElementById('btn-next-page'),
  pageTitle: document.getElementById('page-section-title')
};

function fmt(num) {
  if (num === null || num === undefined) return '-';
  return parseFloat(num).toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
}

function fmtMeterId(id) {
  return String(id).padStart(4, '0');
}

async function loadFilters() {
  try {
    const res = await fetch(`${API_BASE}/api/grids`);
    if (!res.ok) throw new Error('Failed to load grids');
    const grids = await res.json();

    els.gridSelect.innerHTML = '';
    grids.forEach((grid) => {
      const opt = document.createElement('option');
      opt.value = grid.id;
      opt.textContent = grid.name;
      els.gridSelect.appendChild(opt);
    });

    if (grids.length > 0) {
      state.filters.gridId = String(grids[0].id);
      els.gridSelect.value = state.filters.gridId;
      await loadBuildings(state.filters.gridId);
    }
  } catch (err) {
    showError(err.message);
  }
}

async function loadBuildings(gridId) {
  try {
    const res = await fetch(`${API_BASE}/api/buildings?grid_id=${gridId}`);
    if (!res.ok) throw new Error('Failed to load buildings');
    const buildings = await res.json();

    els.buildingSelect.innerHTML = '';
    buildings.forEach((b) => {
      const opt = document.createElement('option');
      opt.value = b.id;
      opt.textContent = b.name;
      els.buildingSelect.appendChild(opt);
    });

    if (buildings.length > 0) {
      state.filters.buildingId = String(buildings[0].id);
      els.buildingSelect.value = state.filters.buildingId;
      await loadAreas(state.filters.buildingId);
    } else {
      state.filters.buildingId = '';
      els.areaSelect.innerHTML = '<option value="">-- ALL --</option>';
    }
  } catch (err) {
    showError(err.message);
  }
}

async function loadAreas(buildingId) {
  try {
    const res = await fetch(`${API_BASE}/api/areas?building_id=${buildingId}`);
    if (!res.ok) throw new Error('Failed to load areas');
    const areas = await res.json();

    els.areaSelect.innerHTML = '<option value="">-- ALL --</option>';
    areas.forEach((a) => {
      const opt = document.createElement('option');
      opt.value = a.id;
      opt.textContent = a.name;
      els.areaSelect.appendChild(opt);
    });
  } catch (err) {
    showError(err.message);
  }
}

async function loadSummary() {
  try {
    const params = new URLSearchParams();
    if (state.filters.gridId) params.set('grid_id', state.filters.gridId);
    if (state.filters.buildingId) params.set('building_id', state.filters.buildingId);
    if (state.filters.areaId) params.set('area_id', state.filters.areaId);
    if (state.filters.startDate) params.set('start_date', state.filters.startDate);
    if (state.filters.endDate) params.set('end_date', state.filters.endDate);
    if (state.filters.meterType) params.set('meter_type', state.filters.meterType);

    const res = await fetch(`${API_BASE}/api/summary?${params}`);
    if (!res.ok) throw new Error('Failed to load summary');
    const data = await res.json();

    if (els.summaryTotal) els.summaryTotal.textContent = data.total || 0;
    if (els.summaryLive) els.summaryLive.textContent = data.live || 0;
    if (els.summaryDown) els.summaryDown.textContent = data.down || 0;
  } catch (err) {
    console.error(err);
  }
}

async function loadMeters() {
  try {
    const params = new URLSearchParams();
    if (state.filters.gridId) params.set('grid_id', state.filters.gridId);
    if (state.filters.buildingId) params.set('building_id', state.filters.buildingId);
    if (state.filters.areaId) params.set('area_id', state.filters.areaId);
    if (state.filters.startDate) params.set('start_date', state.filters.startDate);
    if (state.filters.endDate) params.set('end_date', state.filters.endDate);
    if (state.filters.meterType) params.set('meter_type', state.filters.meterType);

    params.set('page', state.pagination.page);
    params.set('limit', state.pagination.limit);
    params.set('sort', state.sort.column);
    params.set('order', state.sort.order);

    const res = await fetch(`${API_BASE}/api/meters?${params}`);
    if (!res.ok) throw new Error('Failed to load meters');
    const data = await res.json();

    state.pagination.total = data.pagination.total;
    state.pagination.totalPages = data.pagination.totalPages;

    renderTable(data.data);
    updatePagination();
  } catch (err) {
    showError(err.message);
  }
}

function renderStatus(status) {
  const isLive = status === 'live';
  return `
    <span class="status-cell ${isLive ? 'status-live' : 'status-down'}">
      <span class="status-dot"></span>
      ${status.toUpperCase()}
    </span>
  `;
}

function renderTable(rows) {
  if (!rows || rows.length === 0) {
    els.tbody.innerHTML = '<tr><td colspan="14" class="loading">No meters found for selected criteria.</td></tr>';
    return;
  }

  els.tbody.innerHTML = rows.map((row) => `
    <tr data-meter-id="${row.meter_id}">
      <td class="center">${fmtMeterId(row.meter_id)}</td>
      <td>
        <div class="meter-desc-primary">${escapeHtml(row.meter_description)}</div>
      </td>
      <td>${escapeHtml(row.building_name)}</td>
      <td>${escapeHtml(row.area_name)}</td>
      <td class="numeric">${fmt(row.current_reading)}</td>
      <td class="numeric">${fmt(row.previous_reading)}</td>
      <td class="numeric">${fmt(parseFloat(row.current_reading || 0) - parseFloat(row.previous_reading || 0))}</td>

    </tr>
  `).join('');
}

function updatePagination() {
  els.currentPage.textContent = state.pagination.page;
  els.totalPages.textContent = state.pagination.totalPages || 1;
  els.prevPage.disabled = state.pagination.page <= 1;
  els.nextPage.disabled = state.pagination.page >= state.pagination.totalPages;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function showError(message) {
  els.tbody.innerHTML = `<tr><td colspan="14" class="error">Error: ${escapeHtml(message)}</td></tr>`;
}

function setupFilters() {
  els.gridSelect.addEventListener('change', async () => {
    state.filters.gridId = els.gridSelect.value;
    state.pagination.page = 1;
    await loadBuildings(state.filters.gridId);
    refresh();
  });

  els.buildingSelect.addEventListener('change', async () => {
    state.filters.buildingId = els.buildingSelect.value;
    state.pagination.page = 1;
    await loadAreas(state.filters.buildingId);
    refresh();
  });

  
  els.meterTypeSelect.addEventListener('change', () => {
    state.filters.meterType = els.meterTypeSelect.value;
    state.pagination.page = 1;
    refresh();
  });
  els.areaSelect.addEventListener('change', () => {
    state.filters.areaId = els.areaSelect.value;
    state.pagination.page = 1;
    refresh();
  });

  els.startTimeInput.addEventListener('change', () => {
    if (els.startTimeInput.value && els.endTimeInput.value && new Date(els.startTimeInput.value) > new Date(els.endTimeInput.value)) {
      alert('Start Date-Time must be earlier than or equal to End Date-Time.');
      els.startTimeInput.value = state.filters.startDate;
      return;
    }
    state.filters.startDate = els.startTimeInput.value;
    state.pagination.page = 1;
    refresh();
  });

  els.endTimeInput.addEventListener('change', () => {
    if (els.startTimeInput.value && els.endTimeInput.value && new Date(els.startTimeInput.value) > new Date(els.endTimeInput.value)) {
      alert('Start Date-Time must be earlier than or equal to End Date-Time.');
      els.endTimeInput.value = state.filters.endDate;
      return;
    }
    state.filters.endDate = els.endTimeInput.value;
    state.pagination.page = 1;
    refresh();
  });
}

function setupSorting() {
  document.getElementById('btn-sort-meter-id').addEventListener('click', () => {
    if (state.sort.column === 'meter_id') {
      state.sort.order = state.sort.order === 'asc' ? 'desc' : 'asc';
    } else {
      state.sort.column = 'meter_id';
      state.sort.order = 'asc';
    }
    const indicator = document.querySelector('#btn-sort-meter-id .sort-indicator');
    if (indicator) indicator.textContent = state.sort.order === 'asc' ? '↑' : '↓';
    loadMeters();
  });
}

function setupPagination() {
  els.prevPage.addEventListener('click', () => {
    if (state.pagination.page > 1) {
      state.pagination.page--;
      loadMeters();
    }
  });

  els.nextPage.addEventListener('click', () => {
    if (state.pagination.page < state.pagination.totalPages) {
      state.pagination.page++;
      loadMeters();
    }
  });
}

async function exportFullPDF() {
  const jsPDF = window.jspdf?.jsPDF;
  const html2canvas = window.html2canvas;

  try {
    const params = new URLSearchParams();
    if (state.filters.gridId) params.set('grid_id', state.filters.gridId);
    if (state.filters.buildingId) params.set('building_id', state.filters.buildingId);
    if (state.filters.areaId) params.set('area_id', state.filters.areaId);
    if (state.filters.startDate) params.set('start_date', state.filters.startDate);
    if (state.filters.endDate) params.set('end_date', state.filters.endDate);
    if (state.filters.meterType) params.set('meter_type', state.filters.meterType);
    params.set('limit', '5000');
    params.set('page', '1');

    const res = await fetch(`${API_BASE}/api/meters?${params}`);
    if (!res.ok) throw new Error('Failed to fetch full meter report data');
    const fullData = await res.json();
    const rows = fullData.data || [];

    const printContainer = document.createElement('div');
    printContainer.style.position = 'absolute';
    printContainer.style.left = '-9999px';
    printContainer.style.top = '0';
    printContainer.style.width = '1200px';
    printContainer.style.background = '#FFFFFF';
    printContainer.style.padding = '20px';
    printContainer.style.fontFamily = 'Inter, sans-serif';

    const selectedGridName = els.gridSelect.options[els.gridSelect.selectedIndex]?.text || '';
    const selectedBuildingName = els.buildingSelect.options[els.buildingSelect.selectedIndex]?.text || '';
    const selectedAreaName = els.areaSelect.options[els.areaSelect.selectedIndex]?.text || 'ALL Floors';

    printContainer.innerHTML = `
      <div style="font-size:18px; font-weight:700; color:#1e293b; margin-bottom:8px;">
        <span style="color:#3b82f6;">e</span>TRAMS — Meter Status Report
      </div>
      <div style="font-size:12px; color:#475569; margin-bottom:16px; display:flex; gap:16px; border-bottom:2px solid #e2e8f0; padding-bottom:8px;">
        <span><strong>Grid:</strong> ${escapeHtml(selectedGridName)}</span>
        <span><strong>Building:</strong> ${escapeHtml(selectedBuildingName)}</span>
        <span><strong>Floor/Area:</strong> ${escapeHtml(selectedAreaName)}</span>
        <span><strong>Start Time:</strong> ${escapeHtml(state.filters.startDate)}</span>
        <span><strong>End Time:</strong> ${escapeHtml(state.filters.endDate)}</span>
        <span><strong>Total Records:</strong> ${rows.length}</span>
      </div>
      <table style="width:100%; border-collapse:collapse; font-size:10px;">
        <thead>
          <tr style="background:#f1f5f9; text-align:left;">
            <th style="padding:6px; border:1px solid #cbd5e1;">METER ID</th>
            <th style="padding:6px; border:1px solid #cbd5e1;">DESCRIPTION</th>
            <th style="padding:6px; border:1px solid #cbd5e1;">BUILDING</th>
            <th style="padding:6px; border:1px solid #cbd5e1;">AREA/FLOOR</th>
            <th style="padding:6px; border:1px solid #cbd5e1; text-align:right;">CURR READING</th>
            <th style="padding:6px; border:1px solid #cbd5e1; text-align:right;">PREV READING</th>
            <th style="padding:6px; border:1px solid #cbd5e1; text-align:right;">TOTAL USED</th>

          </tr>
        </thead>
        <tbody>
          ${rows.map(r => `
            <tr>
              <td style="padding:5px; border:1px solid #e2e8f0;">${fmtMeterId(r.meter_id)}</td>
              <td style="padding:5px; border:1px solid #e2e8f0;">${escapeHtml(r.meter_description)}</td>
              <td style="padding:5px; border:1px solid #e2e8f0;">${escapeHtml(r.building_name)}</td>
              <td style="padding:5px; border:1px solid #e2e8f0;">${escapeHtml(r.area_name)}</td>
              <td style="padding:5px; border:1px solid #e2e8f0; text-align:right;">${fmt(r.current_reading)}</td>
              <td style="padding:5px; border:1px solid #e2e8f0; text-align:right;">${fmt(r.previous_reading)}</td>
              <td style="padding:5px; border:1px solid #e2e8f0; text-align:right;">${fmt(r.total_used)}</td>

            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    document.body.appendChild(printContainer);
    const canvas = await html2canvas(printContainer, { scale: 2, backgroundColor: '#FFFFFF' });
    document.body.removeChild(printContainer);

    const pdf = new jsPDF('l', 'mm', 'a4');
    const pageWidth = 297;
    const pageHeight = 210;
    const imgWidth = pageWidth - 10;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = 5;

    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 5, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    while (heightLeft >= 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 5, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    pdf.save('meter-report-full.pdf');
  } catch (err) {
    console.error('Export PDF error:', err);
    alert('PDF export failed.');
  }
}

function setupActionButtons() {
  const btnSettings = document.getElementById('btn-system-settings');
  if (btnSettings) {
    btnSettings.addEventListener('click', () => {
      window.location.href = '/settings.html';
    });
  }

  document.getElementById('btn-download-csv').addEventListener('click', () => {
    const params = new URLSearchParams();
    if (state.filters.gridId) params.set('grid_id', state.filters.gridId);
    if (state.filters.buildingId) params.set('building_id', state.filters.buildingId);
    if (state.filters.areaId) params.set('area_id', state.filters.areaId);
    if (state.filters.startDate) params.set('start_date', state.filters.startDate);
    if (state.filters.endDate) params.set('end_date', state.filters.endDate);
    if (state.filters.meterType) params.set('meter_type', state.filters.meterType);
    window.open(`${API_BASE}/api/meters/csv?${params}`, '_blank');
  });

  document.getElementById('btn-export-pdf').addEventListener('click', exportFullPDF);

  document.getElementById('btn-reset-filters').addEventListener('click', async () => {
    state.filters = {
      gridId: els.gridSelect.options[0]?.value || '',
      buildingId: '',
      areaId: '',
      startDate: defaultStart,
      endDate: defaultEnd,
      meterType: 'main'
    };
    els.gridSelect.value = state.filters.gridId;
    els.startTimeInput.value = state.filters.startDate;
    els.endTimeInput.value = state.filters.endDate;
    state.pagination.page = 1;
    await loadBuildings(state.filters.gridId);
    refresh();
  });
}

function refresh() {
  loadSummary();
  loadMeters();
}

async function init() {
  if (window.getSectionTitle && els.pageTitle) {
    els.pageTitle.textContent = window.getSectionTitle('meterReport', 'Building Meter Status Report');
  }
  await loadFilters();
  setupFilters();
  setupSorting();
  setupPagination();
  setupActionButtons();
  refresh();
}

init();
