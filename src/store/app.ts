/**
 * WATTZ UP v2 - App Store (Zustand)
 * Client-side state management
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { StationWithEstimate, User } from '@/types';

interface AppState {
  // User
  user: User | null;
  deviceId: string | null;
  setUser: (user: User | null) => void;
  setDeviceId: (deviceId: string) => void;

  // Location
  userLocation: { latitude: number; longitude: number } | null;
  setUserLocation: (location: { latitude: number; longitude: number } | null) => void;

  // Stations
  stations: StationWithEstimate[];
  selectedStation: StationWithEstimate | null;
  setStations: (stations: StationWithEstimate[]) => void;
  setSelectedStation: (station: StationWithEstimate | null) => void;

  // Map
  mapCenter: { latitude: number; longitude: number };
  mapZoom: number;
  setMapCenter: (center: { latitude: number; longitude: number }) => void;
  setMapZoom: (zoom: number) => void;

  // Filters
  radiusKm: number;
  networkFilter: string | null;
  plugTypeFilter: string[];
  setRadiusKm: (radius: number) => void;
  setNetworkFilter: (network: string | null) => void;
  setPlugTypeFilter: (plugTypes: string[]) => void;

  // Loading states
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}

// Generate device ID if not exists
function generateDeviceId(): string {
  return crypto.randomUUID();
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // User
      user: null,
      deviceId: null,
      setUser: (user) => set({ user }),
      setDeviceId: (deviceId) => set({ deviceId }),

      // Location - default to San Francisco
      userLocation: null,
      setUserLocation: (location) => set({ userLocation: location }),

      // Stations
      stations: [],
      selectedStation: null,
      setStations: (stations) => set({ stations }),
      setSelectedStation: (station) => set({ selectedStation: station }),

      // Map - default to US center
      mapCenter: { latitude: 37.7749, longitude: -122.4194 },
      mapZoom: 12,
      setMapCenter: (center) => set({ mapCenter: center }),
      setMapZoom: (zoom) => set({ mapZoom: zoom }),

      // Filters
      radiusKm: 10,
      networkFilter: null,
      plugTypeFilter: [],
      setRadiusKm: (radius) => set({ radiusKm: radius }),
      setNetworkFilter: (network) => set({ networkFilter: network }),
      setPlugTypeFilter: (plugTypes) => set({ plugTypeFilter: plugTypes }),

      // Loading
      isLoading: false,
      setIsLoading: (loading) => set({ isLoading: loading }),
    }),
    {
      name: 'wattz-up-storage',
      partialize: (state) => ({
        deviceId: state.deviceId || generateDeviceId(),
        radiusKm: state.radiusKm,
        networkFilter: state.networkFilter,
        plugTypeFilter: state.plugTypeFilter,
      }),
    }
  )
);
