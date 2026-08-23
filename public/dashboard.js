/* ADMU Energy Management System Dashboard Scripts */

// --- Constants & Grid Metadata ---
const COLORS = {
  katipunan1: '#E67E22',
  katipunan2: '#E74C3C',
  katipunan3: '#F1C40F',
  barangka: '#2ECC71',
  balara: '#5DADE2',
  rockwell: '#9B59B6',
  navbar: '#5686C0',
  text: '#333333',
  grid: '#e0e0e0'
};

const GRID_LABELS = {
  katipunan1: 'KATIPUNAN GRID (LOOP 1)',
  katipunan2: 'KATIPUNAN GRID (LOOP 2)',
  katipunan3: 'KATIPUNAN GRID (LOOP 3)',
  barangka: 'BARANGKA GRID',
  balara: 'BALARA GRID',
  rockwell: 'ROCK WELL'
};

const MAP_WIDTH = 1800;
const MAP_HEIGHT = 1100;
const fullBounds = [
  [0, 0],
  [MAP_HEIGHT, MAP_WIDTH]
];

const GRID_ITEMS = [
  { id: 'katipunan1', code: 'LOOP 1', label: 'KATIPUNAN GRID (LOOP 1)', color: '#E67E22', coords: [[750, 300], [850, 600], [700, 700], [600, 400]] },
  { id: 'katipunan2', code: 'LOOP 2', label: 'KATIPUNAN GRID (LOOP 2)', color: '#E74C3C', coords: [[650, 800], [750, 1100], [600, 1200], [500, 900]] },
  { id: 'katipunan3', code: 'LOOP 3', label: 'KATIPUNAN GRID (LOOP 3)', color: '#F1C40F', coords: [[500, 250], [600, 500], [450, 600], [350, 350]] },
  { id: 'barangka', code: 'BARANGKA', label: 'BARANGKA GRID', color: '#2ECC71', coords: [[400, 750], [500, 1000], [350, 1100], [250, 850]] },
  { id: 'balara', code: 'BALARA', label: 'BALARA GRID', color: '#5DADE2', coords: [[200, 400], [300, 650], [150, 750], [80, 500]] },
  { id: 'rockwell', code: 'ROCKWELL', label: 'ROCK WELL', color: '#9B59B6', coords: [[850, 1200], [950, 1500], [800, 1600], [700, 1300]] }
];

// --- Map Setup ---
let map;
let gridLayers = [];
let gridPolygonMap = new Map();
let selectedGridId = null;
let layersVisible = true;

function selectGrid(gridId) {
  selectedGridId = gridId;
  const grid = GRID_ITEMS.find((g) => g.id === gridId);
  const searchInput = document.getElementById('search-grids');
  const dropdown = document.getElementById('search-dropdown');

  if (searchInput && grid) {
    searchInput.value = `${grid.code} — ${grid.label}`;
  }
  if (dropdown) {
    dropdown.classList.add('hidden');
  }

  if (grid && map) {
    map.flyToBounds(grid.coords, { animate: true, padding: [50, 50] });
  }
}

function setupSearchDropdown() {
  const searchInput = document.getElementById('search-grids');
  const dropdown = document.getElementById('search-dropdown');
  if (!searchInput || !dropdown) return;

  function renderDropdown(filterText = '') {
    const query = filterText.trim().toLowerCase();
    const filtered = GRID_ITEMS.filter((g) => g.code.toLowerCase().includes(query) || g.label.toLowerCase().includes(query));

    if (filtered.length === 0) {
      dropdown.innerHTML = '<div class="dropdown-item empty">No grids found</div>';
    } else {
      dropdown.innerHTML = filtered
        .map(
          (g) => `
            <div class="dropdown-item ${selectedGridId === g.id ? 'active' : ''}" data-id="${g.id}">
              <span class="dropdown-code" style="color:${g.color}">${g.code}</span>
              <span class="dropdown-label">${g.label}</span>
            </div>
          `
        )
        .join('');
    }

    dropdown.classList.remove('hidden');
  }

  searchInput.addEventListener('focus', () => renderDropdown(searchInput.value));
  searchInput.addEventListener('input', (e) => renderDropdown(e.target.value));

  document.addEventListener('click', (e) => {
    if (!searchInput.contains(e.target) && !dropdown.contains(e.target)) {
      dropdown.classList.add('hidden');
    }
  });

  dropdown.addEventListener('click', (e) => {
    const item = e.target.closest('.dropdown-item[data-id]');
    if (item) {
      selectGrid(item.dataset.id);
    }
  });
}

function getMapImageUrl() {
  try {
    const saved = JSON.parse(localStorage.getItem('etrams_theme_settings') || '{}');
    return saved.mapImage || 'campus-map.png';
  } catch (e) {
    return 'campus-map.png';
  }
}

function initMap() {
  const mapImageUrl = getMapImageUrl();

  map = L.map('campus-map', {
    crs: L.CRS.Simple,
    bounds: fullBounds,
    maxBounds: fullBounds,
    maxBoundsViscosity: 1.0,
    zoomControl: true,
    scrollWheelZoom: true,
    minZoom: -5
  });

  // Clean map view with uploaded image (no markers or polygon overlays)
  L.imageOverlay(mapImageUrl, fullBounds, { opacity: 1.0 }).addTo(map);
  
  // Ensure the map container is fully rendered before fitting bounds
  setTimeout(() => {
    map.invalidateSize();
    map.fitBounds(fullBounds, { padding: [0,0] });
  }, 100);
  
  // Ensure map stays fitted when the window resizes
  window.addEventListener('resize', () => {
    map.invalidateSize();
    map.fitBounds(fullBounds, { padding: [0,0] });
  });
}

function toggleMapLayers() {
  if (map) {
    map.fitBounds(fullBounds);
  }
}

function toggleMapFullscreen() {
  const mapPanel = document.getElementById('CampusMapPanel');
  if (!document.fullscreenElement) {
    mapPanel.requestFullscreen().catch((err) => {
      console.error('Fullscreen error:', err);
    });
  } else {
    document.exitFullscreen();
  }
}

// Realtime Clock Update
function initRealtimeClock() {
  function updateClock() {
    const timeEl = document.querySelector('.weather-time');
    const dateEl = document.querySelector('.weather-date');
    if (!timeEl && !dateEl) return;
    const now = new Date();
    if (timeEl) {
      const hours = String(now.getHours()).padStart(2, '0');
      const mins = String(now.getMinutes()).padStart(2, '0');
      const secs = String(now.getSeconds()).padStart(2, '0');
      timeEl.textContent = `${hours}:${mins}:${secs}`;
    }
    if (dateEl) {
      const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
      const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
      const currentDayStr = days[now.getDay()];
      dateEl.textContent = `${currentDayStr}, ${months[now.getMonth()]} ${now.getDate()}`;
      
      const forecastDays = document.querySelectorAll('.forecast-day');
      forecastDays.forEach(dayEl => {
        const labelEl = dayEl.querySelector('.day-label');
        if (labelEl && labelEl.textContent.trim() === currentDayStr) {
          dayEl.classList.add('current');
        } else {
          dayEl.classList.remove('current');
        }
      });
    }
  }
  updateClock();
  setInterval(updateClock, 1000);
}

// --- Charts ---
let donutChart;
let barChart;

function initDonutChart() {
  const ctx = document.getElementById('donutChart').getContext('2d');
  donutChart = new Chart(ctx, {
    type: 'pie',
    data: {
      labels: Object.values(GRID_LABELS),
      datasets: [{
        data: [33, 13, 10, 5, 15, 29],
        backgroundColor: [
          COLORS.katipunan1,
          COLORS.katipunan2,
          COLORS.katipunan3,
          COLORS.barangka,
          COLORS.balara,
          COLORS.rockwell
        ],
        borderWidth: 2,
        borderColor: '#ffffff',
        hoverOffset: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      radius: '85%',
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          callbacks: {
            label: (context) => {
              const label = context.label || '';
              const value = context.parsed || 0;
              return `${label}: ${value}%`;
            }
          }
        }
      },
      layout: {
        padding: 12
      }
    }
  });
}

function generateMonthlyData(selectedYear = '2026') {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const data = {};
  const seedMultiplier = selectedYear === '2025' ? 0.8 : selectedYear === '2027' ? 1.2 : 1.0;
  Object.keys(GRID_LABELS).forEach((key) => {
    data[key] = months.map(() => Math.floor((Math.random() * 8 + 2) * seedMultiplier));
  });
  return { months, data };
}

let currentYear = '2026';
let monthlyData = generateMonthlyData(currentYear);

function initBarChart() {
  const ctx = document.getElementById('barChart').getContext('2d');
  const datasets = Object.keys(GRID_LABELS).map((key) => ({
    label: GRID_LABELS[key],
    data: monthlyData.data[key],
    backgroundColor: COLORS[key],
    borderRadius: 3,
    barPercentage: 0.7,
    categoryPercentage: 0.8
  }));

  barChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: monthlyData.months,
      datasets: datasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          mode: 'index',
          intersect: false
        }
      },
      scales: {
        x: {
          title: {
            display: true,
            text: 'Month (1 - 12)',
            color: '#888',
            font: {
              size: 12
            }
          },
          grid: {
            display: false
          },
          ticks: {
            color: '#666',
            font: {
              size: 11
            }
          }
        },
        y: {
          min: 0,
          max: 15,
          title: {
            display: true,
            text: 'kWh',
            color: '#888',
            font: {
              size: 12
            }
          },
          grid: {
            color: '#e0e0e0',
            borderDash: [4, 4]
          },
          ticks: {
            color: '#666',
            font: {
              size: 11
            }
          }
        }
      }
    }
  });
}

function updateBarChartRange(range) {
  let sliceCount = 12;
  if (range === '1M') sliceCount = 1;
  if (range === '3M') sliceCount = 3;
  if (range === '6M') sliceCount = 6;
  if (range === '1Y') sliceCount = 12;

  const start = 12 - sliceCount;
  const labels = monthlyData.months.slice(start);
  barChart.data.labels = labels;
  barChart.data.datasets.forEach((dataset, index) => {
    const key = Object.keys(GRID_LABELS)[index];
    dataset.data = monthlyData.data[key].slice(start);
  });
  barChart.update();
}

function filterBarChart(gridKey) {
  if (gridKey === 'all') {
    barChart.data.datasets.forEach((ds) => {
      ds.hidden = false;
    });
  } else {
    barChart.data.datasets.forEach((ds) => {
      ds.hidden = ds.label !== GRID_LABELS[gridKey];
    });
  }
  barChart.update();
}

// --- Button Handlers ---
async function exportSectionToPDF(element, filename) {
  const html2canvas = window.html2canvas;
  const jsPDF = window.jspdf?.jsPDF;
  if (!html2canvas || !jsPDF) {
    alert('PDF libraries are loading. Please try again.');
    return;
  }
  try {
    const wrapper = document.createElement('div');
    wrapper.style.position = 'absolute';
    wrapper.style.left = '-9999px';
    wrapper.style.top = '0';
    wrapper.style.width = `${element.scrollWidth || 800}px`;
    wrapper.style.background = '#FFFFFF';
    document.body.appendChild(wrapper);

    const clone = element.cloneNode(true);
    clone.style.padding = '16px';
    clone.style.background = '#FFFFFF';
    wrapper.appendChild(clone);

    const originalCanvases = element.querySelectorAll('canvas');
    const cloneCanvases = clone.querySelectorAll('canvas');
    originalCanvases.forEach((orig, i) => {
      if (cloneCanvases[i]) {
        try {
          const img = document.createElement('img');
          img.src = orig.toDataURL('image/png');
          img.style.width = orig.style.width || '100%';
          img.style.height = orig.style.height || '100%';
          img.style.display = 'block';
          cloneCanvases[i].parentNode.replaceChild(img, cloneCanvases[i]);
        } catch (e) {}
      }
    });

    const canvas = await html2canvas(clone, { scale: 2, backgroundColor: '#FFFFFF' });
    document.body.removeChild(wrapper);

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('l', 'mm', 'a4');
    const pdfHeight = (canvas.height * 277) / canvas.width;
    pdf.addImage(imgData, 'PNG', 10, 10, 277, Math.min(190, pdfHeight));
    pdf.save(filename);
  } catch (err) {
    console.error('Export PDF error:', err);
    alert('PDF export failed.');
  }
}

function setupButtons() {
  // HeaderNav
  const ctrlBtn = document.getElementById('btn-control-panel');
  if (ctrlBtn) {
    ctrlBtn.addEventListener('click', () => {
      window.location.href = `/grid.html`;
    });
  }

  setupSearchDropdown();

  // Map
  const layersBtn = document.getElementById('btn-map-layers');
  if (layersBtn) layersBtn.addEventListener('click', toggleMapLayers);
  const fsBtn = document.getElementById('btn-map-fullscreen');
  if (fsBtn) fsBtn.addEventListener('click', toggleMapFullscreen);
  const gridDetailsBtn = document.getElementById('btn-grid-details');
  if (gridDetailsBtn) {
    gridDetailsBtn.addEventListener('click', () => {
      window.location.href = '/grid.html';
    });
  }

  // Donut chart export
  const exportDonutBtn = document.getElementById('btn-export-donut');
  if (exportDonutBtn) {
    exportDonutBtn.addEventListener('click', () => {
      const card = document.getElementById('EnergyDemandChart');
      if (card) exportSectionToPDF(card, 'grid-active-energy-demand.pdf');
    });
  }

  // Bar chart filter & export
  const chartFilterSelect = document.getElementById('btn-chart-filter');
  if (chartFilterSelect) {
    chartFilterSelect.addEventListener('change', (e) => {
      filterBarChart(e.target.value);
    });
  }

  const yearSelect = document.getElementById('select-chart-year');
  if (yearSelect) {
    yearSelect.addEventListener('change', (e) => {
      currentYear = e.target.value;
      monthlyData = generateMonthlyData(currentYear);
      barChart.data.labels = monthlyData.months;
      barChart.data.datasets.forEach((dataset, index) => {
        const key = Object.keys(GRID_LABELS)[index];
        dataset.data = monthlyData.data[key];
      });
      barChart.update();
    });
  }

  const exportChartBtn = document.getElementById('btn-export-chart');
  if (exportChartBtn) {
    exportChartBtn.addEventListener('click', () => {
      const card = document.getElementById('MonthlyDemandChart');
      if (card) exportSectionToPDF(card, 'monthly-grid-energy-demand.pdf');
    });
  }
}

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
  initRealtimeClock();
  initMap();
  initDonutChart();
  initBarChart();
  setupButtons();
});

// Resize charts on window resize
window.addEventListener('resize', () => {
  if (donutChart) donutChart.resize();
  if (barChart) barChart.resize();
});
