CREATE SEQUENCE location_id_seq;
CREATE TABLE locations (
    id BIGINT PRIMARY KEY DEFAULT nextval('location_id_seq'),
    name TEXT NOT NULL,
    type TEXT,
    terminal TEXT,
    floor INTEGER NOT NULL,
    x DOUBLE PRECISION, y DOUBLE PRECISION,
    lat DOUBLE PRECISION, lng DOUBLE PRECISION,
    source_id BIGINT,
    phone TEXT, website TEXT, area TEXT, description TEXT,
    opening_hours TEXT, facilities TEXT,
    CONSTRAINT location_coordinates CHECK ((x IS NOT NULL AND y IS NOT NULL) OR (lat IS NOT NULL AND lng IS NOT NULL))
);
ALTER SEQUENCE location_id_seq OWNED BY locations.id;
CREATE INDEX locations_terminal_floor_idx ON locations (terminal, floor);
CREATE TABLE data_imports (name TEXT PRIMARY KEY, imported_at TIMESTAMPTZ NOT NULL DEFAULT now());
COMMENT ON COLUMN locations.x IS 'SVG pixel X, not longitude';
COMMENT ON COLUMN locations.y IS 'SVG pixel Y, not latitude';
COMMENT ON COLUMN locations.lat IS 'WGS84 latitude';
COMMENT ON COLUMN locations.lng IS 'WGS84 longitude';
