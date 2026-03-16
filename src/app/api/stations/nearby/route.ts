/**
 * GET /api/stations/nearby
 * Find charging stations near a location using PostGIS
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db/client';
import { estimateWaitTimeBatch } from '@/lib/services/estimator';
import { mapStationRow } from '@/lib/mappers/station';
import { z } from 'zod';

const querySchema = z.object({
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180),
  radiusKm: z.coerce.number().min(1).max(100).default(10),
  network: z.string().nullish(),
  plugTypes: z.string().max(100).nullish(),
  limit: z.coerce.number().min(1).max(500).default(50),
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
      return NextResponse.json(
        { error: 'Invalid parameters', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { latitude, longitude, radiusKm, network, plugTypes, limit } = parsed.data;

    // Use PostGIS RPC for spatial query (ST_DWithin on GIST index)
    const { data: stations, error } = await supabase.rpc('wattz_nearby_stations', {
      lat: latitude,
      lng: longitude,
      radius_km: radiusKm,
      max_results: limit,
      network_filter: network || null,
    });

    if (error) {
      console.error('Error fetching stations:', error);
      return NextResponse.json(
        { error: 'Failed to fetch stations' },
        { status: 500 }
      );
    }

    // Transform raw Supabase rows to API shape
    type MappedStation = ReturnType<typeof mapStationRow>;
    let nearbyStations: MappedStation[] = (stations || []).map((row: Record<string, unknown>) =>
      mapStationRow(row, (row as Record<string, number>).distance_km)
    );

    // Filter by plug types if specified
    if (plugTypes) {
      const requestedPlugs = plugTypes.split(',').map((p) => p.trim().toUpperCase());
      nearbyStations = nearbyStations.filter((station) =>
        station.plugTypes.some((plug: string) => requestedPlugs.includes(plug.toUpperCase()))
      );
    }

    // Batch estimate wait times
    const stationIds = nearbyStations.map((s) => s.id);
    const estimates = await estimateWaitTimeBatch(stationIds);

    const stationsWithEstimates = nearbyStations.map((station) => ({
      ...station,
      estimate: estimates.get(station.id) ?? null,
    }));

    return NextResponse.json({
      stations: stationsWithEstimates,
      searchCenter: { latitude, longitude },
      radiusKm,
      totalFound: stationsWithEstimates.length,
    });
  } catch (error) {
    console.error('Error fetching nearby stations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stations' },
      { status: 500 }
    );
  }
}
