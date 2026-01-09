/**
 * GET /api/stations/[id]
 * Get station details with wait time estimate
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db/client';
import { estimateWaitTime } from '@/lib/services/estimator';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Fetch station
    const { data: station, error } = await supabase
      .from('stations')
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
      station: {
        id: station.id,
        externalId: station.external_id,
        source: station.source,
        name: station.name,
        latitude: Number(station.latitude),
        longitude: Number(station.longitude),
        geohash6: station.geohash6,
        address: station.address,
        city: station.city,
        state: station.state,
        zip: station.zip,
        network: station.network,
        plugTypes: station.plug_types || [],
        stallsTotal: station.stalls_total || 4,
        maxPowerKw: station.max_power_kw,
        pricingPerKwh: station.pricing_per_kwh ? Number(station.pricing_per_kwh) : undefined,
        pricingPerMinute: station.pricing_per_minute ? Number(station.pricing_per_minute) : undefined,
        amenities: station.amenities || [],
        accessRestrictions: station.access_restrictions,
        dataQualityScore: Number(station.data_quality_score) || 0.5,
        createdAt: station.created_at,
        updatedAt: station.updated_at,
      },
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
