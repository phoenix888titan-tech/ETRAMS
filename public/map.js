async function getMapImageUrl() {
  try {
    let savedStr = null;
    if (window.etramsThemeStorage) {
      savedStr = await window.etramsThemeStorage.getItem('etrams_theme_settings');
    } else {
      savedStr = localStorage.getItem('etrams_theme_settings');
    }
    const saved = JSON.parse(savedStr || '{}');
    return saved.mapImage || 'campus-map.png';
  } catch (e) {
    return 'campus-map.png';
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const MAP_WIDTH = 1800;
  const MAP_HEIGHT = 1100;
  const bounds = [
    [0, 0],
    [MAP_HEIGHT, MAP_WIDTH]
  ];

  const map = L.map('full-campus-map', {
    crs: L.CRS.Simple,
    bounds: bounds,
    maxBounds: bounds,
    maxBoundsViscosity: 1.0,
    zoomControl: false,
    attributionControl: false,
    scrollWheelZoom: true,
    doubleClickZoom: true,
    dragging: true
  });

  const mapImageUrl = await getMapImageUrl();

  // Render ONLY the uploaded image in Leaflet plugin (no markers, no button controls)
  L.imageOverlay(mapImageUrl, bounds, { opacity: 1.0 }).addTo(map);
  map.fitBounds(bounds);

  window.addEventListener('resize', () => {
    map.invalidateSize();
    map.fitBounds(bounds);
  });
});
