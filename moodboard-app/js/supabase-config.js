/* ═══════════════════════════════════════════
   supabase-config.js
   · En local (file://) → se salta, usa IndexedDB
   · En servidor con config real → activa Supabase
═══════════════════════════════════════════ */

const SUPABASE_URL    = 'https://rlbuyrnpyojyeoebjsfg.supabase.co';
const SUPABASE_ANON   = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJsYnV5cm5weW9qeWVvZWJqc2ZnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgwMjA1MTUsImV4cCI6MjA5MzU5NjUxNX0.2uW84jUs6DN5RG7_UruzWVsVJcBcSao_tOJrwNIY0lU';

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
