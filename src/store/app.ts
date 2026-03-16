/**
 * WATTZ UP v2 - App Store (Zustand)
 * Client-side state management with localStorage persistence
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { StationWithEstimate, User } from '@/types';
import { EVVehicle } from '@/lib/data/vehicles';

// Charging speed filter options
export type SpeedFilter = 'all' | 'dc_fast' | 'level2';

// Sort options
export type SortOption = 'distance' | 'wait_time' | 'price' | 'power';

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
  speedFilter: SpeedFilter;
  showAvailableOnly: boolean;
  setRadiusKm: (radius: number) => void;
  setNetworkFilter: (network: string | null) => void;
  setPlugTypeFilter: (plugTypes: string[]) => void;
  setSpeedFilter: (speed: SpeedFilter) => void;
  setShowAvailableOnly: (show: boolean) => void;

  // Favorites
  favorites: string[]; // station IDs
  toggleFavorite: (stationId: string) => void;
  isFavorite: (stationId: string) => boolean;

  // Vehicle profile
  selectedVehicle: EVVehicle | null;
  setSelectedVehicle: (vehicle: EVVehicle | null) => void;

  // Sort
  sortBy: SortOption;
  setSortBy: (sort: SortOption) => void;

  // Units
  useMiles: boolean;
  setUseMiles: (useMiles: boolean) => void;

  // Search
  searchQuery: string;
  setSearchQuery: (query: string) => void;

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
    (set, get) => ({
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
      speedFilter: 'all',
      showAvailableOnly: false,
      setRadiusKm: (radius) => set({ radiusKm: radius }),
      setNetworkFilter: (network) => set({ networkFilter: network }),
      setPlugTypeFilter: (plugTypes) => set({ plugTypeFilter: plugTypes }),
      setSpeedFilter: (speed) => set({ speedFilter: speed }),
      setShowAvailableOnly: (show) => set({ showAvailableOnly: show }),

      // Favorites
      favorites: [],
      toggleFavorite: (stationId) =>
        set((state) => ({
          favorites: state.favorites.includes(stationId)
            ? state.favorites.filter((id) => id !== stationId)
            : [...state.favorites, stationId],
        })),
      isFavorite: (stationId) => get().favorites.includes(stationId),

      // Vehicle
      selectedVehicle: null,
      setSelectedVehicle: (vehicle) => set({ selectedVehicle: vehicle }),

      // Sort
      sortBy: 'distance' as SortOption,
      setSortBy: (sort) => set({ sortBy: sort }),

      // Units — default to miles for US users
      useMiles: true,
      setUseMiles: (useMiles) => set({ useMiles }),

      // Search
      searchQuery: '',
      setSearchQuery: (query) => set({ searchQuery: query }),

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
        speedFilter: state.speedFilter,
        favorites: state.favorites,
        selectedVehicle: state.selectedVehicle,
        sortBy: state.sortBy,
        useMiles: state.useMiles,
      }),
    }
  )
);
