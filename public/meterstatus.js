import React, { useEffect, useMemo, useRef, useState } from 'https://esm.sh/react@18.2.0';
import ReactDOM from 'https://esm.sh/react-dom@18.2.0/client';
import htm from 'https://esm.sh/htm@3.1.1';
import Chart from 'https://esm.sh/chart.js@4.4.1/auto';
import ChartDataLabels from 'https://esm.sh/chartjs-plugin-datalabels@2.2.0?deps=chart.js@4.4.1';

Chart.register(ChartDataLabels);

const html = htm.bind(React.createElement);
const API_BASE = '';

// --- Parameter config ---
const PARAMETERS = {
  vll: {
    id: 'vll',
    label: 'Voltage Line to Line',
    column: 'vll',
    unit: 'V',
    color: '#1E3A8A',
    textColor: '#FFFFFF',
    activeBorder: '#172554',
    shadow: 'rgba(30, 58, 138, 0.3)',
    min: 0,
    max: 500,
    step: 50
  },
  vln: {
    id: 'vln',
    label: 'Voltage Line to Nuetral',
    column: 'vln',
    unit: 'V',
    color: '#FFA500',
    textColor: '#1F2937',
    activeBorder: '#1F2937',
    shadow: 'rgba(255, 165, 0, 0.3)',
    min: 0,
    max: 500,
    step: 50
  },
  amps: {
    id: 'amps',
    label: 'Ampere',
    column: 'amps',
    unit: 'A',
    color: '#FF0000',
    textColor: '#FFFFFF',
    activeBorder: '#991B1B',
    shadow: 'rgba(255, 0, 0, 0.3)',
    min: 0,
    max: 100,
    step: 10
  },
  power_factor: {
    id: 'power_factor',
    label: 'Power Factor',
    column: 'power_factor',
    unit: '',
    color: '#32CD32',
    textColor: '#1F2937',
    activeBorder: '#1F2937',
    shadow: 'rgba(50, 205, 50, 0.3)',
    min: 0,
    max: 1,
    step: 0.1
  },
  active_power: {
    id: 'active_power',
    label: 'Active power',
    column: 'active_power',
    unit: 'kW',
    color: '#00BFFF',
    textColor: '#FFFFFF',
    activeBorder: '#1E3A8A',
    shadow: 'rgba(0, 191, 255, 0.3)',
    min: 0,
    max: 50,
    step: 5
  }
};

const PARAM_KEYS = Object.keys(PARAMETERS);

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

const ActivityIcon = () => html`
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
  </svg>
`;

// --- Helpers ---
function formatDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function shiftDate(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return formatDateKey(d);
}

function getLookbackRange(lookbackDays) {
  const days = parseInt(lookbackDays, 10) || 30;
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - days);
  return {
    startDate: formatDateKey(start),
    endDate: formatDateKey(end)
  };
}

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function exportMeterStatusPDF(element) {
  const html2canvas = window.html2canvas;
  const jsPDF = window.jspdf?.jsPDF;
  if (!html2canvas || !jsPDF) {
    alert('PDF libraries are still loading. Please try again in a moment.');
    return;
  }

  try {
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

    clone.querySelectorAll('.icon-btn, .filter-actions, .footer-actions, .btn-export-pdf-action').forEach((el) => {
      el.style.display = 'none';
    });

    clone.querySelectorAll('canvas').forEach((canvas) => {
      try {
        const dataUrl = canvas.toDataURL('image/png');
        const img = document.createElement('img');
        img.src = dataUrl;
        img.style.width = canvas.style.width || '100%';
        img.style.height = canvas.style.height || '100%';
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
    pdf.save('meter-status-detail.pdf');
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
  const customTitle = window.getSectionTitle ? window.getSectionTitle('meterStatistics', 'Meter Detail') : 'Meter Detail';
  return html`
    <section class="PageHeader" id="PageHeader">
      <div class="page-title-cluster">
        <span class="page-icon">🔌</span>
        <h2 class="page-title">${customTitle}</h2>
      </div>
      <button class="btn btn-secondary btn-export-pdf-action" id="btn-export-pdf" onClick=${onExportPDF}>
        <${FileIcon} />
        Export PDF
      </button>
    </section>
  `;
}

function FilterControlBar({ filters, setFilters, grids, buildings, areas, meters }) {
  const setGrid = (gridId) => {
    setFilters((prev) => ({
      ...prev,
      gridId,
      buildingId: '',
      areaId: '',
      meterId: ''
    }));
  };

  const setBuilding = (buildingId) => {
    setFilters((prev) => ({
      ...prev,
      buildingId,
      areaId: '',
      meterId: ''
    }));
  };

  const setArea = (areaId) => {
    setFilters((prev) => ({
      ...prev,
      areaId,
      meterId: ''
    }));
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
          <label for="filter-area">Select Floor/Area</label>
          <select id="filter-area" value=${filters.areaId} disabled=${!filters.buildingId} onChange=${(e) => setArea(e.target.value)}>
            <option value="">-- ALL --</option>
            ${areas.map((a) => html`<option key=${a.id} value=${a.id}>${a.name}</option>`)}
          </select>
        </div>
        <div class="filter-group">
          <label for="filter-meter">Select Meter</label>
          <select id="filter-meter" value=${filters.meterId} onChange=${(e) => setFilters((prev) => ({ ...prev, meterId: e.target.value }))}>
            <option value="">Select Meter</option>
            ${meters.map((m) => html`<option key=${m.meter_id} value=${m.meter_id}>${m.meter_code} — ${m.meter_description}</option>`)}
          </select>
        </div>
        <div class="filter-group">
          <label for="filter-lookback">Select Date Range</label>
          <select id="filter-lookback" value=${filters.lookback} onChange=${(e) => setFilters((prev) => ({ ...prev, lookback: e.target.value }))}>
            <option value="30">Past 30 days</option>
            <option value="60">Past 60 days</option>
            <option value="90">Past 90 days</option>
          </select>
        </div>
      </div>
    </section>
  `;
}

function ParameterSelector({ activeParam, onSelect }) {
  return html`
    <div class="parameter-selector">
      <div class="parameter-selector-title">Select Parameter</div>
      <div class="parameter-buttons">
        ${PARAM_KEYS.map((key) => {
          const p = PARAMETERS[key];
          return html`
            <button
              key=${p.id}
              id=${`btn-param-${p.id}`}
              className=${`param-btn ${activeParam === p.id ? 'active' : ''}`}
              style=${{
                backgroundColor: p.color,
                color: p.textColor,
                borderColor: activeParam === p.id ? p.activeBorder : 'transparent',
                boxShadow: activeParam === p.id ? `0 4px 12px ${p.shadow}` : 'none'
              }}
              onClick=${() => onSelect(p.id)}
            >
              ${p.label}
            </button>
          `;
        })}
      </div>
    </div>
  `;
}

function MeterLineGraph({ readings, activeParam, gridId }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    if (chartRef.current) chartRef.current.destroy();

    const p = PARAMETERS[activeParam];
    const labels = readings.map((r) => {
      const d = new Date(r.reading_datetime);
      return `${String(d.getDate()).padStart(2, '0')} ${d.toLocaleString('en-US', { month: 'short' })}`;
    });
    const data = readings.map((r) => parseFloat(r[p.column]) || 0);

    chartRef.current = new Chart(canvasRef.current.getContext('2d'), {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: p.label,
          data,
          borderColor: p.color,
          backgroundColor: p.color + '1A',
          pointBackgroundColor: p.color,
          pointBorderColor: '#1F2937',
          pointRadius: 3,
          pointHoverRadius: 6,
          fill: true,
          tension: 0.4,
          borderWidth: 2
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
              label: (ctx) => `${p.label}: ${ctx.parsed.y.toFixed(3)} ${p.unit}`
            }
          }
        },
        scales: {
          x: {
            title: { display: true, text: 'Time Line', color: '#6B7280', font: { size: 12 } },
            grid: { display: false },
            ticks: { color: '#6B7280', font: { size: 10 }, maxRotation: 45, minRotation: 0 }
          },
          y: {
            title: { display: true, text: `${p.label} (${p.unit})`, color: '#6B7280', font: { size: 12 } },
            min: p.min,
            suggestedMax: p.max,
            grid: { color: '#E5E7EB', borderDash: [4, 4] },
            ticks: { color: '#6B7280', font: { size: 11 }, stepSize: p.step }
          }
        }
      }
    });

    return () => {
      if (chartRef.current) chartRef.current.destroy();
    };
  }, [readings, activeParam]);

  return html`
    <div class="line-graph-container" id="MeterLineGraph">
      <div class="chart-actions">
        <span class="line-graph-title">Selected Parameter</span>
      </div>
      <div class="line-graph-wrapper">
        ${!gridId
          ? html`<div style=${{ width: '100%', height: '100%' }}></div>`
          : readings.length === 0
            ? html`<div class="empty-state">Select a Meter and date range to view readings</div>`
            : html`<canvas ref=${canvasRef} />`}
      </div>
    </div>
  `;
}

function MeterDetailCard({ readings, activeParam, onParamSelect, selectedMeter, gridId }) {
  return html`
    <section class="card meter-detail-card" id="MeterDetailCard">
      <div class="meter-name-header" id="MeterNameHeader">
        <div class="meter-name-titles">
          <div class="meter-name-title">${selectedMeter ? selectedMeter.meter_description : 'Meter Name'}</div>
          <div class="meter-name-subtitle">Meter Array</div>
        </div>
      </div>
      <${MeterLineGraph} readings=${readings} activeParam=${activeParam} gridId=${gridId} />
      <${ParameterSelector} activeParam=${activeParam} onSelect=${onParamSelect} />
    </section>
  `;
}

function MeterModelCard({ averages, activeParam }) {
  const p = PARAMETERS[activeParam];
  const valueMap = {
    vll: { label: 'Avg VLL', value: averages.avg_vll, unit: 'V' },
    vln: { label: 'Avg VLN', value: averages.avg_vln, unit: 'V' },
    amps: { label: 'Avg AMP', value: averages.avg_amp, unit: 'A' },
    power_factor: { label: 'Avg PF', value: averages.avg_pf, unit: '' },
    active_power: { label: 'Avg Act P', value: averages.avg_act_p, unit: 'kW' }
  };

  return html`
    <section class="card" id="MeterModelCard">
      <div class="bottom-chart-title">Meter Model</div>
      <div class="meter-model-inner">
        <div class="model-icon-area">
          <${ActivityIcon} />
        </div>
        <div class="model-values">
          ${PARAM_KEYS.map((key) => {
            const item = valueMap[key];
            const isActive = key === activeParam;
            return html`
              <div
                key=${key}
                className=${`model-value-row ${isActive ? 'active' : ''}`}
                style=${isActive ? { backgroundColor: PARAMETERS[key].color + '33', borderLeft: `4px solid ${PARAMETERS[key].color}` } : { borderLeft: '4px solid transparent' }}
              >
                <span class="model-value-label">${item.label}</span>
                <span class="model-value-value">${item.value !== null && item.value !== undefined ? Number(item.value).toFixed(3) : '—'} ${item.unit}</span>
              </div>
            `;
          })}
        </div>
      </div>
    </section>
  `;
}

function MonthlyGridDemandChart({ gridId }) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!gridId) {
      setData([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const year = 2026;
    const url = `${API_BASE}/api/monthly-grid-kw?year=${year}&grid_id=${gridId}`;
    fetchJSON(url)
      .then((rows) => {
        setData(rows);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [gridId]);

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
          datalabels: { display: false }
        },
        scales: {
          x: {
            title: { display: true, text: 'Months', color: '#9CA3AF', font: { size: 12 } },
            grid: { display: false },
            ticks: { color: '#6B7280', font: { size: 10 } }
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
        ${!gridId
          ? html`<div style=${{ width: '100%', height: '100%' }}></div>`
          : loading
            ? html`<div class="empty-state">Loading...</div>`
            : html`<canvas ref=${canvasRef} />`}
      </div>
    </section>
  `;
}

// --- Main App ---
function App() {
  const contentRef = useRef(null);
  const [filters, setFilters] = useState({
    gridId: '',
    buildingId: '',
    areaId: '',
    meterId: '',
    lookback: '30'
  });
  const [activeParam, setActiveParam] = useState('vll');

  const dateRange = useMemo(() => getLookbackRange(filters.lookback), [filters.lookback]);

  const [grids, setGrids] = useState([]);
  const [buildings, setBuildings] = useState([]);
  const [areas, setAreas] = useState([]);
  const [meters, setMeters] = useState([]);
  const [readings, setReadings] = useState([]);
  const [averages, setAverages] = useState({});
  const [loadingReadings, setLoadingReadings] = useState(false);
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
    if (!filters.buildingId) {
      setMeters([]);
      return;
    }
    let url = `${API_BASE}/api/meters?building_id=${filters.buildingId}&limit=500`;
    if (filters.areaId) url += `&area_id=${filters.areaId}`;
    fetchJSON(url)
      .then((res) => {
        const list = res.data || [];
        setMeters(list);
        if (list.length > 0) {
          setFilters((prev) => ({ ...prev, meterId: String(list[0].meter_id) }));
        }
      })
      .catch(setError);
  }, [filters.buildingId, filters.areaId]);

  useEffect(() => {
    if (!filters.meterId) {
      setReadings([]);
      setAverages({});
      return;
    }
    setLoadingReadings(true);
    const readingsUrl = `${API_BASE}/api/meter-readings?meter_id=${filters.meterId}&start_date=${dateRange.startDate}&end_date=${dateRange.endDate}`;
    const averagesUrl = `${API_BASE}/api/meter-averages?meter_id=${filters.meterId}&start_date=${dateRange.startDate}&end_date=${dateRange.endDate}`;

    Promise.all([fetchJSON(readingsUrl), fetchJSON(averagesUrl)])
      .then(([rData, aData]) => {
        setReadings(rData);
        setAverages(aData || {});
        setLoadingReadings(false);
      })
      .catch((err) => {
        setError(err);
        setLoadingReadings(false);
      });
  }, [filters.meterId, dateRange.startDate, dateRange.endDate]);

  const selectedGridObj = grids.find((g) => String(g.id) === String(filters.gridId));
  const selectedBuildingObj = buildings.find((b) => String(b.id) === String(filters.buildingId));
  const selectedAreaObj = areas.find((a) => String(a.id) === String(filters.areaId));
  const selectedMeter = meters.find((m) => String(m.meter_id) === String(filters.meterId));

  const handleExportPDF = () => {
    if (contentRef.current) {
      exportMeterStatusPDF(contentRef.current);
    }
  };

  return html`
    <div>
      <${AppHeader} />
      <div class="app-layout">
        <etrams-sidebar active="btn-nav-meter-status"></etrams-sidebar>
        <main ref=${contentRef} class="main-content">
          <${PageHeader} onExportPDF=${handleExportPDF} />
          <div class="pdf-metadata-header" style=${{ background: '#f8fafc', border: '1px solid #e2e8f0', padding: '10px 16px', borderRadius: '6px', marginBottom: '12px', fontSize: '13px', color: '#334155', display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
            <span><strong>Grid:</strong> ${selectedGridObj ? selectedGridObj.name : 'N/A'}</span>
            <span><strong>Building:</strong> ${selectedBuildingObj ? selectedBuildingObj.name : 'N/A'}</span>
            <span><strong>Floor/Area:</strong> ${selectedAreaObj ? selectedAreaObj.name : 'ALL Floors'}</span>
            <span><strong>Meter:</strong> ${selectedMeter ? `${selectedMeter.meter_code} — ${selectedMeter.meter_description}` : 'N/A'}</span>
            <span><strong>Date Range:</strong> ${dateRange.startDate} to ${dateRange.endDate}</span>
          </div>
          ${error ? html`<div class="error" style=${{ marginBottom: '12px', color: '#DC2626' }}>${error.message || 'Failed to load data'}</div>` : null}
          <${FilterControlBar}
            filters=${filters}
            setFilters=${setFilters}
            grids=${grids}
            buildings=${buildings}
            areas=${areas}
            meters=${meters}
          />
          <${MeterDetailCard}
            readings=${readings}
            activeParam=${activeParam}
            onParamSelect=${setActiveParam}
            selectedMeter=${selectedMeter}
            gridId=${filters.gridId}
          />
          <div class="bottom-charts-row">
            <${MeterModelCard} averages=${averages} activeParam=${activeParam} />
            <${MonthlyGridDemandChart} gridId=${filters.gridId} />
          </div>
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
