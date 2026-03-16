'use client';

/**
 * WATTZ UP v2 - Station List Component
 * Scrollable list of nearby stations with pricing, power, favorites
 */

import { useAppStore } from '@/store/app';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ReportDialog } from './ReportDialog';
import { StationPhotos } from './StationPhotos';
import {
  Zap,
  Clock,
  Navigation,
  ChevronRight,
  MessageSquarePlus,
  Heart,
  DollarSign,
  Gauge,
  AlertTriangle,
  BatteryCharging,
  ShieldCheck,
  ExternalLink,
} from 'lucide-react';

// Format power level for display
function formatPower(maxPowerKw: number | undefined): string | null {
  if (!maxPowerKw) return null;
  if (maxPowerKw >= 50) return `${maxPowerKw} kW DC Fast`;
  if (maxPowerKw >= 7) return `${maxPowerKw} kW Level 2`;
  return `${maxPowerKw} kW Level 1`;
}

// Format pricing for display
function formatPricing(perKwh?: number, perMin?: number): string | null {
  if (perKwh) return `$${perKwh.toFixed(2)}/kWh`;
  if (perMin) return `$${perMin.toFixed(2)}/min`;
  return null;
}

export function StationList() {
  const {
    stations,
    selectedStation,
    setSelectedStation,
    isLoading,
    searchQuery,
    speedFilter,
    showAvailableOnly,
    favorites,
    toggleFavorite,
    selectedVehicle,
    sortBy,
    useMiles,
  } = useAppStore();

  // Apply client-side filters
  let filteredStations = stations;

  // Search query filter
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    filteredStations = filteredStations.filter(
      (s) =>
        s.name?.toLowerCase().includes(q) ||
        s.network?.toLowerCase().includes(q) ||
        s.city?.toLowerCase().includes(q) ||
        s.address?.toLowerCase().includes(q)
    );
  }

  // Speed filter
  if (speedFilter === 'dc_fast') {
    filteredStations = filteredStations.filter((s) => (s.maxPowerKw ?? 0) >= 50);
  } else if (speedFilter === 'level2') {
    filteredStations = filteredStations.filter(
      (s) => (s.maxPowerKw ?? 0) >= 7 && (s.maxPowerKw ?? 0) < 50
    );
  }

  // Available now filter (only stations with short/no wait)
  if (showAvailableOnly) {
    filteredStations = filteredStations.filter((s) => {
      const wait = s.estimate?.etaWaitMinutes;
      return wait !== null && wait !== undefined && wait <= 5;
    });
  }

  // Vehicle compatibility filter — show compatible first, incompatible at bottom
  if (selectedVehicle) {
    const vehiclePlugs = selectedVehicle.plugTypes.map((p) => p.toUpperCase());
    const compatible = filteredStations.filter((s) =>
      s.plugTypes.some((p) => vehiclePlugs.includes(p.toUpperCase()))
    );
    const incompatible = filteredStations.filter(
      (s) => !s.plugTypes.some((p) => vehiclePlugs.includes(p.toUpperCase()))
    );
    filteredStations = [...compatible, ...incompatible];
  }

  // Sort stations
  if (sortBy === 'wait_time') {
    filteredStations = [...filteredStations].sort((a, b) => {
      const aWait = a.estimate?.etaWaitMinutes ?? 999;
      const bWait = b.estimate?.etaWaitMinutes ?? 999;
      return aWait - bWait;
    });
  } else if (sortBy === 'price') {
    filteredStations = [...filteredStations].sort((a, b) => {
      const aPrice = a.pricingPerKwh ?? a.pricingPerMinute ?? 999;
      const bPrice = b.pricingPerKwh ?? b.pricingPerMinute ?? 999;
      return aPrice - bPrice;
    });
  } else if (sortBy === 'power') {
    filteredStations = [...filteredStations].sort((a, b) => {
      return (b.maxPowerKw ?? 0) - (a.maxPowerKw ?? 0);
    });
  }
  // 'distance' is default — already sorted by distance from API

  // Get badge style based on wait time
  const getWaitBadgeStyle = (waitMinutes: number | null | undefined) => {
    if (waitMinutes === null || waitMinutes === undefined)
      return { variant: 'secondary' as const, className: 'text-xs' };
    if (waitMinutes <= 5)
      return { variant: 'default' as const, className: 'text-xs bg-emerald-600 text-white hover:bg-emerald-700' };
    if (waitMinutes <= 15)
      return { variant: 'default' as const, className: 'text-xs bg-amber-500 text-white hover:bg-amber-600' };
    return { variant: 'default' as const, className: 'text-xs bg-red-600 text-white hover:bg-red-700' };
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <Card key={i} className="p-4">
            <Skeleton className="h-4 w-3/4 mb-2" />
            <Skeleton className="h-3 w-1/2 mb-3" />
            <div className="flex gap-2">
              <Skeleton className="h-5 w-16" />
              <Skeleton className="h-5 w-20" />
            </div>
          </Card>
        ))}
      </div>
    );
  }

  if (filteredStations.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <Zap className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>No stations found nearby</p>
        <p className="text-sm">Try expanding your search radius or adjusting filters</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {filteredStations.map((station) => {
        const isSelected = selectedStation?.id === station.id;
        const waitMinutes = station.estimate?.etaWaitMinutes;
        const isFav = favorites.includes(station.id);
        const pricing = formatPricing(station.pricingPerKwh, station.pricingPerMinute);
        const power = formatPower(station.maxPowerKw);

        // Vehicle compatibility
        const isCompatible = selectedVehicle
          ? station.plugTypes.some((p) =>
              selectedVehicle.plugTypes.map((vp) => vp.toUpperCase()).includes(p.toUpperCase())
            )
          : true;

        // Reliability score: blend confidence + data quality (0-100)
        const confidence = station.estimate?.confidence ?? 0;
        const reliability = Math.round(
          (confidence * 0.6 + station.dataQualityScore * 0.4) * 100
        );
        const reliabilityLabel = reliability >= 60 ? 'High' : reliability >= 30 ? 'Med' : 'Low';
        const reliabilityColor = reliability >= 60 ? 'text-emerald-600' : reliability >= 30 ? 'text-amber-500' : 'text-gray-400';

        // Estimated charge time (10-80% = 70% of battery)
        const chargeTimeMin = selectedVehicle && station.maxPowerKw
          ? Math.round((selectedVehicle.batteryKwh * 0.7) / Math.min(station.maxPowerKw, selectedVehicle.maxChargeKw) * 60)
          : null;

        return (
          <Card
            key={station.id}
            className={`p-4 cursor-pointer transition-all hover:shadow-md ${
              isSelected ? 'ring-2 ring-primary' : ''
            } ${!isCompatible ? 'opacity-50' : ''}`}
            onClick={() => setSelectedStation(station)}
          >
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="flex items-start gap-1">
                  <h3 className="font-semibold text-sm mb-1 line-clamp-1 flex-1">{station.name}</h3>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFavorite(station.id);
                    }}
                    className="flex-shrink-0 p-0.5 -mt-0.5"
                    title={isFav ? 'Remove from favorites' : 'Add to favorites'}
                  >
                    <Heart
                      className={`w-4 h-4 transition-colors ${
                        isFav ? 'fill-red-500 text-red-500' : 'text-muted-foreground hover:text-red-400'
                      }`}
                    />
                  </button>
                </div>
                <p className="text-xs text-muted-foreground mb-2">
                  {station.network || 'Unknown Network'}
                  {station.city && ` \u2022 ${station.city}`}
                  {station.state && `, ${station.state}`}
                </p>

                <div className="flex flex-wrap gap-1.5">
                  {/* Wait time badge */}
                  <Badge variant={getWaitBadgeStyle(waitMinutes).variant} className={getWaitBadgeStyle(waitMinutes).className}>
                    <Clock className="w-3 h-3 mr-1" />
                    {waitMinutes !== null && waitMinutes !== undefined
                      ? `${waitMinutes} min`
                      : 'Unknown'}
                  </Badge>

                  {/* Power level */}
                  {power && (
                    <Badge variant="outline" className="text-xs">
                      <Gauge className="w-3 h-3 mr-1" />
                      {power}
                    </Badge>
                  )}

                  {/* Stalls */}
                  {station.stallsTotal > 0 && (
                    <Badge variant="outline" className="text-xs">
                      <Zap className="w-3 h-3 mr-1" />
                      {station.stallsTotal} stalls
                    </Badge>
                  )}

                  {/* Distance */}
                  {station.distance !== undefined && (
                    <Badge variant="outline" className="text-xs">
                      <Navigation className="w-3 h-3 mr-1" />
                      {useMiles
                        ? `${(station.distance * 0.621).toFixed(1)} mi`
                        : `${station.distance.toFixed(1)} km`}
                    </Badge>
                  )}

                  {/* Pricing */}
                  {pricing && (
                    <Badge variant="outline" className="text-xs">
                      <DollarSign className="w-3 h-3 mr-1" />
                      {pricing}
                    </Badge>
                  )}

                  {/* Charge time estimate */}
                  {chargeTimeMin && isCompatible && (
                    <Badge variant="outline" className="text-xs">
                      <BatteryCharging className="w-3 h-3 mr-1" />
                      ~{chargeTimeMin} min charge
                    </Badge>
                  )}

                  {/* Reliability */}
                  {reliability > 0 && (
                    <Badge variant="outline" className={`text-xs ${reliabilityColor}`}>
                      <ShieldCheck className="w-3 h-3 mr-1" />
                      {reliabilityLabel}
                    </Badge>
                  )}

                  {/* Incompatible warning */}
                  {!isCompatible && selectedVehicle && (
                    <Badge variant="destructive" className="text-xs">
                      <AlertTriangle className="w-3 h-3 mr-1" />
                      Incompatible
                    </Badge>
                  )}
                </div>

                {/* Plug types */}
                <div className="mt-2 flex flex-wrap gap-1">
                  {station.plugTypes.slice(0, 3).map((plug) => (
                    <span
                      key={plug}
                      className="text-xs px-2 py-0.5 bg-muted rounded-full"
                    >
                      {plug}
                    </span>
                  ))}
                  {station.plugTypes.length > 3 && (
                    <span className="text-xs px-2 py-0.5 bg-muted rounded-full">
                      +{station.plugTypes.length - 3}
                    </span>
                  )}
                </div>

                {/* Expanded details when selected */}
                {isSelected && (
                  <div className="mt-3 pt-3 border-t space-y-3">
                    {station.address && (
                      <p className="text-xs text-muted-foreground">{station.address}{station.city ? `, ${station.city}` : ''}{station.state ? `, ${station.state}` : ''} {station.zip || ''}</p>
                    )}
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${station.latitude},${station.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1.5 text-xs text-emerald-600 hover:text-emerald-500 font-medium"
                    >
                      <ExternalLink className="w-3 h-3" />
                      Get Directions
                    </a>
                    <StationPhotos stationId={station.id} />
                  </div>
                )}
              </div>

              <div className="flex flex-col items-end gap-2 ml-2">
                <ReportDialog
                  station={station}
                  trigger={
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MessageSquarePlus className="w-4 h-4" />
                    </Button>
                  }
                />
                <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
