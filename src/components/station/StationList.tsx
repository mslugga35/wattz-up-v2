'use client';

/**
 * WATTZ UP v2 - Station List Component
 * Scrollable list of nearby stations
 */

import { useAppStore } from '@/store/app';
import { StationWithEstimate } from '@/types';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ReportDialog } from './ReportDialog';
import { Zap, Clock, Navigation, ChevronRight, MessageSquarePlus } from 'lucide-react';

interface StationListProps {
  onStationSelect?: (station: StationWithEstimate) => void;
}

export function StationList({ onStationSelect }: StationListProps) {
  const { stations, selectedStation, setSelectedStation, isLoading } = useAppStore();

  const handleSelect = (station: StationWithEstimate) => {
    setSelectedStation(station);
    onStationSelect?.(station);
  };

  // Get badge color based on wait time
  const getWaitBadgeColor = (waitMinutes: number | null | undefined) => {
    if (waitMinutes === null || waitMinutes === undefined) return 'secondary';
    if (waitMinutes <= 5) return 'default';
    if (waitMinutes <= 15) return 'secondary';
    return 'destructive';
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

  if (stations.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <Zap className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>No stations found nearby</p>
        <p className="text-sm">Try expanding your search radius</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {stations.map((station) => {
        const isSelected = selectedStation?.id === station.id;
        const waitMinutes = station.estimate?.etaWaitMinutes;

        return (
          <Card
            key={station.id}
            className={`p-4 cursor-pointer transition-all hover:shadow-md ${
              isSelected ? 'ring-2 ring-primary' : ''
            }`}
            onClick={() => handleSelect(station)}
          >
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <h3 className="font-semibold text-sm mb-1 line-clamp-1">{station.name}</h3>
                <p className="text-xs text-muted-foreground mb-2">
                  {station.network || 'Unknown Network'}
                  {station.city && ` • ${station.city}`}
                </p>

                <div className="flex flex-wrap gap-2">
                  {/* Wait time badge */}
                  <Badge variant={getWaitBadgeColor(waitMinutes)} className="text-xs">
                    <Clock className="w-3 h-3 mr-1" />
                    {waitMinutes !== null && waitMinutes !== undefined
                      ? `${waitMinutes} min`
                      : 'Unknown'}
                  </Badge>

                  {/* Stalls */}
                  {station.stallsTotal && (
                    <Badge variant="outline" className="text-xs">
                      <Zap className="w-3 h-3 mr-1" />
                      {station.stallsTotal} stalls
                    </Badge>
                  )}

                  {/* Distance */}
                  {station.distance !== undefined && (
                    <Badge variant="outline" className="text-xs">
                      <Navigation className="w-3 h-3 mr-1" />
                      {station.distance.toFixed(1)} km
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
