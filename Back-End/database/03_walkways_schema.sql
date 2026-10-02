-- Walkway network used for directions (admin draws it on the map).
-- Run once, after 01_schema.sql. Safe on a database that already has data.
BEGIN;
-- A point on a walkway. connector = 'Thang máy', 'Thang cuốn'... when passengers change floor here.
CREATE TABLE IF NOT EXISTS walkway_nodes (
    id TEXT PRIMARY KEY CHECK (btrim(id) <> ''),
    floor_id BIGINT NOT NULL REFERENCES floors(id),
    lat DOUBLE PRECISION NOT NULL,
    lng DOUBLE PRECISION NOT NULL,
    connector TEXT
);
-- A straight walkable segment between two nodes (both directions). Different floors = floor change.
CREATE TABLE IF NOT EXISTS walkway_edges (
    from_id TEXT NOT NULL REFERENCES walkway_nodes(id) ON DELETE CASCADE,
    to_id TEXT NOT NULL REFERENCES walkway_nodes(id) ON DELETE CASCADE,
    PRIMARY KEY (from_id, to_id),
    CHECK (from_id <> to_id)
);
CREATE INDEX IF NOT EXISTS walkway_nodes_floor_idx ON walkway_nodes(floor_id);
CREATE INDEX IF NOT EXISTS walkway_edges_to_idx ON walkway_edges(to_id);
COMMIT;
