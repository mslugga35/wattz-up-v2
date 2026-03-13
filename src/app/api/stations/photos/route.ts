/**
 * GET /api/stations/photos?stationId=xxx
 * POST /api/stations/photos (multipart form data)
 * Station photo upload + listing via Supabase Storage
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db/client';
import { z } from 'zod';

const BUCKET = 'station-photos';
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

// GET — list photos for a station
export async function GET(request: NextRequest) {
  const stationId = request.nextUrl.searchParams.get('stationId');
  if (!stationId) {
    return NextResponse.json({ error: 'stationId required' }, { status: 400 });
  }

  // List files in station folder
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .list(stationId, { limit: 20, sortBy: { column: 'created_at', order: 'desc' } });

  if (error) {
    console.error('Storage list error:', error);
    return NextResponse.json({ error: 'Failed to list photos' }, { status: 500 });
  }

  const photos = (data || [])
    .filter((f) => f.name !== '.emptyFolderPlaceholder')
    .map((f) => {
      const { data: urlData } = supabase.storage
        .from(BUCKET)
        .getPublicUrl(`${stationId}/${f.name}`);
      return {
        name: f.name,
        url: urlData.publicUrl,
        createdAt: f.created_at,
      };
    });

  return NextResponse.json({ photos });
}

// POST — upload a photo
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const stationId = formData.get('stationId') as string | null;
    const deviceId = formData.get('deviceId') as string | null;

    if (!file || !stationId || !deviceId) {
      return NextResponse.json({ error: 'file, stationId, deviceId required' }, { status: 400 });
    }

    // Validate file
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Only JPEG, PNG, WebP allowed' }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File too large (max 5MB)' }, { status: 400 });
    }

    // Generate unique filename
    const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
    const timestamp = Date.now();
    const fileName = `${stationId}/${timestamp}-${deviceId.slice(0, 8)}.${ext}`;

    // Upload to Supabase Storage
    const buffer = Buffer.from(await file.arrayBuffer());
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(BUCKET)
      .getPublicUrl(fileName);

    return NextResponse.json({
      success: true,
      url: urlData.publicUrl,
    });
  } catch (error) {
    console.error('Photo upload error:', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
