/**
 * WATTZ UP v2 - Wait Time Estimator
 * Simplified port from original @wattz-up/api
 *
 * Uses Mode 3 (Fallback Heuristic) for wait time estimation:
 * - Recent crowd reports (last 2 hours) - weight 0.7
 * - Historical patterns (same day-of-week, hour) - weight 0.3
 * - Industry defaults if no data available
 */

import { db, rawQuery } from '@/lib/db/client';
import { observations, sessionStatsHourly, stations } from '@/lib/db/schema';
import { eq, desc, gte, and } from 'drizzle-orm';
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
  last_computed_at: Date;
}

interface StationMeta {
  id: string;
  stallsTotal: number;
  maxPowerKw: number | null;
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
  const result = await db
    .select({
      id: stations.id,
      stallsTotal: stations.stallsTotal,
      maxPowerKw: stations.maxPowerKw,
    })
    .from(stations)
    .where(eq(stations.id, stationId))
    .limit(1);

  if (result.length === 0) return null;

  return {
    id: result[0].id,
    stallsTotal: result[0].stallsTotal ?? 4,
    maxPowerKw: result[0].maxPowerKw,
  };
}

async function getSessionStats(stationId: string): Promise<SessionStatsRecord | null> {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const hourOfDay = now.getHours();

  const result = await db
    .select()
    .from(sessionStatsHourly)
    .where(
      and(
        eq(sessionStatsHourly.stationId, stationId),
        eq(sessionStatsHourly.dayOfWeek, dayOfWeek),
        eq(sessionStatsHourly.hourOfDay, hourOfDay)
      )
    )
    .limit(1);

  if (result.length === 0) return null;

  const row = result[0];
  return {
    station_id: row.stationId,
    day_of_week: row.dayOfWeek,
    hour_of_day: row.hourOfDay,
    median_session_min: Number(row.medianSessionMin) || 0,
    p75_session_min: Number(row.p75SessionMin) || 0,
    avg_queue_length: Number(row.avgQueueLength) || 0,
    sample_count: row.sampleCount ?? 0,
    last_computed_at: row.lastComputedAt ?? new Date(),
  };
}

async function getRecentObservations(stationId: string, hoursBack: number = 2) {
  const cutoff = new Date(Date.now() - hoursBack * 60 * 60 * 1000);

  return db
    .select()
    .from(observations)
    .where(
      and(
        eq(observations.stationId, stationId),
        gte(observations.observedAt, cutoff)
      )
    )
    .orderBy(desc(observations.observedAt))
    .limit(50);
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
        (obs) => obs.observationType === 'in_queue' && obs.queuePosition
      );
      const sessionObs = recentObs.filter(
        (obs) => obs.observationType === 'done_charging' && obs.sessionDurationMin
      );

      if (queueObs.length > 0) {
        const avgQueuePosition = queueObs.reduce(
          (sum, obs) => sum + (obs.queuePosition || 0),
          0
        ) / queueObs.length;

        const sessionTime = sessionStats?.median_session_min || getIndustryDefault(stationMeta.maxPowerKw);
        const stallsFactor = stationMeta.stallsTotal || 4;
        crowdEstimate = (avgQueuePosition * sessionTime) / stallsFactor;
      } else if (sessionObs.length > 0) {
        const avgSessionDuration = sessionObs.reduce(
          (sum, obs) => sum + (obs.sessionDurationMin || 0),
          0
        ) / sessionObs.length;
        crowdEstimate = avgSessionDuration * 0.5;
      }

      const mostRecentObs = recentObs[0];
      const ageMillis = Date.now() - new Date(mostRecentObs.observedAt!).getTime();
      freshnessMinutes = Math.floor(ageMillis / 60000);
    }

    // Step 2: Historical estimate (weight 0.3)
    let historicalEstimate: number | null = null;
    if (sessionStats) {
      sources.push('historical');
      historicalEstimate = sessionStats.median_session_min;

      const statsAgeMillis = Date.now() - sessionStats.last_computed_at.getTime();
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
