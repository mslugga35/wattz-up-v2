'use client';

/**
 * WATTZ UP v2 - Station Map Component
 * Mapbox GL JS map with clustered station markers
 */

import { useCallback, useMemo } from 'react';
import Map, {
  Source,
  Layer,
  Popup,
  NavigationControl,
  GeolocateControl,
} from 'react-map-gl/mapbox';
import type { MapLayerMouseEvent, GeoJSONSource } from 'mapbox-gl';
import { useAppStore } from '@/store/app';
import { StationWithEstimate } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Zap, Clock, Navigation, DollarSign, Gauge } from 'lucide-react';
import 'mapbox-gl/dist/mapbox-gl.css';

export function StationMap() {
  const {
    stations,
    selectedStation,
    setSelectedStation,
    mapCenter,
    mapZoom,
    setMapCenter,
    setMapZoom,
    userLocation,
    setUserLocation,
  } = useAppStore();

  // Convert stations to GeoJSON for clustering
  const geojson = useMemo(() => ({
    type: 'FeatureCollection' as const,
    features: stations.map((s) => ({
      type: 'Feature' as const,
      id: s.id,
      geometry: {
        type: 'Point' as const,
        coordinates: [s.longitude, s.latitude],
      },
      properties: {
        id: s.id,
        name: s.name,
        network: s.network || 'Unknown',
        maxPowerKw: s.maxPowerKw || 0,
        stallsTotal: s.stallsTotal || 0,
        waitMinutes: s.estimate?.etaWaitMinutes ?? -1,
      },
    })),
  }), [stations]);

  // Handle map move
  const onMove = useCallback(
    (evt: any) => {
      setMapCenter({
        latitude: evt.viewState.latitude,
        longitude: evt.viewState.longitude,
      });
      setMapZoom(evt.viewState.zoom);
    },
    [setMapCenter, setMapZoom]
  );

  // Handle click on cluster or station point
  const onClick = useCallback(
    (evt: MapLayerMouseEvent) => {
      const feature = evt.features?.[0];
      if (!feature) return;

      // Click on cluster → zoom in
      if (feature.layer?.id === 'clusters') {
        const map = evt.target;
        const source = map.getSource('stations') as GeoJSONSource;
        if (source && feature.properties?.cluster_id) {
          source.getClusterExpansionZoom(feature.properties.cluster_id, (err: any, zoom: number | null | undefined) => {
            if (err || zoom == null) return;
            const coords = (feature.geometry as any).coordinates;
            map.easeTo({ center: coords, zoom: Math.min(zoom, 18) });
          });
        }
        return;
      }

      // Click on individual station
      if (feature.layer?.id === 'unclustered-point') {
        const stationId = feature.properties?.id;
        const station = stations.find((s) => s.id === stationId);
        if (station) setSelectedStation(station);
      }
    },
    [stations, setSelectedStation]
  );

  return (
    <div className="relative w-full h-full min-h-[400px]">
      <Map
        mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
        initialViewState={{
          latitude: mapCenter.latitude,
          longitude: mapCenter.longitude,
          zoom: mapZoom,
        }}
        onMove={onMove}
        onClick={onClick}
        interactiveLayerIds={['clusters', 'unclustered-point']}
        style={{ width: '100%', height: '100%' }}
        mapStyle="mapbox://styles/mapbox/dark-v11"
        cursor="pointer"
      >
        <NavigationControl position="top-right" />
        <GeolocateControl
          position="top-right"
          trackUserLocation
          onGeolocate={(e) => {
            setUserLocation({
              latitude: e.coords.latitude,
              longitude: e.coords.longitude,
            });
          }}
        />

        <Source
          id="stations"
          type="geojson"
          data={geojson}
          cluster
          clusterMaxZoom={14}
          clusterRadius={50}
        >
          {/* Cluster circles */}
          <Layer
            id="clusters"
            type="circle"
            filter={['has', 'point_count']}
            paint={{
              'circle-color': [
                'step',
                ['get', 'point_count'],
                '#10B981', // green for small clusters
                10, '#F59E0B', // amber for medium
                50, '#EF4444', // red for large
              ],
              'circle-radius': [
                'step',
                ['get', 'point_count'],
                18,
                10, 24,
                50, 32,
                100, 40,
              ],
              'circle-stroke-width': 2,
              'circle-stroke-color': '#ffffff',
              'circle-opacity': 0.9,
            }}
          />

          {/* Cluster count labels */}
          <Layer
            id="cluster-count"
            type="symbol"
            filter={['has', 'point_count']}
            layout={{
              'text-field': '{point_count_abbreviated}',
              'text-font': ['DIN Pro Medium', 'Arial Unicode MS Bold'],
              'text-size': 13,
            }}
            paint={{
              'text-color': '#ffffff',
            }}
          />

          {/* Individual station markers */}
          <Layer
            id="unclustered-point"
            type="circle"
            filter={['!', ['has', 'point_count']]}
            paint={{
              'circle-color': [
                'case',
                ['<=', ['get', 'waitMinutes'], 5], '#10B981',
                ['<=', ['get', 'waitMinutes'], 15], '#F59E0B',
                ['>', ['get', 'waitMinutes'], 15], '#EF4444',
                '#6B7280', // gray for unknown (-1)
              ],
              'circle-radius': [
                'interpolate', ['linear'], ['zoom'],
                8, 4,
                12, 8,
                16, 12,
              ],
              'circle-stroke-width': 2,
              'circle-stroke-color': '#ffffff',
            }}
          />
        </Source>

        {/* Selected station popup */}
        {selectedStation && (
          <Popup
            latitude={selectedStation.latitude}
            longitude={selectedStation.longitude}
            onClose={() => setSelectedStation(null)}
            closeOnClick={false}
            offset={20}
          >
            <div className="p-2 min-w-[220px]">
              <h3 className="font-semibold text-sm mb-1">{selectedStation.name}</h3>
              <p className="text-xs text-gray-600 mb-2">
                {selectedStation.network || 'Unknown Network'}
                {selectedStation.city && ` \u2022 ${selectedStation.city}`}
              </p>

              <div className="flex flex-wrap gap-1.5 mb-2">
                {selectedStation.stallsTotal > 0 && (
                  <Badge variant="outline" className="text-xs">
                    <Zap className="w-3 h-3 mr-1" />
                    {selectedStation.stallsTotal} stalls
                  </Badge>
                )}
                {selectedStation.maxPowerKw && (
                  <Badge variant="outline" className="text-xs">
                    <Gauge className="w-3 h-3 mr-1" />
                    {selectedStation.maxPowerKw} kW
                  </Badge>
                )}
                {selectedStation.distance !== undefined && (
                  <Badge variant="outline" className="text-xs">
                    <Navigation className="w-3 h-3 mr-1" />
                    {selectedStation.distance.toFixed(1)} km
                  </Badge>
                )}
                {selectedStation.pricingPerKwh && (
                  <Badge variant="outline" className="text-xs">
                    <DollarSign className="w-3 h-3 mr-1" />
                    ${selectedStation.pricingPerKwh.toFixed(2)}/kWh
                  </Badge>
                )}
                {!selectedStation.pricingPerKwh && selectedStation.pricingPerMinute && (
                  <Badge variant="outline" className="text-xs">
                    <DollarSign className="w-3 h-3 mr-1" />
                    ${selectedStation.pricingPerMinute.toFixed(2)}/min
                  </Badge>
                )}
              </div>

              {selectedStation.estimate && (
                <div className="flex items-center gap-1 text-sm mb-2">
                  <Clock className="w-4 h-4" />
                  <span>
                    {selectedStation.estimate.etaWaitMinutes !== null
                      ? `~${selectedStation.estimate.etaWaitMinutes} min wait`
                      : 'Wait time unknown'}
                  </span>
                </div>
              )}

              <div className="flex flex-wrap gap-1">
                {selectedStation.plugTypes.slice(0, 4).map((plug) => (
                  <Badge key={plug} variant="secondary" className="text-xs">
                    {plug}
                  </Badge>
                ))}
              </div>

              {selectedStation.address && (
                <p className="text-xs text-gray-500 mt-2">{selectedStation.address}</p>
              )}
            </div>
          </Popup>
        )}
      </Map>
    </div>
  );
}
