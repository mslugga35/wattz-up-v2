/**
 * POST /api/users/register
 * Register a new anonymous device
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db/client';
import { z } from 'zod';

const registerSchema = z.object({
  deviceId: z.string().min(32).max(64),
  platform: z.enum(['ios', 'android', 'web']),
  fcmToken: z.string().optional(),
  locationConsent: z.boolean().default(false),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Check if device already registered
    const { data: existing, error: selectError } = await supabase
      .from('users')
      .select('*')
      .eq('device_id', data.deviceId)
      .limit(1);

    if (selectError) {
      console.error('Error checking user:', selectError);
      return NextResponse.json(
        { error: 'Database error', details: selectError.message },
        { status: 500 }
      );
    }

    if (existing && existing.length > 0) {
      // Return existing user
      return NextResponse.json({
        user: {
          id: existing[0].id,
          deviceId: existing[0].device_id,
          platform: existing[0].platform,
          trustScore: Number(existing[0].trust_score),
          createdAt: existing[0].created_at,
        },
        message: 'Device already registered',
      });
    }

    // Create new user
    const { data: newUser, error: insertError } = await supabase
      .from('users')
      .insert({
        device_id: data.deviceId,
        platform: data.platform,
        fcm_token: data.fcmToken,
        location_consent: data.locationConsent,
        trust_score: 0.5,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating user:', insertError);
      return NextResponse.json(
        { error: 'Failed to create user', details: insertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      user: {
        id: newUser.id,
        deviceId: newUser.device_id,
        platform: newUser.platform,
        trustScore: Number(newUser.trust_score),
        createdAt: newUser.created_at,
      },
      message: 'Device registered successfully',
    });
  } catch (error) {
    console.error('Error registering user:', error);
    return NextResponse.json(
      { error: 'Failed to register device' },
      { status: 500 }
    );
  }
}
