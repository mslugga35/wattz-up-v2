/**
 * GET /api/health
 * Health check endpoint
 */

import { NextResponse } from 'next/server';
import { supabase } from '@/lib/db/client';

export async function GET() {
  const checks: Record<string, { status: string; latency?: number; error?: string }> = {};

  // Check database
  const dbStart = Date.now();
  try {
    const { error } = await supabase.from('stations').select('id').limit(1);
    if (error) throw error;
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
