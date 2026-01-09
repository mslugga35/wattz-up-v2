/**
 * POST /api/alerts - Create a new alert
 * GET /api/alerts - List user's alerts
 * DELETE /api/alerts?id=xxx - Delete an alert
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db/client';
import { z } from 'zod';

const createAlertSchema = z.object({
  stationId: z.string().uuid(),
  conditionType: z.literal('stalls_available'),
  conditionValue: z.number().int().min(1).max(50),
});

// Alert TTL: 2 hours
const ALERT_TTL_MS = 2 * 60 * 60 * 1000;

export async function POST(request: NextRequest) {
  try {
    const deviceId = request.headers.get('X-Device-Id');
    if (!deviceId) {
      return NextResponse.json({ error: 'Missing X-Device-Id header' }, { status: 401 });
    }

    // Get user
    const { data: user } = await supabase
      .from('users')
      .select('id')
      .eq('device_id', deviceId)
      .single();

    if (!user) {
      return NextResponse.json({ error: 'User not registered' }, { status: 401 });
    }

    // Parse body
    const body = await request.json();
    const parsed = createAlertSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Verify station exists
    const { data: station } = await supabase
      .from('stations')
      .select('id')
      .eq('id', data.stationId)
      .single();

    if (!station) {
      return NextResponse.json({ error: 'Station not found' }, { status: 404 });
    }

    // Create alert
    const expiresAt = new Date(Date.now() + ALERT_TTL_MS).toISOString();

    const { data: newAlert, error } = await supabase
      .from('alerts')
      .insert({
        user_id: user.id,
        station_id: data.stationId,
        condition_type: data.conditionType,
        condition_value: data.conditionValue,
        status: 'active',
        expires_at: expiresAt,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating alert:', error);
      return NextResponse.json({ error: 'Failed to create alert' }, { status: 500 });
    }

    return NextResponse.json({
      alert: { id: newAlert.id },
      message: 'Alert created successfully',
    });
  } catch (error) {
    console.error('Error creating alert:', error);
    return NextResponse.json({ error: 'Failed to create alert' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const deviceId = request.headers.get('X-Device-Id');
    if (!deviceId) {
      return NextResponse.json({ error: 'Missing X-Device-Id header' }, { status: 401 });
    }

    // Get user
    const { data: user } = await supabase
      .from('users')
      .select('id')
      .eq('device_id', deviceId)
      .single();

    if (!user) {
      return NextResponse.json({ error: 'User not registered' }, { status: 401 });
    }

    // Get user's alerts
    const { data: alerts, error } = await supabase
      .from('alerts')
      .select('id, station_id, condition_type, condition_value, status, created_at, expires_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Error fetching alerts:', error);
      return NextResponse.json({ error: 'Failed to fetch alerts' }, { status: 500 });
    }

    return NextResponse.json({
      alerts: alerts || [],
      count: alerts?.length || 0,
    });
  } catch (error) {
    console.error('Error fetching alerts:', error);
    return NextResponse.json({ error: 'Failed to fetch alerts' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const deviceId = request.headers.get('X-Device-Id');
    if (!deviceId) {
      return NextResponse.json({ error: 'Missing X-Device-Id header' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const alertId = searchParams.get('id');

    if (!alertId) {
      return NextResponse.json({ error: 'Missing alert id' }, { status: 400 });
    }

    // Get user
    const { data: user } = await supabase
      .from('users')
      .select('id')
      .eq('device_id', deviceId)
      .single();

    if (!user) {
      return NextResponse.json({ error: 'User not registered' }, { status: 401 });
    }

    // Delete alert
    const { error } = await supabase
      .from('alerts')
      .delete()
      .eq('id', alertId)
      .eq('user_id', user.id);

    if (error) {
      console.error('Error deleting alert:', error);
      return NextResponse.json({ error: 'Failed to delete alert' }, { status: 500 });
    }

    return NextResponse.json({ message: 'Alert deleted successfully' });
  } catch (error) {
    console.error('Error deleting alert:', error);
    return NextResponse.json({ error: 'Failed to delete alert' }, { status: 500 });
  }
}
