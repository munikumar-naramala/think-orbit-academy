# Backend: FastAPI Google ID token verification

This small FastAPI service verifies Google ID tokens (from the client) and provides a simple session cookie for protected API access.

Setup

1. Create a Python virtualenv and install dependencies:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
```

2. Set the `GOOGLE_CLIENT_ID` environment variable to the OAuth 2.0 Client ID from Google Cloud Console:

```bash
export GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"

Alternatively, create a `.env` file in the project root (or copy `backend/.env.example`) with the same keys. The server will load `.env` automatically if present.
```

3. (Optional) Restrict CORS origins for development by setting `CORS_ORIGINS` (comma-separated). Default is `*`:

```bash
export CORS_ORIGINS="http://localhost:3000"
```

4. Start the service:

```bash
uvicorn backend.main:app --reload --port 8000
```

API endpoints

- POST /login — Accepts JSON `{ "id_token": "<JWT>" }`. Verifies the ID token with Google and sets an HttpOnly session cookie (`toa_token` by default). Returns the decoded payload in the response.
- POST /verify_token — Verifies an ID token passed in the request body and returns its decoded payload (useful for direct verification).
- GET /profile — Protected route. Verifies token from either `Authorization: Bearer <token>` header or the session cookie and returns a minimal profile object.
 - POST /logout — Clears the session cookie set by `/login`.

Example: login (frontend should POST the ID token and include credentials to receive the cookie):

```bash
curl -X POST http://localhost:8000/login \
  -H "Content-Type: application/json" \
  -d '{"id_token":"<JWT>"}' \
  -c cookies.txt
```

Then access profile with the cookie:

```bash
curl http://localhost:8000/profile -b cookies.txt
```

Notes

- For development the server may accept wildcard CORS, but browsers will block cookies when `Access-Control-Allow-Origin: *`. For correct cookie handling set `CORS_ORIGINS` to the frontend origin and keep `allow_credentials=true`.
- For production you should create a short-lived server session identifier instead of storing raw ID tokens, and secure cookies (Secure, HttpOnly, SameSite) should be used.

Session settings

- SESSION_TTL (env) - number of seconds the in-memory session is valid. Default: 3600 (1 hour).
- SESSION_COOKIE_NAME - name of the cookie set by `/login`. Default: `toa_token`.
- COOKIE_SECURE - set to `true` in production when serving over HTTPS so the cookie has the Secure flag.

Note: the current implementation stores sessions in an in-memory Python dict (`SESSION_STORE`). This is fine for local testing and demos but will not persist across process restarts or scale across multiple instances. For production use a shared store such as Redis and issue short-lived session identifiers.
