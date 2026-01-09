'use client';

/**
 * WATTZ UP v2 - Station Map Component
 * Mapbox GL JS map with station markers
 */

import { useRef, useCallback } from 'react';
import Map, { Marker, Popup, NavigationControl, GeolocateControl, MapRef } from 'react-map-gl/mapbox';
import { useAppStore } from '@/store/app';
import { StationWithEstimate } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Zap, Clock, Navigation } from 'lucide-react';
import 'mapbox-gl/dist/mapbox-gl.css';

interface StationMapProps {
  onStationSelect?: (station: StationWithEstimate) => void;
}

export function StationMap({ onStationSelect }: StationMapProps) {
  const mapRef = useRef<MapRef>(null);

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

  // Handle marker click
  const handleMarkerClick = (station: StationWithEstimate) => {
    setSelectedStation(station);
    onStationSelect?.(station);
  };

  // Get marker color based on wait time
  const getMarkerColor = (station: StationWithEstimate): string => {
    const waitMinutes = station.estimate?.etaWaitMinutes;
    if (waitMinutes === null || waitMinutes === undefined) return '#6B7280'; // gray
    if (waitMinutes <= 5) return '#10B981'; // green
    if (waitMinutes <= 15) return '#F59E0B'; // yellow
    return '#EF4444'; // red
  };

  return (
    <div className="relative w-full h-full min-h-[400px]">
      <Map
        ref={mapRef}
        mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
        initialViewState={{
          latitude: mapCenter.latitude,
          longitude: mapCenter.longitude,
          zoom: mapZoom,
        }}
        onMove={onMove}
        style={{ width: '100%', height: '100%' }}
        mapStyle="mapbox://styles/mapbox/dark-v11"
      >
        {/* Navigation controls */}
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

        {/* Station markers */}
        {stations.map((station) => (
          <Marker
            key={station.id}
            latitude={station.latitude}
            longitude={station.longitude}
            onClick={(e) => {
              e.originalEvent.stopPropagation();
              handleMarkerClick(station);
            }}
          >
            <div
              className="cursor-pointer transform hover:scale-110 transition-transform"
              style={{
                width: 32,
                height: 32,
                backgroundColor: getMarkerColor(station),
                borderRadius: '50%',
                border: '3px solid white',
                boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Zap className="w-4 h-4 text-white" />
            </div>
          </Marker>
        ))}

        {/* Selected station popup */}
        {selectedStation && (
          <Popup
            latitude={selectedStation.latitude}
            longitude={selectedStation.longitude}
            onClose={() => setSelectedStation(null)}
            closeOnClick={false}
            offset={20}
          >
            <div className="p-2 min-w-[200px]">
              <h3 className="font-semibold text-sm mb-1">{selectedStation.name}</h3>
              <p className="text-xs text-gray-600 mb-2">
                {selectedStation.network || 'Unknown Network'}
              </p>

              <div className="flex gap-2 mb-2">
                {selectedStation.stallsTotal && (
                  <Badge variant="outline" className="text-xs">
                    <Zap className="w-3 h-3 mr-1" />
                    {selectedStation.stallsTotal} stalls
                  </Badge>
                )}
                {selectedStation.distance !== undefined && (
                  <Badge variant="outline" className="text-xs">
                    <Navigation className="w-3 h-3 mr-1" />
                    {selectedStation.distance.toFixed(1)} km
                  </Badge>
                )}
              </div>

              {selectedStation.estimate && (
                <div className="flex items-center gap-1 text-sm">
                  <Clock className="w-4 h-4" />
                  <span>
                    {selectedStation.estimate.etaWaitMinutes !== null
                      ? `~${selectedStation.estimate.etaWaitMinutes} min wait`
                      : 'Wait time unknown'}
                  </span>
                </div>
              )}

              <div className="mt-2 flex flex-wrap gap-1">
                {selectedStation.plugTypes.slice(0, 3).map((plug) => (
                  <Badge key={plug} variant="secondary" className="text-xs">
                    {plug}
                  </Badge>
                ))}
              </div>
            </div>
          </Popup>
        )}
      </Map>
    </div>
  );
}
