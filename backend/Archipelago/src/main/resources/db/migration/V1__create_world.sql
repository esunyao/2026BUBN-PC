CREATE TABLE users (
    id TEXT NOT NULL PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at INTEGER NOT NULL
);
CREATE TABLE events (
    id TEXT NOT NULL PRIMARY KEY,
    owner_id TEXT NOT NULL REFERENCES users(id),
    name TEXT NOT NULL,
    created_at INTEGER NOT NULL
);
CREATE INDEX idx_events_owner ON events(owner_id, created_at);
CREATE TABLE participants (
    id TEXT NOT NULL PRIMARY KEY,
    event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    initials TEXT NOT NULL,
    color TEXT NOT NULL,
    UNIQUE(event_id, id)
);
CREATE TABLE places (
    id TEXT NOT NULL PRIMARY KEY,
    event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slot INTEGER NOT NULL CHECK(slot >= 0),
    latitude REAL,
    longitude REAL,
    UNIQUE(event_id, id),
    UNIQUE(event_id, slot),
    CHECK((latitude IS NULL AND longitude IS NULL) OR
          (latitude IS NOT NULL AND longitude IS NOT NULL AND
           latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180))
);
CREATE TABLE photos (
    id TEXT NOT NULL PRIMARY KEY,
    event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    photographer_id TEXT NOT NULL,
    island_id TEXT,
    filename TEXT NOT NULL,
    caption TEXT NOT NULL,
    content_type TEXT NOT NULL,
    declared_bytes INTEGER NOT NULL CHECK(declared_bytes > 0),
    verified_bytes INTEGER,
    staging_key TEXT NOT NULL UNIQUE,
    object_key TEXT NOT NULL UNIQUE,
    upload_expires_at INTEGER NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('PENDING', 'READY')),
    latitude REAL,
    longitude REAL,
    captured_at INTEGER CHECK(captured_at IS NULL OR captured_at >= 0),
    import_order INTEGER NOT NULL CHECK(import_order >= 0),
    created_at INTEGER NOT NULL,
    UNIQUE(event_id, import_order),
    FOREIGN KEY(event_id, photographer_id) REFERENCES participants(event_id, id),
    FOREIGN KEY(event_id, island_id) REFERENCES places(event_id, id),
    CHECK((latitude IS NULL AND longitude IS NULL) OR
          (latitude IS NOT NULL AND longitude IS NOT NULL AND
           latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180)),
    CHECK(status != 'READY' OR (verified_bytes IS NOT NULL AND verified_bytes > 0))
);
CREATE INDEX idx_photos_event_status ON photos(event_id, status, import_order);
CREATE INDEX idx_photos_place ON photos(event_id, island_id, status);
