# Authentication

Spring Security provides authorization code OAuth 2.0 and OIDC for public client `world-web`. Its registered callback and logout return URI are configuration values. The authorization request must contain PKCE S256; scopes are `openid profile world`. Discovery is `/.well-known/openid-configuration`; use its advertised authorization, token, JWKS, UserInfo and `end_session_endpoint` addresses. Dynamic client registration is disabled.

Clients should send unpredictable `state` and OIDC `nonce` values. The ID token echoes the requested nonce; the client verifies both values when completing login. A code can be exchanged once, with the original S256 verifier and registered redirect URI. PKCE validation runs before the authorization endpoint can create a code or redirect to login.

Form login uses Spring's generated page with CSRF protection. SQLite stores BCrypt password hashes. The demo username defaults to `demo`; the first startup requires `WORLD_DEMO_PASSWORD` from the local environment or `.env`. Later startups preserve the existing user and hash. The local `.env` and `data/` are ignored by Git. A generated password is not a public credential; operators can choose their own initial value before first startup.

Access tokens last ten minutes, with users.id in `sub`, `world-api` in `aud` and `token_use=access_token`. `/api/v1/**` accepts bearer tokens only, checks signature, issuer, expiration and audience, and requires `SCOPE_world`. ID tokens and login cookies cannot authorize these APIs. `/api/v1/me` returns `{id, username}` for the signed-in user.

API authentication failures return 401 and missing `world` scope returns 403, both as `application/problem+json` with a `WWW-Authenticate` header. Error details do not include bearer values or JWT decoder errors. CORS uses the configured exact origin, permits Authorization/Content-Type headers and GET/POST/PUT/PATCH/DELETE/OPTIONS, and does not allow credentialed requests. Browser form login remains a server navigation protected by CSRF.

Private RSA JWK material persists at `WORLD_AUTH_KEY_PATH` (default `./data/signing-key.json`), so restart preserves JWT verification. Protect this file with filesystem permissions and backups; changing it invalidates outstanding tokens. OAuth grants and login sessions are in memory, and disappear on restart. No refresh token is issued.

OIDC logout uses the advertised `/connect/logout` endpoint with ID-token hint and registered post-logout URI. The caller clears its local tokens. Logout ends the server login session; already issued bearer JWTs remain valid until their ten-minute expiration. Production deployments must configure HTTPS issuer, callback, allowed CORS origin, logout return URI and private-key directory permissions.
