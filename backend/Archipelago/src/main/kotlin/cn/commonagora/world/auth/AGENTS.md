# Authentication module

Start with [backend rules](../../../../../../../AGENTS.md); configuration and HTTP contracts are linked there.

Own login users, the demo seed, RSA signing keys, OAuth/OIDC endpoints and API security. Public SPA client is `world-web`, authorization code with PKCE S256 only. JWT subject is the immutable SQLite users.id. `/api/v1/**` requires a bearer access token with world-api audience and SCOPE_world; browser sessions never authorize this chain.

Do not put passwords, private signing keys or bearer tokens in source, documentation or logs. Keep form-login CSRF enabled. Dynamic client registration and refresh grants are deliberately absent. Read [doc/README.md](doc/README.md) before changing the protocol contract; update it with behavior changes. The root agent owns shared Problem Detail handling.
