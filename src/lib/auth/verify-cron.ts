/**
 * Shared cron authentication helper.
 * Verifies CRON_SECRET using timing-safe comparison.
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
  if (provided.length !== cronSecret.length) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const isValid = crypto.timingSafeEqual(
    Buffer.from(provided),
    Buffer.from(cronSecret)
  );

  if (!isValid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return null; // Auth passed
}
