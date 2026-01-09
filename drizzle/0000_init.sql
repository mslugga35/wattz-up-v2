-- WATTZ UP v2 - Database Schema
-- Run this in Supabase SQL Editor

-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- ============ STATIONS TABLE ============
CREATE TABLE IF NOT EXISTS stations (
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

CREATE INDEX IF NOT EXISTS idx_stations_geohash6 ON stations(geohash_6);
CREATE INDEX IF NOT EXISTS idx_stations_network ON stations(network);
CREATE INDEX IF NOT EXISTS idx_stations_source ON stations(source);

-- Add PostGIS geography column for spatial queries
ALTER TABLE stations ADD COLUMN IF NOT EXISTS location GEOGRAPHY(POINT, 4326);

-- Create trigger to auto-update location from lat/lng
CREATE OR REPLACE FUNCTION update_station_location()
RETURNS TRIGGER AS $$
BEGIN
  NEW.location = ST_SetSRID(ST_MakePoint(NEW.longitude::float, NEW.latitude::float), 4326)::geography;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS stations_location_trigger ON stations;
CREATE TRIGGER stations_location_trigger
  BEFORE INSERT OR UPDATE ON stations
  FOR EACH ROW
  EXECUTE FUNCTION update_station_location();

-- Spatial index for nearby queries
CREATE INDEX IF NOT EXISTS idx_stations_location ON stations USING GIST(location);

-- ============ USERS TABLE ============
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id VARCHAR(64) UNIQUE NOT NULL,
  platform VARCHAR(10) NOT NULL,
  trust_score DECIMAL(3, 2) DEFAULT 0.5,
  fcm_token TEXT,
  location_consent BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_device ON users(device_id);

-- ============ OBSERVATIONS TABLE ============
CREATE TABLE IF NOT EXISTS observations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id UUID NOT NULL REFERENCES stations(id),
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

CREATE INDEX IF NOT EXISTS idx_observations_station ON observations(station_id);
CREATE INDEX IF NOT EXISTS idx_observations_observed ON observations(observed_at);
CREATE INDEX IF NOT EXISTS idx_observations_type ON observations(observation_type);

-- ============ ALERTS TABLE ============
CREATE TABLE IF NOT EXISTS alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  station_id UUID NOT NULL REFERENCES stations(id),

  condition_type VARCHAR(30) NOT NULL,
  condition_value INTEGER NOT NULL,

  status VARCHAR(20) DEFAULT 'active',
  fcm_token TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  triggered_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_alerts_user ON alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_alerts_station ON alerts(station_id);
CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status);

-- ============ SESSION STATS TABLE ============
CREATE TABLE IF NOT EXISTS session_stats_hourly (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  station_id UUID NOT NULL REFERENCES stations(id),
  day_of_week INTEGER NOT NULL,
  hour_of_day INTEGER NOT NULL,

  median_session_min DECIMAL(6, 2),
  p75_session_min DECIMAL(6, 2),
  avg_queue_length DECIMAL(4, 2),
  sample_count INTEGER DEFAULT 0,

  last_computed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_session_stats_station ON session_stats_hourly(station_id);
CREATE INDEX IF NOT EXISTS idx_session_stats_time ON session_stats_hourly(day_of_week, hour_of_day);

-- ============ INGEST JOBS TABLE ============
CREATE TABLE IF NOT EXISTS ingest_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source VARCHAR(20) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  last_sync_time TIMESTAMPTZ,
  records_processed INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- ============ ROW LEVEL SECURITY ============
-- Enable RLS on all tables
ALTER TABLE stations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

-- Public read access to stations
CREATE POLICY "Stations are viewable by everyone" ON stations
  FOR SELECT USING (true);

-- Users can only see their own data
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (true);

CREATE POLICY "Users can insert own profile" ON users
  FOR INSERT WITH CHECK (true);

-- Observations are public read, authenticated write
CREATE POLICY "Observations are viewable by everyone" ON observations
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert observations" ON observations
  FOR INSERT WITH CHECK (true);

-- Alerts: users can manage their own
CREATE POLICY "Users can view own alerts" ON alerts
  FOR SELECT USING (true);

CREATE POLICY "Users can insert own alerts" ON alerts
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can delete own alerts" ON alerts
  FOR DELETE USING (true);

-- Grant access to anon and authenticated roles
GRANT SELECT ON stations TO anon, authenticated;
GRANT SELECT, INSERT ON users TO anon, authenticated;
GRANT SELECT, INSERT ON observations TO anon, authenticated;
GRANT SELECT, INSERT, DELETE ON alerts TO anon, authenticated;
GRANT SELECT ON session_stats_hourly TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON ingest_jobs TO authenticated;

-- Done!
SELECT 'Schema created successfully!' as status;
