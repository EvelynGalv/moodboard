/* ═══════════════════════════════════════════
   firebase-config.js
   · En local (file://) → se salta, usa IndexedDB
   · En servidor con config real → activa Firebase
═══════════════════════════════════════════ */

const firebaseConfig = {
  apiKey:            "PEGA_TU_API_KEY",
  authDomain:        "TU_PROYECTO.firebaseapp.com",
  projectId:         "TU_PROYECTO_ID",
  storageBucket:     "TU_PROYECTO.appspot.com",
  messagingSenderId: "TU_SENDER_ID",
  appId:             "TU_APP_ID"
};

const _isLocal      = location.protocol === 'file:';
const _isConfigured = firebaseConfig.apiKey !== 'PEGA_TU_API_KEY';

if (!_isLocal && _isConfigured && typeof firebase !== 'undefined') {
  try {
    firebase.initializeApp(firebaseConfig);
    window._fbDB = firebase.firestore();
    window._fbST = firebase.storage();
    console.log('[Firebase] Conectado ✓');
  } catch (e) {
    console.error('[Firebase] Error:', e);
  }
} else if (_isLocal) {
  console.log('[DB] Modo local — IndexedDB activo');
}
