// Google Sign-In (client-side integration)
// IMPORTANT: replace CLIENT_ID with your OAuth 2.0 Client ID from Google Cloud Console
// Create an OAuth 2.0 Client ID (Web application) and add your site origin to the authorized JavaScript origins.

const CLIENT_ID = '722385255969-almfinbm72cvfdoqkq27dtd6iju31eb8.apps.googleusercontent.com';
// Backend login endpoint (can be overridden with window.TOA_LOGIN_URL)
// This endpoint will verify the ID token and set an HttpOnly cookie for the session.
const LOGIN_URL = window.TOA_LOGIN_URL || 'http://localhost:8000/login';

function decodeJwtResponse(token) {
  // Basic base64url decode for JWT payload (no signature verification)
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const payload = parts[1];
  const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
  try {
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
  } catch (e) {
    console.error('Failed to decode JWT', e);
    return null;
  }
}

// Debugging state shown on-page and in console. Use this to diagnose why GIS
// (https://accounts.google.com/gsi/client) may not be loading or initializing.
const _gsiDebug = {
  scriptFound: false,
  scriptLoaded: false,
  scriptError: null,
  attempts: 0,
  lastInitError: null,
  lastEventAt: null,
};
 
// Track whether we've already called google.accounts.id.initialize to avoid
// double-initialization errors.
let _gsiInitialized = false;

function updateDebugUI() {
  const debugEl = document.getElementById('gsi_debug');
  const parts = [];
  parts.push(`scriptFound: ${_gsiDebug.scriptFound}`);
  parts.push(`scriptLoaded: ${_gsiDebug.scriptLoaded}`);
  if (_gsiDebug.scriptError) parts.push(`scriptError: ${_gsiDebug.scriptError}`);
  parts.push(`attempts: ${_gsiDebug.attempts}`);
  if (_gsiDebug.lastInitError) parts.push(`lastInitError: ${_gsiDebug.lastInitError}`);
  parts.push(`updated: ${_gsiDebug.lastEventAt || '-'}`);
  if (debugEl) debugEl.textContent = parts.join(' | ');
  console.debug('GSI debug:', _gsiDebug);
}

function attachScriptListeners(script) {
  if (!script) return;
  _gsiDebug.scriptFound = true;
  _gsiDebug.lastEventAt = new Date().toISOString();
  script.addEventListener('load', () => {
    _gsiDebug.scriptLoaded = true;
    _gsiDebug.scriptError = null;
    _gsiDebug.lastEventAt = new Date().toISOString();
    updateDebugUI();
    console.info('GSI script loaded');
  });
  script.addEventListener('error', (e) => {
    _gsiDebug.scriptError = (e && e.message) ? e.message : 'error loading script';
    _gsiDebug.lastEventAt = new Date().toISOString();
    updateDebugUI();
    console.warn('GSI script failed to load', e);
  });
}

function ensureGsiScriptLoaded() {
  // Look for the existing script tag first
  const selector = 'script[src="https://accounts.google.com/gsi/client"]';
  let script = document.querySelector(selector);
  if (script) {
    attachScriptListeners(script);
    // if already loaded, mark it
    if (script.readyState === 'complete' || script.readyState === 'loaded' || script.onload === null) {
      _gsiDebug.scriptLoaded = true;
      _gsiDebug.lastEventAt = new Date().toISOString();
      updateDebugUI();
    }
    return;
  }

  // Not present — try to inject it so we can observe load/error and help users
  try {
    script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.crossOrigin = 'anonymous';
    attachScriptListeners(script);
    document.head.appendChild(script);
    _gsiDebug.lastEventAt = new Date().toISOString();
    updateDebugUI();
    console.info('Inserted GSI script tag dynamically');
  } catch (e) {
    _gsiDebug.scriptError = String(e.message || e);
    _gsiDebug.lastEventAt = new Date().toISOString();
    updateDebugUI();
    console.warn('Failed to insert GSI script tag', e);
  }
}

function showSignedOut() {
  const auth = document.getElementById('auth');
  auth.innerHTML = '<div id="g_id_signin"></div><div id="gsi_debug" style="font-size:12px;color:#666;margin-top:6px;white-space:pre-wrap"></div>';
  // Try to initialize the Google Identity Services button. The GIS script is loaded
  // with async/defer so it may not be available immediately at DOMContentLoaded.
  // Retry a few times with a short delay so the button appears when the script finishes loading.
  let attempts = 0;
  const tryInit = () => {
    attempts += 1;
    _gsiDebug.attempts = attempts;
    _gsiDebug.lastEventAt = new Date().toISOString();
    const debugEl = document.getElementById('gsi_debug');
    if (debugEl) debugEl.textContent = `attempt ${attempts}: checking google...`;
    if (window.google && google.accounts && google.accounts.id) {
      if (debugEl) debugEl.textContent = 'Google Identity Services loaded — rendering button.';
      try {
        google.accounts.id.initialize({
          client_id: CLIENT_ID,
          callback: handleCredentialResponse,
        });
        google.accounts.id.renderButton(
          document.getElementById('g_id_signin'),
          { theme: 'outline', size: 'medium' }
        );
      } catch (e) {
        console.error('Failed to initialize Google Sign-In:', e);
        _gsiDebug.lastInitError = String(e.message || e);
        if (debugEl) debugEl.textContent = `initialization error: ${e.message || e}`;
        updateDebugUI();
      }
      return;
    }
    if (attempts < 10) {
      if (debugEl) debugEl.textContent = `attempt ${attempts}: waiting for GIS...`;
      updateDebugUI();
      // Make sure we have a script tag watching the load/error events
      ensureGsiScriptLoaded();
      setTimeout(tryInit, 200);
    } else {
      if (debugEl) debugEl.textContent = 'Google Identity Services did not load; sign-in button not rendered.';
      _gsiDebug.lastEventAt = new Date().toISOString();
      updateDebugUI();
      console.warn('Google Identity Services did not load; sign-in button not rendered.');
    }
  };
  tryInit();
}

function showSignedIn(user) {
  const auth = document.getElementById('auth');
  auth.innerHTML = `
    <div class="user">
      <img class="user-img" src="${user.picture || ''}" alt="${user.name || ''}" />
      <div class="user-name">${user.name || user.email || 'Member'}</div>
      <button id="signout" class="signout-btn">Sign out</button>
    </div>
  `;
  document.getElementById('signout').addEventListener('click', async () => {
    // Call backend to clear session cookie
    try {
      await fetch(window.TOA_LOGOUT_URL || 'http://localhost:8000/logout', { method: 'POST', credentials: 'include' });
    } catch (e) {
      console.warn('Logout request failed', e);
    }
    localStorage.removeItem('toa_user');
    showSignedOut();
  });
}

function handleCredentialResponse(response) {
  // response.credential is a JWT ID token; decode to extract profile
  const payload = decodeJwtResponse(response.credential);
  if (!payload) {
    console.error('Failed to parse credential response');
    return;
  }

  // Send the ID token to backend /login for verification and session cookie
  fetch(LOGIN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include', // allow cookies from backend
    body: JSON.stringify({ id_token: response.credential }),
  })
    .then(async (res) => {
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Login failed: ${res.status} ${text}`);
      }
      return res.json();
    })
    .then((data) => {
      // server verified payload returned under data.payload
      const serverPayload = (data && data.payload) ? data.payload : payload;
      // Store visible profile locally; raw token is stored as HttpOnly cookie by server
      localStorage.setItem('toa_user', JSON.stringify({ payload: serverPayload }));
      showSignedIn(serverPayload);
    })
    .catch((err) => {
      console.error('Backend login error', err);
      // fallback to showing client-side decoded info (not recommended for production)
      localStorage.setItem('toa_user', JSON.stringify({ payload }));
      showSignedIn(payload);
    });
}

// Initialize on DOM ready
window.addEventListener('DOMContentLoaded', () => {
  const stored = localStorage.getItem('toa_user');
  if (stored) {
    try {
      const obj = JSON.parse(stored);
      if (obj && obj.payload) {
        showSignedIn(obj.payload);
        return;
      }
    } catch (e) {
      // fall through to signed out
    }
  }
  // show sign-in button
  showSignedOut();
});

// Expose a helper to trigger/refresh the auth UI from the page (header button).
window.showAuthUI = function () {
  try {
    showSignedOut();
    if (window.google && google.accounts && google.accounts.id) {
      // Try to show the one-tap prompt if available (non-blocking)
      try {
        google.accounts.id.prompt();
      } catch (e) {
        console.warn('google.accounts.id.prompt() failed:', e);
      }
    } else {
      const debugEl = document.getElementById('gsi_debug');
      if (debugEl) debugEl.textContent = 'Google Identity Services not loaded yet.';
    }
  } catch (e) {
    console.error('showAuthUI error', e);
  }
};
