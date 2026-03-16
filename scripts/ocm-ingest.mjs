/**
 * OpenChargeMap station ingest — runs locally (no timeout)
 * Tiles the US with lat/lng bounding boxes to get ALL stations
 * Usage: npx dotenv -e .env.local -- node scripts/ocm-ingest.mjs
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const OCM_KEY = process.env.OCM_API_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY || !OCM_KEY) {
  console.error('Missing env vars. Run from project root with .env.local');
  process.exit(1);
}
const OCM_BASE = 'https://api.openchargemap.io/v3/poi/';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// OCM ConnectionTypeID → our plug type names
const CONNECTOR_MAP = {
  1: 'J1772', 2: 'CHADEMO', 25: 'TYPE2', 27: 'NACS',
  30: 'TESLA', 32: 'CCS', 33: 'CCS2',
};

const LEVEL_POWER = { 1: 3, 2: 22, 3: 150 };

const OPERATOR_MAP = {
  5: 'ChargePoint', 9: 'Blink Network', 15: 'EVgo',
  23: 'Tesla', 89: 'Electrify America', 39: 'SemaConnect',
  3534: 'Tesla Supercharger',
};

// State name → abbreviation
const STATE_MAP = {
  'alabama':'AL','alaska':'AK','arizona':'AZ','arkansas':'AR','california':'CA',
  'colorado':'CO','connecticut':'CT','delaware':'DE','florida':'FL','georgia':'GA',
  'hawaii':'HI','idaho':'ID','illinois':'IL','indiana':'IN','iowa':'IA',
  'kansas':'KS','kentucky':'KY','louisiana':'LA','maine':'ME','maryland':'MD',
  'massachusetts':'MA','michigan':'MI','minnesota':'MN','mississippi':'MS',
  'missouri':'MO','montana':'MT','nebraska':'NE','nevada':'NV','new hampshire':'NH',
  'new jersey':'NJ','new mexico':'NM','new york':'NY','north carolina':'NC',
  'north dakota':'ND','ohio':'OH','oklahoma':'OK','oregon':'OR','pennsylvania':'PA',
  'rhode island':'RI','south carolina':'SC','south dakota':'SD','tennessee':'TN',
  'texas':'TX','utah':'UT','vermont':'VT','virginia':'VA','washington':'WA',
  'west virginia':'WV','wisconsin':'WI','wyoming':'WY','district of columbia':'DC',
};

function stateAbbrev(s) {
  if (!s) return null;
  if (s.length <= 2) return s.toUpperCase();
  return STATE_MAP[s.toLowerCase()] || s.slice(0, 2).toUpperCase();
}

function encodeGeohash6(lat, lng) {
  const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';
  let minLat = -90, maxLat = 90, minLng = -180, maxLng = 180;
  let hash = '', isLng = true, bit = 0, ch = 0;
  while (hash.length < 6) {
    if (isLng) {
      const mid = (minLng + maxLng) / 2;
      if (lng >= mid) { ch = ch * 2 + 1; minLng = mid; } else { ch = ch * 2; maxLng = mid; }
    } else {
      const mid = (minLat + maxLat) / 2;
      if (lat >= mid) { ch = ch * 2 + 1; minLat = mid; } else { ch = ch * 2; maxLat = mid; }
    }
    isLng = !isLng; bit++;
    if (bit === 5) { hash += BASE32[ch]; bit = 0; ch = 0; }
  }
  return hash;
}

function mapStation(s) {
  const addr = s.AddressInfo || {};
  const connections = s.Connections || [];

  const plugTypes = [...new Set(
    connections.map(c => CONNECTOR_MAP[c.ConnectionTypeID]).filter(Boolean)
  )];
  if (plugTypes.length === 0) {
    const levels = connections.map(c => c.LevelID).filter(Boolean);
    if (levels.includes(3)) plugTypes.push('CCS');
    else if (levels.includes(2)) plugTypes.push('J1772');
  }

  const maxPowerKw = Math.round(Math.max(
    ...connections.map(c => c.PowerKW || LEVEL_POWER[c.LevelID] || 7), 7
  ));

  const stallsTotal = connections.reduce((sum, c) => sum + (c.Quantity || 1), 0);

  return {
    external_id: `ocm-${s.ID}`,
    source: 'ocm',
    name: addr.Title || `OCM Station ${s.ID}`,
    latitude: addr.Latitude,
    longitude: addr.Longitude,
    geohash_6: encodeGeohash6(addr.Latitude, addr.Longitude),
    address: addr.AddressLine1 || null,
    city: addr.Town || null,
    state: stateAbbrev(addr.StateOrProvince),
    zip: (addr.Postcode || '').slice(0, 10) || null,
    network: OPERATOR_MAP[s.OperatorID] || null,
    plug_types: plugTypes.length > 0 ? plugTypes : ['UNKNOWN'],
    stalls_total: stallsTotal,
    max_power_kw: maxPowerKw,
    pricing_per_kwh: null,
    pricing_per_minute: null,
    access_restrictions: s.UsageTypeID === 1 ? 'public' : 'restricted',
    updated_at: new Date().toISOString(),
  };
}

// Tile the continental US into grid cells and fetch each
// US bounding box: lat 24-50, lng -125 to -66
// With 5000 max results per call, use ~4° lat x 6° lng tiles
async function fetchTile(latMin, latMax, lngMin, lngMax) {
  const centerLat = (latMin + latMax) / 2;
  const centerLng = (lngMin + lngMax) / 2;
  // OCM uses distance from center point, not bounding box
  // Calculate radius to cover the tile (rough: 1° lat ≈ 111 km)
  const latRange = (latMax - latMin) / 2 * 111;
  const lngRange = (lngMax - lngMin) / 2 * 111 * Math.cos(centerLat * Math.PI / 180);
  const radiusKm = Math.ceil(Math.sqrt(latRange * latRange + lngRange * lngRange));

  const url = new URL(OCM_BASE);
  url.searchParams.set('output', 'json');
  url.searchParams.set('countrycode', 'US');
  url.searchParams.set('maxresults', '5000');
  url.searchParams.set('compact', 'true');
  url.searchParams.set('verbose', 'false');
  url.searchParams.set('key', OCM_KEY);
  url.searchParams.set('statustypeid', '50');
  url.searchParams.set('latitude', String(centerLat));
  url.searchParams.set('longitude', String(centerLng));
  url.searchParams.set('distance', String(radiusKm));
  url.searchParams.set('distanceunit', 'KM');

  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': 'WattzUp/2.0' }
  });

  if (!res.ok) {
    console.error(`  OCM tile error: HTTP ${res.status}`);
    return [];
  }

  return await res.json();
}

async function main() {
  console.log('=== WATTZ UP OpenChargeMap Ingest ===\n');

  // Grid: lat 24-50 (step 4°), lng -125 to -66 (step 6°)
  const tiles = [];
  for (let lat = 24; lat < 50; lat += 4) {
    for (let lng = -125; lng < -66; lng += 6) {
      tiles.push({ latMin: lat, latMax: lat + 4, lngMin: lng, lngMax: lng + 6 });
    }
  }
  // Add Alaska tile
  tiles.push({ latMin: 55, latMax: 72, lngMin: -170, lngMax: -130 });
  // Add Hawaii tile
  tiles.push({ latMin: 18, latMax: 23, lngMin: -162, lngMax: -154 });

  console.log(`Fetching ${tiles.length} tiles...\n`);

  const seenIds = new Set();
  let totalFetched = 0;
  let totalUpserted = 0;
  let totalDupes = 0;

  for (let i = 0; i < tiles.length; i++) {
    const tile = tiles[i];
    const stations = await fetchTile(tile.latMin, tile.latMax, tile.lngMin, tile.lngMax);

    // Deduplicate
    const unique = stations.filter(s => {
      if (seenIds.has(s.ID)) return false;
      seenIds.add(s.ID);
      return true;
    });

    totalFetched += stations.length;
    totalDupes += stations.length - unique.length;

    const rows = unique
      .filter(s => s.AddressInfo?.Latitude && s.AddressInfo?.Longitude)
      .map(mapStation);

    process.stdout.write(`Tile ${i + 1}/${tiles.length} [${tile.latMin}-${tile.latMax}°N, ${tile.lngMin}-${tile.lngMax}°W]: ${stations.length} fetched, ${unique.length} new`);

    // Upsert in batches
    for (let j = 0; j < rows.length; j += 100) {
      const batch = rows.slice(j, j + 100);
      const { error } = await supabase
        .from('wattz_stations')
        .upsert(batch, { onConflict: 'external_id' });

      if (error) {
        console.error(` ERR: ${error.message.slice(0, 80)}`);
      } else {
        totalUpserted += batch.length;
      }
    }

    console.log(' ✓');

    // Rate limit
    await new Promise(r => setTimeout(r, 1500));
  }

  console.log(`\n=== DONE ===`);
  console.log(`Tiles: ${tiles.length}`);
  console.log(`Fetched: ${totalFetched} (${totalDupes} dupes removed)`);
  console.log(`Unique: ${seenIds.size}`);
  console.log(`Upserted: ${totalUpserted}`);
}

main().catch(console.error);
