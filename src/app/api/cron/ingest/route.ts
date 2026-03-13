/**
 * POST /api/cron/ingest
 * Import stations from AFDC API
 * Protected by CRON_SECRET with timing-safe comparison
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/db/client';
import { encodeGeohash6 } from '@/lib/utils/geohash';
import { verifyCronAuth } from '@/lib/auth/verify-cron';

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

export async function POST(request: NextRequest) {
  const authError = verifyCronAuth(request);
  if (authError) return authError;

  const apiKey = process.env.AFDC_API_KEY;
  if (!apiKey) {
    // Don't expose which config is missing
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  // Create ingest job record
  const { data: job, error: jobError } = await supabase
    .from('wattz_ingest_jobs')
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

    let processed = 0;
    const BATCH_SIZE = 100;

    // Process in batches using upsert (eliminates N+1 queries)
    for (let i = 0; i < allStations.length; i += BATCH_SIZE) {
      const batch = allStations.slice(i, i + BATCH_SIZE);

      const rows = batch.map((afdcStation) => {
        const stallsTotal = (afdcStation.ev_dc_fast_num || 0) + (afdcStation.ev_level2_evse_num || 0);
        return {
          external_id: `afdc-${afdcStation.id}`,
          source: 'afdc',
          name: afdcStation.station_name,
          latitude: afdcStation.latitude,
          longitude: afdcStation.longitude,
          geohash_6: encodeGeohash6(afdcStation.latitude, afdcStation.longitude),
          address: afdcStation.street_address,
          city: afdcStation.city,
          state: afdcStation.state,
          zip: afdcStation.zip,
          network: afdcStation.ev_network,
          plug_types: (afdcStation.ev_connector_types || []).map((t: string) =>
            t.toUpperCase().replace('_', ' ')
          ),
          stalls_total: stallsTotal,
          max_power_kw: afdcStation.ev_dc_fast_num > 0 ? 150 : 19,
          access_restrictions: afdcStation.access_code,
          updated_at: new Date().toISOString(),
        };
      });

      const { error: upsertError } = await supabase
        .from('wattz_stations')
        .upsert(rows, { onConflict: 'external_id' });

      if (upsertError) {
        console.error(`Batch upsert error at offset ${i}:`, upsertError.message);
      }

      processed += batch.length;
    }

    // Update job record
    if (job) {
      await supabase
        .from('wattz_ingest_jobs')
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
    });
  } catch (error) {
    console.error('Ingest error:', error);

    if (job) {
      await supabase
        .from('wattz_ingest_jobs')
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
