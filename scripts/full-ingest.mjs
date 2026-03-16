/**
 * Full AFDC station ingest — runs locally (no timeout)
 * Paginates through ALL stations for every US state
 * Usage: npx dotenv -e .env.local -- node scripts/full-ingest.mjs
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const AFDC_KEY = process.env.AFDC_API_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY || !AFDC_KEY) {
  console.error('Missing env vars. Run from project root with .env.local');
  process.exit(1);
}
const AFDC_BASE = 'https://developer.nrel.gov/api/alt-fuel-stations/v1.json';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA',
  'HI','ID','IL','IN','IA','KS','KY','LA','ME','MD',
  'MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC',
  'SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC'
];

// Geohash encoding (simplified 6-char)
function encodeGeohash6(lat, lng) {
  const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';
  let minLat = -90, maxLat = 90, minLng = -180, maxLng = 180;
  let hash = '';
  let isLng = true;
  let bit = 0;
  let ch = 0;

  while (hash.length < 6) {
    if (isLng) {
      const mid = (minLng + maxLng) / 2;
      if (lng >= mid) { ch = ch * 2 + 1; minLng = mid; }
      else { ch = ch * 2; maxLng = mid; }
    } else {
      const mid = (minLat + maxLat) / 2;
      if (lat >= mid) { ch = ch * 2 + 1; minLat = mid; }
      else { ch = ch * 2; maxLat = mid; }
    }
    isLng = !isLng;
    bit++;
    if (bit === 5) { hash += BASE32[ch]; bit = 0; ch = 0; }
  }
  return hash;
}

function parsePricing(text) {
  if (!text) return {};
  const kwhMatch = text.match(/\$(\d+\.?\d*)\s*\/?\s*kWh/i);
  const minMatch = text.match(/\$(\d+\.?\d*)\s*\/?\s*min/i);
  return {
    perKwh: kwhMatch ? parseFloat(kwhMatch[1]) : undefined,
    perMin: minMatch ? parseFloat(minMatch[1]) : undefined,
  };
}

async function fetchStateStations(state) {
  let offset = 0;
  let all = [];

  while (true) {
    const url = new URL(AFDC_BASE);
    url.searchParams.set('api_key', AFDC_KEY);
    url.searchParams.set('fuel_type', 'ELEC');
    url.searchParams.set('status', 'E');
    url.searchParams.set('state', state);
    url.searchParams.set('limit', '200');
    url.searchParams.set('offset', String(offset));

    let res;
    for (let attempt = 0; attempt < 3; attempt++) {
      res = await fetch(url.toString());
      if (res.status === 429) {
        const wait = (attempt + 1) * 10000;
        console.error(`  429 ${state} offset=${offset}, waiting ${wait/1000}s...`);
        await new Promise(r => setTimeout(r, wait));
        continue;
      }
      break;
    }
    if (!res.ok) {
      console.error(`  ERROR ${state}: HTTP ${res.status}`);
      break;
    }

    const data = await res.json();
    const stations = data.fuel_stations || [];
    all = all.concat(stations);

    if (stations.length < 200) break;
    offset += 200;

    // Rate limit: 2s between pages
    await new Promise(r => setTimeout(r, 2000));
  }

  return all;
}

function mapStation(s) {
  const dcFast = s.ev_dc_fast_num || 0;
  const level2 = s.ev_level2_evse_num || 0;
  const pricing = parsePricing(s.ev_pricing);

  let maxPowerKw = 7;
  if (dcFast > 0) {
    if (s.ev_network === 'Tesla') maxPowerKw = 250;
    else if (s.ev_network === 'Electrify America') maxPowerKw = 350;
    else maxPowerKw = 150;
  } else if (level2 > 0) {
    maxPowerKw = 19;
  }

  return {
    external_id: `afdc-${s.id}`,
    source: 'afdc',
    name: s.station_name,
    latitude: s.latitude,
    longitude: s.longitude,
    geohash_6: encodeGeohash6(s.latitude, s.longitude),
    address: s.street_address,
    city: s.city,
    state: s.state,
    zip: s.zip,
    network: s.ev_network,
    plug_types: (s.ev_connector_types || []).map(t => t.toUpperCase().replace('_', ' ')),
    stalls_total: dcFast + level2,
    max_power_kw: maxPowerKw,
    pricing_per_kwh: pricing.perKwh ?? null,
    pricing_per_minute: pricing.perMin ?? null,
    access_restrictions: s.access_code,
    updated_at: new Date().toISOString(),
  };
}

async function main() {
  console.log('=== WATTZ UP Full AFDC Ingest ===\n');

  let totalFetched = 0;
  let totalUpserted = 0;

  for (const state of STATES) {
    const stations = await fetchStateStations(state);
    totalFetched += stations.length;
    process.stdout.write(`${state}: ${stations.length} stations`);

    // Upsert in batches of 100
    const rows = stations.map(mapStation);
    for (let i = 0; i < rows.length; i += 100) {
      const batch = rows.slice(i, i + 100);
      const { error } = await supabase
        .from('wattz_stations')
        .upsert(batch, { onConflict: 'external_id' });

      if (error) {
        console.error(` UPSERT ERROR: ${error.message}`);
      } else {
        totalUpserted += batch.length;
      }
    }

    console.log(` ✓`);

    // Rate limit between states
    await new Promise(r => setTimeout(r, 3000));
  }

  console.log(`\n=== DONE ===`);
  console.log(`Fetched: ${totalFetched}`);
  console.log(`Upserted: ${totalUpserted}`);
}

main().catch(console.error);
