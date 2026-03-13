/**
 * Shared cron/admin authentication helper.
 * Verifies CRON_SECRET using timing-safe comparison.
 * Both sides are SHA-256 hashed to normalize length and prevent timing leaks.
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

/**
 * Verify the cron secret from the Authorization header.
 * Returns null if valid, or a 401 NextResponse if invalid.
 */
export function verifyCronAuth(request: NextRequest): NextResponse | null {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || !authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const provided = authHeader.slice(7);

  // Hash both sides to fixed length — eliminates timing side-channel from length check
  const a = crypto.createHash('sha256').update(provided).digest();
  const b = crypto.createHash('sha256').update(cronSecret).digest();

  if (!crypto.timingSafeEqual(a, b)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return null;
}

/**
 * Verify admin access via Bearer header OR ?token= query param.
 * Used by the admin dashboard which can't set headers from client-side fetch.
 */
export function verifyAdminAuth(request: NextRequest): NextResponse | null {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Try Bearer header first
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return verifyCronAuth(request);
  }

  // Fall back to ?token= query param
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const a = crypto.createHash('sha256').update(token).digest();
  const b = crypto.createHash('sha256').update(cronSecret).digest();

  if (!crypto.timingSafeEqual(a, b)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return null;
}
