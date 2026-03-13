/**
 * GET /api/stations/[id]
 * Get station details with wait time estimate
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db/client';
import { estimateWaitTime } from '@/lib/services/estimator';
import { mapStationRow } from '@/lib/mappers/station';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Fetch station
    const { data: station, error } = await supabase
      .from('wattz_stations')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (error || !station) {
      return NextResponse.json(
        { error: 'Station not found' },
        { status: 404 }
      );
    }

    // Get wait time estimate
    const estimate = await estimateWaitTime(id);

    return NextResponse.json({
      station: mapStationRow(station),
      estimate,
    });
  } catch (error) {
    console.error('Error fetching station:', error);
    return NextResponse.json(
      { error: 'Failed to fetch station' },
      { status: 500 }
    );
  }
}
