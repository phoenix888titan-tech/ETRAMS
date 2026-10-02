// eTRAMS client-side auth guard — include on every authenticated page
// (before the page's own script). Redirects to /login.html when there is
// no logged-in user, exposes the current user, wires the logout button,
// and injects the shared styles for the header user chip / sign-out button.
(function () {
  const stored = sessionStorage.getItem('etrams_user');
  if (!stored) {
    window.location.href = '/login.html';
    return;
  }

  let user = null;
  try {
    user = JSON.parse(stored);
  } catch (e) {
    sessionStorage.removeItem('etrams_user');
    window.location.href = '/login.html';
    return;
  }

  window.ETRAMS_USER = user;

  // Settings page is admin-only.
  if (user.role !== 'admin' && window.location.pathname.endsWith('/settings.html')) {
    window.location.href = '/index.html';
    return;
  }

  window.etramsLogout = async function () {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {
      // Server unreachable — clear local state anyway.
    }
    sessionStorage.removeItem('etrams_user');
    window.location.href = '/login.html';
  };

  
  let activeFetches = 0;
  let fetchStartTime = null;
  let loaderTimer = null;

  function updateLoaderText() {
    const textEl = document.getElementById('etrams-loader-text-el');
    if (!textEl || !fetchStartTime) return;
    const elapsed = Math.floor((Date.now() - fetchStartTime) / 1000);
    textEl.textContent = elapsed > 0 ? `Loading report data...${elapsed}s` : 'Loading report data...';
  }

  function updateGlobalLoader() {
    let loader = document.getElementById('etrams-global-loader');
    if (!loader) {
      const container = document.body || document.documentElement;
      if (container) {
        loader = document.createElement('div');
        loader.id = 'etrams-global-loader';
        loader.innerHTML = `
          <div class="etrams-loader-card">
            <div class="etrams-spinner"></div>
            <div class="etrams-loader-text" id="etrams-loader-text-el">Loading report data...</div>
          </div>
        `;
        container.appendChild(loader);
      }
    }

    if (activeFetches > 0) {
      if (!fetchStartTime) {
        fetchStartTime = Date.now();
      }
      updateLoaderText();
      if (!loaderTimer) {
        loaderTimer = setInterval(updateLoaderText, 1000);
      }
      if (loader) loader.style.display = 'flex';
    } else {
      if (loaderTimer) {
        clearInterval(loaderTimer);
        loaderTimer = null;
      }
      fetchStartTime = null;
      const textEl = document.getElementById('etrams-loader-text-el');
      if (textEl) textEl.textContent = 'Loading report data...';
      if (loader) loader.style.display = 'none';
    }
  }

  // Redirect to login when any API call answers 401 (expired/invalid session).
  const originalFetch = window.fetch.bind(window);
  window.fetch = async function (...args) {
    activeFetches++;
    updateGlobalLoader();
    try {
      const res = await originalFetch(...args);
      if (res.status === 401 && !String(args[0]).includes('/api/auth/')) {
        sessionStorage.removeItem('etrams_user');
        window.location.href = '/login.html';
      }
      return res;
    } finally {
      activeFetches--;
      updateGlobalLoader();
    }
  };


  // IndexedDB Storage Helper for eTRAMS (solves QuotaExceededError for high-res map images & theme settings)
  const DB_NAME = 'etrams_db';
  const DB_VERSION = 1;
  const STORE_NAME = 'settings';

  function getDB() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) {
        reject(new Error('IndexedDB not supported'));
        return;
      }
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      request.onsuccess = (e) => resolve(e.target.result);
      request.onerror = (e) => reject(e.target.error);
    });
  }

  window.etramsThemeStorage = {
    async getItem(key) {
      try {
        const db = await getDB();
        return new Promise((resolve) => {
          const tx = db.transaction(STORE_NAME, 'readonly');
          const store = tx.objectStore(STORE_NAME);
          const req = store.get(key);
          req.onsuccess = () => {
            if (req.result !== undefined) {
              resolve(req.result);
            } else {
              resolve(localStorage.getItem(key));
            }
          };
          req.onerror = () => resolve(localStorage.getItem(key));
        });
      } catch (e) {
        return localStorage.getItem(key);
      }
    },

    async setItem(key, value) {
      try {
        const db = await getDB();
        await new Promise((resolve, reject) => {
          const tx = db.transaction(STORE_NAME, 'readwrite');
          const store = tx.objectStore(STORE_NAME);
          const req = store.put(value, key);
          req.onsuccess = () => resolve();
          req.onerror = (e) => reject(e.target.error);
        });
      } catch (e) {
        console.warn('IndexedDB setItem failed:', e);
      }

      try {
        localStorage.setItem(key, value);
      } catch (e) {
        if (e.name === 'QuotaExceededError' || e.code === 22) {
          try {
            const parsed = JSON.parse(value);
            if (parsed && typeof parsed === 'object') {
              const lightTheme = { ...parsed, mapImage: '' };
              localStorage.setItem(key, JSON.stringify(lightTheme));
            }
          } catch (err) {}
        }
      }
    },

    async removeItem(key) {
      try {
        const db = await getDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).delete(key);
      } catch (e) {}
      localStorage.removeItem(key);
    }
  };

  // Global Theme Applier
  window.applyGlobalTheme = async function (theme) {
    let saved = theme;
    if (!saved) {
      try {
        let savedStr = await window.etramsThemeStorage.getItem('etrams_theme_settings');
        if (!savedStr) {
          savedStr = localStorage.getItem('etrams_theme_settings');
        }
        saved = JSON.parse(savedStr || '{}');
      } catch (e) {
        saved = {};
      }
    }
    const root = document.documentElement;
    if (saved.headerColor) {
      root.style.setProperty('--theme-header-bg', saved.headerColor);
      root.style.setProperty('--header-bg', saved.headerColor);
    }
    if (saved.sidebarColor) {
      root.style.setProperty('--theme-sidebar-bg', saved.sidebarColor);
      root.style.setProperty('--sidebar-bg', saved.sidebarColor);
    }
    if (saved.sidebarTextColor) {
      root.style.setProperty('--theme-sidebar-text', saved.sidebarTextColor);
      root.style.setProperty('--sidebar-text', saved.sidebarTextColor);
    }
    if (saved.contentColor) {
      root.style.setProperty('--theme-content-bg', saved.contentColor);
      root.style.setProperty('--page-bg', saved.contentColor);
      if (document.body) {
        document.body.style.backgroundColor = saved.contentColor;
      }
    }
  };
  window.applyGlobalTheme();

  window.addEventListener('storage', (e) => {
    if (e.key === 'etrams_theme_settings') {
      window.applyGlobalTheme();
    }
  });

  // Shared styles for global theme + header user chip + sign-out button + header logo (all pages).
  const style = document.createElement('style');
  style.id = 'etrams-global-theme-styles';
  style.textContent = `
    header, .AppHeader, .HeaderNav {
      background: var(--theme-header-bg, var(--header-bg, #3B82F6)) !important;
      background-color: var(--theme-header-bg, var(--header-bg, #3B82F6)) !important;
      background-image: none !important;
    }
    .SidebarNav, etrams-sidebar, aside {
      background: var(--theme-sidebar-bg, var(--sidebar-bg, #0F172A)) !important;
      background-color: var(--theme-sidebar-bg, var(--sidebar-bg, #0F172A)) !important;
      background-image: none !important;
      color: var(--theme-sidebar-text, #FFFFFF) !important;
    }
    .SidebarNav .nav-label,
    .SidebarNav .logo-mark,
    .SidebarNav .nav-item,
    .SidebarNav .nav-icon,
    .SidebarNav .nav-chevron,
    .SidebarNav button,
    .SidebarNav a {
      color: var(--theme-sidebar-text, var(--sidebar-text, inherit)) !important;
    }
    body, .main-content, .app-layout, .layout, #root, .bg-page {
      background-color: var(--theme-content-bg, var(--page-bg, #B5BBC7)) !important;
    }
    .header-logo-img, .brand img, .header-logo img, .logo img {
      height: 42px;
      width: auto;
      max-height: 46px;
      border-radius: 8px;
      object-fit: contain;
    }
    .etrams-header-user { display: flex; align-items: center; gap: 10px; margin-left: 12px; }
    .etrams-username { font-size: 13px; font-weight: 600; color: inherit; white-space: nowrap; }
    .etrams-logout-btn {
      padding: 7px 14px; border: none; border-radius: 8px; cursor: pointer;
      background: #3B82F6; color: #FFFFFF; font-size: 13px; font-weight: 600; font-family: inherit;
      transition: background 0.15s ease;
    }
    .etrams-logout-btn:hover { background: #1E40AF; }
  `;
  style.textContent += `
    #etrams-global-loader {
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(15, 23, 42, 0.4);
      z-index: 9999999;
      display: none;
      align-items: center;
      justify-content: center;
      backdrop-filter: blur(2px);
      pointer-events: none;
      transition: opacity 0.2s ease;
    }
    .etrams-loader-card {
      background: #ffffff;
      padding: 20px 32px;
      border-radius: 12px;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.25), 0 8px 10px -6px rgba(0, 0, 0, 0.15);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 12px;
      border: 1px solid #e2e8f0;
    }
    .etrams-spinner {
      width: 40px;
      height: 40px;
      border: 4px solid #e2e8f0;
      border-top-color: #3b82f6;
      border-radius: 50%;
      animation: etrams-spin 0.8s linear infinite;
    }
    .etrams-loader-text {
      font-size: 14px;
      font-weight: 600;
      color: #1e293b;
      font-family: 'Inter', sans-serif;
    }
    @keyframes etrams-spin {
      to { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(style);

  document.addEventListener('DOMContentLoaded', () => {
    window.applyGlobalTheme();

    const nameEl = document.getElementById('etrams-username');
    if (nameEl) nameEl.textContent = user.fullName || user.username;

    const logoutBtn = document.getElementById('btn-logout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', window.etramsLogout);
    }

    // Viewers have no access to Settings — hide entry points (vanilla pages;
    // React pages also gate these in their components via window.ETRAMS_USER).
    if (user.role !== 'admin') {
      const settingsNav = document.getElementById('btn-nav-settings');
      if (settingsNav) settingsNav.closest('li').style.display = 'none';
      const settingsBtn = document.getElementById('btn-system-settings');
      if (settingsBtn) settingsBtn.style.display = 'none';
    }
  });
})();
