/* eTRAMS Admin Grid Report Frontend */

const API_BASE = '';

const state = {
  gridId: '',
  startDate: '2026-06-10T12:00',
  endDate: '2026-06-13T17:00'
};

const els = {
  gridSelect: document.getElementById('filter-grid'),
  startTimeInput: document.getElementById('filter-start-time'),
  endTimeInput: document.getElementById('filter-end-time'),
  outGrid: document.getElementById('out-selected-grid'),
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
}

async function loadGridReport() {
  if (!state.gridId) return;

  const selectedGridText = els.gridSelect.options[els.gridSelect.selectedIndex]?.text || '';
  els.outGrid.textContent = selectedGridText;
  els.outStart.textContent = formatDisplayDate(state.startDate);
  els.outEnd.textContent = formatDisplayDate(state.endDate);

  try {
    let url = `${API_BASE}/api/meters?limit=10000&start_date=${state.startDate}&end_date=${state.endDate}`;
    if (state.gridId !== 'all') {
      url += `&grid_id=${state.gridId}`;
    }
    const res = await fetch(url);
    const result = await res.json();
    const meters = result.data || result;

    if (!meters || meters.length === 0) {
      els.tbody.innerHTML = '<tr><td colspan="4" class="loading">No data found for selected grid and date range.</td></tr>';
      return;
    }

    const gridMap = {};
    meters.forEach((m) => {
      const g = m.grid_name || 'Unknown Grid';
      if (!gridMap[g]) {
        gridMap[g] = { prev: 0, curr: 0, totalKw: 0 };
      }
      gridMap[g].prev += parseFloat(m.previous_reading || 0);
      gridMap[g].curr += parseFloat(m.current_reading || 0);
      gridMap[g].totalKw += parseFloat(m.total_used || 0);
    });

    els.tbody.innerHTML = Object.entries(gridMap).map(([gridName, totals]) => `
      <tr>
        <td>${gridName}</td>
        <td class="numeric">${totals.prev.toFixed(2)}</td>
        <td class="numeric">${totals.curr.toFixed(2)}</td>
        <td class="numeric">${totals.totalKw.toFixed(2)}</td>
      </tr>
    `).join('');
  } catch (err) {
    els.tbody.innerHTML = `<tr><td colspan="4" class="error">Error loading grid report data.</td></tr>`;
  }
}

function setupEvents() {
  const btnSettings = document.getElementById('btn-system-settings');
  if (btnSettings) {
    btnSettings.addEventListener('click', () => {
      window.location.href = '/settings.html';
    });
  }

  els.gridSelect.addEventListener('change', () => {
    state.gridId = els.gridSelect.value;
    loadGridReport();
  });

  els.startTimeInput.addEventListener('change', () => {
    state.startDate = els.startTimeInput.value;
    loadGridReport();
  });

  els.endTimeInput.addEventListener('change', () => {
    state.endDate = els.endTimeInput.value;
    loadGridReport();
  });

  document.getElementById('btn-reset-filters').addEventListener('click', () => {
    state.startDate = '2026-06-10T12:00';
    state.endDate = '2026-06-13T17:00';
    state.gridId = 'all';
    els.gridSelect.value = state.gridId;
    els.startTimeInput.value = state.startDate;
    els.endTimeInput.value = state.endDate;
    loadGridReport();
  });

  document.getElementById('btn-download-csv').addEventListener('click', () => {
    const startDay = state.startDate.split('T')[0];
    const endDay = state.endDate.split('T')[0];
    let url = `${API_BASE}/api/meters/csv?start_date=${startDay}&end_date=${endDay}`;
    if (state.gridId !== 'all') {
      url += `&grid_id=${state.gridId}`;
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
    pdf.save('grid-demand-report.pdf');
  });
}

async function init() {
  if (window.getSectionTitle && els.pageTitle) {
    els.pageTitle.textContent = window.getSectionTitle('gridReport', 'Grid Demand Report');
  }
  await loadGrids();
  setupEvents();
  loadGridReport();
}

init();
