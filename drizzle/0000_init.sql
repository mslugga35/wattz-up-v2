-- WATTZ UP v2 - Database Schema
-- All tables prefixed with wattz_ to avoid collisions on shared Supabase instance

-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- ============ STATIONS TABLE ============
CREATE TABLE IF NOT EXISTS wattz_stations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id VARCHAR(255) UNIQUE NOT NULL,
  source VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,

  latitude DECIMAL(10, 7) NOT NULL,
  longitude DECIMAL(10, 7) NOT NULL,
  geohash_6 VARCHAR(6) NOT NULL,

  address TEXT,
  city VARCHAR(100),
  state VARCHAR(2),
  zip VARCHAR(10),
  country VARCHAR(2) DEFAULT 'US',

  network VARCHAR(100),
  plug_types TEXT[],
  stalls_total INTEGER DEFAULT 4,
  max_power_kw INTEGER,

  pricing_per_kwh DECIMAL(5, 3),
  pricing_per_minute DECIMAL(5, 3),

  amenities TEXT[],
  access_restrictions TEXT,

  data_quality_score DECIMAL(3, 2) DEFAULT 0.5,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_wattz_stations_geohash6 ON wattz_stations(geohash_6);
CREATE INDEX IF NOT EXISTS idx_wattz_stations_network ON wattz_stations(network);
CREATE INDEX IF NOT EXISTS idx_wattz_stations_source ON wattz_stations(source);

-- PostGIS geography column + trigger for automatic lat/lng → location sync
ALTER TABLE wattz_stations ADD COLUMN IF NOT EXISTS location GEOGRAPHY(POINT, 4326);

CREATE OR REPLACE FUNCTION update_station_location()
RETURNS TRIGGER AS $$
BEGIN
  NEW.location = ST_SetSRID(ST_MakePoint(NEW.longitude::float, NEW.latitude::float), 4326)::geography;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS wattz_stations_location_trigger ON wattz_stations;
CREATE TRIGGER wattz_stations_location_trigger
  BEFORE INSERT OR UPDATE ON wattz_stations
  FOR EACH ROW
  EXECUTE FUNCTION update_station_location();

CREATE INDEX IF NOT EXISTS idx_wattz_stations_location ON wattz_stations USING GIST(location);

-- ============ USERS TABLE ============
CREATE TABLE IF NOT EXISTS wattz_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id VARCHAR(64) UNIQUE NOT NULL,
  platform VARCHAR(10) NOT NULL,
  trust_score DECIMAL(3, 2) DEFAULT 0.5,
  fcm_token TEXT,
  location_consent BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_wattz_users_device ON wattz_users(device_id);

-- ============ OBSERVATIONS TABLE ============
CREATE TABLE IF NOT EXISTS wattz_observations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id UUID NOT NULL REFERENCES wattz_stations(id),
  user_hash VARCHAR(64) NOT NULL,

  observation_type VARCHAR(20) NOT NULL,
  queue_position INTEGER,
  stalls_available INTEGER,
  session_duration_min INTEGER,

  geohash_6 VARCHAR(6) NOT NULL,

  trust_score DECIMAL(3, 2) DEFAULT 0.5,
  observed_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_wattz_observations_station ON wattz_observations(station_id);
CREATE INDEX IF NOT EXISTS idx_wattz_observations_observed ON wattz_observations(observed_at);
CREATE INDEX IF NOT EXISTS idx_wattz_observations_type ON wattz_observations(observation_type);

-- ============ ALERTS TABLE ============
CREATE TABLE IF NOT EXISTS wattz_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES wattz_users(id),
  station_id UUID NOT NULL REFERENCES wattz_stations(id),

  condition_type VARCHAR(30) NOT NULL,
  condition_value INTEGER NOT NULL,

  status VARCHAR(20) DEFAULT 'active',
  fcm_token TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  triggered_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_wattz_alerts_user ON wattz_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_wattz_alerts_station ON wattz_alerts(station_id);
CREATE INDEX IF NOT EXISTS idx_wattz_alerts_status ON wattz_alerts(status);

-- ============ SESSION STATS TABLE ============
CREATE TABLE IF NOT EXISTS wattz_session_stats_hourly (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id UUID NOT NULL REFERENCES wattz_stations(id),
  day_of_week INTEGER NOT NULL,
  hour_of_day INTEGER NOT NULL,

  median_session_min DECIMAL(6, 2),
  p75_session_min DECIMAL(6, 2),
  avg_queue_length DECIMAL(4, 2),
  sample_count INTEGER DEFAULT 0,

  last_computed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wattz_session_stats_station ON wattz_session_stats_hourly(station_id);
CREATE INDEX IF NOT EXISTS idx_wattz_session_stats_time ON wattz_session_stats_hourly(day_of_week, hour_of_day);

-- ============ INGEST JOBS TABLE ============
CREATE TABLE IF NOT EXISTS wattz_ingest_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source VARCHAR(20) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  last_sync_time TIMESTAMPTZ,
  records_processed INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- ============ PostGIS NEARBY RPC ============
-- Spatial query using ST_DWithin on GIST index (replaces JS-side haversine)
CREATE OR REPLACE FUNCTION wattz_nearby_stations(
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  radius_km DOUBLE PRECISION DEFAULT 10,
  max_results INTEGER DEFAULT 50,
  network_filter TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  external_id VARCHAR,
  source VARCHAR,
  name VARCHAR,
  latitude DECIMAL,
  longitude DECIMAL,
  geohash_6 VARCHAR,
  address TEXT,
  city VARCHAR,
  state VARCHAR,
  zip VARCHAR,
  network VARCHAR,
  plug_types TEXT[],
  stalls_total INTEGER,
  max_power_kw INTEGER,
  pricing_per_kwh DECIMAL,
  pricing_per_minute DECIMAL,
  amenities TEXT[],
  access_restrictions TEXT,
  data_quality_score DECIMAL,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  distance_km DOUBLE PRECISION
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id, s.external_id, s.source, s.name,
    s.latitude, s.longitude, s.geohash_6,
    s.address, s.city, s.state, s.zip,
    s.network, s.plug_types, s.stalls_total, s.max_power_kw,
    s.pricing_per_kwh, s.pricing_per_minute,
    s.amenities, s.access_restrictions, s.data_quality_score,
    s.created_at, s.updated_at,
    ST_Distance(
      s.location,
      ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography
    ) / 1000.0 AS distance_km
  FROM wattz_stations s
  WHERE s.deleted_at IS NULL
    AND ST_DWithin(
      s.location,
      ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography,
      radius_km * 1000
    )
    AND (network_filter IS NULL OR s.network = network_filter)
  ORDER BY distance_km
  LIMIT max_results;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============ ROW LEVEL SECURITY ============
ALTER TABLE wattz_stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE wattz_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE wattz_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE wattz_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Stations are viewable by everyone" ON wattz_stations;
CREATE POLICY "Stations are viewable by everyone" ON wattz_stations
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can view own profile" ON wattz_users;
CREATE POLICY "Users can view own profile" ON wattz_users
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert own profile" ON wattz_users;
CREATE POLICY "Users can insert own profile" ON wattz_users
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Observations are viewable by everyone" ON wattz_observations;
CREATE POLICY "Observations are viewable by everyone" ON wattz_observations
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert observations" ON wattz_observations;
CREATE POLICY "Authenticated users can insert observations" ON wattz_observations
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Users can view own alerts" ON wattz_alerts;
CREATE POLICY "Users can view own alerts" ON wattz_alerts
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert own alerts" ON wattz_alerts;
CREATE POLICY "Users can insert own alerts" ON wattz_alerts
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Users can delete own alerts" ON wattz_alerts;
CREATE POLICY "Users can delete own alerts" ON wattz_alerts
  FOR DELETE USING (true);

-- ============ GRANTS ============
GRANT SELECT ON wattz_stations TO anon, authenticated;
GRANT SELECT, INSERT ON wattz_users TO anon, authenticated;
GRANT SELECT, INSERT ON wattz_observations TO anon, authenticated;
GRANT SELECT, INSERT, DELETE ON wattz_alerts TO anon, authenticated;
GRANT SELECT ON wattz_session_stats_hourly TO anon, authenticated;
GRANT SELECT, INSERT, DELETE ON wattz_session_stats_hourly TO authenticated;
GRANT SELECT, INSERT, UPDATE ON wattz_ingest_jobs TO authenticated;
GRANT SELECT, UPDATE ON wattz_alerts TO authenticated;
GRANT EXECUTE ON FUNCTION wattz_nearby_stations TO anon, authenticated;
