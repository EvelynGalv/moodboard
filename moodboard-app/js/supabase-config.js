/* ═══════════════════════════════════════════
   supabase-config.js
   · En local (file://) → se salta, usa IndexedDB
   · En servidor con config real → activa Supabase
═══════════════════════════════════════════ */

const SUPABASE_URL    = 'PEGA_TU_SUPABASE_URL';
const SUPABASE_ANON   = 'PEGA_TU_ANON_KEY';

const _isLocal      = location.protocol === 'file:';
const _isConfigured = SUPABASE_URL !== 'PEGA_TU_SUPABASE_URL';

if (!_isLocal && _isConfigured && typeof supabase !== 'undefined') {
  try {
    window._sbClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
    console.log('[Supabase] Conectado ✓');
  } catch (e) {
    console.error('[Supabase] Error:', e);
  }
} else if (_isLocal) {
  console.log('[DB] Modo local — IndexedDB activo');
}
