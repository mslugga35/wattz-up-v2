/**
 * GET /api/health
 * Health check endpoint
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { stations } from '@/lib/db/schema';
import { sql } from 'drizzle-orm';

export async function GET() {
  const checks: Record<string, { status: string; latency?: number; error?: string }> = {};

  // Check database
  const dbStart = Date.now();
  try {
    const result = await db.select({ count: sql<number>`count(*)` }).from(stations);
    checks.database = {
      status: 'healthy',
      latency: Date.now() - dbStart,
    };
  } catch (error) {
    checks.database = {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }

  // Overall status
  const isHealthy = Object.values(checks).every((c) => c.status === 'healthy');

  return NextResponse.json(
    {
      status: isHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      version: '2.0.0',
      checks,
    },
    { status: isHealthy ? 200 : 503 }
  );
}
