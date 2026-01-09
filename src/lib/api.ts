/**
 * WATTZ UP v2 - API Client
 * Fetch wrapper for all API calls
 */

import { NearbyStationsResponse, StationWithEstimate, SubmitObservationRequest } from '@/types';

const API_BASE = '/api';

// Get device ID from localStorage
function getDeviceId(): string {
  if (typeof window === 'undefined') return '';

  const stored = localStorage.getItem('wattz-up-storage');
  if (stored) {
    const parsed = JSON.parse(stored);
    return parsed.state?.deviceId || '';
  }
  return '';
}

// Common fetch with device ID header
async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const deviceId = getDeviceId();

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Device-Id': deviceId,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `API error: ${response.status}`);
  }

  return response.json();
}

// ============ STATIONS ============

export async function fetchNearbyStations(
  latitude: number,
  longitude: number,
  options: {
    radiusKm?: number;
    network?: string;
    plugTypes?: string[];
    limit?: number;
  } = {}
): Promise<NearbyStationsResponse> {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
  });

  if (options.radiusKm) params.set('radiusKm', String(options.radiusKm));
  if (options.network) params.set('network', options.network);
  if (options.plugTypes?.length) params.set('plugTypes', options.plugTypes.join(','));
  if (options.limit) params.set('limit', String(options.limit));

  return apiFetch(`/stations/nearby?${params}`);
}

export async function fetchStation(id: string): Promise<{
  station: StationWithEstimate;
  estimate: unknown;
}> {
  return apiFetch(`/stations/${id}`);
}

// ============ OBSERVATIONS ============

export async function submitObservation(data: SubmitObservationRequest): Promise<{
  observation: { id: string };
  message: string;
}> {
  return apiFetch('/observations', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function fetchObservations(stationId: string): Promise<{
  observations: unknown[];
  stationId: string;
}> {
  return apiFetch(`/observations?stationId=${stationId}`);
}

// ============ USERS ============

export async function registerDevice(
  deviceId: string,
  platform: 'ios' | 'android' | 'web'
): Promise<{
  user: { id: string; deviceId: string; platform: string; trustScore: number };
  message: string;
}> {
  return apiFetch('/users/register', {
    method: 'POST',
    body: JSON.stringify({ deviceId, platform, locationConsent: true }),
  });
}

// ============ ALERTS ============

export async function createAlert(data: {
  stationId: string;
  conditionType: 'stalls_available';
  conditionValue: number;
}): Promise<{
  alert: { id: string };
  message: string;
}> {
  return apiFetch('/alerts', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function fetchAlerts(): Promise<{
  alerts: unknown[];
  count: number;
}> {
  return apiFetch('/alerts');
}

export async function deleteAlert(alertId: string): Promise<{ message: string }> {
  return apiFetch(`/alerts?id=${alertId}`, { method: 'DELETE' });
}
