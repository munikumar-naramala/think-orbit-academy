# think-orbit-academy
A Concept based learning app focussed on the fundamental concepts.

## Google Sign-In (local/dev setup)

This project includes a simple client-side Google Sign-In integration. It uses the Google Identity Services (GIS) library and stores a decoded ID token payload in localStorage for demo purposes.

Steps to enable:

1. Open Google Cloud Console -> APIs & Services -> Credentials.
2. Create an OAuth 2.0 Client ID for a Web application.
3. Add your development origin (for example `http://localhost:3000` or `http://127.0.0.1:8080`).
4. Copy the Client ID and replace the placeholder in `js/auth.js` (the `CLIENT_ID` constant).

Notes:

- This implementation decodes the ID token on the client for display only. For production you must send the token to your server and verify it with Google's token verification endpoint or using Google libraries.
- If you need me to wire this up to a backend (Node/Express, serverless function, etc.) to perform token verification and issue your own session cookie, tell me which runtime you'd like and I can add an example.

