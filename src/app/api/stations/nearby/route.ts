/**
 * GET /api/stations/nearby
 * Find charging stations near a location
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db/client';
import { haversineDistance } from '@/lib/utils/geohash';
import { z } from 'zod';

const querySchema = z.object({
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  radiusKm: z.coerce.number().min(1).max(100).default(10),
  network: z.string().nullish(),
  plugTypes: z.string().nullish(),
  limit: z.coerce.number().min(1).max(100).default(20),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const parsed = querySchema.safeParse({
      latitude: searchParams.get('latitude'),
      longitude: searchParams.get('longitude'),
      radiusKm: searchParams.get('radiusKm') ?? 10,
      network: searchParams.get('network'),
      plugTypes: searchParams.get('plugTypes'),
      limit: searchParams.get('limit') ?? 20,
    });

    if (!parsed.success) {
      console.error('Validation error:', parsed.error.flatten());
      return NextResponse.json(
        { error: 'Invalid parameters', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    console.log('Fetching stations near:', parsed.data);

    const { latitude, longitude, radiusKm, network, plugTypes, limit } = parsed.data;

    // Query stations from Supabase
    let query = supabase
      .from('stations')
      .select('*')
      .is('deleted_at', null);

    // Apply network filter if specified
    if (network) {
      query = query.eq('network', network);
    }

    // Get all stations (we'll filter by distance in JS)
    // For production, use PostGIS RPC function
    const { data: stations, error } = await query.limit(500);

    if (error) {
      console.error('Error fetching stations:', error);
      return NextResponse.json(
        { error: 'Failed to fetch stations', details: error.message },
        { status: 500 }
      );
    }

    // Filter by distance and transform
    const nearbyStations = (stations || [])
      .map((station) => {
        const distance = haversineDistance(
          latitude,
          longitude,
          Number(station.latitude),
          Number(station.longitude)
        );
        return {
          id: station.id,
          externalId: station.external_id,
          source: station.source,
          name: station.name,
          latitude: Number(station.latitude),
          longitude: Number(station.longitude),
          geohash6: station.geohash_6,
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
          createdAt: new Date(station.created_at),
          updatedAt: new Date(station.updated_at),
          distance,
          estimate: null, // TODO: Add estimation
        };
      })
      .filter((station) => station.distance <= radiusKm)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, limit);

    // Filter by plug types if specified
    let filteredStations = nearbyStations;
    if (plugTypes) {
      const requestedPlugs = plugTypes.split(',').map((p) => p.trim().toUpperCase());
      filteredStations = nearbyStations.filter((station) =>
        station.plugTypes.some((plug: string) => requestedPlugs.includes(plug.toUpperCase()))
      );
    }

    return NextResponse.json({
      stations: filteredStations,
      searchCenter: { latitude, longitude },
      radiusKm,
      totalFound: filteredStations.length,
    });
  } catch (error) {
    console.error('Error fetching nearby stations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stations' },
      { status: 500 }
    );
  }
}
