/* ═══════════════════════════════════════════
   Utils.js — Helpers, Toast, Confirm, Lightbox,
   File reading, Font loading
═══════════════════════════════════════════ */

/* ── UUID ───────────────────────────────── */
function uid() {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
      });
}

/* ── Date helpers ───────────────────────── */
function formatDate(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}

function nowISO() { return new Date().toISOString(); }

/* ── Toast ──────────────────────────────── */
const Toast = (() => {
  const container = () => document.getElementById('toast-container');

  function show(msg, type = 'success', ms = 3000) {
    const el = document.createElement('div');
    el.className = `toast ${type}`;

    const icons = {
      success: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="color:var(--accent)"><polyline points="20 6 9 17 4 12"/></svg>`,
      error:   `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="color:var(--danger)"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
      info:    `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="color:rgba(255,255,255,0.5)"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
    };

    el.innerHTML = `${icons[type] || ''}${msg}`;
    container().appendChild(el);

    setTimeout(() => {
      el.style.animation = 'toastOut 0.22s ease forwards';
      setTimeout(() => el.remove(), 220);
    }, ms);
  }

  return { show, success: m => show(m, 'success'), error: m => show(m, 'error'), info: m => show(m, 'info') };
})();

/* ── Confirm modal ──────────────────────── */
function confirm(title, msg, okLabel = 'Eliminar') {
  return new Promise(resolve => {
    const overlay = document.getElementById('modal-confirm');
    document.getElementById('modal-confirm-title').textContent = title;
    document.getElementById('modal-confirm-msg').textContent   = msg;
    document.getElementById('modal-confirm-ok').textContent    = okLabel;

    overlay.classList.remove('hidden');

    function cleanup(result) {
      overlay.classList.add('hidden');
      resolve(result);
    }

    document.getElementById('modal-confirm-ok').onclick     = () => cleanup(true);
    document.getElementById('modal-confirm-cancel').onclick = () => cleanup(false);
    overlay.addEventListener('click', e => { if (e.target === overlay) cleanup(false); }, { once: true });
  });
}

/* ── File reading → base64 ──────────────── */
function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = e => resolve(e.target.result);
    reader.onerror = e => reject(e.target.error);
    reader.readAsDataURL(file);
  });
}

/* ── Resize + compress image before storing ─
   Max 1400px en el lado más largo, JPEG 0.82
   PNG con transparencia se mantiene como PNG  */
function resizeImage(file, maxPx = 1400, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = e => reject(e.target.error);
    reader.onload = e => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const { naturalWidth: w, naturalHeight: h } = img;
        const scale  = Math.min(1, maxPx / Math.max(w, h));
        const canvas = document.createElement('canvas');
        canvas.width  = Math.round(w * scale);
        canvas.height = Math.round(h * scale);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        /* Keep PNG for files that likely have transparency, else JPEG */
        const useJpeg = file.type !== 'image/png';
        const out     = useJpeg
          ? canvas.toDataURL('image/jpeg', quality)
          : canvas.toDataURL('image/png');
        resolve(out);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

/* ── Google Fonts loader ────────────────── */
const FontLoader = (() => {
  const loaded = new Set();

  function load(fontName) {
    const slug = fontName.trim();
    if (!slug || loaded.has(slug)) return Promise.resolve(true);

    return new Promise(resolve => {
      const encoded = encodeURIComponent(slug).replace(/%20/g, '+');
      const id = `gfont-${slug.replace(/\s+/g, '_')}`;
      if (document.getElementById(id)) { loaded.add(slug); resolve(true); return; }

      const link = document.createElement('link');
      link.id   = id;
      link.rel  = 'stylesheet';
      link.href = `https://fonts.googleapis.com/css2?family=${encoded}:wght@300;400;500;600;700&display=swap`;
      link.onload  = () => { loaded.add(slug); resolve(true); };
      link.onerror = () => resolve(false);
      document.head.appendChild(link);
    });
  }

  return { load };
})();

/* ── Lightbox ────────────────────────────── */
const Lightbox = (() => {
  let images   = []; // [{ src, label }]
  let current  = 0;

  const lb      = () => document.getElementById('lightbox');
  const lbImg   = () => document.getElementById('lb-img');
  const lbLabel = () => document.getElementById('lb-label');
  const lbCount = () => document.getElementById('lb-counter');
  const lbPrev  = () => document.getElementById('lb-prev');
  const lbNext  = () => document.getElementById('lb-next');

  function show(index) {
    current = Math.max(0, Math.min(index, images.length - 1));
    const item = images[current];
    lbImg().src                = item.src;
    lbLabel().textContent      = item.label || '';
    lbCount().textContent      = images.length > 1 ? `${current + 1} / ${images.length}` : '';
    lbPrev().disabled          = images.length <= 1;
    lbNext().disabled          = images.length <= 1;
    lb().classList.remove('hidden');
  }

  function close() { lb().classList.add('hidden'); lbImg().src = ''; }

  function open(imageList, index = 0) {
    images  = imageList;
    current = index;
    show(current);
  }

  function next() { if (images.length > 1) show((current + 1) % images.length); }
  function prev() { if (images.length > 1) show((current - 1 + images.length) % images.length); }

  /* Wire up once */
  function init() {
    document.getElementById('lb-close').addEventListener('click', close);
    document.getElementById('lb-prev').addEventListener('click', prev);
    document.getElementById('lb-next').addEventListener('click', next);
    document.getElementById('lightbox').addEventListener('click', e => {
      if (e.target === e.currentTarget || e.target.classList.contains('lb-stage')) close();
    });
    document.addEventListener('keydown', e => {
      if (lb().classList.contains('hidden')) return;
      if (e.key === 'Escape')     close();
      if (e.key === 'ArrowRight') next();
      if (e.key === 'ArrowLeft')  prev();
    });
  }

  return { init, open, close };
})();

/* ── Debounce ────────────────────────────── */
function debounce(fn, ms) {
  let timer;
  return function(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), ms);
  };
}

/* ── Toggle element visibility ──────────── */
function show(el) { el && el.classList.remove('hidden'); }
function hide(el) { el && el.classList.add('hidden'); }
function toggle(el, condition) { condition ? show(el) : hide(el); }

/* ── Safe query helper ──────────────────── */
function qs(selector, root = document) { return root.querySelector(selector); }
function qsa(selector, root = document) { return Array.from(root.querySelectorAll(selector)); }

/* ── Hex validation ─────────────────────── */
function isValidHex(hex) { return /^[0-9A-Fa-f]{6}$/.test(hex); }
function normalizeHex(hex) { return hex.replace('#', '').toUpperCase(); }

/* ── Contrast detector (for color swatches) */
function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.slice(0,2),16),
    g: parseInt(h.slice(2,4),16),
    b: parseInt(h.slice(4,6),16),
  };
}

function isDarkColor(hex) {
  const { r, g, b } = hexToRgb(hex);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance < 0.5;
}

/* ── Copy to clipboard ──────────────────── */
async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}
