/**
 * WATTZ UP v2 - Drizzle Schema
 * PostgreSQL + PostGIS schema for Supabase
 */

import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  decimal,
  boolean,
  timestamp,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// ============ STATIONS TABLE ============

export const stations = pgTable('stations', {
  id: uuid('id').primaryKey().defaultRandom(),
  externalId: varchar('external_id', { length: 255 }).notNull().unique(),
  source: varchar('source', { length: 50 }).notNull(), // 'ocm', 'afdc', 'ea', etc.
  name: varchar('name', { length: 255 }).notNull(),

  // Location - stored as lat/lng, PostGIS geography handled via raw SQL
  latitude: decimal('latitude', { precision: 10, scale: 7 }).notNull(),
  longitude: decimal('longitude', { precision: 10, scale: 7 }).notNull(),
  geohash6: varchar('geohash_6', { length: 6 }).notNull(),

  // Address
  address: text('address'),
  city: varchar('city', { length: 100 }),
  state: varchar('state', { length: 2 }),
  zip: varchar('zip', { length: 10 }),
  country: varchar('country', { length: 2 }).default('US'),

  // Station metadata
  network: varchar('network', { length: 100 }),
  plugTypes: text('plug_types').array(), // ['CCS', 'NACS', 'CHAdeMO']
  stallsTotal: integer('stalls_total').default(4),
  maxPowerKw: integer('max_power_kw'),

  // Pricing
  pricingPerKwh: decimal('pricing_per_kwh', { precision: 5, scale: 3 }),
  pricingPerMinute: decimal('pricing_per_minute', { precision: 5, scale: 3 }),

  // Amenities
  amenities: text('amenities').array(),
  accessRestrictions: text('access_restrictions'),

  // Data quality
  dataQualityScore: decimal('data_quality_score', { precision: 3, scale: 2 }).default('0.5'),

  // Timestamps
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (table) => [
  index('idx_stations_geohash6').on(table.geohash6),
  index('idx_stations_network').on(table.network),
  index('idx_stations_source').on(table.source),
]);

// ============ OBSERVATIONS TABLE ============

export const observations = pgTable('observations', {
  id: uuid('id').primaryKey().defaultRandom(),
  stationId: uuid('station_id').notNull().references(() => stations.id),
  userHash: varchar('user_hash', { length: 64 }).notNull(), // SHA-256 of device_id + salt

  observationType: varchar('observation_type', { length: 20 }).notNull(), // in_queue, plugged_in, done_charging
  queuePosition: integer('queue_position'),
  stallsAvailable: integer('stalls_available'),
  sessionDurationMin: integer('session_duration_min'),

  // Privacy: Only store geohash, not raw coordinates
  geohash6: varchar('geohash_6', { length: 6 }).notNull(),

  trustScore: decimal('trust_score', { precision: 3, scale: 2 }).default('0.5'),
  observedAt: timestamp('observed_at', { withTimezone: true }).defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(), // 7-day TTL
}, (table) => [
  index('idx_observations_station').on(table.stationId),
  index('idx_observations_observed').on(table.observedAt),
  index('idx_observations_type').on(table.observationType),
]);

// ============ USERS TABLE ============

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  deviceId: varchar('device_id', { length: 64 }).notNull().unique(),
  platform: varchar('platform', { length: 10 }).notNull(), // ios, android, web
  trustScore: decimal('trust_score', { precision: 3, scale: 2 }).default('0.5'),
  fcmToken: text('fcm_token'),
  locationConsent: boolean('location_consent').default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  uniqueIndex('idx_users_device').on(table.deviceId),
]);

// ============ ALERTS TABLE ============

export const alerts = pgTable('alerts', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  stationId: uuid('station_id').notNull().references(() => stations.id),

  conditionType: varchar('condition_type', { length: 30 }).notNull(), // stalls_available
  conditionValue: integer('condition_value').notNull(),

  status: varchar('status', { length: 20 }).default('active'), // active, triggered, expired
  fcmToken: text('fcm_token'),

  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(), // 2-hour TTL
  triggeredAt: timestamp('triggered_at', { withTimezone: true }),
}, (table) => [
  index('idx_alerts_user').on(table.userId),
  index('idx_alerts_station').on(table.stationId),
  index('idx_alerts_status').on(table.status),
]);

// ============ SESSION STATS (for estimation) ============

export const sessionStatsHourly = pgTable('session_stats_hourly', {
  id: uuid('id').primaryKey().defaultRandom(),
  stationId: uuid('station_id').notNull().references(() => stations.id),
  dayOfWeek: integer('day_of_week').notNull(), // 0=Sunday, 6=Saturday
  hourOfDay: integer('hour_of_day').notNull(), // 0-23

  medianSessionMin: decimal('median_session_min', { precision: 6, scale: 2 }),
  p75SessionMin: decimal('p75_session_min', { precision: 6, scale: 2 }),
  avgQueueLength: decimal('avg_queue_length', { precision: 4, scale: 2 }),
  sampleCount: integer('sample_count').default(0),

  lastComputedAt: timestamp('last_computed_at', { withTimezone: true }).defaultNow(),
}, (table) => [
  index('idx_session_stats_station').on(table.stationId),
  index('idx_session_stats_time').on(table.dayOfWeek, table.hourOfDay),
]);

// ============ INGEST JOBS (for tracking data imports) ============

export const ingestJobs = pgTable('ingest_jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  source: varchar('source', { length: 20 }).notNull(), // afdc, ocm
  status: varchar('status', { length: 20 }).default('pending'), // pending, running, completed, failed
  lastSyncTime: timestamp('last_sync_time', { withTimezone: true }),
  recordsProcessed: integer('records_processed').default(0),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
});
