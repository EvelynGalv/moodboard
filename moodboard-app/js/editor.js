/* ═══════════════════════════════════════════
   Editor.js — Dashboard + Project editor logic
═══════════════════════════════════════════ */

/* ══════════════════════════════════════════
   DASHBOARD
══════════════════════════════════════════ */
const Dashboard = (() => {
  async function render() {
    const user = Auth.currentUser();
    if (!user) { App.go('login'); return; }

    /* Update user badge */
    qs('#user-initial-badge').textContent = user.name.charAt(0).toUpperCase();
    qs('#user-name-display').textContent  = user.name;

    /* Load projects */
    let projects = await DB.getAllProjects();
    projects.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

    const grid   = qs('#projects-grid');
    const empty  = qs('#empty-state');
    const subtitle = qs('#dash-subtitle');

    grid.innerHTML = '';

    if (projects.length === 0) {
      hide(grid);
      show(empty);
      subtitle.textContent = 'Sin proyectos';
      return;
    }

    show(grid);
    hide(empty);
    subtitle.textContent = `${projects.length} proyecto${projects.length !== 1 ? 's' : ''}`;

    for (const p of projects) {
      const card = await buildProjectCard(p);
      grid.appendChild(card);
    }
  }

  async function buildProjectCard(p) {
    const card = document.createElement('div');
    card.className = 'project-card';
    card.dataset.id = p.id;

    /* Cover image: dedicated cover first, then first page, then first product */
    let thumbHTML = `
      <div class="project-card-thumb-placeholder">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9l4-4 4 4 4-4 4 4"/><circle cx="8" cy="13" r="2"/><path d="M21 15l-5-5L5 21"/></svg>
        <span>Sin imágenes</span>
      </div>`;

    let coverRec = null;
    if (p.coverImageId) {
      coverRec = await DB.getImage(p.coverImageId);
    }
    if (!coverRec && p.pages && p.pages.length > 0) {
      coverRec = await DB.getImage(p.pages[0].id);
    }
    if (!coverRec && p.productVisuals && p.productVisuals.length > 0) {
      coverRec = await DB.getImage(p.productVisuals[0].id);
    }
    if (coverRec) {
      thumbHTML = `<img src="${coverRec.data}" alt="${p.name}" loading="lazy">`;
    }

    /* Color strip */
    const colors = (p.colors || []).slice(0, 8);
    const colorStrip = colors.length
      ? `<div class="card-colors-strip">${colors.map(c => `<div class="card-color-chip" style="background:#${c.hex}"></div>`).join('')}</div>`
      : '';

    /* Stats */
    const pageCount    = (p.pages || []).length;
    const productCount = (p.productVisuals || []).length;

    card.innerHTML = `
      <div class="project-card-thumb">
        ${thumbHTML}
        ${colorStrip}
      </div>
      <div class="project-card-body">
        <div class="project-card-name">${p.name || 'Sin nombre'}</div>
        <p class="project-card-desc">${p.description || '<span style="opacity:.4">Sin descripción</span>'}</p>
        <div class="project-card-meta">
          <span class="card-meta-stat">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="2" width="14" height="20" rx="2"/></svg>
            ${pageCount} pág.
          </span>
          <span class="card-meta-stat">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/></svg>
            ${productCount} prod.
          </span>
          <span class="card-meta-stat" style="margin-left:auto;font-size:10px;opacity:.5">
            ${formatDate(p.updatedAt)}
          </span>
          <div class="project-card-actions">
            <button class="card-action-btn" title="Enlace de vista" data-action="share" data-id="${p.id}">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
            </button>
            <button class="card-action-btn" title="Editar proyecto" data-action="edit" data-id="${p.id}">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="card-action-btn danger" title="Eliminar proyecto" data-action="delete" data-id="${p.id}">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
            </button>
          </div>
        </div>
      </div>`;
    return card;
  }

  async function createNew() {
    const p = {
      id:            uid(),
      name:          '',
      description:   '',
      createdAt:     nowISO(),
      updatedAt:     nowISO(),
      viewToken:     uid(),
      viewEnabled:   false,
      pages:         [],
      productVisuals:[],
      colors:        [],
      fonts:         [],
      uiComponents:  [],
    };
    await DB.saveProject(p);
    App.go('project', p.id);
  }

  function initEvents() {
    /* New project button */
    qs('#btn-new-project').addEventListener('click', createNew);

    /* Project card actions (delegated) */
    qs('#projects-grid').addEventListener('click', async e => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const id     = btn.dataset.id;
      const action = btn.dataset.action;
      if (action === 'edit')   App.go('project', id);
      if (action === 'share')  ShareModal.open(id);
      if (action === 'delete') {
        const ok = await confirm('Eliminar proyecto', '¿Seguro que quieres eliminar este proyecto? Esta acción no se puede deshacer.');
        if (!ok) return;
        await deleteProject(id);
        render();
      }
    });

    /* User dropdown */
    qs('#btn-user-menu').addEventListener('click', e => {
      e.stopPropagation();
      qs('#user-dropdown').classList.toggle('hidden');
    });
    document.addEventListener('click', () => qs('#user-dropdown')?.classList.add('hidden'));

    /* Manage editors */
    qs('#btn-manage-editors').addEventListener('click', () => {
      qs('#user-dropdown').classList.add('hidden');
      EditorsModal.open();
    });

    /* Logout */
    qs('#btn-logout').addEventListener('click', () => {
      Auth.logout();
      App.go('login');
    });
  }

  async function deleteProject(id) {
    const p = await DB.getProject(id);
    if (!p) return;
    const imgIds = [
      ...(p.pages || []).map(x => x.id),
      ...(p.productVisuals || []).map(x => x.id),
      ...(p.uiComponents || []).map(x => x.id),
    ];
    await DB.deleteImages(imgIds);
    await DB.deleteProject(id);
    Toast.success('Proyecto eliminado');
  }

  return { render, createNew, initEvents, deleteProject };
})();

/* ══════════════════════════════════════════
   PROJECT EDITOR
══════════════════════════════════════════ */
const ProjectEditor = (() => {
  let _project   = null;
  let _activeTab = 'pages';
  let _dirty     = false;

  /* ── Load ──────────────────────────────── */
  async function load(id) {
    _project = await DB.getProject(id);
    if (!_project) { App.go('dashboard'); return; }

    qs('#proj-name').value = _project.name || '';
    qs('#proj-desc').value = _project.description || '';

    await loadCoverPreview();
    renderTab(_activeTab);
    show(qs('#v-project'));
  }

  /* ── Cover image ────────────────────────── */
  async function loadCoverPreview() {
    const img       = qs('#cover-preview-img');
    const empty     = qs('#cover-preview-area');
    const removeBtn = qs('#btn-remove-cover');

    if (_project.coverImageId) {
      const rec = await DB.getImage(_project.coverImageId);
      if (rec) {
        img.src = rec.data;
        show(img);
        hide(empty);
        show(removeBtn);
        return;
      }
    }
    img.src = '';
    hide(img);
    show(empty);
    hide(removeBtn);
  }

  /* ── Save ──────────────────────────────── */
  async function save() {
    if (!_project) return;
    _project.name        = qs('#proj-name').value.trim();
    _project.description = qs('#proj-desc').value.trim();
    _project.updatedAt   = nowISO();
    await DB.saveProject(_project);
    _dirty = false;
    Toast.success('Proyecto guardado');
  }

  /* ── Tab routing ─────────────────────────── */
  function renderTab(tab) {
    _activeTab = tab;

    /* Update tab buttons */
    qsa('.tab-btn', qs('#tabs-nav')).forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tab);
    });

    /* Show/hide panels */
    qsa('.tab-panel', qs('#v-project')).forEach(p => {
      p.classList.toggle('active', p.id === `tab-${tab}`);
    });

    if (tab === 'pages')   renderImages('pages');
    if (tab === 'product') renderImages('product');
    if (tab === 'colors')  renderColors();
    if (tab === 'fonts')   renderFonts();
    if (tab === 'ui')      renderUIComponents();
  }

  /* ══════════════════════════════════════
     IMAGES (pages / product / ui)
  ══════════════════════════════════════ */
  function getSection(type) {
    if (type === 'pages')   return { key: 'pages',          grid: 'pages-grid',   empty: 'pages-empty'  };
    if (type === 'product') return { key: 'productVisuals', grid: 'product-grid', empty: 'product-empty' };
    if (type === 'ui')      return { key: 'uiComponents',   grid: 'ui-grid',      empty: 'ui-empty'      };
  }

  async function renderImages(type) {
    const { key, grid: gridId, empty: emptyId } = getSection(type);
    const items  = _project[key] || [];
    const grid   = qs(`#${gridId}`);
    const emptyEl = qs(`#${emptyId}`);
    grid.innerHTML = '';

    if (items.length === 0) { show(emptyEl); return; }
    hide(emptyEl);

    for (const item of items) {
      const imgRec = await DB.getImage(item.id);
      if (!imgRec) continue;

      const card = document.createElement('div');
      card.className = 'img-card';
      card.dataset.id = item.id;

      card.innerHTML = `
        <div class="img-card-thumb" data-lb-type="${type}" data-lb-id="${item.id}">
          <img src="${imgRec.data}" alt="${item.title || ''}" loading="lazy">
          <div class="img-card-overlay">
            <div class="img-overlay-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
            </div>
          </div>
        </div>
        <div class="img-card-footer">
          <input class="img-card-title" type="text" value="${item.title || ''}" placeholder="Título…" maxlength="80" data-id="${item.id}" data-type="${type}">
          <button class="img-delete-btn" data-delete-img data-id="${item.id}" data-type="${type}" title="Eliminar imagen">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
          </button>
        </div>`;

      grid.appendChild(card);
    }

    wireImageEvents(type);
  }

  /* ══════════════════════════════════════
     UI COMPONENTS
  ══════════════════════════════════════ */
  function uiSrcdoc(code) {
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
      *{box-sizing:border-box;margin:0;padding:0;}
      body{background:transparent;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:20px;font-family:system-ui,sans-serif;}
    </style></head><body>${code}</body></html>`;
  }

  function renderUIComponents() {
    const grid    = qs('#ui-grid');
    const emptyEl = qs('#ui-empty');
    const items   = _project.uiComponents || [];
    grid.innerHTML = '';

    const validItems = items.filter(c => c.code);
    if (validItems.length === 0) { show(emptyEl); return; }
    hide(emptyEl);

    validItems.forEach(comp => {
      const card = document.createElement('div');
      card.className = 'ui-comp-card';
      card.dataset.id = comp.id;
      card.innerHTML = `
        <div class="ui-comp-preview">
          <iframe class="ui-comp-iframe" sandbox="allow-scripts"></iframe>
        </div>
        <div class="ui-comp-footer">
          <span class="ui-comp-name">${escapeHTML(comp.title || 'Sin título')}</span>
          <button class="ui-comp-code-btn" data-toggle-code="${comp.id}" title="Ver/ocultar código">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
          </button>
          <button class="ui-comp-delete-btn" data-delete-ui="${comp.id}" title="Eliminar">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
          </button>
        </div>
        <div class="ui-comp-code-view hidden" id="code-view-${comp.id}">
          <pre class="ui-comp-code-pre"><code>${escapeHTML(comp.code || '')}</code></pre>
        </div>`;

      card.querySelector('.ui-comp-iframe').srcdoc = uiSrcdoc(comp.code || '');
      grid.appendChild(card);
    });

    /* Toggle code view */
    grid.querySelectorAll('[data-toggle-code]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id  = btn.dataset.toggleCode;
        const box = qs(`#code-view-${id}`);
        box.classList.toggle('hidden');
      });
    });

    /* Delete */
    grid.querySelectorAll('[data-delete-ui]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.deleteUi;
        const ok = await confirm('Eliminar componente', '¿Eliminar este componente?');
        if (!ok) return;
        _project.uiComponents = (_project.uiComponents || []).filter(x => x.id !== id);
        await autoSave();
        renderUIComponents();
      });
    });
  }

  function escapeHTML(str) {
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function initUIForm() {
    const formWrap  = qs('#ui-form-wrap');
    const codeInput = qs('#ui-comp-code');
    const liveFrame = qs('#ui-live-iframe');
    let debounce;

    qs('#btn-add-ui').addEventListener('click', () => {
      qs('#ui-comp-title').value = '';
      codeInput.value = '';
      liveFrame.srcdoc = '';
      show(formWrap);
      qs('#ui-comp-title').focus();
    });

    qs('#btn-cancel-ui').addEventListener('click', () => hide(formWrap));

    codeInput.addEventListener('input', () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        liveFrame.srcdoc = uiSrcdoc(codeInput.value);
      }, 400);
    });

    qs('#btn-save-ui').addEventListener('click', async () => {
      const title = qs('#ui-comp-title').value.trim();
      const code  = codeInput.value.trim();
      if (!code) return;
      if (!_project.uiComponents) _project.uiComponents = [];
      _project.uiComponents.push({ id: uid(), title, code });
      await autoSave();
      hide(formWrap);
      renderUIComponents();
      Toast.success('Componente guardado');
    });
  }

  function wireImageEvents(type) {
    const { key, grid: gridId } = getSection(type);
    const grid = qs(`#${gridId}`);

    /* Lightbox on thumb click */
    grid.querySelectorAll('.img-card-thumb').forEach((thumb, idx) => {
      thumb.addEventListener('click', async () => {
        const items = _project[key] || [];
        const imgs  = [];
        for (const item of items) {
          const rec = await DB.getImage(item.id);
          if (rec) imgs.push({ src: rec.data, label: item.title || '' });
        }
        Lightbox.open(imgs, idx);
      });
    });

    /* Title update */
    grid.querySelectorAll('.img-card-title').forEach(input => {
      input.addEventListener('change', () => {
        const id = input.dataset.id;
        const item = (_project[key] || []).find(x => x.id === id);
        if (item) { item.title = input.value; autoSave(); }
      });
    });

    /* Delete image */
    grid.querySelectorAll('[data-delete-img]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const ok = await confirm('Eliminar imagen', '¿Eliminar esta imagen del proyecto?');
        if (!ok) return;
        _project[key] = (_project[key] || []).filter(x => x.id !== id);
        await DB.deleteImage(id);
        await autoSave();
        renderImages(type);
      });
    });
  }

  async function addImages(type, files) {
    const { key } = getSection(type);
    if (!_project[key]) _project[key] = [];

    for (const file of files) {
      if (!file.type.startsWith('image/')) continue;
      const data = await resizeImage(file);
      const id   = uid();
      await DB.saveImage(id, data);
      _project[key].push({ id, title: file.name.replace(/\.[^.]+$/, ''), order: _project[key].length });
    }

    await autoSave();
    renderImages(type);
    Toast.success(`${files.length} imagen${files.length > 1 ? 'es' : ''} agregada${files.length > 1 ? 's' : ''}`);
  }

  /* ══════════════════════════════════════
     COLORS
  ══════════════════════════════════════ */
  function renderColors() {
    const grid    = qs('#colors-grid');
    const emptyEl = qs('#colors-empty');
    const colors  = _project.colors || [];
    grid.innerHTML = '';

    if (colors.length === 0) { show(emptyEl); }
    else hide(emptyEl);

    colors.forEach(c => {
      const hex = '#' + c.hex;
      const card = document.createElement('div');
      card.className = 'color-swatch-card';
      card.innerHTML = `
        <div class="color-swatch-block" style="background:${hex}"></div>
        <div class="color-swatch-info">
          <div class="color-swatch-hex">#${c.hex}</div>
          ${c.name ? `<div class="color-swatch-name">${c.name}</div>` : ''}
        </div>
        <button class="color-delete-btn" data-delete-color data-id="${c.id}" title="Eliminar">✕</button>`;
      grid.appendChild(card);
    });

    /* Delete events */
    grid.querySelectorAll('[data-delete-color]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const ok = await confirm('Eliminar color', '¿Eliminar este color de la paleta?');
        if (!ok) return;
        _project.colors = (_project.colors || []).filter(c => c.id !== id);
        await autoSave();
        renderColors();
      });
    });
  }

  function initColorForm() {
    const hexInput   = qs('#color-hex');
    const preview    = qs('#color-preview-swatch');
    const nameInput  = qs('#color-name');

    /* Live preview on hex input */
    hexInput.addEventListener('input', () => {
      const raw = normalizeHex(hexInput.value);
      if (isValidHex(raw)) {
        preview.style.background = '#' + raw;
      }
    });

    qs('#btn-add-color').addEventListener('click', () => {
      hexInput.value  = '';
      nameInput.value = '';
      preview.style.background = 'rgba(255,255,255,0.05)';
      show(qs('#color-form-wrap'));
      hexInput.focus();
    });

    qs('#btn-cancel-color').addEventListener('click', () => {
      hide(qs('#color-form-wrap'));
    });

    qs('#btn-save-color').addEventListener('click', async () => {
      const raw  = normalizeHex(hexInput.value);
      if (!isValidHex(raw)) { Toast.error('Código hex inválido (6 caracteres, ej: 00C896)'); return; }
      const name = nameInput.value.trim();
      _project.colors = _project.colors || [];
      _project.colors.push({ id: uid(), hex: raw, name });
      await autoSave();
      hide(qs('#color-form-wrap'));
      renderColors();
    });

    /* Enter key on hex input */
    hexInput.addEventListener('keydown', e => { if (e.key === 'Enter') qs('#btn-save-color').click(); });
  }

  /* ══════════════════════════════════════
     FONTS
  ══════════════════════════════════════ */
  async function renderFonts() {
    const list    = qs('#fonts-list');
    const emptyEl = qs('#fonts-empty');
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
        </div>
        <button class="font-delete-btn" data-delete-font data-id="${f.id}" title="Eliminar">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
        </button>`;
      list.appendChild(card);
    }

    /* Delete events */
    list.querySelectorAll('[data-delete-font]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const ok = await confirm('Eliminar tipografía', '¿Eliminar esta tipografía del proyecto?');
        if (!ok) return;
        _project.fonts = (_project.fonts || []).filter(f => f.id !== id);
        await autoSave();
        renderFonts();
      });
    });
  }

  function initFontForm() {
    const input      = qs('#font-name-input');
    const preview    = qs('#font-live-preview');
    const prevText   = qs('#font-prev-text');

    const loadPreview = debounce(async () => {
      const name = input.value.trim();
      if (!name) { hide(preview); return; }
      const ok = await FontLoader.load(name);
      prevText.style.fontFamily = `'${name}', sans-serif`;
      prevText.textContent = `Aa Bb — ${name} — The quick brown fox`;
      show(preview);
      if (!ok) prevText.style.opacity = '0.4';
      else prevText.style.opacity = '1';
    }, 500);

    input.addEventListener('input', loadPreview);

    qs('#btn-add-font').addEventListener('click', () => {
      input.value = '';
      hide(preview);
      show(qs('#font-form-wrap'));
      input.focus();
    });

    qs('#btn-cancel-font').addEventListener('click', () => {
      hide(qs('#font-form-wrap'));
    });

    qs('#btn-save-font').addEventListener('click', async () => {
      const name = input.value.trim();
      if (!name) { Toast.error('Escribe el nombre de la tipografía'); return; }
      if ((_project.fonts || []).some(f => f.name.toLowerCase() === name.toLowerCase())) {
        Toast.info('Esta tipografía ya está en el proyecto'); return;
      }
      _project.fonts = _project.fonts || [];
      _project.fonts.push({ id: uid(), name });
      await autoSave();
      hide(qs('#font-form-wrap'));
      renderFonts();
    });

    input.addEventListener('keydown', e => { if (e.key === 'Enter') qs('#btn-save-font').click(); });
  }

  /* ── Auto-save ──────────────────────────── */
  async function autoSave() {
    if (!_project) return;
    _project.updatedAt = nowISO();
    await DB.saveProject(_project);
  }

  /* ── Init events (once) ─────────────────── */
  function initEvents() {
    /* Back to dashboard */
    qs('#btn-back').addEventListener('click', async () => {
      if (_dirty) await save();
      _project = null;
      App.go('dashboard');
    });

    /* Save button */
    qs('#btn-save-project').addEventListener('click', save);

    /* Auto-save on name/desc change */
    qs('#proj-name').addEventListener('input', debounce(async () => {
      if (_project) { _project.name = qs('#proj-name').value.trim(); await autoSave(); }
    }, 800));
    qs('#proj-desc').addEventListener('input', debounce(async () => {
      if (_project) { _project.description = qs('#proj-desc').value.trim(); await autoSave(); }
    }, 800));

    /* Tabs */
    qs('#tabs-nav').addEventListener('click', e => {
      const btn = e.target.closest('.tab-btn');
      if (btn && btn.dataset.tab) renderTab(btn.dataset.tab);
    });

    /* Cover image */
    qs('#btn-set-cover').addEventListener('click', () => qs('#file-cover').click());
    qs('#file-cover').addEventListener('change', async e => {
      const file = e.target.files[0];
      if (!file || !_project) return;
      e.target.value = '';

      /* Remove old cover from DB if it was a dedicated cover (not a shared image) */
      if (_project.coverImageId && _project.coverIsDedicated) {
        await DB.deleteImage(_project.coverImageId);
      }

      const data = await resizeImage(file);
      const id   = uid();
      await DB.saveImage(id, data);
      _project.coverImageId      = id;
      _project.coverIsDedicated  = true;
      await autoSave();
      await loadCoverPreview();
      Toast.success('Foto portada actualizada');
    });

    qs('#btn-remove-cover').addEventListener('click', async e => {
      e.stopPropagation();
      if (!_project) return;
      if (_project.coverIsDedicated && _project.coverImageId) {
        await DB.deleteImage(_project.coverImageId);
      }
      _project.coverImageId     = null;
      _project.coverIsDedicated = false;
      await autoSave();
      await loadCoverPreview();
    });

    /* File inputs */
    qs('#btn-add-page').addEventListener('click',    () => qs('#file-pages').click());
    qs('#btn-add-product').addEventListener('click', () => qs('#file-product').click());

    qs('#file-pages').addEventListener('change',   e => { addImages('pages',   Array.from(e.target.files)); e.target.value=''; });
    qs('#file-product').addEventListener('change', e => { addImages('product', Array.from(e.target.files)); e.target.value=''; });

    /* UI components form */
    initUIForm();

    /* Share link */
    qs('#btn-share-link').addEventListener('click', () => {
      if (_project) ShareModal.open(_project.id);
    });

    /* Color & font forms */
    initColorForm();
    initFontForm();
  }

  return { load, save, initEvents };
})();

/* ══════════════════════════════════════════
   SHARE MODAL
══════════════════════════════════════════ */
const ShareModal = (() => {
  let _projectId = null;

  function buildURL(token) {
    const base = window.location.href.split('#')[0];
    return `${base}#view/${token}`;
  }

  async function open(projectId) {
    _projectId = projectId;
    const p = await DB.getProject(projectId);
    if (!p) return;

    const url = buildURL(p.viewToken);
    qs('#share-link-input').value = p.viewEnabled ? url : '';
    qs('#share-toggle').checked   = !!p.viewEnabled;
    qs('#share-link-input').style.opacity = p.viewEnabled ? '1' : '0.35';

    qs('#modal-share').classList.remove('hidden');
  }

  function close() { qs('#modal-share').classList.add('hidden'); _projectId = null; }

  async function initEvents() {
    qs('#modal-share-close').addEventListener('click', close);
    qs('#modal-share').addEventListener('click', e => { if (e.target === qs('#modal-share')) close(); });

    qs('#btn-copy-link').addEventListener('click', async () => {
      const p = await DB.getProject(_projectId);
      if (!p || !p.viewEnabled) { Toast.info('Activa el enlace primero'); return; }
      await copyToClipboard(buildURL(p.viewToken));
      Toast.success('Enlace copiado al portapapeles');
    });

    qs('#share-toggle').addEventListener('change', async e => {
      const p = await DB.getProject(_projectId);
      if (!p) return;
      p.viewEnabled = e.target.checked;
      await DB.saveProject(p);
      const url = buildURL(p.viewToken);
      qs('#share-link-input').value   = p.viewEnabled ? url : '';
      qs('#share-link-input').style.opacity = p.viewEnabled ? '1' : '0.35';
    });

    qs('#btn-regen-token').addEventListener('click', async () => {
      const ok = await confirm('Regenerar enlace', 'El enlace anterior dejará de funcionar. ¿Continuar?', 'Regenerar');
      if (!ok) return;
      const p = await DB.getProject(_projectId);
      if (!p) return;
      p.viewToken = uid();
      await DB.saveProject(p);
      const url = buildURL(p.viewToken);
      qs('#share-link-input').value = p.viewEnabled ? url : '';
      Toast.success('Enlace regenerado');
    });
  }

  return { open, initEvents };
})();

/* ══════════════════════════════════════════
   EDITORS MODAL
══════════════════════════════════════════ */
const EditorsModal = (() => {
  async function renderList() {
    const list  = qs('#editors-list');
    const admin = await Auth.getAdmin();
    const eds   = await Auth.getEditors();
    const all   = [{ ...admin, isAdmin: true }, ...eds];
    list.innerHTML = '';

    all.forEach(u => {
      const row = document.createElement('div');
      row.className = 'editor-row';
      row.innerHTML = `
        <div class="editor-avatar">${u.name.charAt(0).toUpperCase()}</div>
        <div class="editor-info">
          <div class="editor-name">${u.name}</div>
          <div class="editor-username">@${u.username}</div>
        </div>
        ${u.isAdmin ? '<span class="editor-admin-tag">Admin</span>' : ''}
        ${!u.isAdmin ? `<button class="editor-delete-btn" data-delete-editor data-id="${u.id}" title="Revocar acceso">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>` : ''}`;
      list.appendChild(row);
    });

    list.querySelectorAll('[data-delete-editor]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const ok = await confirm('Revocar acceso', '¿Eliminar este editor? Ya no podrá iniciar sesión.');
        if (!ok) return;
        await Auth.removeEditor(id);
        renderList();
        Toast.success('Editor eliminado');
      });
    });
  }

  function open() {
    renderList();
    qs('#modal-editors').classList.remove('hidden');
  }

  function close() { qs('#modal-editors').classList.add('hidden'); }

  function initEvents() {
    qs('#modal-editors-close').addEventListener('click', close);
    qs('#modal-editors').addEventListener('click', e => { if (e.target === qs('#modal-editors')) close(); });

    qs('#add-editor-form').addEventListener('submit', async e => {
      e.preventDefault();
      const name     = qs('#editor-new-name').value.trim();
      const username = qs('#editor-new-username').value.trim().replace(/\s/g,'').toLowerCase();
      const password = qs('#editor-new-password').value;
      const errEl    = qs('#add-editor-error');
      hide(errEl);

      try {
        await Auth.addEditor(name, username, password);
        qs('#editor-new-name').value     = '';
        qs('#editor-new-username').value = '';
        qs('#editor-new-password').value = '';
        renderList();
        Toast.success(`Editor "${name}" agregado`);
      } catch (err) {
        errEl.textContent = err.message;
        show(errEl);
      }
    });
  }

  return { open, initEvents };
})();
