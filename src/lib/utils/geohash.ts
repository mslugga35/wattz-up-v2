/**
 * WATTZ UP v2 - Geohash Utilities
 * Privacy-preserving location handling
 */

import ngeohash from 'ngeohash';

/**
 * Encode lat/lng to geohash-6 (~1.2km² precision)
 * This is the privacy level we use - never store raw coordinates
 */
export function encodeGeohash6(latitude: number, longitude: number): string {
  return ngeohash.encode(latitude, longitude, 6);
}

/**
 * Decode geohash back to approximate lat/lng (center of tile)
 */
export function decodeGeohash(geohash: string): { latitude: number; longitude: number } {
  const decoded = ngeohash.decode(geohash);
  return {
    latitude: decoded.latitude,
    longitude: decoded.longitude,
  };
}

/**
 * Get neighboring geohash tiles (for expanding search)
 */
export function getNeighbors(geohash: string): string[] {
  return ngeohash.neighbors(geohash);
}

/**
 * Get all geohashes within a bounding box
 */
export function getGeohashesInBbox(
  minLat: number,
  minLng: number,
  maxLat: number,
  maxLng: number,
  precision: number = 6
): string[] {
  return ngeohash.bboxes(minLat, minLng, maxLat, maxLng, precision);
}

/**
 * Calculate distance between two points (Haversine formula)
 * Returns distance in kilometers
 */
export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

/**
 * Generate user hash from device ID (for privacy)
 * Uses SHA-256 to prevent reverse lookup
 */
export async function generateUserHash(deviceId: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(deviceId + salt);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}
