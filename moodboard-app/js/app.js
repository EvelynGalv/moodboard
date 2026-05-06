/* ═══════════════════════════════════════════
   App.js — Router + Initialization
   Hash-based routing:
     #setup           → first-time setup
     #login           → editor login
     #dashboard       → editor dashboard
     #project/:id     → project editor
     #view/:token     → public viewer
═══════════════════════════════════════════ */

const VIEWS = {
  setup:     'v-setup',
  login:     'v-login',
  dashboard: 'v-dashboard',
  project:   'v-project',
  viewer:    'v-viewer',
  error:     'v-error',
};

/* ── App router ─────────────────────────── */
const App = (() => {
  function showOnly(viewId) {
    Object.values(VIEWS).forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.add('hidden');
    });
    const target = document.getElementById(viewId);
    if (target) target.classList.remove('hidden');
    window.scrollTo(0, 0);
  }

  async function route() {
    const hash  = window.location.hash.slice(1) || '';
    const parts = hash.split('/').filter(Boolean);
    const page  = parts[0] || '';
    const param = parts[1] || '';

    /* Public viewer route — no auth needed */
    if (page === 'view' && param) {
      showOnly(VIEWS.viewer);
      await Viewer.load(param);
      return;
    }

    /* App not configured yet */
    if (!(await Auth.isSetup())) {
      showOnly(VIEWS.setup);
      return;
    }

    /* Require auth for all editor routes */
    const user = Auth.currentUser();

    if (!user) {
      showOnly(VIEWS.login);
      return;
    }

    if (page === 'project' && param) {
      showOnly(VIEWS.project);
      await ProjectEditor.load(param);
      return;
    }

    /* Default: dashboard */
    showOnly(VIEWS.dashboard);
    await Dashboard.render();
  }

  function go(page, param) {
    if (page === 'login')     { window.location.hash = '#login';     return; }
    if (page === 'dashboard') { window.location.hash = '#dashboard'; return; }
    if (page === 'project')   { window.location.hash = `#project/${param}`; return; }
    if (page === 'error')     { showOnly(VIEWS.error); return; }
  }

  return { route, go, showOnly };
})();

/* ═══════════════════════════════════════════
   SETUP FORM
═══════════════════════════════════════════ */
function initSetupForm() {
  qs('#setup-form').addEventListener('submit', async e => {
    e.preventDefault();
    const name  = qs('#setup-name').value.trim();
    const user  = qs('#setup-username').value.trim().replace(/\s/g,'').toLowerCase();
    const pwd1  = qs('#setup-password').value;
    const pwd2  = qs('#setup-password2').value;
    const errEl = qs('#setup-error');
    hide(errEl);

    if (pwd1 !== pwd2) {
      errEl.textContent = 'Las contraseñas no coinciden';
      show(errEl);
      return;
    }
    if (pwd1.length < 6) {
      errEl.textContent = 'La contraseña debe tener al menos 6 caracteres';
      show(errEl);
      return;
    }

    try {
      await Auth.setup(name, user, pwd1);
      const session = await Auth.login(user, pwd1);
      if (session) App.go('dashboard');
    } catch (err) {
      errEl.textContent = err.message;
      show(errEl);
    }
  });
}

/* ═══════════════════════════════════════════
   LOGIN FORM
═══════════════════════════════════════════ */
function initLoginForm() {
  qs('#login-form').addEventListener('submit', async e => {
    e.preventDefault();
    const username = qs('#login-username').value.trim();
    const password = qs('#login-password').value;
    const errEl    = qs('#login-error');
    hide(errEl);

    try {
      await Auth.login(username, password);
      App.go('dashboard');
    } catch (err) {
      errEl.textContent = err.message;
      show(errEl);
    }
  });
}

/* ═══════════════════════════════════════════
   BOOTSTRAP
═══════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  /* Init utilities */
  Lightbox.init();

  /* Init forms and event handlers */
  initSetupForm();
  initLoginForm();
  Dashboard.initEvents();
  ProjectEditor.initEvents();
  ShareModal.initEvents();
  EditorsModal.initEvents();
  Viewer.initEvents();

  /* Hash-based routing */
  window.addEventListener('hashchange', () => App.route());
  App.route();
});
