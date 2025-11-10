// Google Sign-In (client-side integration)
// IMPORTANT: replace CLIENT_ID with your OAuth 2.0 Client ID from Google Cloud Console
// Create an OAuth 2.0 Client ID (Web application) and add your site origin to the authorized JavaScript origins.

// CLIENT_ID will be fetched from the backend at runtime to avoid mismatches
// between client-side hardcoded values and server configuration.
let CLIENT_ID = null;
const CONFIG_URL = window.TOA_CONFIG_URL || 'http://localhost:8000/config';
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
  // Keep debug logging to the console only (no on-page debug element).
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
  // If there's a header login placeholder prefer rendering the Google button there
  const headerLogin = document.getElementById('header-login');
  if (headerLogin) {
    // Render the GIS button inside the header control; keep the page auth area empty.
    headerLogin.innerHTML = '<div id="g_id_signin"></div>';
    headerLogin.classList.remove('btn');
    headerLogin.style.display = '';
    if (auth) auth.innerHTML = '';
  } else {
    // Fallback: render button in the auth area (legacy behaviour)
    if (auth) auth.innerHTML = '<div id="g_id_signin"></div>';
  }
  // Try to initialize the Google Identity Services button. The GIS script is loaded
  // with async/defer so it may not be available immediately at DOMContentLoaded.
  // Retry a few times with a short delay so the button appears when the script finishes loading.
  let attempts = 0;
  const tryInit = () => {
    attempts += 1;
  _gsiDebug.attempts = attempts;
  _gsiDebug.lastEventAt = new Date().toISOString();
  // Console-only debug (no on-page element)
  console.debug(`GSI attempt ${attempts}: checking google...`);
    // Ensure we have a client id from the server before initializing.
    if (!CLIENT_ID) {
      console.debug(`attempt ${attempts}: waiting for client_id...`);
      // Try to fetch it (fire-and-forget); it may already be in progress.
      fetchConfig().catch(() => {});
    }

    if (window.google && google.accounts && google.accounts.id && CLIENT_ID) {
      console.debug('Google Identity Services loaded — rendering button.');
      try {
          google.accounts.id.initialize({
            client_id: CLIENT_ID,
            callback: handleCredentialResponse,
          });
          const container = document.getElementById('g_id_signin');
          if (container) {
            // Render a compact button suitable for the header when applicable
            const isHeader = !!document.getElementById('header-login');
            const sizeOption = isHeader ? 'small' : 'medium';
            google.accounts.id.renderButton(container, { theme: 'outline', size: sizeOption });
          }
      } catch (e) {
        console.error('Failed to initialize Google Sign-In:', e);
        _gsiDebug.lastInitError = String(e.message || e);
        updateDebugUI();
      }
      return;
    }
    if (attempts < 10) {
      console.debug(`attempt ${attempts}: waiting for GIS...`);
      updateDebugUI();
      // Make sure we have a script tag watching the load/error events
      ensureGsiScriptLoaded();
      setTimeout(tryInit, 200);
    } else {
      console.warn('Google Identity Services did not load; sign-in button not rendered.');
      _gsiDebug.lastEventAt = new Date().toISOString();
      updateDebugUI();
    }
  };
  tryInit();
}

// Fetch runtime configuration from the backend (e.g. client id) and cache it
async function fetchConfig() {
  try {
    const res = await fetch(CONFIG_URL, { cache: 'no-store' });
    if (!res.ok) {
      throw new Error(`config fetch failed: ${res.status}`);
    }
    const body = await res.json();
    if (body && body.client_id) {
      CLIENT_ID = body.client_id;
      console.info('Fetched CLIENT_ID from server');
      _gsiDebug.lastEventAt = new Date().toISOString();
      updateDebugUI();
      return CLIENT_ID;
    }
    throw new Error('client_id not present in config');
  } catch (e) {
    console.warn('Failed to fetch config from server', e);
    _gsiDebug.lastEventAt = new Date().toISOString();
    _gsiDebug.scriptError = String(e && e.message);
    updateDebugUI();
    throw e;
  }
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
  // Hide header login placeholder when signed in to avoid duplicate controls
  const headerLogin = document.getElementById('header-login');
  if (headerLogin) {
    headerLogin.style.display = 'none';
  }
  document.getElementById('signout').addEventListener('click', async () => {
    // Call backend to clear session cookie
    try {
      await fetch(window.TOA_LOGOUT_URL || 'http://localhost:8000/logout', { method: 'POST', credentials: 'include' });
    } catch (e) {
      console.warn('Logout request failed', e);
    }
    localStorage.removeItem('toa_user');
    // Restore header login control when signed out
    const headerLogin = document.getElementById('header-login');
    if (headerLogin) {
      headerLogin.style.display = '';
      // ensure header shows sign-in container again
      headerLogin.innerHTML = '<div id="g_id_signin"></div>';
    }
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
window.addEventListener('DOMContentLoaded', async () => {
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

  // Try to fetch runtime config (client id) before rendering the button. If
  // the fetch fails we still attempt to render so the user sees diagnostics.
  try {
    await fetchConfig();
  } catch (e) {
    // ignored — showSignedOut will display diagnostics
  }

  // show sign-in button
  showSignedOut();
});

// Expose a helper to trigger/refresh the auth UI from the page (header button).
window.showAuthUI = function () {
  try {
    // Ensure we have CLIENT_ID; fetch if missing, then show the UI.
    const ensureThenShow = async () => {
      if (!CLIENT_ID) {
        try {
          await fetchConfig();
        } catch (e) {
          console.warn('showAuthUI: failed to fetch client_id before showing UI', e);
        }
      }
      showSignedOut();
      if (window.google && google.accounts && google.accounts.id) {
        try {
          google.accounts.id.prompt();
        } catch (e) {
          console.warn('google.accounts.id.prompt() failed:', e);
        }
      }
    };
    ensureThenShow();
  } catch (e) {
    console.error('showAuthUI error', e);
  }
};

// Also attach the header login button click via JS to avoid relying on inline onclick
// (this helps with CSP or timing issues where inline handlers may not fire).
document.addEventListener('DOMContentLoaded', () => {
  try {
    const headerLogin = document.getElementById('header-login');
    if (headerLogin) {
      // make it clearly clickable and provide immediate feedback
      headerLogin.style.cursor = 'pointer';
      headerLogin.addEventListener('click', (e) => {
        try {
          console.info('header-login clicked');
          (window.showAuthUI || (() => {}))();
        } catch (err) {
          console.error('header-login click handler error', err);
        }
      });
      // keyboard accessibility: Enter or Space should trigger the login UI
      headerLogin.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          (window.showAuthUI || (() => {}))();
        }
      });
    }
  } catch (e) {
    console.error('Failed to attach header-login listener', e);
  }
});
