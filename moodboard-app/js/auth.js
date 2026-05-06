/* ═══════════════════════════════════════════
   Auth.js — Dual mode
   · Supabase cuando está configurado
   · localStorage como fallback para desarrollo
═══════════════════════════════════════════ */
const Auth = (() => {
  const SESSION_KEY  = 'mb_session';
  const LOCAL_KEY    = 'mb_auth';
  const isCloud      = () => !!window._sbClient;
  const sb           = () => window._sbClient;
  const CONFIG_TABLE = 'config';
  const AUTH_KEY     = 'auth';

  /* ── Helpers ─────────────────────────── */
  async function hashPwd(password) {
    const enc  = new TextEncoder();
    const data = enc.encode(password);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  function uid() {
    return crypto.randomUUID
      ? crypto.randomUUID()
      : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
          const r = Math.random() * 16 | 0;
          return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
        });
  }

  /* ── Storage adapters ────────────────── */
  async function loadAuth() {
    if (isCloud()) {
      try {
        const { data, error } = await sb()
          .from(CONFIG_TABLE)
          .select('value')
          .eq('key', AUTH_KEY)
          .single();
        if (error || !data) return null;
        return data.value;
      } catch { return null; }
    } else {
      try { return JSON.parse(localStorage.getItem(LOCAL_KEY)) || null; } catch { return null; }
    }
  }

  async function saveAuth(authData) {
    if (isCloud()) {
      const { error } = await sb()
        .from(CONFIG_TABLE)
        .upsert({ key: AUTH_KEY, value: authData });
      if (error) throw error;
    } else {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(authData));
    }
  }

  /* ── Public API ──────────────────────── */

  async function isSetup() {
    const d = await loadAuth();
    return !!(d && d.admin);
  }

  async function setup(name, username, password) {
    const hash  = await hashPwd(password);
    const admin = { id: uid(), name, username, password: hash, isAdmin: true };
    await saveAuth({ admin, editors: [] });
    return admin;
  }

  async function login(username, password) {
    const d = await loadAuth();
    if (!d) throw new Error('Sin configuración');
    const hash = await hashPwd(password);

    if (d.admin.username === username && d.admin.password === hash) {
      const session = { ...d.admin, isAdmin: true };
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
      return session;
    }

    const editor = (d.editors || []).find(e => e.username === username && e.password === hash);
    if (editor) {
      const session = { ...editor, isAdmin: false };
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
      return session;
    }

    throw new Error('Usuario o contraseña incorrectos');
  }

  function currentUser() {
    try { return JSON.parse(sessionStorage.getItem(SESSION_KEY)) || null; } catch { return null; }
  }

  function logout() { sessionStorage.removeItem(SESSION_KEY); }

  async function getEditors()  { const d = await loadAuth(); return d ? (d.editors || []) : []; }
  async function getAllUsers()  { const d = await loadAuth(); if (!d) return []; return [{ ...d.admin, isAdmin: true }, ...(d.editors || [])]; }

  async function addEditor(name, username, password) {
    const d = await loadAuth();
    if (!d) throw new Error('Sin configuración');
    if ([d.admin, ...(d.editors || [])].some(u => u.username === username))
      throw new Error('El nombre de usuario ya existe');
    const editor = { id: uid(), name, username, password: await hashPwd(password), isAdmin: false };
    d.editors = [...(d.editors || []), editor];
    await saveAuth(d);
    return editor;
  }

  async function removeEditor(id) {
    const d = await loadAuth();
    if (!d) return;
    d.editors = (d.editors || []).filter(e => e.id !== id);
    await saveAuth(d);
  }

  async function getAdmin() {
    const d = await loadAuth();
    if (!d) return null;
    const { password: _, ...safe } = d.admin;
    return { ...safe, isAdmin: true };
  }

  return { isSetup, setup, login, logout, currentUser, getEditors, getAllUsers, addEditor, removeEditor, getAdmin };
})();
