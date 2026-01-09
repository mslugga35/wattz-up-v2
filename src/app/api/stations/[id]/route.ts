/**
 * GET /api/stations/[id]
 * Get station details with wait time estimate
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/client';
import { stations } from '@/lib/db/schema';
import { estimateWaitTime } from '@/lib/services/estimator';
import { eq, isNull } from 'drizzle-orm';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Fetch station
    const result = await db
      .select()
      .from(stations)
      .where(eq(stations.id, id))
      .limit(1);

    if (result.length === 0) {
      return NextResponse.json(
        { error: 'Station not found' },
        { status: 404 }
      );
    }

    const station = result[0];

    // Check if deleted
    if (station.deletedAt) {
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
        externalId: station.externalId,
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
        plugTypes: station.plugTypes || [],
        stallsTotal: station.stallsTotal || 4,
        maxPowerKw: station.maxPowerKw,
        pricingPerKwh: station.pricingPerKwh ? Number(station.pricingPerKwh) : undefined,
        pricingPerMinute: station.pricingPerMinute ? Number(station.pricingPerMinute) : undefined,
        amenities: station.amenities || [],
        accessRestrictions: station.accessRestrictions,
        dataQualityScore: Number(station.dataQualityScore) || 0.5,
        createdAt: station.createdAt,
        updatedAt: station.updatedAt,
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
