# Archive module

Read the backend and root rules and [public module documentation](doc/README.md).

Archive HTTP endpoints delegate validation, visibility filtering, ID remapping and idempotency to MemoryService. They accept only metadata and never fetch arbitrary image URLs. Signed media URLs are transient and must not appear in exported archives. The backend-controlled demo fixture is the only authority for bundled asset references.
