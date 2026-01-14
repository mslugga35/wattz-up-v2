/**
 * POST /api/cron/ingest
 * Import stations from AFDC API
 * Protected by CRON_SECRET with timing-safe comparison
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db/client';
import { encodeGeohash6 } from '@/lib/utils/geohash';
import crypto from 'crypto';

const AFDC_API_BASE = 'https://developer.nrel.gov/api/alt-fuel-stations/v1';

interface AFDCStation {
  id: number;
  station_name: string;
  latitude: number;
  longitude: number;
  street_address: string;
  city: string;
  state: string;
  zip: string;
  ev_network: string;
  ev_connector_types: string[];
  ev_dc_fast_num: number;
  ev_level2_evse_num: number;
  ev_pricing: string;
  access_code: string;
}

// Timing-safe token comparison to prevent timing attacks
function verifyToken(provided: string, expected: string): boolean {
  if (provided.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
}

export async function POST(request: NextRequest) {
  // Verify cron secret with timing-safe comparison
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || !authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const providedToken = authHeader.slice(7); // Remove "Bearer "
  if (!verifyToken(providedToken, cronSecret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const apiKey = process.env.AFDC_API_KEY;
  if (!apiKey) {
    // Don't expose which config is missing
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  // Create ingest job record
  const { data: job, error: jobError } = await supabase
    .from('ingest_jobs')
    .insert({ source: 'afdc', status: 'running' })
    .select()
    .single();

  if (jobError) {
    console.error('Failed to create job:', jobError);
  }

  try {
    // Fetch from multiple states
    const states = [
      'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
      'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
      'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
      'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
      'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC'
    ];
    let allStations: AFDCStation[] = [];

    for (const state of states) {
      const url = new URL(`${AFDC_API_BASE}.json`);
      url.searchParams.set('api_key', apiKey);
      url.searchParams.set('fuel_type', 'ELEC');
      url.searchParams.set('status', 'E');
      url.searchParams.set('state', state);
      url.searchParams.set('limit', '200');

      // Fetch state data (don't log state names in production)

      const response = await fetch(url.toString());

      if (!response.ok) {
        console.error(`AFDC API error for ${state}: ${response.status}`);
        continue;
      }

      const data = await response.json();
      allStations = allStations.concat(data.fuel_stations || []);
    }

    const afdcStations: AFDCStation[] = allStations;
    console.log(`Total stations fetched: ${afdcStations.length}`);

    let processed = 0;
    let created = 0;
    let updated = 0;

    for (const afdcStation of afdcStations) {
      const externalId = `afdc-${afdcStation.id}`;
      const geohash6 = encodeGeohash6(afdcStation.latitude, afdcStation.longitude);
      const stallsTotal = (afdcStation.ev_dc_fast_num || 0) + (afdcStation.ev_level2_evse_num || 0);
      const maxPowerKw = afdcStation.ev_dc_fast_num > 0 ? 150 : 19;
      const plugTypes = (afdcStation.ev_connector_types || []).map((t: string) =>
        t.toUpperCase().replace('_', ' ')
      );

      // Check if exists
      const { data: existing } = await supabase
        .from('stations')
        .select('id')
        .eq('external_id', externalId)
        .limit(1);

      if (existing && existing.length > 0) {
        // Update existing
        await supabase
          .from('stations')
          .update({
            name: afdcStation.station_name,
            latitude: afdcStation.latitude,
            longitude: afdcStation.longitude,
            geohash_6: geohash6,
            address: afdcStation.street_address,
            city: afdcStation.city,
            state: afdcStation.state,
            zip: afdcStation.zip,
            network: afdcStation.ev_network,
            plug_types: plugTypes,
            stalls_total: stallsTotal,
            max_power_kw: maxPowerKw,
            access_restrictions: afdcStation.access_code,
            updated_at: new Date().toISOString(),
          })
          .eq('external_id', externalId);
        updated++;
      } else {
        // Create new
        const { error: insertError } = await supabase.from('stations').insert({
          external_id: externalId,
          source: 'afdc',
          name: afdcStation.station_name,
          latitude: afdcStation.latitude,
          longitude: afdcStation.longitude,
          geohash_6: geohash6,
          address: afdcStation.street_address,
          city: afdcStation.city,
          state: afdcStation.state,
          zip: afdcStation.zip,
          network: afdcStation.ev_network,
          plug_types: plugTypes,
          stalls_total: stallsTotal,
          max_power_kw: maxPowerKw,
          access_restrictions: afdcStation.access_code,
        });
        if (insertError) {
          console.error('Insert error for station', externalId, ':', insertError.message);
        } else {
          created++;
        }
      }

      processed++;
    }

    // Update job record
    if (job) {
      await supabase
        .from('ingest_jobs')
        .update({
          status: 'completed',
          records_processed: processed,
          completed_at: new Date().toISOString(),
        })
        .eq('id', job.id);
    }

    return NextResponse.json({
      success: true,
      jobId: job?.id,
      processed,
      created,
      updated,
    });
  } catch (error) {
    console.error('Ingest error:', error);

    if (job) {
      await supabase
        .from('ingest_jobs')
        .update({
          status: 'failed',
          error_message: error instanceof Error ? error.message : 'Unknown error',
          completed_at: new Date().toISOString(),
        })
        .eq('id', job.id);
    }

    // Don't expose internal error details to clients
    return NextResponse.json({ error: 'Ingest failed' }, { status: 500 });
  }
}
