CREATE TABLE demo_discovery_feedback (
    event_id TEXT NOT NULL,
    user_id TEXT NOT NULL REFERENCES users(id),
    finding_id TEXT NOT NULL,
    content TEXT NOT NULL,
    evidence_json TEXT NOT NULL,
    PRIMARY KEY(event_id,user_id,finding_id)
);
