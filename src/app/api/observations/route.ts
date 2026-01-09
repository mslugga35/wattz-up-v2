/**
 * POST /api/observations
 * Submit a crowdsourced observation
 *
 * GET /api/observations?stationId=xxx
 * Get recent observations for a station
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db/client';
import { z } from 'zod';
import crypto from 'crypto';

const submitSchema = z.object({
  stationId: z.string().uuid(),
  deviceId: z.string(),
  observationType: z.enum(['available', 'short_wait', 'long_wait', 'full']),
  queuePosition: z.number().int().min(0).max(50).nullish(),
  stallsAvailable: z.number().int().min(0).max(100).nullish(),
});

// Simple hash for privacy
function hashDeviceId(deviceId: string): string {
  return crypto.createHash('sha256').update(deviceId + 'wattz-salt').digest('hex').slice(0, 16);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = submitSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Get station for geohash
    const { data: station } = await supabase
      .from('stations')
      .select('geohash_6')
      .eq('id', data.stationId)
      .single();

    if (!station) {
      return NextResponse.json({ error: 'Station not found' }, { status: 404 });
    }

    // Create observation
    const userHash = hashDeviceId(data.deviceId);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: newObs, error } = await supabase
      .from('observations')
      .insert({
        station_id: data.stationId,
        user_hash: userHash,
        observation_type: data.observationType,
        queue_position: data.queuePosition || null,
        stalls_available: data.stallsAvailable || null,
        geohash_6: station.geohash_6,
        trust_score: 0.5,
        expires_at: expiresAt,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating observation:', error);
      return NextResponse.json({ error: 'Failed to submit' }, { status: 500 });
    }

    return NextResponse.json({
      observation: { id: newObs.id },
      message: 'Thanks for reporting!',
    });
  } catch (error) {
    console.error('Error submitting observation:', error);
    return NextResponse.json({ error: 'Failed to submit observation' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const stationId = searchParams.get('stationId');

    if (!stationId) {
      return NextResponse.json({ error: 'Missing stationId' }, { status: 400 });
    }

    // Get recent observations (last 24 hours)
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: observations, error } = await supabase
      .from('observations')
      .select('id, observation_type, queue_position, stalls_available, observed_at, trust_score')
      .eq('station_id', stationId)
      .gte('observed_at', cutoff)
      .order('observed_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Error fetching observations:', error);
      return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
    }

    return NextResponse.json({
      observations: observations || [],
      stationId,
      timeRange: '24h',
    });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Failed to fetch observations' }, { status: 500 });
  }
}
