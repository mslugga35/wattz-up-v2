'use client';

/**
 * WATTZ UP v2 - Trip Planner Page
 * Plan a road trip with optimal charging stops
 */

import { useState, useCallback } from 'react';
import { useAppStore } from '@/store/app';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import {
  ArrowLeft,
  Zap,
  MapPin,
  Navigation,
  Clock,
  Car,
  Fuel,
  Route,
  Loader2,
  ChevronDown,
  BatteryCharging,
  DollarSign,
  AlertTriangle,
} from 'lucide-react';
import { EV_VEHICLES } from '@/lib/data/vehicles';
import { geocodeAddress, planTrip, TripPlan, GeocodingResult } from '@/lib/trip';

export default function TripPage() {
  const { userLocation, selectedVehicle, setSelectedVehicle } = useAppStore();

  const [originQuery, setOriginQuery] = useState('');
  const [destQuery, setDestQuery] = useState('');
  const [originResults, setOriginResults] = useState<GeocodingResult[]>([]);
  const [destResults, setDestResults] = useState<GeocodingResult[]>([]);
  const [selectedOrigin, setSelectedOrigin] = useState<GeocodingResult | null>(null);
  const [selectedDest, setSelectedDest] = useState<GeocodingResult | null>(null);
  const [useCurrentLocation, setUseCurrentLocation] = useState(true);
  const [planning, setPlanning] = useState(false);
  const [tripPlan, setTripPlan] = useState<TripPlan | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Geocode with debounce
  const searchOrigin = useCallback(async () => {
    if (originQuery.length < 3) return;
    const results = await geocodeAddress(originQuery);
    setOriginResults(results);
  }, [originQuery]);

  const searchDest = useCallback(async () => {
    if (destQuery.length < 3) return;
    const results = await geocodeAddress(destQuery);
    setDestResults(results);
  }, [destQuery]);

  const handlePlanTrip = async () => {
    if (!selectedVehicle) {
      setError('Please select your vehicle first');
      return;
    }

    const origin = useCurrentLocation && userLocation
      ? { latitude: userLocation.latitude, longitude: userLocation.longitude, name: 'Current Location' }
      : selectedOrigin
        ? { latitude: selectedOrigin.latitude, longitude: selectedOrigin.longitude, name: selectedOrigin.displayName.split(',')[0] }
        : null;

    if (!origin) {
      setError('Please set your starting location');
      return;
    }

    if (!selectedDest) {
      setError('Please select a destination');
      return;
    }

    setError(null);
    setPlanning(true);
    try {
      const plan = await planTrip(
        origin,
        { latitude: selectedDest.latitude, longitude: selectedDest.longitude, name: selectedDest.displayName.split(',')[0] },
        selectedVehicle
      );
      if (!plan) {
        setError('Could not find a route. Try a different destination.');
      } else {
        setTripPlan(plan);
      }
    } catch {
      setError('Trip planning failed. Please try again.');
    } finally {
      setPlanning(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b px-4 py-3 flex items-center gap-3 bg-card sticky top-0 z-10">
        <Link href="/">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div className="flex items-center gap-2">
          <Route className="w-5 h-5 text-emerald-500" />
          <h1 className="text-lg font-bold">Trip Planner</h1>
        </div>
      </header>

      <div className="max-w-2xl mx-auto p-4 space-y-4">
        {/* Vehicle Selector */}
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Car className="w-4 h-4 text-emerald-500" />
            <h2 className="font-semibold text-sm">Your Vehicle</h2>
          </div>
          <select
            value={selectedVehicle?.id || ''}
            onChange={(e) => {
              const vehicle = EV_VEHICLES.find((v) => v.id === e.target.value) || null;
              setSelectedVehicle(vehicle);
            }}
            className="w-full px-3 py-2 border rounded-md bg-background text-sm h-10 cursor-pointer hover:border-emerald-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors"
          >
            <option value="">Select your vehicle...</option>
            {EV_VEHICLES.map((v) => (
              <option key={v.id} value={v.id}>
                {v.make} {v.model} ({v.year}) — {v.rangeKm} km range
              </option>
            ))}
          </select>
          {selectedVehicle && (
            <div className="flex gap-2 mt-2">
              <Badge variant="outline" className="text-xs">
                <BatteryCharging className="w-3 h-3 mr-1" />
                {selectedVehicle.batteryKwh} kWh
              </Badge>
              <Badge variant="outline" className="text-xs">
                <Zap className="w-3 h-3 mr-1" />
                {selectedVehicle.maxChargeKw} kW max
              </Badge>
              <Badge variant="outline" className="text-xs">
                <Navigation className="w-3 h-3 mr-1" />
                {selectedVehicle.rangeKm} km range
              </Badge>
            </div>
          )}
        </Card>

        {/* Origin */}
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <MapPin className="w-4 h-4 text-blue-500" />
            <h2 className="font-semibold text-sm">Starting From</h2>
          </div>
          <div className="space-y-2">
            <button
              onClick={() => { setUseCurrentLocation(true); setSelectedOrigin(null); }}
              className={`w-full text-left px-3 py-2 rounded-md border text-sm transition-colors ${
                useCurrentLocation
                  ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950'
                  : 'hover:border-emerald-400'
              }`}
            >
              <div className="flex items-center gap-2">
                <Navigation className="w-4 h-4" />
                <span>Current Location</span>
                {userLocation && (
                  <span className="text-xs text-muted-foreground ml-auto">
                    {userLocation.latitude.toFixed(2)}, {userLocation.longitude.toFixed(2)}
                  </span>
                )}
              </div>
            </button>
            <div className="relative">
              <Input
                placeholder="Or enter an address..."
                value={originQuery}
                onChange={(e) => { setOriginQuery(e.target.value); setUseCurrentLocation(false); }}
                onKeyDown={(e) => e.key === 'Enter' && searchOrigin()}
                className="pr-10"
              />
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1 h-8 px-2"
                onClick={searchOrigin}
              >
                <ChevronDown className="w-4 h-4" />
              </Button>
            </div>
            {originResults.length > 0 && !selectedOrigin && (
              <div className="border rounded-md divide-y max-h-40 overflow-auto">
                {originResults.map((r, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setSelectedOrigin(r);
                      setOriginQuery(r.displayName.split(',').slice(0, 2).join(','));
                      setOriginResults([]);
                      setUseCurrentLocation(false);
                    }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors"
                  >
                    {r.displayName}
                  </button>
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* Destination */}
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Fuel className="w-4 h-4 text-red-500" />
            <h2 className="font-semibold text-sm">Destination</h2>
          </div>
          <div className="relative">
            <Input
              placeholder="Where are you going?"
              value={destQuery}
              onChange={(e) => { setDestQuery(e.target.value); setSelectedDest(null); }}
              onKeyDown={(e) => e.key === 'Enter' && searchDest()}
              className="pr-10"
            />
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-1 top-1 h-8 px-2"
              onClick={searchDest}
            >
              <ChevronDown className="w-4 h-4" />
            </Button>
          </div>
          {destResults.length > 0 && !selectedDest && (
            <div className="border rounded-md divide-y max-h-40 overflow-auto mt-2">
              {destResults.map((r, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setSelectedDest(r);
                    setDestQuery(r.displayName.split(',').slice(0, 2).join(','));
                    setDestResults([]);
                  }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors"
                >
                  {r.displayName}
                </button>
              ))}
            </div>
          )}
        </Card>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 text-red-500 text-sm px-1">
            <AlertTriangle className="w-4 h-4" />
            {error}
          </div>
        )}

        {/* Plan Button */}
        <Button
          onClick={handlePlanTrip}
          disabled={planning}
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white h-12 text-base"
        >
          {planning ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Planning Route...
            </>
          ) : (
            <>
              <Route className="w-5 h-5 mr-2" />
              Plan My Trip
            </>
          )}
        </Button>

        {/* Trip Results */}
        {tripPlan && (
          <div className="space-y-4">
            {/* Summary */}
            <Card className="p-4 bg-emerald-50 dark:bg-emerald-950 border-emerald-200 dark:border-emerald-800">
              <h2 className="font-bold text-lg mb-3">Trip Summary</h2>
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center">
                  <div className="text-2xl font-bold">{tripPlan.totalDistanceKm}</div>
                  <div className="text-xs text-muted-foreground">km total</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">
                    {Math.floor(tripPlan.totalDurationMin / 60)}h {tripPlan.totalDurationMin % 60}m
                  </div>
                  <div className="text-xs text-muted-foreground">with charging</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">{tripPlan.stops.length}</div>
                  <div className="text-xs text-muted-foreground">charging stops</div>
                </div>
              </div>
            </Card>

            {/* Timeline */}
            <div className="space-y-0">
              {/* Origin */}
              <div className="flex gap-3 items-start">
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center">
                    <MapPin className="w-4 h-4 text-white" />
                  </div>
                  {tripPlan.stops.length > 0 && (
                    <div className="w-0.5 h-8 bg-gray-300 dark:bg-gray-600" />
                  )}
                </div>
                <div className="pb-4">
                  <p className="font-semibold text-sm">{tripPlan.origin.name}</p>
                  <p className="text-xs text-muted-foreground">Start — Battery 100%</p>
                </div>
              </div>

              {/* Stops */}
              {tripPlan.stops.map((stop, i) => (
                <div key={i} className="flex gap-3 items-start">
                  <div className="flex flex-col items-center">
                    <div className="w-0.5 h-4 bg-gray-300 dark:bg-gray-600" />
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      stop.station ? 'bg-emerald-500' : 'bg-amber-500'
                    }`}>
                      <Zap className="w-4 h-4 text-white" />
                    </div>
                    {i < tripPlan.stops.length - 1 && (
                      <div className="w-0.5 h-8 bg-gray-300 dark:bg-gray-600" />
                    )}
                    {i === tripPlan.stops.length - 1 && (
                      <div className="w-0.5 h-8 bg-gray-300 dark:bg-gray-600" />
                    )}
                  </div>
                  <Card className="flex-1 p-3 mb-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold text-sm">
                          {stop.station?.name || `Charging Stop ${i + 1}`}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {stop.distanceFromStartKm} km from start
                          {stop.station?.network && ` • ${stop.station.network}`}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        Stop {i + 1}
                      </Badge>
                    </div>
                    {stop.station ? (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {stop.station.maxPowerKw && (
                          <Badge variant="outline" className="text-xs">
                            <Zap className="w-3 h-3 mr-1" />
                            {stop.station.maxPowerKw} kW
                          </Badge>
                        )}
                        {stop.chargeTimeMin && (
                          <Badge variant="outline" className="text-xs">
                            <Clock className="w-3 h-3 mr-1" />
                            ~{stop.chargeTimeMin} min charge
                          </Badge>
                        )}
                        {stop.station.pricingPerKwh && (
                          <Badge variant="outline" className="text-xs">
                            <DollarSign className="w-3 h-3 mr-1" />
                            ${stop.station.pricingPerKwh.toFixed(2)}/kWh
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-xs">
                          {stop.station.stallsTotal} stalls
                        </Badge>
                      </div>
                    ) : (
                      <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        No compatible station found nearby — consider adjusting route
                      </p>
                    )}
                  </Card>
                </div>
              ))}

              {/* Destination */}
              <div className="flex gap-3 items-start">
                <div className="flex flex-col items-center">
                  <div className="w-0.5 h-4 bg-gray-300 dark:bg-gray-600" />
                  <div className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center">
                    <Fuel className="w-4 h-4 text-white" />
                  </div>
                </div>
                <div className="pt-2">
                  <p className="font-semibold text-sm">{tripPlan.destination.name}</p>
                  <p className="text-xs text-muted-foreground">Destination</p>
                </div>
              </div>
            </div>

            {/* No stops needed */}
            {tripPlan.stops.length === 0 && (
              <Card className="p-4 text-center">
                <BatteryCharging className="w-8 h-8 mx-auto mb-2 text-emerald-500" />
                <p className="font-semibold">No charging stops needed!</p>
                <p className="text-sm text-muted-foreground">
                  Your {selectedVehicle?.make} {selectedVehicle?.model} can make this trip on a full charge.
                </p>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
