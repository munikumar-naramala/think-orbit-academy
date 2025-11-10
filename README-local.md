# Local development — think-orbit-academy

This file contains copy-paste commands and a quick helper to run the static frontend and FastAPI backend for local development.

Prerequisites
- Python 3.8+ (for the backend)
- A Google OAuth 2.0 Client ID (Web application)

Quick start (from project root)

1) Copy the example env and set your Google client id:

```bash
cp backend/.env.example backend/.env
# edit backend/.env and set GOOGLE_CLIENT_ID to your OAuth client id
```

Or export the variable in your shell instead:

```bash
export GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
```

2) Create a Python virtualenv and install backend dependencies:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
```

3) Start both frontend and backend with the helper script:

```bash
chmod +x scripts/start-dev.sh
./scripts/start-dev.sh
```

This will start a static server on http://localhost:3000 and the backend on http://localhost:8000.

Manual alternative

Start frontend only (serves project root so `index.html` and `edu-app.html` are available):

```bash
# serve frontend on port 3000
python3 -m http.server 3000 --directory .
```

Start backend only (after activating `.venv`):

```bash
uvicorn backend.main:app --reload --port 8000
```

Testing endpoints (when you have an ID token)

```bash
# verify token
curl -X POST http://localhost:8000/verify_token \
  -H "Content-Type: application/json" \
  -d '{"id_token":"<ID_TOKEN>"}'

# login and save cookie
curl -X POST http://localhost:8000/login \
  -H "Content-Type: application/json" \
  -d '{"id_token":"<ID_TOKEN>"}' \
  -c cookies.txt

# access profile using cookie
curl http://localhost:8000/profile -b cookies.txt
```

Notes
- Replace the placeholder `CLIENT_ID` in `js/auth.js` with your OAuth client id if you prefer a client-side substitution.
- When using cookies from the browser for cross-origin requests, set `CORS_ORIGINS` in `backend/.env` to the frontend origin (do not use `*`).
- For production use HTTPS and set `COOKIE_SECURE=true` in the environment.