import React, { useEffect, useMemo, useRef, useState } from 'https://esm.sh/react@18.2.0';
import ReactDOM from 'https://esm.sh/react-dom@18.2.0/client';
import htm from 'https://esm.sh/htm@3.1.1';
import Chart from 'https://esm.sh/chart.js@4.4.1/auto';
import ChartDataLabels from 'https://esm.sh/chartjs-plugin-datalabels@2.2.0?deps=chart.js@4.4.1';

Chart.register(ChartDataLabels);

const html = htm.bind(React.createElement);
const API_BASE = '';

function getDefaultDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
const defaultDateString = getDefaultDateString();

// --- Icons ---
const SettingsIcon = () => html`
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
`;

const DownloadIcon = () => html`
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
`;

const ZoomIcon = () => html`
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
    <line x1="11" y1="8" x2="11" y2="14" />
    <line x1="8" y1="11" x2="14" y2="11" />
  </svg>
`;

const FullscreenIcon = () => html`
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
  </svg>
`;

const RefreshIcon = () => html`
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <polyline points="23 4 23 10 17 10" />
    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
  </svg>
`;

const BuildingIcon = () => html`
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
    <path d="M9 22v-4h6v4" />
    <path d="M8 6h.01" />
    <path d="M16 6h.01" />
    <path d="M12 6h.01" />
    <path d="M12 10h.01" />
    <path d="M12 14h.01" />
    <path d="M16 10h.01" />
    <path d="M16 14h.01" />
    <path d="M8 10h.01" />
    <path d="M8 14h.01" />
  </svg>
`;

// --- Helpers ---
function formatDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getMonthRange(monthStr) {
  const [year, month] = monthStr.split('-').map(Number);
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0);
  return {
    start: formatDateKey(start),
    end: formatDateKey(end)
  };
}

function getCurrentMonthStr() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function addMonths(monthStr, delta) {
  const [year, month] = monthStr.split('-').map(Number);
  const d = new Date(year, month - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function exportDashboardPDF(element, filename = 'building-energy-demand.pdf') {
  const html2canvas = window.html2canvas;
  const jsPDF = window.jspdf?.jsPDF;
  if (!html2canvas || !jsPDF) {
    alert('PDF libraries are still loading. Please try again in a moment.');
    return;
  }

  try {
    // Clone the dashboard content off-screen and remove sidebar-margin so it fills the PDF page
    const wrapper = document.createElement('div');
    wrapper.style.position = 'absolute';
    wrapper.style.left = '-9999px';
    wrapper.style.top = '0';
    wrapper.style.width = `${element.scrollWidth}px`;
    wrapper.style.background = '#FFFFFF';
    document.body.appendChild(wrapper);

    const clone = element.cloneNode(true);
    clone.style.marginLeft = '0';
    clone.style.marginRight = '0';
    clone.style.padding = '10px';
    clone.style.width = '100%';
    clone.style.maxWidth = 'none';
    clone.style.minWidth = '0';
    wrapper.appendChild(clone);

    // Hide interactive/action buttons in the PDF capture
    clone.querySelectorAll('.icon-btn, .filter-actions, .footer-actions, .btn-export-pdf-action').forEach((el) => {
      el.style.display = 'none';
    });

    // Convert Chart.js canvases to images so html2canvas captures them correctly
    const originalCanvases = element.querySelectorAll('canvas');
    clone.querySelectorAll('canvas').forEach((canvas, index) => {
      try {
        const originalCanvas = originalCanvases[index];
        const dataUrl = originalCanvas.toDataURL('image/png');
        const img = document.createElement('img');
        img.src = dataUrl;
        img.style.width = originalCanvas.style.width || '100%';
        img.style.height = originalCanvas.style.height || '100%';
        img.style.display = 'block';
        img.style.maxWidth = '100%';
        canvas.parentNode.replaceChild(img, canvas);
      } catch (e) {
        console.warn('Could not convert canvas to image', e);
      }
    });

    const canvas = await html2canvas(clone, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#FFFFFF',
      windowWidth: clone.scrollWidth,
      windowHeight: clone.scrollHeight
    });

    document.body.removeChild(wrapper);

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('l', 'mm', 'a4');
    const pageWidth = 297;
    const pageHeight = 210;
    const margin = 5;
    const maxWidth = pageWidth - 2 * margin;
    const maxHeight = pageHeight - 2 * margin;

    const imgWidthPx = canvas.width;
    const imgHeightPx = canvas.height;
    const imgAspect = imgHeightPx / imgWidthPx;

    let finalWidth = maxWidth;
    let finalHeight = finalWidth * imgAspect;
    if (finalHeight > maxHeight) {
      finalHeight = maxHeight;
      finalWidth = finalHeight / imgAspect;
    }

    const x = (pageWidth - finalWidth) / 2;
    const y = (pageHeight - finalHeight) / 2;

    pdf.addImage(imgData, 'PNG', x, y, finalWidth, finalHeight);
    pdf.save(filename);
  } catch (err) {
    console.error('PDF export failed', err);
    alert('PDF export failed. Please try again.');
  }
}

// --- Components ---
function AppHeader() {
  return html`
    <header class="AppHeader" id="AppHeader">
      <div class="header-logo">
        <img src="etrams.jpg" alt="eTRAMS logo" class="header-logo-img" />
      </div>
      <h1 class="header-title">
        <span class="highlight">e</span>NERGY Technical Reporting <span class="highlight">A</span>nalysis <span class="highlight">M</span>anagement <span class="highlight">S</span>ystem
      </h1>
    </header>
  `;
}

function PageHeader({ onExportPDF }) {
  const customTitle = window.getSectionTitle ? window.getSectionTitle('buildingStatistics', 'Building Energy Demand') : 'Building Energy Demand';
  return html`
    <section class="PageHeader" id="PageHeader">
      <div class="page-title-cluster">
        <span class="page-icon"><${BuildingIcon} /></span>
        <h2 class="page-title">${customTitle}</h2>
        <span class="record-badge" id="badge-record-count">Building Report</span>
      </div>
      <button class="btn btn-secondary btn-export-pdf-action" id="btn-export-pdf" onClick=${onExportPDF}>
        <${DownloadIcon} />
        Export PDF
      </button>
    </section>
  `;
}

function FilterControlBar({ filters, setFilters, grids, buildings, areas }) {
  const setGrid = (gridId) => {
    setFilters((prev) => ({ ...prev, gridId, buildingId: '', areaId: '' }));
  };

  const setBuilding = (buildingId) => {
    setFilters((prev) => ({ ...prev, buildingId, areaId: '' }));
  };

  return html`
    <section class="FilterControlBar" id="FilterControlBar">
      <div class="filters-left">
        <div class="filter-group">
          <label for="filter-grid">Select Grid</label>
          <select id="filter-grid" value=${filters.gridId} onChange=${(e) => setGrid(e.target.value)}>
            ${grids.map((g) => html`<option key=${g.id} value=${g.id}>${g.name}</option>`)}
          </select>
        </div>
        <div class="filter-group">
          <label for="filter-building">Select Building</label>
          <select id="filter-building" value=${filters.buildingId} disabled=${!filters.gridId} onChange=${(e) => setBuilding(e.target.value)}>
            ${buildings.map((b) => html`<option key=${b.id} value=${b.id}>${b.name}</option>`)}
          </select>
        </div>
        <div class="filter-group">
          <label for="filter-floor">Select Floor/Area</label>
          <select id="filter-floor" value=${filters.areaId} disabled=${!filters.buildingId} onChange=${(e) => setFilters((prev) => ({ ...prev, areaId: e.target.value }))}>
            <option value="">-- ALL --</option>
            ${areas.map((a) => html`<option key=${a.id} value=${a.id}>${a.name}</option>`)}
          </select>
        </div>
        <div class="filter-group">
          <label for="filter-start">Start Date</label>
          <input type="date" id="filter-start" value=${filters.startDate} onChange=${(e) => setFilters((prev) => ({ ...prev, startDate: e.target.value }))} />
        </div>
                <div class="filter-group">
          <label for="filter-meter-type">Meter Type</label>
          <select id="filter-meter-type" value=${filters.meterType} onChange=${(e) => setFilters((prev) => ({ ...prev, meterType: e.target.value }))}>
            <option value="main">Main</option>
            <option value="submeter">Submeter</option>
            <option value="backup">Backup</option>
          </select>
        </div>
        <div class="filter-group">
          <label for="filter-end">End Date</label>
          <input type="date" id="filter-end" value=${filters.endDate} onChange=${(e) => setFilters((prev) => ({ ...prev, endDate: e.target.value }))} />
        </div>
      </div>
    </section>
  `;
}

function MeterDemandChart({ meters, loading }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const totalPages = Math.max(1, Math.ceil(meters.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedMeters = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return meters.slice(start, start + pageSize);
  }, [meters, currentPage]);

  useEffect(() => {
    if (!canvasRef.current || loading) return;
    if (chartRef.current) chartRef.current.destroy();

    const labels = paginatedMeters.map((m) => m.meter_code);
    const values = paginatedMeters.map((m) => parseFloat(m.total_used || 0));
    const colors = paginatedMeters.map((_, i) => `hsl(${(i * 35) % 360}, 70%, 50%)`);

    chartRef.current = new Chart(canvasRef.current.getContext('2d'), {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Total KW Consumption',
          data: values,
          backgroundColor: colors,
          borderRadius: 4,
          barPercentage: 0.6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          datalabels: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.label}: ${ctx.parsed.y.toFixed(2)} KW`
            }
          }
        },
        scales: {
          x: { title: { display: true, text: 'Meters on Selected Floor/Area', color: '#6B7280', font: { size: 12 } }, grid: { display: false } },
          y: { title: { display: true, text: 'KW Total', color: '#6B7280', font: { size: 12 } }, grid: { color: '#E5E7EB', borderDash: [4, 4] } }
        }
      }
    });

    return () => {
      if (chartRef.current) chartRef.current.destroy();
    };
  }, [paginatedMeters, loading]);

  const downloadChart = () => {
    if (chartRef.current) {
      const link = document.createElement('a');
      link.download = 'floor-meter-demand.png';
      link.href = chartRef.current.toBase64Image();
      link.click();
    }
  };

  return html`
    <section class="card" id="PowerDemandChart">
      <div class="chart-header" style=${{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
        <div style=${{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div class="chart-icon-circle">🏢</div>
          <div class="chart-title-block">
            <h3>KW</h3>
            <p>Meter Power Demand on Floor/Area</p>
          </div>
        </div>
        <div class="chart-actions" style=${{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style=${{ display: 'flex', alignItems: 'center', gap: '4px', marginRight: '8px' }}>
            <button class="btn btn-text" disabled=${currentPage <= 1} onClick=${() => setPage((p) => Math.max(1, p - 1))}>Previous</button>
            <span style=${{ fontSize: '12px', color: '#6b7280' }}>Page ${currentPage} of ${totalPages}</span>
            <button class="btn btn-text" disabled=${currentPage >= totalPages} onClick=${() => setPage((p) => Math.min(totalPages, p + 1))}>Next</button>
          </div>
          <button class="icon-btn" id="btn-chart-download" title="Download PNG" onClick=${downloadChart}><${DownloadIcon} /></button>
          <button class="icon-btn" id="btn-refresh-data" title="Refresh Data" onClick=${() => window.location.reload()}><${RefreshIcon} /></button>
        </div>
      </div>
      <div class="chart-container">
        ${loading ? html`<div class="empty-state">Loading chart data...</div>` : html`<canvas ref=${canvasRef} />`}
      </div>
    </section>
  `;
}

function BuildingConsumptionChart({ meters, loading }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current || loading) return;
    if (chartRef.current) chartRef.current.destroy();

    const labels = (meters || []).map((m) => m.meter_code || 'Meter');
    const values = (meters || []).map((m) => parseFloat(m.total_used || 0));
    const sliceColors = (meters || []).map((_, i) => `hsl(${(i * 45) % 360}, 65%, 55%)`);


    chartRef.current = new Chart(canvasRef.current.getContext('2d'), {
      type: 'pie',
      data: {
        labels,
        datasets: [{
          data: values,
          backgroundColor: sliceColors,
          borderWidth: 2,
          borderColor: '#fff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          datalabels: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const label = ctx.label || '';
                const value = ctx.parsed || 0;
                const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                const pct = total ? ((value / total) * 100).toFixed(1) : 0;
                return `${label}: ${value.toFixed(2)} KW (${pct}%)`;
              }
            }
          }
        }
      }
    });

    return () => {
      if (chartRef.current) chartRef.current.destroy();
    };
  }, [meters, loading]);

  return html`
    <section class="card" id="BuildingConsumptionChart">
      <div class="bottom-chart-title">Building KW Consumption</div>
      <div class="bottom-chart-container">
        ${loading ? html`<div class="empty-state">Loading...</div>` : html`<canvas ref=${canvasRef} />`}
      </div>
    </section>
  `;
}

function MonthlyGridDemandChart() {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);
  const [year, setYear] = useState(2026);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    const url = `${API_BASE}/api/monthly-grid-kw?year=${year}`;
    fetchJSON(url)
      .then((rows) => {
        setData(rows);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [year]);

  useEffect(() => {
    if (!canvasRef.current) return;
    if (chartRef.current) chartRef.current.destroy();

    const labels = data.map((d) => d.month_name.slice(0, 3));
    const values = data.map((d) => d.total_kw);
    const barColor = '#3B82F6';

    chartRef.current = new Chart(canvasRef.current.getContext('2d'), {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'KW Demand',
          data: values,
          backgroundColor: barColor,
          borderColor: barColor,
          borderWidth: 1,
          borderRadius: 4,
          barPercentage: 0.6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          datalabels: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.label}: ${ctx.parsed.y.toFixed(2)} KW`
            }
          }
        },
        scales: {
          x: { title: { display: true, text: 'Months', color: '#9CA3AF', font: { size: 12 } }, grid: { display: false }, ticks: { color: '#6B7280', font: { size: 11 } } },
          y: { title: { display: true, text: 'KW DEMAND', color: '#9CA3AF', font: { size: 12 } }, grid: { color: '#e0e0e0', borderDash: [4, 4] }, ticks: { color: '#6B7280', font: { size: 11 } } }
        }
      }
    });

    return () => {
      if (chartRef.current) chartRef.current.destroy();
    };
  }, [data]);

  return html`
    <section class="card" id="MonthlyGridDemandChart">
      <div class="bottom-chart-title">Monthly Grid KW Demand</div>
      <div class="bottom-chart-container">
        ${loading ? html`<div class="empty-state">Loading...</div>` : html`<canvas ref=${canvasRef} />`}
      </div>
      <div class="flex justify-end gap-2 mt-3">
        <select class="filter-dropdown" value=${year} onChange=${(e) => setYear(Number(e.target.value))}>
          <option value="2025">2025</option>
          <option value="2026">2026</option>
          <option value="2027">2027</option>
        </select>
      </div>
    </section>
  `;
}

function SummaryFooterBar({ totalKw }) {
  return html`
    <section class="SummaryFooterBar" id="SummaryFooterBar">
      <div class="summary-metrics centered">
        <div class="metric-block total-kw-block">
          <span class="metric-label">Total Kilowatts</span>
          <span class="metric-value total-kw-value">${totalKw.toFixed(2)} KW</span>
        </div>
      </div>
    </section>
  `;
}

// --- Main App ---
function App() {
  const contentRef = useRef(null);
  const [grids, setGrids] = useState([]);
  const [buildings, setBuildings] = useState([]);
  const [areas, setAreas] = useState([]);

  const [filters, setFilters] = useState({
    gridId: '',
    buildingId: '',
    areaId: '',
    startDate: defaultDateString,
    endDate: defaultDateString,
    meterType: 'main'
  });

  const [buildingAreaData, setBuildingAreaData] = useState([]);
  const [meters, setMeters] = useState([]);
  const [metersLoading, setMetersLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchJSON(`${API_BASE}/api/grids`).then((data) => {
      setGrids(data);
      if (data.length > 0) {
        setFilters((prev) => ({ ...prev, gridId: prev.gridId || String(data[0].id) }));
      }
    }).catch(setError);
  }, []);

  useEffect(() => {
    if (!filters.gridId) {
      setBuildings([]);
      return;
    }
    fetchJSON(`${API_BASE}/api/buildings?grid_id=${filters.gridId}`).then((data) => {
      setBuildings(data);
      if (data.length > 0) {
        setFilters((prev) => ({ ...prev, buildingId: prev.buildingId || String(data[0].id) }));
      }
    }).catch(setError);
  }, [filters.gridId]);

  useEffect(() => {
    if (!filters.buildingId) {
      setAreas([]);
      return;
    }
    fetchJSON(`${API_BASE}/api/areas?building_id=${filters.buildingId}`).then(setAreas).catch(setError);
  }, [filters.buildingId]);

  useEffect(() => {
    if (!filters.gridId || !filters.buildingId) return;
    setLoading(true);
    let url = `${API_BASE}/api/building-area-demand?grid_id=${filters.gridId}&building_id=${filters.buildingId}&start_date=${filters.startDate}&end_date=${filters.endDate}&meter_type=${filters.meterType}`;
    if (filters.areaId) url += `&area_id=${filters.areaId}`;
    fetchJSON(url).then((data) => {
      setBuildingAreaData(data);
      setLoading(false);
    }).catch((err) => {
      setError(err);
      setLoading(false);
    });
  }, [filters.gridId, filters.buildingId, filters.areaId, filters.startDate, filters.endDate, filters.meterType]);

  useEffect(() => {
    if (!filters.gridId || !filters.buildingId) return;
    setMetersLoading(true);
    let url = `${API_BASE}/api/meters?grid_id=${filters.gridId}&building_id=${filters.buildingId}&limit=1000&start_date=${filters.startDate}&end_date=${filters.endDate}&meter_type=${filters.meterType}`;
    if (filters.areaId) url += `&area_id=${filters.areaId}`;

    fetchJSON(url)
      .then((res) => {
        setMeters(res.data || []);
        setMetersLoading(false);
      })
      .catch(() => {
        setMetersLoading(false);
      });
  }, [filters.gridId, filters.buildingId, filters.areaId, filters.startDate, filters.endDate, filters.meterType]);

  const selectedGridObj = grids.find((g) => String(g.id) === String(filters.gridId));
  const selectedBuildingObj = buildings.find((b) => String(b.id) === String(filters.buildingId));
  const selectedAreaObj = areas.find((a) => String(a.id) === String(filters.areaId));

  const totalKw = useMemo(() => {
    return buildingAreaData.reduce((sum, d) => sum + parseFloat(d.totalKw || 0), 0);
  }, [buildingAreaData]);

  const handleExportPDF = () => {
    if (contentRef.current) {
      exportDashboardPDF(contentRef.current, 'building-energy-demand.pdf');
    }
  };

  return html`
    <div>
      <${AppHeader} />
      <div class="app-layout">
        <etrams-sidebar active="btn-nav-building"></etrams-sidebar>
        <main ref=${contentRef} class="main-content">
          <${PageHeader} onExportPDF=${handleExportPDF} />
          <div class="pdf-metadata-header" style=${{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '10px 16px', borderRadius: '6px', marginBottom: '12px', fontSize: '13px', color: '#334155', display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
            <span><strong>Grid:</strong> ${selectedGridObj ? selectedGridObj.name : 'N/A'}</span>
            <span><strong>Building:</strong> ${selectedBuildingObj ? selectedBuildingObj.name : 'N/A'}</span>
            <span><strong>Floor/Area:</strong> ${selectedAreaObj ? selectedAreaObj.name : 'ALL Floors'}</span>
            <span><strong>Start Date:</strong> ${filters.startDate}</span>
            <span><strong>End Date:</strong> ${filters.endDate}</span>
          </div>
          ${error ? html`<div class="error">${error.message || 'Failed to load data'}</div>` : null}
          <${FilterControlBar} filters=${filters} setFilters=${setFilters} grids=${grids} buildings=${buildings} areas=${areas} />
          <${MeterDemandChart} meters=${meters} loading=${metersLoading} />
          <div class="bottom-charts-row">
            <${BuildingConsumptionChart} meters=${meters} loading=${metersLoading} />
            <${MonthlyGridDemandChart} />
          </div>
          <${SummaryFooterBar} totalKw=${totalKw} />
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
    container._reactRoot.render(html`<${App} />`);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mount);
} else {
  mount();
}
