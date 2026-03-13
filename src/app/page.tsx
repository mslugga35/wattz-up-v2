'use client';

/**
 * WATTZ UP v2 - Main App Page
 * Map + Station list view
 */

import { useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useAppStore } from '@/store/app';
import { fetchNearbyStations, registerDevice } from '@/lib/api';
import { StationList } from '@/components/station/StationList';

// Dynamic import to avoid SSR issues with Mapbox GL
const StationMap = dynamic(
  () => import('@/components/map/StationMap').then((mod) => mod.StationMap),
  { ssr: false, loading: () => <div className="w-full h-full bg-muted animate-pulse" /> }
);
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Toaster } from '@/components/ui/sonner';
import { Zap, RefreshCw, Search, MapPin } from 'lucide-react';

export default function HomePage() {
  const {
    stations,
    setStations,
    userLocation,
    setUserLocation,
    mapCenter,
    radiusKm,
    setRadiusKm,
    isLoading,
    setIsLoading,
    deviceId,
    setDeviceId,
    setUser,
    searchQuery,
    setSearchQuery,
    networkFilter,
    setNetworkFilter,
    plugTypeFilter,
    setPlugTypeFilter,
  } = useAppStore();

  // Initialize device on mount
  useEffect(() => {
    const initDevice = async () => {
      let id = deviceId;

      // Generate device ID if not exists
      if (!id) {
        id = crypto.randomUUID();
        setDeviceId(id);
      }

      // Register device with API
      try {
        const result = await registerDevice(id, 'web');
        setUser(result.user as any);
      } catch (error) {
        console.error('Failed to register device:', error);
      }
    };

    initDevice();
  }, [deviceId, setDeviceId, setUser]);

  // Get user location on mount
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        },
        (error) => {
          console.error('Geolocation error:', error);
          // Default to San Francisco if geolocation fails
          setUserLocation({ latitude: 37.7749, longitude: -122.4194 });
        }
      );
    }
  }, [setUserLocation]);

  // Fetch stations when location changes
  const fetchStations = useCallback(async () => {
    // Use map center for searching (what user is looking at)
    const location = mapCenter;

    setIsLoading(true);
    try {
      const result = await fetchNearbyStations(location.latitude, location.longitude, {
        radiusKm,
        network: networkFilter || undefined,
        plugTypes: plugTypeFilter.length > 0 ? plugTypeFilter : undefined,
        limit: 50,
      });
      setStations(result.stations);
    } catch (error) {
      console.error('Failed to fetch stations:', error);
    } finally {
      setIsLoading(false);
    }
  }, [mapCenter, radiusKm, networkFilter, plugTypeFilter, setStations, setIsLoading]);

  // Fetch on map center or radius change
  useEffect(() => {
    fetchStations();
  }, [mapCenter.latitude, mapCenter.longitude, radiusKm, networkFilter, plugTypeFilter]);

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="border-b px-4 py-3 flex items-center justify-between bg-card">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
            <Zap className="w-5 h-5 text-primary-foreground" />
          </div>
          <h1 className="text-xl font-bold">Wattz Up</h1>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="hidden sm:flex">
            {stations.length} stations
          </Badge>
          <Button
            variant="outline"
            size="icon"
            onClick={fetchStations}
            disabled={isLoading}
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </header>

      {/* Search + filters bar */}
      <div className="p-4 border-b bg-card space-y-2">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search stations..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <select
            value={radiusKm}
            onChange={(e) => setRadiusKm(Number(e.target.value))}
            className="px-3 py-2 border rounded-md bg-background text-sm"
          >
            <option value={5}>5 km</option>
            <option value={10}>10 km</option>
            <option value={25}>25 km</option>
            <option value={50}>50 km</option>
          </select>
        </div>
        <div className="flex gap-2">
          <select
            value={networkFilter || ''}
            onChange={(e) => setNetworkFilter(e.target.value || null)}
            className="px-3 py-2 border rounded-md bg-background text-sm flex-1"
          >
            <option value="">All Networks</option>
            <option value="Tesla">Tesla</option>
            <option value="ChargePoint Network">ChargePoint</option>
            <option value="Electrify America">Electrify America</option>
            <option value="EVgo">EVgo</option>
            <option value="Blink Network">Blink</option>
            <option value="FLO">FLO</option>
            <option value="Non-Networked">Non-Networked</option>
          </select>
          <select
            value={plugTypeFilter[0] || ''}
            onChange={(e) => setPlugTypeFilter(e.target.value ? [e.target.value] : [])}
            className="px-3 py-2 border rounded-md bg-background text-sm flex-1"
          >
            <option value="">All Plug Types</option>
            <option value="CCS">CCS</option>
            <option value="NACS">NACS (Tesla)</option>
            <option value="CHADEMO">CHAdeMO</option>
            <option value="J1772">J1772</option>
          </select>
        </div>
      </div>

      {/* Main content - split view on desktop, tabs on mobile */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Map */}
        <div className="h-[40vh] lg:h-full lg:flex-1">
          <StationMap />
        </div>

        {/* Station list */}
        <div className="flex-1 lg:w-[400px] lg:flex-none overflow-auto border-l">
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">Nearby Chargers</h2>
              {userLocation && (
                <Badge variant="secondary" className="text-xs">
                  <MapPin className="w-3 h-3 mr-1" />
                  {userLocation.latitude.toFixed(4)}, {userLocation.longitude.toFixed(4)}
                </Badge>
              )}
            </div>
            <StationList />
          </div>
        </div>
      </div>

      <Toaster />
    </div>
  );
}
