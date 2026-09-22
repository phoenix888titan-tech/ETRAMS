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

const FileIcon = () => html`
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </svg>
`;

const ZoomInIcon = () => html`
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
    <line x1="11" y1="8" x2="11" y2="14" />
    <line x1="8" y1="11" x2="14" y2="11" />
  </svg>
`;

const ZoomOutIcon = () => html`
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
    <line x1="8" y1="11" x2="14" y2="11" />
  </svg>
`;

const DownloadIcon = () => html`
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
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

// --- Helpers ---
function getMonthRange(monthStr) {
  const [year, month] = monthStr.split('-').map(Number);
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0);
  return {
    start: formatDateKey(start),
    end: formatDateKey(end)
  };
}

function formatDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
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

async function exportDashboardPDF(element) {
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
    pdf.save('grid-energy-demand.pdf');
  } catch (err) {
    console.error('PDF export failed', err);
    alert('PDF export failed. Please try again.');
  }
}

// --- Components ---

function AppHeader() {
  const customTitle = window.getSectionTitle ? window.getSectionTitle('gridStatistics', 'Grid Energy Demand') : 'Grid Energy Demand';
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
  const customTitle = window.getSectionTitle ? window.getSectionTitle('gridStatistics', 'Grid Energy Demand') : 'Grid Energy Demand';
  return html`
    <section class="PageHeader" id="PageHeader">
      <div class="page-title-cluster">
        <span class="page-icon">⚡</span>
        <h2 class="page-title">${customTitle}</h2>
      </div>
      <button class="btn btn-secondary btn-export-pdf-action" id="btn-export-pdf" onClick=${onExportPDF}>
        <${FileIcon} />
        Export PDF
      </button>
    </section>
  `;
}

function FilterControlBar({ filters, setFilters, grids }) {
  return html`
    <section class="FilterControlBar" id="FilterControlBar">
      <div class="filters-left">
        <div class="filter-group">
          <label for="filter-grid">Select Grid</label>
          <select id="filter-grid" value=${filters.gridId} onChange=${(e) => setFilters((prev) => ({ ...prev, gridId: e.target.value }))}>
            ${grids.map((g) => html`<option key=${g.id} value=${g.id}>${g.name}</option>`)}
          </select>
        </div>
        <div class="filter-group">
          <label for="filter-start">Start Date</label>
          <input type="date" id="filter-start" value=${filters.startDate} onChange=${(e) => setFilters((prev) => ({ ...prev, startDate: e.target.value }))} />
        </div>
        <div class="filter-group">
          <label for="filter-end">End Date</label>
          <input type="date" id="filter-end" value=${filters.endDate} onChange=${(e) => setFilters((prev) => ({ ...prev, endDate: e.target.value }))} />
        </div>
      </div>
    </section>
  `;
}

function GridLineChart({ gridLoopData, loading }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);
  const [page, setPage] = useState(1);
  const pageSize = 12;

  const totalPages = Math.max(1, Math.ceil(gridLoopData.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return gridLoopData.slice(start, start + pageSize);
  }, [gridLoopData, currentPage]);

  useEffect(() => {
    if (!canvasRef.current || loading) return;
    if (chartRef.current) chartRef.current.destroy();

    const labels = paginatedData.map((d) => d.buildingName || d.gridName || 'Building');
    const values = paginatedData.map((d) => parseFloat(d.totalKw));
    const pointColors = paginatedData.map((d) => d.gridColor || '#3B82F6');

    chartRef.current = new Chart(canvasRef.current.getContext('2d'), {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Total KW per Building',
          data: values,
          backgroundColor: pointColors,
          borderColor: pointColors,
          borderRadius: 4,
          borderWidth: 1,
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
          x: {
            title: { display: true, text: 'Building', color: '#6B7280', font: { size: 12 } },
            grid: { display: false },
            ticks: { color: '#6B7280', font: { size: 10 }, autoSkip: false }
          },
          y: {
            title: { display: true, text: 'KW Total', color: '#6B7280', font: { size: 12 } },
            grid: { color: '#E5E7EB', borderDash: [4, 4] },
            ticks: { color: '#6B7280', font: { size: 11 } }
          }
        }
      }
    });

    return () => {
      if (chartRef.current) chartRef.current.destroy();
    };
  }, [paginatedData, loading]);

  const downloadChart = () => {
    if (chartRef.current) {
      const link = document.createElement('a');
      link.download = 'grid-energy-demand.png';
      link.href = chartRef.current.toBase64Image();
      link.click();
    }
  };

  return html`
    <section class="card" id="GridLineChart">
      <div class="chart-header" style=${{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
        <div class="chart-title">Grid Energy Demand Trend (Total KW per Building)</div>
        <div class="chart-actions" style=${{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style=${{ display: 'flex', alignItems: 'center', gap: '4px', marginRight: '8px' }}>
            <button class="btn btn-text" disabled=${currentPage <= 1} onClick=${() => setPage((p) => Math.max(1, p - 1))}>Previous</button>
            <span style=${{ fontSize: '12px', color: '#6b7280' }}>Page ${currentPage} of ${totalPages}</span>
            <button class="btn btn-text" disabled=${currentPage >= totalPages} onClick=${() => setPage((p) => Math.min(totalPages, p + 1))}>Next</button>
          </div>
          <button class="icon-btn" id="btn-chart-download-png" title="Download PNG" onClick=${downloadChart}><${DownloadIcon} /></button>
          <button class="icon-btn" id="btn-refresh-chart-data" title="Refresh" onClick=${() => window.location.reload()}><${RefreshIcon} /></button>
        </div>
      </div>
      <div class="chart-wrapper">
        ${loading ? html`<div class="empty-state">Loading chart data...</div>` : html`<canvas ref=${canvasRef} />`}
      </div>
    </section>
  `;
}

function BuildingButtonPanel({ buildings }) {
  return html`
    <section class="card" id="BuildingButtonPanel">
      <div class="chart-header">
        <div class="chart-title">Buildings in Grid (${buildings.length})</div>
      </div>
      <div class="building-panel-buttons">
        ${buildings.length === 0
          ? html`<div class="empty-state">No buildings found for selected grid.</div>`
          : buildings.map((b) => html`
              <button key=${b.id} class="building-btn" id=${`btn-building-${b.id}`} title=${b.name}>${b.name}</button>
            `)}
      </div>
    </section>
  `;
}

function BuildingConsumptionChart({ gridLoopData, loading }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current || loading) return;
    if (chartRef.current) chartRef.current.destroy();

    const labels = gridLoopData.map((d) => d.buildingName || d.gridName || '');
    const values = gridLoopData.map((d) => parseFloat(d.totalKw));
    const colors = gridLoopData.map((d, i) => `hsl(${(i * 45) % 360}, 65%, 50%)`);

    chartRef.current = new Chart(canvasRef.current.getContext('2d'), {
      type: 'pie',
      data: {
        labels,
        datasets: [{
          data: values,
          backgroundColor: colors,
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
  }, [gridLoopData, loading]);

  return html`
    <section class="card" id="BuildingConsumptionChart">
      <div class="bottom-chart-title">Building KW Consumption (by Grid)</div>
      <div class="bottom-chart-container">
        ${loading ? html`<div class="empty-state">Loading...</div>` : html`<canvas ref=${canvasRef} />`}
      </div>
    </section>
  `;
}

function MonthlyGridDemandChart({ gridId }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);
  const [year, setYear] = useState(2026);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    let url = `${API_BASE}/api/monthly-grid-kw?year=${year}`;
    if (gridId) url += `&grid_id=${gridId}`;
    fetchJSON(url)
      .then((rows) => {
        setData(rows);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [gridId, year]);

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
          x: {
            title: { display: true, text: 'Months', color: '#9CA3AF', font: { size: 12 } },
            grid: { display: false },
            ticks: { color: '#6B7280', font: { size: 11 } }
          },
          y: {
            title: { display: true, text: 'KW DEMAND', color: '#9CA3AF', font: { size: 12 } },
            grid: { color: '#E5E7EB', borderDash: [4, 4] },
            ticks: { color: '#6B7280', font: { size: 11 } }
          }
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
  const [filters, setFilters] = useState({
    gridId: '',
    startDate: defaultDateString,
    endDate: defaultDateString
  });

  const [buildings, setBuildings] = useState([]);
  const [gridLoopDemand, setGridLoopDemand] = useState([]);
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
    if (!filters.gridId) return;
    fetchJSON(`${API_BASE}/api/buildings?grid_id=${filters.gridId}`).then(setBuildings).catch(setError);
  }, [filters.gridId]);

  useEffect(() => {
    if (!filters.gridId) return;
    setLoading(true);
    let url = `${API_BASE}/api/grid-loop-demand?grid_id=${filters.gridId}&start_date=${filters.startDate}&end_date=${filters.endDate}`;
    fetchJSON(url).then((data) => {
      setGridLoopDemand(data);
      setLoading(false);
    }).catch((err) => {
      setError(err);
      setLoading(false);
    });
  }, [filters.gridId, filters.startDate, filters.endDate]);

  const selectedGridObj = grids.find((g) => String(g.id) === String(filters.gridId));

  const totalKw = useMemo(() => {
    return gridLoopDemand.reduce((sum, d) => sum + parseFloat(d.totalKw || 0), 0);
  }, [gridLoopDemand]);

  const handleExportPDF = () => {
    if (contentRef.current) {
      exportDashboardPDF(contentRef.current);
    }
  };

  return html`
    <div>
      <${AppHeader} />
      <div class="app-layout">
        <etrams-sidebar active="btn-nav-grid"></etrams-sidebar>
        <main ref=${contentRef} class="main-content">
          <${PageHeader} onExportPDF=${handleExportPDF} />
          <div class="pdf-metadata-header" style=${{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '10px 16px', borderRadius: '6px', marginBottom: '12px', fontSize: '13px', color: '#334155', display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
            <span><strong>Grid:</strong> ${selectedGridObj ? selectedGridObj.name : 'N/A'}</span>
            <span><strong>Start Date:</strong> ${filters.startDate}</span>
            <span><strong>End Date:</strong> ${filters.endDate}</span>
          </div>
          ${error ? html`<div class="error">${error.message || 'Failed to load data'}</div>` : null}
          <${FilterControlBar} filters=${filters} setFilters=${setFilters} grids=${grids} />
          <${GridLineChart} gridLoopData=${gridLoopDemand} loading=${loading} />
          <div class="bottom-charts-row">
            <${BuildingConsumptionChart} gridLoopData=${gridLoopDemand} loading=${loading} />
            <${MonthlyGridDemandChart} gridId=${filters.gridId} />
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
