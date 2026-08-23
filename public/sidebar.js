// Shared sidebar navigation for all eTRAMS admin pages.
// Classic script (no modules) defining the <etrams-sidebar> custom element.
// Light DOM only: the host element itself carries class="SidebarNav" id="SidebarNav",
// so the existing per-page stylesheets keep applying unchanged.
(function () {
  if (customElements.get('etrams-sidebar')) return;

  const NAV_ITEMS = [
    { id: 'btn-nav-dashboard',       icon: '🏠', label: 'Dashboard',       href: '/dashboard.html' },
    { id: 'btn-nav-map',             icon: '🗺️', label: 'Campus Map',      href: '/map.html' },
    { id: 'btn-nav-statistic',       icon: '📊', label: 'Statistic',       parent: true },
    { id: 'btn-nav-grid',            icon: '⚡', label: 'Grid',            href: '/grid.html',        submenu: true },
    { id: 'btn-nav-building',        icon: '🏢', label: 'Building',        href: '/building.html',    submenu: true },
    { id: 'btn-nav-meter-status',    icon: '🔌', label: 'Meter',           href: '/meterstatus.html', submenu: true },
    { id: 'btn-nav-report',          icon: '📄', label: 'Report',          parent: true },
    { id: 'btn-nav-report-grid',     icon: '⚡', label: 'Grid Report',     href: '/report-grid.html', submenu: true },
    { id: 'btn-nav-report-building', icon: '🏢', label: 'Building Report', href: '/report-building.html', submenu: true },
    { id: 'btn-nav-meter',           icon: '📋', label: 'Meter Report',    href: '/index.html',       submenu: true },
    { id: 'btn-nav-settings',        icon: '⚙️', label: 'Settings',        href: '/settings.html' },
  ];

  window.getSectionTitle = function(key, defaultTitle) {
    try {
      const saved = localStorage.getItem('etrams_section_titles');
      if (saved) {
        const titles = JSON.parse(saved);
        if (titles[key]) return titles[key];
      }
    } catch (e) {}
    return defaultTitle;
  };

  const HAMBURGER_SVG = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>`;

  function navItemHTML(item, activeId) {
    const liClass = item.submenu ? ' class="submenu"' : '';
    const activeClass = item.id === activeId ? ' active' : '';
    const chevron = item.parent ? '<span class="nav-chevron">▾</span>' : '';
    const btnClass = item.parent ? 'nav-item has-submenu' : 'nav-item';
    return `
      <li${liClass}>
        <button class="${btnClass}${activeClass}" id="${item.id}">
          <span class="nav-icon">${item.icon}</span>
          <span class="nav-label">${item.label}</span>
          ${chevron}
        </button>
      </li>`;
  }

  customElements.define('etrams-sidebar', class extends HTMLElement {
    connectedCallback() {
      if (this.dataset.rendered) return;
      this.dataset.rendered = '1';

      this.classList.add('SidebarNav');
      this.id = 'SidebarNav';

      if (window.applyGlobalTheme) {
        window.applyGlobalTheme();
      }

      const activeId = this.getAttribute('active') || '';

      this.innerHTML = `
        <div class="sidebar-logo-area">
          <div class="logo-mark"><span style="font-size:1.35em; text-transform:lowercase; font-weight:800;">e</span>TRAMS</div>
          <button class="sidebar-toggle" id="btn-sidebar-toggle" title="Toggle Sidebar">${HAMBURGER_SVG}</button>
        </div>
        <ul class="sidebar-menu">${NAV_ITEMS.map((item) => navItemHTML(item, activeId)).join('')}
        </ul>`;

      // Navigation: every link item navigates except the active one (dead on its own page);
      // parent items get no handler.
      NAV_ITEMS.forEach((item) => {
        if (item.parent || item.id === activeId) return;
        const btn = this.querySelector('#' + item.id);
        if (btn) {
          btn.addEventListener('click', () => {
            window.location.href = item.href;
          });
        }
      });

      // Mobile overlay, inserted right after the host.
      const overlay = document.createElement('div');
      overlay.className = 'sidebar-overlay';
      this.insertAdjacentElement('afterend', overlay);
      overlay.addEventListener('click', () => {
        this.classList.remove('mobile-open');
        overlay.classList.remove('active');
      });

      this.querySelector('#btn-sidebar-toggle').addEventListener('click', () => {
        if (window.innerWidth < 768) {
          this.classList.toggle('mobile-open');
          overlay.classList.toggle('active');
        } else {
          this.classList.toggle('collapsed');
        }
      });
    }
  });
})();
