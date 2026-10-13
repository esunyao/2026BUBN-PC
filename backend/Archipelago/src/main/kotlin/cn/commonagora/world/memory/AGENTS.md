# Memory module

Read the repository and backend AGENTS.md first. This module owns the authorized Event → Scene → Moment → Contribution graph, member access, Gap validation, feedback, and demo import. The Flyway migrations are the schema source of truth. Update backend/Archipelago/doc/database.md and doc/openapi.yaml when changing persistence or HTTP behavior. Keep object storage calls outside database transactions; do not infer account permissions from display participant IDs.
