/**
 * WATTZ UP v2 - Wait Time Estimator
 * Simplified port from original @wattz-up/api
 *
 * Uses Mode 3 (Fallback Heuristic) for wait time estimation:
 * - Recent crowd reports (last 2 hours) - weight 0.7
 * - Historical patterns (same day-of-week, hour) - weight 0.3
 * - Industry defaults if no data available
 */

import { supabase } from '@/lib/db/client';
import {
  Estimate,
  EstimationMode,
  ConfidenceSource,
  INDUSTRY_DEFAULTS,
} from '@/types';

// ============ TYPES ============

interface SessionStatsRecord {
  station_id: string;
  day_of_week: number;
  hour_of_day: number;
  median_session_min: number;
  p75_session_min: number;
  avg_queue_length: number;
  sample_count: number;
  last_computed_at: string;
}

interface StationMeta {
  id: string;
  stallsTotal: number;
  maxPowerKw: number | null;
}

interface ObservationRecord {
  id: string;
  station_id: string;
  observation_type: string;
  queue_position: number | null;
  session_duration_min: number | null;
  observed_at: string;
}

// ============ HELPERS ============

function getPopularityMultiplier(stallsTotal: number): number {
  if (stallsTotal <= 4) return 0.8;
  if (stallsTotal <= 8) return 1.0;
  return 1.2;
}

function getIndustryDefault(maxPowerKw: number | null): number {
  if (!maxPowerKw || maxPowerKw < 50) {
    return INDUSTRY_DEFAULTS.LEVEL_2.medianSessionMin;
  }
  return INDUSTRY_DEFAULTS.DC_FAST.medianSessionMin;
}

function calculateConfidence(
  sources: ConfidenceSource[],
  freshnessMinutes: number,
  dataPointsLast24h: number
): number {
  let baseConfidence = 0.3;

  if (sources.includes('crowd_recent')) {
    baseConfidence = 0.5;
  } else if (sources.includes('historical')) {
    baseConfidence = 0.4;
  }

  const freshnessFactor = Math.max(0.3, 1 - freshnessMinutes / 60);
  const signalStrength = Math.min(1.0, dataPointsLast24h / 20);
  const confidence = baseConfidence * freshnessFactor * signalStrength;

  return Math.max(0.3, Math.min(0.6, confidence));
}

// ============ DATA FETCHERS ============

async function getStationMetadata(stationId: string): Promise<StationMeta | null> {
  const { data, error } = await supabase
    .from('stations')
    .select('id, stalls_total, max_power_kw')
    .eq('id', stationId)
    .single();

  if (error || !data) return null;

  return {
    id: data.id,
    stallsTotal: data.stalls_total ?? 4,
    maxPowerKw: data.max_power_kw,
  };
}

async function getSessionStats(stationId: string): Promise<SessionStatsRecord | null> {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const hourOfDay = now.getHours();

  const { data, error } = await supabase
    .from('session_stats_hourly')
    .select('*')
    .eq('station_id', stationId)
    .eq('day_of_week', dayOfWeek)
    .eq('hour_of_day', hourOfDay)
    .single();

  if (error || !data) return null;

  return {
    station_id: data.station_id,
    day_of_week: data.day_of_week,
    hour_of_day: data.hour_of_day,
    median_session_min: Number(data.median_session_min) || 0,
    p75_session_min: Number(data.p75_session_min) || 0,
    avg_queue_length: Number(data.avg_queue_length) || 0,
    sample_count: data.sample_count ?? 0,
    last_computed_at: data.last_computed_at ?? new Date().toISOString(),
  };
}

async function getRecentObservations(stationId: string, hoursBack: number = 2): Promise<ObservationRecord[]> {
  const cutoff = new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('observations')
    .select('id, station_id, observation_type, queue_position, session_duration_min, observed_at')
    .eq('station_id', stationId)
    .gte('observed_at', cutoff)
    .order('observed_at', { ascending: false })
    .limit(50);

  if (error || !data) return [];

  return data as ObservationRecord[];
}

// ============ MAIN ESTIMATOR ============

export async function estimateWaitTime(stationId: string): Promise<Estimate> {
  try {
    const stationMeta = await getStationMetadata(stationId);
    if (!stationMeta) {
      return {
        stationId,
        etaWaitMinutes: null,
        confidence: 0,
        mode: EstimationMode.no_data,
        sourcesUsed: [],
        computedAt: new Date(),
      };
    }

    const recentObs = await getRecentObservations(stationId, 2);
    const sessionStats = await getSessionStats(stationId);

    const dataPointsLast24h = recentObs.length;
    const sources: ConfidenceSource[] = [];
    let waitMinutes: number | null = null;
    let freshnessMinutes = 60;

    // Step 1: Crowd-based estimate (weight 0.7)
    let crowdEstimate: number | null = null;
    if (recentObs.length > 0) {
      sources.push('crowd_recent');

      const queueObs = recentObs.filter(
        (obs) => obs.observation_type === 'in_queue' && obs.queue_position
      );
      const sessionObs = recentObs.filter(
        (obs) => obs.observation_type === 'done_charging' && obs.session_duration_min
      );

      if (queueObs.length > 0) {
        const avgQueuePosition = queueObs.reduce(
          (sum, obs) => sum + (obs.queue_position || 0),
          0
        ) / queueObs.length;

        const sessionTime = sessionStats?.median_session_min || getIndustryDefault(stationMeta.maxPowerKw);
        const stallsFactor = stationMeta.stallsTotal || 4;
        crowdEstimate = (avgQueuePosition * sessionTime) / stallsFactor;
      } else if (sessionObs.length > 0) {
        const avgSessionDuration = sessionObs.reduce(
          (sum, obs) => sum + (obs.session_duration_min || 0),
          0
        ) / sessionObs.length;
        crowdEstimate = avgSessionDuration * 0.5;
      }

      const mostRecentObs = recentObs[0];
      const ageMillis = Date.now() - new Date(mostRecentObs.observed_at).getTime();
      freshnessMinutes = Math.floor(ageMillis / 60000);
    }

    // Step 2: Historical estimate (weight 0.3)
    let historicalEstimate: number | null = null;
    if (sessionStats) {
      sources.push('historical');
      historicalEstimate = sessionStats.median_session_min;

      const statsAgeMillis = Date.now() - new Date(sessionStats.last_computed_at).getTime();
      const statsAgeMinutes = Math.floor(statsAgeMillis / 60000);
      if (statsAgeMinutes < freshnessMinutes) {
        freshnessMinutes = statsAgeMinutes;
      }
    }

    // Step 3: Weighted average or fallback
    if (crowdEstimate !== null && historicalEstimate !== null) {
      waitMinutes = crowdEstimate * 0.7 + historicalEstimate * 0.3;
    } else if (crowdEstimate !== null) {
      waitMinutes = crowdEstimate;
    } else if (historicalEstimate !== null) {
      waitMinutes = historicalEstimate * 0.5;
    } else {
      sources.push('heuristic');
      const defaultSession = getIndustryDefault(stationMeta.maxPowerKw);
      waitMinutes = defaultSession * 0.5;
    }

    // Step 4: Popularity adjustment
    const popularityMultiplier = getPopularityMultiplier(stationMeta.stallsTotal);
    waitMinutes = Math.ceil(waitMinutes * popularityMultiplier);

    // Step 5: Confidence score
    const confidence = calculateConfidence(sources, freshnessMinutes, dataPointsLast24h);

    return {
      stationId,
      etaWaitMinutes: waitMinutes,
      confidence,
      mode: EstimationMode.fallback,
      sourcesUsed: sources,
      computedAt: new Date(),
    };
  } catch (error) {
    console.error('Estimation failed:', error);
    return {
      stationId,
      etaWaitMinutes: null,
      confidence: 0,
      mode: EstimationMode.no_data,
      sourcesUsed: [],
      computedAt: new Date(),
    };
  }
}

export async function estimateWaitTimeBatch(stationIds: string[]): Promise<Map<string, Estimate>> {
  const estimates = new Map<string, Estimate>();

  await Promise.all(
    stationIds.map(async (id) => {
      const estimate = await estimateWaitTime(id);
      estimates.set(id, estimate);
    })
  );

  return estimates;
}
