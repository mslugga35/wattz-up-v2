/**
 * POST /api/alerts - Create a new alert
 * GET /api/alerts - List user's alerts
 * DELETE /api/alerts?id=xxx - Delete an alert
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { alerts, users, stations } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { z } from 'zod';

const createAlertSchema = z.object({
  stationId: z.string().uuid(),
  conditionType: z.literal('stalls_available'),
  conditionValue: z.number().int().min(1).max(50),
  fcmToken: z.string().optional(),
});

// Alert TTL: 2 hours
const ALERT_TTL_MS = 2 * 60 * 60 * 1000;

export async function POST(request: NextRequest) {
  try {
    const deviceId = request.headers.get('X-Device-Id');
    if (!deviceId) {
      return NextResponse.json(
        { error: 'Missing X-Device-Id header' },
        { status: 401 }
      );
    }

    // Get user
    const userResult = await db
      .select()
      .from(users)
      .where(eq(users.deviceId, deviceId))
      .limit(1);

    if (userResult.length === 0) {
      return NextResponse.json(
        { error: 'User not registered' },
        { status: 401 }
      );
    }

    const user = userResult[0];

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
    const stationResult = await db
      .select()
      .from(stations)
      .where(eq(stations.id, data.stationId))
      .limit(1);

    if (stationResult.length === 0) {
      return NextResponse.json(
        { error: 'Station not found' },
        { status: 404 }
      );
    }

    // Check for existing active alert on same station
    const existingAlert = await db
      .select()
      .from(alerts)
      .where(
        and(
          eq(alerts.userId, user.id),
          eq(alerts.stationId, data.stationId),
          eq(alerts.status, 'active')
        )
      )
      .limit(1);

    if (existingAlert.length > 0) {
      return NextResponse.json(
        { error: 'Already have an active alert for this station' },
        { status: 409 }
      );
    }

    // Create alert
    const expiresAt = new Date(Date.now() + ALERT_TTL_MS);

    const [newAlert] = await db
      .insert(alerts)
      .values({
        userId: user.id,
        stationId: data.stationId,
        conditionType: data.conditionType,
        conditionValue: data.conditionValue,
        fcmToken: data.fcmToken || user.fcmToken,
        status: 'active',
        expiresAt,
      })
      .returning();

    return NextResponse.json({
      alert: {
        id: newAlert.id,
        stationId: newAlert.stationId,
        conditionType: newAlert.conditionType,
        conditionValue: newAlert.conditionValue,
        status: newAlert.status,
        createdAt: newAlert.createdAt,
        expiresAt: newAlert.expiresAt,
      },
      message: 'Alert created successfully',
    });
  } catch (error) {
    console.error('Error creating alert:', error);
    return NextResponse.json(
      { error: 'Failed to create alert' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const deviceId = request.headers.get('X-Device-Id');
    if (!deviceId) {
      return NextResponse.json(
        { error: 'Missing X-Device-Id header' },
        { status: 401 }
      );
    }

    // Get user
    const userResult = await db
      .select()
      .from(users)
      .where(eq(users.deviceId, deviceId))
      .limit(1);

    if (userResult.length === 0) {
      return NextResponse.json(
        { error: 'User not registered' },
        { status: 401 }
      );
    }

    const user = userResult[0];

    // Get user's alerts with station info
    const result = await db
      .select({
        id: alerts.id,
        stationId: alerts.stationId,
        stationName: stations.name,
        conditionType: alerts.conditionType,
        conditionValue: alerts.conditionValue,
        status: alerts.status,
        createdAt: alerts.createdAt,
        expiresAt: alerts.expiresAt,
        triggeredAt: alerts.triggeredAt,
      })
      .from(alerts)
      .leftJoin(stations, eq(alerts.stationId, stations.id))
      .where(eq(alerts.userId, user.id))
      .orderBy(desc(alerts.createdAt))
      .limit(50);

    return NextResponse.json({
      alerts: result,
      count: result.length,
    });
  } catch (error) {
    console.error('Error fetching alerts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch alerts' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const deviceId = request.headers.get('X-Device-Id');
    if (!deviceId) {
      return NextResponse.json(
        { error: 'Missing X-Device-Id header' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const alertId = searchParams.get('id');

    if (!alertId) {
      return NextResponse.json(
        { error: 'Missing alert id' },
        { status: 400 }
      );
    }

    // Get user
    const userResult = await db
      .select()
      .from(users)
      .where(eq(users.deviceId, deviceId))
      .limit(1);

    if (userResult.length === 0) {
      return NextResponse.json(
        { error: 'User not registered' },
        { status: 401 }
      );
    }

    const user = userResult[0];

    // Delete alert (only if owned by user)
    const deleted = await db
      .delete(alerts)
      .where(
        and(
          eq(alerts.id, alertId),
          eq(alerts.userId, user.id)
        )
      )
      .returning();

    if (deleted.length === 0) {
      return NextResponse.json(
        { error: 'Alert not found or not owned by user' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: 'Alert deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting alert:', error);
    return NextResponse.json(
      { error: 'Failed to delete alert' },
      { status: 500 }
    );
  }
}
