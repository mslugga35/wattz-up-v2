/**
 * POST /api/cron/check-alerts
 * Checks active alerts against recent observations and marks triggered.
 * Run every 5 minutes via Vercel cron. Protected by CRON_SECRET.
 *
 * For each active alert, looks for recent observations at the alert's station
 * that indicate stalls are available. If the condition is met, marks the alert
 * as triggered. Also expires alerts past their TTL.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db/client';
import { verifyCronAuth } from '@/lib/auth/verify-cron';

export async function POST(request: NextRequest) {
  const authError = verifyCronAuth(request);
  if (authError) return authError;

  try {
    const now = new Date().toISOString();

    // Step 1: Expire old alerts
    const { data: expired } = await supabase
      .from('wattz_alerts')
      .update({ status: 'expired' })
      .eq('status', 'active')
      .lt('expires_at', now)
      .select('id');

    const expiredCount = expired?.length ?? 0;

    // Step 2: Get remaining active alerts
    const { data: activeAlerts, error: alertsError } = await supabase
      .from('wattz_alerts')
      .select('id, station_id, condition_type, condition_value')
      .eq('status', 'active');

    if (alertsError || !activeAlerts || activeAlerts.length === 0) {
      return NextResponse.json({
        message: 'No active alerts',
        expired: expiredCount,
        triggered: 0,
      });
    }

    // Step 3: For each alert, check recent observations at the station
    const observationCutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString(); // last 30 min
    let triggered = 0;

    for (const alert of activeAlerts) {
      if (alert.condition_type !== 'stalls_available') continue;

      // Look for recent observations indicating availability
      const { data: recentObs } = await supabase
        .from('wattz_observations')
        .select('observation_type, stalls_available')
        .eq('station_id', alert.station_id)
        .gte('observed_at', observationCutoff)
        .order('observed_at', { ascending: false })
        .limit(5);

      if (!recentObs || recentObs.length === 0) continue;

      // Check if any observation shows enough stalls available
      const conditionMet = recentObs.some((obs) => {
        if (obs.stalls_available !== null && obs.stalls_available >= alert.condition_value) {
          return true;
        }
        // 'available' status implies stalls are open
        if (obs.observation_type === 'available') return true;
        return false;
      });

      if (conditionMet) {
        await supabase
          .from('wattz_alerts')
          .update({ status: 'triggered', triggered_at: now })
          .eq('id', alert.id);
        triggered++;
      }
    }

    return NextResponse.json({
      message: 'Alerts checked',
      active: activeAlerts.length,
      expired: expiredCount,
      triggered,
    });
  } catch (error) {
    console.error('Check alerts error:', error);
    return NextResponse.json({ error: 'Failed to check alerts' }, { status: 500 });
  }
}
