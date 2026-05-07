/* ═══════════════════════════════════════════
   Viewer.js — Public read-only project view
   Access via: index.html#view/TOKEN
═══════════════════════════════════════════ */
const Viewer = (() => {
  let _project   = null;
  let _activeTab = 'pages';

  /* ── Load by token ─────────────────────── */
  async function load(token) {
    /* Find project with matching token */
    const projects = await DB.getAllProjects();
    _project = projects.find(p => p.viewToken === token && p.viewEnabled);

    if (!_project) {
      App.go('error');
      return;
    }

    /* Populate header */
    qs('#viewer-title').textContent = _project.name || 'Proyecto sin nombre';
    qs('#viewer-desc').textContent  = _project.description || '';

    const date = formatDate(_project.updatedAt || _project.createdAt);
    qs('#viewer-meta').innerHTML = `
      <strong>${_project.name || ''}</strong><br>
      Propuesta de diseño<br>
      ${date}`;

    /* Hide empty tabs */
    const tabMap = {
      pages:   (_project.pages || []).length,
      product: (_project.productVisuals || []).length,
      colors:  (_project.colors || []).length,
      fonts:   (_project.fonts || []).length,
      ui:      (_project.uiComponents || []).length,
    };

    qsa('.tab-btn', qs('#viewer-tabs-nav')).forEach(btn => {
      const count = tabMap[btn.dataset.vtab] || 0;
      btn.style.opacity = count > 0 ? '1' : '0.3';
    });

    /* Start with first non-empty tab */
    const firstTab = Object.entries(tabMap).find(([, c]) => c > 0)?.[0] || 'pages';
    renderTab(firstTab);

    show(qs('#v-viewer'));
  }

  /* ── Tab routing ─────────────────────────── */
  function renderTab(tab) {
    _activeTab = tab;

    qsa('.tab-btn', qs('#viewer-tabs-nav')).forEach(btn => {
      btn.classList.toggle('active', btn.dataset.vtab === tab);
    });

    qsa('.tab-panel', qs('#v-viewer')).forEach(p => {
      p.classList.toggle('active', p.id === `vtab-${tab}`);
    });

    if (tab === 'pages')   renderImages('pages');
    if (tab === 'product') renderImages('product');
    if (tab === 'colors')  renderColors();
    if (tab === 'fonts')   renderFonts();
    if (tab === 'ui')      renderUIComponents();
  }

  /* ── Images ────────────────────────────── */
  function getSection(type) {
    if (type === 'pages')   return { key: 'pages',          grid: 'viewer-pages-grid',   empty: 'viewer-pages-empty'   };
    if (type === 'product') return { key: 'productVisuals', grid: 'viewer-product-grid', empty: 'viewer-product-empty' };
    if (type === 'ui')      return { key: 'uiComponents',   grid: 'viewer-ui-grid',      empty: 'viewer-ui-empty'      };
  }

  async function renderImages(type) {
    const { key, grid: gridId, empty: emptyId } = getSection(type);
    const items   = _project[key] || [];
    const grid    = qs(`#${gridId}`);
    const emptyEl = qs(`#${emptyId}`);
    grid.innerHTML = '';

    if (items.length === 0) { show(emptyEl); return; }
    hide(emptyEl);

    for (const item of items) {
      const imgRec = await DB.getImage(item.id);
      if (!imgRec) continue;

      const card = document.createElement('div');
      card.className = 'img-card';

      card.innerHTML = `
        <div class="img-card-thumb" style="cursor:pointer">
          <img src="${imgRec.data}" alt="${item.title || ''}" loading="lazy">
          <div class="img-card-overlay">
            <div class="img-overlay-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            </div>
          </div>
        </div>
        ${item.title ? `<div class="img-card-footer" style="pointer-events:none">
          <span class="img-card-title" style="border:none;background:transparent;cursor:default;padding:0;color:var(--text2)">${item.title}</span>
        </div>` : ''}`;

      grid.appendChild(card);
    }

    /* Lightbox wiring */
    const thumbs = grid.querySelectorAll('.img-card-thumb');
    thumbs.forEach((thumb, idx) => {
      thumb.addEventListener('click', async () => {
        const imgs = [];
        for (const item of items) {
          const rec = await DB.getImage(item.id);
          if (rec) imgs.push({ src: rec.data, label: item.title || '' });
        }
        Lightbox.open(imgs, idx);
      });
    });
  }

  /* ── Colors ─────────────────────────────── */
  function renderColors() {
    const grid    = qs('#viewer-colors-grid');
    const emptyEl = qs('#viewer-colors-empty');
    const colors  = _project.colors || [];
    grid.innerHTML = '';

    if (colors.length === 0) { show(emptyEl); return; }
    hide(emptyEl);

    colors.forEach(c => {
      const hex  = '#' + c.hex;
      const card = document.createElement('div');
      card.className = 'color-swatch-card';
      card.innerHTML = `
        <div class="color-swatch-block" style="background:${hex}"></div>
        <div class="color-swatch-info">
          <div class="color-swatch-hex">#${c.hex}</div>
          ${c.name ? `<div class="color-swatch-name">${c.name}</div>` : ''}
        </div>`;
      grid.appendChild(card);
    });
  }

  /* ── Fonts ──────────────────────────────── */
  async function renderFonts() {
    const list    = qs('#viewer-fonts-list');
    const emptyEl = qs('#viewer-fonts-empty');
    const fonts   = _project.fonts || [];
    list.innerHTML = '';

    if (fonts.length === 0) { show(emptyEl); return; }
    hide(emptyEl);

    for (const f of fonts) {
      await FontLoader.load(f.name);
      const card = document.createElement('div');
      card.className = 'font-card';
      card.innerHTML = `
        <div class="font-card-label">Tipografía</div>
        <div class="font-card-name">${f.name}</div>
        <div class="font-preview-sizes" style="font-family:'${f.name}',sans-serif">
          <div class="font-prev-xl">Aa Bb Cc — 123</div>
          <div class="font-prev-md">The quick brown fox jumps over the lazy dog</div>
          <div class="font-prev-sm">ABCDEFGHIJKLMNOPQRSTUVWXYZ · abcdefghijklmnopqrstuvwxyz · 0123456789</div>
        </div>`;
      list.appendChild(card);
    }
  }

  /* ── UI Components ──────────────────────── */
  function uiSrcdoc(code) {
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
      *{box-sizing:border-box;margin:0;padding:0;}
      body{background:transparent;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:20px;font-family:system-ui,sans-serif;}
    </style></head><body>${code}</body></html>`;
  }

  function renderUIComponents() {
    const grid    = qs('#viewer-ui-grid');
    const emptyEl = qs('#viewer-ui-empty');
    const items   = _project.uiComponents || [];
    grid.innerHTML = '';

    const validItems = items.filter(c => c.code);
    if (validItems.length === 0) { show(emptyEl); return; }
    hide(emptyEl);

    validItems.forEach(comp => {
      const card = document.createElement('div');
      card.className = 'ui-comp-card';
      card.innerHTML = `
        <div class="ui-comp-preview">
          <iframe class="ui-comp-iframe" sandbox="allow-scripts"></iframe>
        </div>
        <div class="ui-comp-footer">
          <span class="ui-comp-name">${comp.title || 'Sin título'}</span>
        </div>`;
      card.querySelector('.ui-comp-iframe').srcdoc = uiSrcdoc(comp.code || '');
      grid.appendChild(card);
    });
  }

  /* ── Init events ─────────────────────────── */
  function initEvents() {
    qs('#viewer-tabs-nav').addEventListener('click', e => {
      const btn = e.target.closest('.tab-btn');
      if (btn && btn.dataset.vtab) renderTab(btn.dataset.vtab);
    });
  }

  return { load, initEvents };
})();
