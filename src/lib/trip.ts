/**
 * WATTZ UP v2 - Trip Planner Logic
 * Uses OSRM (free) for routing, Nominatim for geocoding
 * Finds optimal charging stops based on vehicle range
 */

import { EVVehicle } from '@/lib/data/vehicles';

export interface TripStop {
  latitude: number;
  longitude: number;
  distanceFromStartKm: number;
  station?: {
    id: string;
    name: string;
    network?: string;
    maxPowerKw?: number;
    pricingPerKwh?: number;
    plugTypes: string[];
    stallsTotal: number;
    distance: number; // km from waypoint
  };
  chargeTimeMin?: number;
}

export interface TripPlan {
  origin: { latitude: number; longitude: number; name: string };
  destination: { latitude: number; longitude: number; name: string };
  totalDistanceKm: number;
  totalDurationMin: number;
  stops: TripStop[];
  routeGeometry: [number, number][]; // [lng, lat] pairs for map
}

export interface GeocodingResult {
  latitude: number;
  longitude: number;
  displayName: string;
}

// Geocode an address using Nominatim (free, no key)
export async function geocodeAddress(query: string): Promise<GeocodingResult[]> {
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', query);
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', '5');
  url.searchParams.set('countrycodes', 'us');

  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': 'WattzUp/2.0' },
  });

  if (!res.ok) return [];

  const data = await res.json();
  return data.map((r: any) => ({
    latitude: parseFloat(r.lat),
    longitude: parseFloat(r.lon),
    displayName: r.display_name,
  }));
}

// Get route from OSRM (free demo server)
async function getRoute(
  origin: { latitude: number; longitude: number },
  destination: { latitude: number; longitude: number }
): Promise<{ distanceKm: number; durationMin: number; geometry: [number, number][] } | null> {
  const coords = `${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}`;
  const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`;

  const res = await fetch(url);
  if (!res.ok) return null;

  const data = await res.json();
  if (!data.routes?.length) return null;

  const route = data.routes[0];
  return {
    distanceKm: route.distance / 1000,
    durationMin: Math.round(route.duration / 60),
    geometry: route.geometry.coordinates as [number, number][],
  };
}

// Sample waypoints along the route at regular intervals
function sampleWaypoints(
  geometry: [number, number][],
  intervalKm: number,
  totalDistanceKm: number
): { latitude: number; longitude: number; distanceFromStartKm: number }[] {
  const waypoints: { latitude: number; longitude: number; distanceFromStartKm: number }[] = [];
  let accumulatedKm = 0;
  let nextStopKm = intervalKm;

  for (let i = 1; i < geometry.length; i++) {
    const [lng1, lat1] = geometry[i - 1];
    const [lng2, lat2] = geometry[i];
    const segmentKm = haversineKm(lat1, lng1, lat2, lng2);
    accumulatedKm += segmentKm;

    if (accumulatedKm >= nextStopKm && accumulatedKm < totalDistanceKm - 30) {
      // Don't add a stop within 30km of destination
      waypoints.push({
        latitude: lat2,
        longitude: lng2,
        distanceFromStartKm: Math.round(accumulatedKm),
      });
      nextStopKm = accumulatedKm + intervalKm;
    }
  }

  return waypoints;
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Find best station near a waypoint using our API
async function findStationNearWaypoint(
  lat: number,
  lng: number,
  vehicle: EVVehicle
): Promise<TripStop['station'] | undefined> {
  try {
    const params = new URLSearchParams({
      latitude: lat.toString(),
      longitude: lng.toString(),
      radiusKm: '15',
      limit: '10',
    });

    const res = await fetch(`/api/stations/nearby?${params}`);
    if (!res.ok) return undefined;

    const data = await res.json();
    const stations = data.stations || [];

    // Filter for compatible + DC fast preferred
    const vehiclePlugs = vehicle.plugTypes.map((p) => p.toUpperCase());
    const compatible = stations.filter((s: any) =>
      s.plugTypes.some((p: string) => vehiclePlugs.includes(p.toUpperCase()))
    );

    if (compatible.length === 0) return undefined;

    // Prefer DC fast chargers, then sort by power
    const sorted = compatible.sort((a: any, b: any) => (b.maxPowerKw ?? 0) - (a.maxPowerKw ?? 0));
    const best = sorted[0];

    return {
      id: best.id,
      name: best.name,
      network: best.network,
      maxPowerKw: best.maxPowerKw,
      pricingPerKwh: best.pricingPerKwh,
      plugTypes: best.plugTypes,
      stallsTotal: best.stallsTotal,
      distance: best.distance ?? 0,
    };
  } catch {
    return undefined;
  }
}

// Main trip planning function
export async function planTrip(
  origin: { latitude: number; longitude: number; name: string },
  destination: { latitude: number; longitude: number; name: string },
  vehicle: EVVehicle
): Promise<TripPlan | null> {
  // Get route
  const route = await getRoute(origin, destination);
  if (!route) return null;

  // Calculate charging interval: use 70% of range as safe interval
  const chargeIntervalKm = vehicle.rangeKm * 0.7;

  // If trip is within range, no stops needed
  if (route.distanceKm <= vehicle.rangeKm * 0.85) {
    return {
      origin,
      destination,
      totalDistanceKm: Math.round(route.distanceKm),
      totalDurationMin: route.durationMin,
      stops: [],
      routeGeometry: route.geometry,
    };
  }

  // Sample waypoints along the route
  const waypoints = sampleWaypoints(route.geometry, chargeIntervalKm, route.distanceKm);

  // Find stations near each waypoint
  const stops: TripStop[] = await Promise.all(
    waypoints.map(async (wp) => {
      const station = await findStationNearWaypoint(wp.latitude, wp.longitude, vehicle);
      const chargeTimeMin =
        station?.maxPowerKw
          ? Math.round((vehicle.batteryKwh * 0.6) / Math.min(station.maxPowerKw, vehicle.maxChargeKw) * 60)
          : undefined;

      return {
        latitude: station ? 0 : wp.latitude, // Use station location if found
        longitude: station ? 0 : wp.longitude,
        distanceFromStartKm: wp.distanceFromStartKm,
        station,
        chargeTimeMin,
      };
    })
  );

  // Add charge time to total duration
  const totalChargeMin = stops.reduce((sum, s) => sum + (s.chargeTimeMin ?? 0), 0);

  return {
    origin,
    destination,
    totalDistanceKm: Math.round(route.distanceKm),
    totalDurationMin: route.durationMin + totalChargeMin,
    stops,
    routeGeometry: route.geometry,
  };
}
