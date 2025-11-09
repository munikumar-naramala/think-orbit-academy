// Google Sign-In (client-side integration)
// IMPORTANT: replace CLIENT_ID with your OAuth 2.0 Client ID from Google Cloud Console
// Create an OAuth 2.0 Client ID (Web application) and add your site origin to the authorized JavaScript origins.

const CLIENT_ID = 'REPLACE_WITH_YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com';
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

function showSignedOut() {
  const auth = document.getElementById('auth');
  auth.innerHTML = '<div id="g_id_signin"></div>';
  if (window.google && google.accounts && google.accounts.id) {
    google.accounts.id.initialize({
      client_id: CLIENT_ID,
      callback: handleCredentialResponse,
    });
    google.accounts.id.renderButton(
      document.getElementById('g_id_signin'),
      { theme: 'outline', size: 'medium' }
    );
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
