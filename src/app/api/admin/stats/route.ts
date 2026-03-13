/**
 * GET /api/admin/stats
 * Returns dashboard statistics: station counts, observation stats,
 * alert summaries, and last ingest job info.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db/client';
import { verifyAdminAuth } from '@/lib/auth/verify-cron';

export async function GET(request: NextRequest) {
  const authError = verifyAdminAuth(request);
  if (authError) return authError;
  try {
    // Run all queries in parallel
    const [stationsRes, obs24hRes, obs7dRes, obsByTypeRes, alertsRes, ingestRes] =
      await Promise.all([
        // Station count + network breakdown
        supabase
          .from('wattz_stations')
          .select('network')
          .is('deleted_at', null),

        // Observations in last 24h
        supabase
          .from('wattz_observations')
          .select('id', { count: 'exact', head: true })
          .gte('observed_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),

        // Observations in last 7d
        supabase
          .from('wattz_observations')
          .select('id', { count: 'exact', head: true })
          .gte('observed_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),

        // Observations by type (last 7d)
        supabase
          .from('wattz_observations')
          .select('observation_type')
          .gte('observed_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),

        // Alert counts by status
        supabase.from('wattz_alerts').select('status'),

        // Last ingest job
        supabase
          .from('wattz_ingest_jobs')
          .select('status, records_processed, completed_at')
          .order('created_at', { ascending: false })
          .limit(1)
          .single(),
      ]);

    // Compute network breakdown from station rows
    const stationRows = stationsRes.data ?? [];
    const networkMap = new Map<string, number>();
    for (const row of stationRows) {
      const net = row.network || 'Unknown';
      networkMap.set(net, (networkMap.get(net) ?? 0) + 1);
    }
    const networks = Array.from(networkMap.entries())
      .map(([network, count]) => ({ network, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Compute observation type breakdown
    const obsRows = obsByTypeRes.data ?? [];
    const typeMap = new Map<string, number>();
    for (const row of obsRows) {
      const t = row.observation_type;
      typeMap.set(t, (typeMap.get(t) ?? 0) + 1);
    }
    const byType = Array.from(typeMap.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count);

    // Compute alert counts by status
    const alertRows = alertsRes.data ?? [];
    const alertCounts = { active: 0, triggered: 0, expired: 0 };
    for (const row of alertRows) {
      if (row.status === 'active') alertCounts.active++;
      else if (row.status === 'triggered') alertCounts.triggered++;
      else if (row.status === 'expired') alertCounts.expired++;
    }

    return NextResponse.json({
      stations: {
        total: stationRows.length,
        networks,
      },
      observations: {
        last24h: obs24hRes.count ?? 0,
        last7d: obs7dRes.count ?? 0,
        byType,
      },
      alerts: alertCounts,
      ingest: {
        lastJob: ingestRes.data ?? null,
      },
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
