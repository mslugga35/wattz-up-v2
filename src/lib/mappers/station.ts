/**
 * Transform a raw Supabase station row into the API response shape.
 * Used by both /api/stations/nearby and /api/stations/[id].
 */

export function mapStationRow(row: Record<string, any>, distanceKm?: number) {
  return {
    id: row.id,
    externalId: row.external_id,
    source: row.source,
    name: row.name,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    geohash6: row.geohash_6,
    address: row.address,
    city: row.city,
    state: row.state,
    zip: row.zip,
    network: row.network,
    plugTypes: row.plug_types || [],
    stallsTotal: row.stalls_total || 4,
    maxPowerKw: row.max_power_kw,
    pricingPerKwh: row.pricing_per_kwh ? Number(row.pricing_per_kwh) : undefined,
    pricingPerMinute: row.pricing_per_minute ? Number(row.pricing_per_minute) : undefined,
    amenities: row.amenities || [],
    accessRestrictions: row.access_restrictions,
    dataQualityScore: Number(row.data_quality_score) || 0.5,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...(distanceKm !== undefined && { distance: distanceKm }),
  };
}
