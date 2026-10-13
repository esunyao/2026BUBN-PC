# Media module

Start with [backend rules](../../../../../../../AGENTS.md); configuration, schema and HTTP contracts are linked there.

Owns photo upload intents, RustFS signing, server-side finalization and download URL batches. Read [doc/README.md](doc/README.md) and the root implementation contract before edits.

- Use `EventAccess` for participant checks and island assignment, and MemoryAccess for membership and photo visibility; `PhotoRows.mapper` supplies the common photo shape.
- No S3 network calls inside a database transaction. Confirm must verify staging HEAD, conditional COPY and final HEAD before the short READY transaction.
- Signed PUT keys and final object keys are independent random keys under owner/event prefixes. Never sign PUT against the final key or accept client object keys.
- Serialize confirmation per photo; READY confirmation must return immediately without copying or assigning another island. Current locking assumes the documented single SQLite writer deployment.
- Download requests validate all photo IDs as READY in the event before signing any URL. Never persist or log signed URLs or credentials.
- Keep browser signing endpoint distinct from the internal SDK endpoint, use SigV4 and path style, and return required upload headers.
- Update local public documentation on behavior changes. Tests use actual SQLite and actual SDK signing with an in-process S3 HTTP stub; they do not require a production RustFS account.
