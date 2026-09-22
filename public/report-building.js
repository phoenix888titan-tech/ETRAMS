/* eTRAMS Admin Building Report Frontend */

const API_BASE = '';

function getCurrentDateTimeLocal(isEndOfDay = false) {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const time = isEndOfDay ? '23:59' : '00:00';
  return `${year}-${month}-${day}T${time}`;
}

const state = {
  gridId: '',
  buildingId: '',
  startDate: getCurrentDateTimeLocal(false),
  endDate: getCurrentDateTimeLocal(true)
};

const els = {
  gridSelect: document.getElementById('filter-grid'),
  buildingSelect: document.getElementById('filter-building'),
  startTimeInput: document.getElementById('filter-start-time'),
  endTimeInput: document.getElementById('filter-end-time'),
  outGrid: document.getElementById('out-selected-grid'),
  outBuilding: document.getElementById('out-selected-building'),
  outStart: document.getElementById('out-start-time'),
  outEnd: document.getElementById('out-end-time'),
  tbody: document.getElementById('meters-tbody'),
  pageTitle: document.getElementById('page-section-title')
};

function formatDisplayDate(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return isoStr;
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const m = monthNames[d.getMonth()];
  const day = d.getDate();
  const year = d.getFullYear();
  let hours = d.getHours();
  const ampm = hours >= 12 ? 'pm' : 'am';
  hours = hours % 12 || 12;
  const mins = String(d.getMinutes()).padStart(2, '0');
  return `${m} ${day}, ${year} , ${hours}:${mins} ${ampm}`;
}

async function loadGrids() {
  const res = await fetch(`${API_BASE}/api/grids`);
  const data = await res.json();
  els.gridSelect.innerHTML = '<option value="all">--ALL--</option>';
  data.forEach((g) => {
    const opt = document.createElement('option');
    opt.value = g.id;
    opt.textContent = g.name;
    els.gridSelect.appendChild(opt);
  });
  state.gridId = 'all';
  els.gridSelect.value = state.gridId;
  await loadBuildings(state.gridId);
}

async function loadBuildings(gridId) {
  els.buildingSelect.innerHTML = '<option value="all">--ALL--</option>';
  
  if (gridId === 'all') {
    // If all grids, we could fetch all buildings by just not sending grid_id, but the backend /api/buildings requires it or ignores it?
    // Let's just fetch all buildings if grid_id is not provided, wait, /api/buildings might not filter if grid_id is empty.
    const res = await fetch(`${API_BASE}/api/buildings`);
    const data = await res.json();
    data.forEach((b) => {
      const opt = document.createElement('option');
      opt.value = b.id;
      opt.textContent = b.name;
      els.buildingSelect.appendChild(opt);
    });
  } else {
    const res = await fetch(`${API_BASE}/api/buildings?grid_id=${gridId}`);
    const data = await res.json();
    data.forEach((b) => {
      const opt = document.createElement('option');
      opt.value = b.id;
      opt.textContent = b.name;
      els.buildingSelect.appendChild(opt);
    });
  }
  
  state.buildingId = 'all';
  els.buildingSelect.value = state.buildingId;
}

async function loadBuildingReport() {
  const selectedGridText = els.gridSelect.options[els.gridSelect.selectedIndex]?.text || '';
  const selectedBuildingText = els.buildingSelect.options[els.buildingSelect.selectedIndex]?.text || '';

  els.outGrid.textContent = selectedGridText;
  els.outBuilding.textContent = selectedBuildingText;
  els.outStart.textContent = formatDisplayDate(state.startDate);
  els.outEnd.textContent = formatDisplayDate(state.endDate);

  try {
    let url = `${API_BASE}/api/meters?limit=10000`;
    if (state.gridId && state.gridId !== 'all') {
      url += `&grid_id=${state.gridId}`;
    }
    if (state.buildingId && state.buildingId !== 'all') {
      url += `&building_id=${state.buildingId}`;
    }
    if (state.startDate) {
      url += `&start_date=${encodeURIComponent(state.startDate)}`;
    }
    if (state.endDate) {
      url += `&end_date=${encodeURIComponent(state.endDate)}`;
    }

    const res = await fetch(url);
    const result = await res.json();
    const meters = result.data || [];

    if (meters.length === 0) {
      els.tbody.innerHTML = '<tr><td colspan="5" class="loading">No data found for selected filters and date range.</td></tr>';
      return;
    }

    const buildingMap = {};
    meters.forEach((m) => {
      const g = m.grid_name || 'Unknown Grid';
      const b = m.building_name || 'Unknown Building';
      const key = `${g}::${b}`;
      if (!buildingMap[key]) {
        buildingMap[key] = { gridName: g, buildingName: b, prev: 0, curr: 0, totalKw: 0 };
      }
      buildingMap[key].prev += parseFloat(m.previous_reading || 0);
      buildingMap[key].curr += parseFloat(m.current_reading || 0);
      buildingMap[key].totalKw += parseFloat(m.total_used || 0);
    });

    const rows = Object.values(buildingMap);
    
    // Sort by grid then building name
    rows.sort((a, b) => {
      if (a.gridName < b.gridName) return -1;
      if (a.gridName > b.gridName) return 1;
      return a.buildingName.localeCompare(b.buildingName);
    });

    els.tbody.innerHTML = rows.map((r) => `
      <tr>
        <td>${r.gridName}</td>
        <td>${r.buildingName}</td>
        <td class="numeric">${r.prev.toFixed(2)}</td>
        <td class="numeric">${r.curr.toFixed(2)}</td>
        <td class="numeric">${r.totalKw.toFixed(2)}</td>
      </tr>
    `).join('');
  } catch (err) {
    els.tbody.innerHTML = `<tr><td colspan="5" class="error">Error loading building report data.</td></tr>`;
  }
}


function setupEvents() {
  const btnSettings = document.getElementById('btn-system-settings');
  if (btnSettings) {
    btnSettings.addEventListener('click', () => {
      window.location.href = '/settings.html';
    });
  }

  els.gridSelect.addEventListener('change', async () => {
    state.gridId = els.gridSelect.value;
    await loadBuildings(state.gridId);
    loadBuildingReport();
  });

  els.buildingSelect.addEventListener('change', () => {
    state.buildingId = els.buildingSelect.value;
    loadBuildingReport();
  });

  els.startTimeInput.addEventListener('change', () => {
    state.startDate = els.startTimeInput.value;
    loadBuildingReport();
  });

  els.endTimeInput.addEventListener('change', () => {
    state.endDate = els.endTimeInput.value;
    loadBuildingReport();
  });

  document.getElementById('btn-reset-filters').addEventListener('click', async () => {
    state.startDate = getCurrentDateTimeLocal(false);
    state.endDate = getCurrentDateTimeLocal(true);
    if (els.gridSelect.options.length > 0) {
      state.gridId = 'all';
      els.gridSelect.value = state.gridId;
      await loadBuildings(state.gridId);
    }
    els.startTimeInput.value = state.startDate;
    els.endTimeInput.value = state.endDate;
    loadBuildingReport();
  });

  document.getElementById('btn-download-csv').addEventListener('click', () => {
    const startDay = state.startDate.split('T')[0];
    const endDay = state.endDate.split('T')[0];
    let url = `${API_BASE}/api/meters/csv?start_date=${startDay}&end_date=${endDay}`;
    if (state.gridId && state.gridId !== 'all') {
      url += `&grid_id=${state.gridId}`;
    }
    if (state.buildingId && state.buildingId !== 'all') {
      url += `&building_id=${state.buildingId}`;
    }
    window.open(url, '_blank');
  });

  document.getElementById('btn-export-pdf').addEventListener('click', async () => {
    const jsPDF = window.jspdf?.jsPDF;
    const html2canvas = window.html2canvas;
    const content = document.querySelector('.main-content');
    if (!content || !jsPDF || !html2canvas) return;

    const canvas = await html2canvas(content, { scale: 2, backgroundColor: '#FFFFFF' });
    const pdf = new jsPDF('l', 'mm', 'a4');
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 5, 5, 287, 200);
    pdf.save('building-demand-report.pdf');
  });
}

async function init() {
  if (window.getSectionTitle && els.pageTitle) {
    els.pageTitle.textContent = window.getSectionTitle('buildingReport', 'Building Demand Report');
  }
  await loadGrids();
  setupEvents();
  loadBuildingReport();
}

init();
