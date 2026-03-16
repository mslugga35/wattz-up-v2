# Wattz Up v2
> Last verified: 2026-03-16

## Project
- **Repo:** `github.com/mslugga35/wattz-up-v2` (branch: `master`)
- **Stack:** Next.js 16 + Supabase + PostGIS + Mapbox GL + Zustand + Vercel
- **Live:** https://wattz-up-v2.vercel.app
- **Supabase:** project `ebhtzgimevacvcgiyesc` (Management API access via `sbp_...` token from HiddenBag `.env.local`)

## Build
- **MUST use `--webpack` flag** — Serwist SW injection requires webpack, not Turbopack
- `npx next build --webpack`
- Turbopack (default in Next.js 16) will error without this flag

## Data Sources & Ingest

### Stations: 83,642+ (as of 2026-03-16)
| Source | Count | Script | Rate Limit |
|--------|-------|--------|------------|
| AFDC (NREL) | ~10K (partial) | `scripts/full-ingest.mjs` | 200/request, daily limit, 429 on overuse |
| OpenChargeMap | ~73.5K | `scripts/ocm-ingest.mjs` | 5000/request, 1.5s between tiles |

### Running Ingest Scripts
Both scripts read from `.env.local` — run from project root:
```bash
node --env-file=.env.local scripts/full-ingest.mjs    # AFDC
node --env-file=.env.local scripts/ocm-ingest.mjs     # OCM
```

### AFDC Ingest (`scripts/full-ingest.mjs`)
- Paginates 200/page per state, 2s between pages, 3s between states
- 3 retries on 429 with 10s/20s/30s backoff
- PM2 cron: `wattz-afdc-ingest` (#72) — daily 4 AM UTC (midnight ET)
- **Gotcha:** AFDC rate limit is aggressive — if you get 429, wait hours before retrying
- **Gotcha:** When rate limited, AFDC ignores state filter and returns ALL US stations — causes massive dupes (safe due to upsert dedup, but wastes time)

### OCM Ingest (`scripts/ocm-ingest.mjs`)
- Grid tiling: continental US = 4°lat × 6°lng tiles + Alaska + Hawaii = 72 tiles
- Queries by center lat/lng + radius (OCM doesn't support bounding box)
- Deduplicates by OCM ID across overlapping tiles
- `stateAbbrev()` converts full state names → 2-letter codes (OCM sends full names)
- `Math.round()` on power kW (DB column is integer, OCM sends decimals)
- Zip codes truncated to 10 chars (DB varchar(10))

### Vercel Cron Ingest (`src/app/api/cron/ingest/route.ts`)
- `maxDuration = 60` (also in `vercel.json`)
- 5 states per batch, `?batch=0` through `?batch=10`
- Limited to 200/state, no pagination (timeout constraint)
- Good for incremental daily updates, NOT full ingest

## Architecture

### Key Files
| File | Purpose |
|------|---------|
| `src/app/page.tsx` | Main page — map + list split view |
| `src/components/map/StationMap.tsx` | Mapbox GL with native clustering |
| `src/components/station/StationList.tsx` | Station list with filters, sort, favorites |
| `src/components/station/StationPhotos.tsx` | Photo gallery + upload |
| `src/components/station/ReportDialog.tsx` | Crowdsource observation modal |
| `src/store/app.ts` | Zustand store (persisted to localStorage) |
| `src/lib/services/estimator.ts` | Wait time estimation (Mode 3 heuristic) |
| `src/lib/trip.ts` | Trip planner (OSRM routing + Nominatim geocoding) |
| `src/lib/data/vehicles.ts` | 32 EV vehicles with specs |
| `src/app/api/stations/nearby/route.ts` | PostGIS spatial query via Supabase RPC |

### Map Clustering
- Uses Mapbox GL native `Source`/`Layer` (NOT individual React markers)
- Cluster colors: green (<10), amber (10-50), red (50+) by count
- Click cluster → zoom to expand via `getClusterExpansionZoom`
- Individual station dots color-coded by wait time (green/amber/red/gray)
- Scales with zoom level (4px at z8, 12px at z16)

### Debounced Fetching
- Map panning debounced 500ms before API call
- Filter changes trigger immediate fetch (no debounce)
- Fetch limit: 200 stations per request (API max: 500)

### Units Toggle
- `useMiles` in Zustand store (default: true for US users)
- Persisted to localStorage
- Toggle button in radius selector row
- Affects: radius labels, distance badges, vehicle range badge, map popup

### Station Features
- **Reliability scores:** blend of confidence (60%) + data quality (40%) → High/Med/Low
- **Sort options:** distance (default), wait_time, price, power
- **Vehicle compatibility:** filters by plug type, shows incompatible at bottom with warning
- **Charge time estimate:** `(batteryKwh × 0.7) / min(stationKw, vehicleMaxKw) × 60`
- **Favorites:** heart icon, persisted in localStorage
- **Directions:** Google Maps link on expanded station + map popup
- **Photos:** community upload to Supabase Storage `station-photos` bucket
- **Report dialog:** crowdsource wait times (available/short/long/full + queue + stalls)

### Trip Planner (`/trip`)
- OSRM free routing API (no key needed)
- Nominatim free geocoding (US only, no key needed)
- Samples waypoints at 70% vehicle range intervals
- Finds compatible stations near each waypoint
- Timeline UI with charge time estimates

## Supabase Storage
- **Bucket:** `station-photos` (public, 5MB, JPEG/PNG/WebP)
- **RLS:** public read + public upload policies
- Created via Management API SQL (anon key can't create buckets due to RLS)

## DB Schema (key table)
- **`wattz_stations`** — `external_id` (unique), `source` (afdc/ocm), `state` varchar(2), `max_power_kw` integer, `plug_types` text[], `geohash_6` char(6)
- **`wattz_nearby_stations`** — PostGIS RPC function (ST_DWithin on GIST index)
- **`wattz_observations`** — crowdsourced reports
- **`wattz_session_stats_hourly`** — pre-computed historical patterns

## API Keys (in `.env.local`)
| Key | Source |
|-----|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | Mapbox (mslugga35) |
| `AFDC_API_KEY` | NREL/AFDC |
| `OCM_API_KEY` | OpenChargeMap |
| `CRON_SECRET` | Self-generated |

## Connector Type Mapping (OCM)
| OCM ConnectionTypeID | Our Plug Type |
|---------------------|---------------|
| 1 | J1772 |
| 2 | CHADEMO |
| 25 | TYPE2 |
| 27 | NACS |
| 30 | TESLA |
| 32 | CCS |
| 33 | CCS2 |

## OCM Operator Mapping
| OCM OperatorID | Network |
|---------------|---------|
| 5 | ChargePoint |
| 9 | Blink Network |
| 15 | EVgo |
| 23 | Tesla |
| 89 | Electrify America |
| 39 | SemaConnect |
| 3534 | Tesla Supercharger |

## Gotchas
- **`--webpack` flag required** for builds (Serwist + Next.js 16 Turbopack conflict)
- **AFDC API max 200 per request** — returns 422 if you set limit higher
- **AFDC rate limiting** — aggressive daily limit, 429 for hours after overuse
- **OCM `stateprovince` filter doesn't work** — always returns 5000 regardless of state. Use lat/lng grid tiling instead
- **OCM sends full state names** — must convert to 2-letter abbreviations for `state` varchar(2)
- **OCM sends decimal power kW** — must `Math.round()` for integer column
- **Vercel function timeout** — 60s max even with Pro. Use `maxDuration = 60` export AND `vercel.json` config
- **Vercel default timeout is 10s** — must explicitly set maxDuration
- **CRON_SECRET** — must match between `.env.local` and Vercel env vars. Use `printf` not `echo` when setting via CLI (echo adds newline)
- **Supabase bucket creation** — anon key blocked by RLS. Use Management API SQL: `INSERT INTO storage.buckets`

## Competitor Landscape
| App | Stations | Key Advantage |
|-----|----------|---------------|
| PlugShare | 500K+ | Community reviews, photos, check-ins |
| ChargePoint | 100K+ | Real-time availability (own network) |
| A Better Route Planner | ~100K | Best trip planner |
| **Wattz Up v2** | **83K+** | Free, fast, reliability scores, trip planner |

## Next Steps
- [ ] Full AFDC ingest (rate limit reset → ~60K more → total ~140K+)
- [ ] Real-time availability partnerships (ChargePoint, EVgo APIs)
- [ ] Push notifications (PWA web push)
- [ ] User accounts + trust scoring
- [ ] Native app (Expo / React Native) — `wattz-up-mobile/`
- [ ] SEO landing pages (city/state pages for organic traffic)
