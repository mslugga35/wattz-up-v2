/**
 * POST /api/cron/compute-stats
 * Aggregates recent observations into wattz_session_stats_hourly.
 * Run daily via Vercel cron. Protected by CRON_SECRET.
 *
 * For each station with observations in the last 7 days, computes
 * median session duration, p75, and avg queue length per (day, hour) bucket.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db/client';
import crypto from 'crypto';

function verifyToken(provided: string, expected: string): boolean {
  if (provided.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || !authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!verifyToken(authHeader.slice(7), cronSecret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Fetch observations from the last 7 days that have session data
    const { data: observations, error } = await supabase
      .from('wattz_observations')
      .select('station_id, observation_type, queue_position, session_duration_min, observed_at')
      .gte('observed_at', cutoff)
      .order('observed_at', { ascending: true })
      .limit(10000);

    if (error) {
      console.error('Failed to fetch observations:', error);
      return NextResponse.json({ error: 'Failed to fetch observations' }, { status: 500 });
    }

    if (!observations || observations.length === 0) {
      return NextResponse.json({ message: 'No observations to process', upserted: 0 });
    }

    // Group by station + day_of_week + hour_of_day
    const buckets = new Map<string, {
      stationId: string;
      dayOfWeek: number;
      hourOfDay: number;
      sessionDurations: number[];
      queuePositions: number[];
    }>();

    for (const obs of observations) {
      const dt = new Date(obs.observed_at);
      const key = `${obs.station_id}-${dt.getDay()}-${dt.getHours()}`;

      if (!buckets.has(key)) {
        buckets.set(key, {
          stationId: obs.station_id,
          dayOfWeek: dt.getDay(),
          hourOfDay: dt.getHours(),
          sessionDurations: [],
          queuePositions: [],
        });
      }

      const bucket = buckets.get(key)!;
      if (obs.session_duration_min) bucket.sessionDurations.push(obs.session_duration_min);
      if (obs.queue_position !== null) bucket.queuePositions.push(obs.queue_position);

      // Infer session duration from status types
      if (!obs.session_duration_min && obs.observation_type) {
        const inferredMinutes: Record<string, number> = {
          available: 0,
          short_wait: 8,
          long_wait: 25,
          full: 45,
        };
        if (inferredMinutes[obs.observation_type] !== undefined) {
          bucket.sessionDurations.push(inferredMinutes[obs.observation_type]);
        }
      }
    }

    // Compute stats and upsert
    let upserted = 0;
    for (const bucket of buckets.values()) {
      if (bucket.sessionDurations.length === 0) continue;

      const sorted = bucket.sessionDurations.sort((a, b) => a - b);
      const medianIdx = Math.floor(sorted.length / 2);
      const p75Idx = Math.floor(sorted.length * 0.75);
      const avgQueue = bucket.queuePositions.length > 0
        ? bucket.queuePositions.reduce((a, b) => a + b, 0) / bucket.queuePositions.length
        : 0;

      // Delete existing row for this bucket, then insert fresh
      await supabase
        .from('wattz_session_stats_hourly')
        .delete()
        .eq('station_id', bucket.stationId)
        .eq('day_of_week', bucket.dayOfWeek)
        .eq('hour_of_day', bucket.hourOfDay);

      const { error: insertError } = await supabase
        .from('wattz_session_stats_hourly')
        .insert({
          station_id: bucket.stationId,
          day_of_week: bucket.dayOfWeek,
          hour_of_day: bucket.hourOfDay,
          median_session_min: sorted[medianIdx],
          p75_session_min: sorted[p75Idx] ?? sorted[medianIdx],
          avg_queue_length: Number(avgQueue.toFixed(2)),
          sample_count: sorted.length,
          last_computed_at: new Date().toISOString(),
        });

      if (!insertError) upserted++;
    }

    return NextResponse.json({
      message: 'Stats computed',
      observationsProcessed: observations.length,
      bucketsComputed: buckets.size,
      upserted,
    });
  } catch (error) {
    console.error('Compute stats error:', error);
    return NextResponse.json({ error: 'Failed to compute stats' }, { status: 500 });
  }
}
