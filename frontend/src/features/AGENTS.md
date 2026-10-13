# Feature boundary

Follow [frontend rules](../../AGENTS.md). Keep map rendering in world, photo display in memories, EXIF/import grouping in import, and timeline scheduling in replay. Use shared types and typed props/events. Replay uses navigation rather than a separate movement animation. One import batch has one selected photographer. Missing EXIF must remain visible and correctable.

Implementation: [doc/README.md](doc/README.md).
