/**
 * WATTZ UP v2 - Type Definitions
 * Simplified from original @wattz-up/shared package
 */

// ============ ENUMS ============

export const EstimationMode = {
  realtime: 'realtime',     // Mode 1: M/M/c queue (needs 100+ data points)
  hybrid: 'hybrid',         // Mode 2: Hybrid (30-100 data points)
  fallback: 'fallback',     // Mode 3: Fallback heuristic (our MVP)
  no_data: 'no_data',       // No data available
} as const;

export type EstimationMode = typeof EstimationMode[keyof typeof EstimationMode];

export const ObservationType = {
  in_queue: 'in_queue',
  plugged_in: 'plugged_in',
  done_charging: 'done_charging',
  available: 'available',
  short_wait: 'short_wait',
  long_wait: 'long_wait',
  full: 'full',
} as const;

export type ObservationType = typeof ObservationType[keyof typeof ObservationType];

export const AlertStatus = {
  active: 'active',
  triggered: 'triggered',
  expired: 'expired',
} as const;

export type AlertStatus = typeof AlertStatus[keyof typeof AlertStatus];

export type ConfidenceSource = 'crowd_recent' | 'historical' | 'heuristic' | 'realtime_api';

// ============ CORE TYPES ============

export interface Station {
  id: string;
  externalId: string;
  source: string;
  name: string;
  latitude: number;
  longitude: number;
  geohash6: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  network?: string;
  plugTypes: string[];
  stallsTotal: number;
  maxPowerKw?: number;
  pricingPerKwh?: number;
  pricingPerMinute?: number;
  amenities: string[];
  accessRestrictions?: string;
  dataQualityScore: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface StationWithEstimate extends Station {
  estimate: Estimate | null;
  distance?: number; // km from search point
}

export interface Observation {
  id: string;
  stationId: string;
  userHash: string;
  observationType: ObservationType;
  queuePosition?: number;
  stallsAvailable?: number;
  sessionDurationMin?: number;
  geohash6: string;
  trustScore: number;
  observedAt: Date;
  expiresAt: Date;
}

export interface Estimate {
  stationId: string;
  etaWaitMinutes: number | null;
  confidence: number;
  mode: EstimationMode;
  sourcesUsed: ConfidenceSource[];
  computedAt: Date;
}

export interface Alert {
  id: string;
  userId: string;
  stationId: string;
  conditionType: 'stalls_available';
  conditionValue: number;
  status: AlertStatus;
  fcmToken?: string;
  createdAt: Date;
  expiresAt: Date;
  triggeredAt?: Date;
}

export interface User {
  id: string;
  deviceId: string;
  platform: 'ios' | 'android' | 'web';
  trustScore: number;
  fcmToken?: string;
  locationConsent: boolean;
  createdAt: Date;
}

// ============ API REQUEST/RESPONSE TYPES ============

export interface NearbyStationsRequest {
  latitude: number;
  longitude: number;
  radiusKm?: number;
  network?: string;
  plugTypes?: string[];
  limit?: number;
}

export interface NearbyStationsResponse {
  stations: StationWithEstimate[];
  searchCenter: { latitude: number; longitude: number };
  radiusKm: number;
  totalFound: number;
}

export interface SubmitObservationRequest {
  stationId: string;
  deviceId: string;
  observationType: ObservationType;
  queuePosition?: number | null;
  stallsAvailable?: number | null;
  sessionDurationMin?: number | null;
}

export interface CreateAlertRequest {
  stationId: string;
  conditionType: 'stalls_available';
  conditionValue: number;
  fcmToken?: string;
}

// ============ INDUSTRY DEFAULTS ============

export const INDUSTRY_DEFAULTS = {
  DC_FAST: {
    medianSessionMin: 25,
    p75SessionMin: 35,
    avgQueueLength: 0.5,
  },
  LEVEL_2: {
    medianSessionMin: 120,
    p75SessionMin: 180,
    avgQueueLength: 0.2,
  },
} as const;
