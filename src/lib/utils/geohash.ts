/**
 * WATTZ UP v2 - Geohash Utilities
 * Used by the ingest cron to compute geohash_6 for new stations.
 */

import ngeohash from 'ngeohash';

/**
 * Encode lat/lng to geohash-6 (~1.2km² precision).
 * Stored on each station row for coarse spatial grouping.
 */
export function encodeGeohash6(latitude: number, longitude: number): string {
  return ngeohash.encode(latitude, longitude, 6);
}
