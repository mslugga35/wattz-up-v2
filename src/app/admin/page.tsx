'use client';

/**
 * WATTZ UP v2 - Admin Dashboard
 * Overview of stations, observations, ingestion, and alerts.
 */

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Zap, Database, Activity, Bell, RefreshCw, Clock, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

interface DashboardStats {
  stations: { total: number; networks: { network: string; count: number }[] };
  observations: { last24h: number; last7d: number; byType: { type: string; count: number }[] };
  alerts: { active: number; triggered: number; expired: number };
  ingest: { lastJob: { status: string; records_processed: number; completed_at: string } | null };
}

export default function AdminPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    setLoading(true);
    setError(null);
    try {
      // Pass admin token from URL query param (e.g., /admin?token=xxx)
      const urlParams = new URLSearchParams(window.location.search);
      const token = urlParams.get('token') || '';
      const res = await fetch(`/api/admin/stats?token=${encodeURIComponent(token)}`);
      if (!res.ok) throw new Error(res.status === 401 ? 'Unauthorized — add ?token=YOUR_CRON_SECRET to URL' : `HTTP ${res.status}`);
      setStats(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchStats(); }, []);

  if (loading) {
    return (
      <div className="p-8 max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
          <Zap className="w-6 h-6" /> Wattz Up Admin
        </h1>
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="p-8 max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
          <Zap className="w-6 h-6" /> Wattz Up Admin
        </h1>
        <p className="text-red-500">{error || 'No data'}</p>
        <Button onClick={fetchStats} className="mt-4">Retry</Button>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link href="/">
            <Button variant="ghost" size="icon" className="h-9 w-9">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Zap className="w-6 h-6" /> Wattz Up Admin
          </h1>
        </div>
        <Button variant="outline" size="sm" onClick={fetchStats}>
          <RefreshCw className="w-4 h-4 mr-1" /> Refresh
        </Button>
      </div>

      {/* Top-level stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2 text-muted-foreground text-sm">
            <Database className="w-4 h-4" /> Stations
          </div>
          <p className="text-3xl font-bold">{stats.stations.total.toLocaleString()}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2 text-muted-foreground text-sm">
            <Activity className="w-4 h-4" /> Reports (24h)
          </div>
          <p className="text-3xl font-bold">{stats.observations.last24h}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2 text-muted-foreground text-sm">
            <Activity className="w-4 h-4" /> Reports (7d)
          </div>
          <p className="text-3xl font-bold">{stats.observations.last7d}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2 text-muted-foreground text-sm">
            <Bell className="w-4 h-4" /> Active Alerts
          </div>
          <p className="text-3xl font-bold">{stats.alerts.active}</p>
        </Card>
      </div>

      {/* Networks breakdown */}
      <div className="grid md:grid-cols-2 gap-6 mb-8">
        <Card className="p-4">
          <h2 className="font-semibold mb-3 flex items-center gap-2">
            <Zap className="w-4 h-4" /> Top Networks
          </h2>
          {stats.stations.networks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No data</p>
          ) : (
            <div className="space-y-2">
              {stats.stations.networks.map((n) => (
                <div key={n.network} className="flex items-center justify-between">
                  <span className="text-sm">{n.network || 'Unknown'}</span>
                  <Badge variant="secondary">{n.count}</Badge>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-4">
          <h2 className="font-semibold mb-3 flex items-center gap-2">
            <Activity className="w-4 h-4" /> Observations by Type
          </h2>
          {stats.observations.byType.length === 0 ? (
            <p className="text-sm text-muted-foreground">No observations yet</p>
          ) : (
            <div className="space-y-2">
              {stats.observations.byType.map((o) => (
                <div key={o.type} className="flex items-center justify-between">
                  <span className="text-sm">{o.type.replace('_', ' ')}</span>
                  <Badge variant="secondary">{o.count}</Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Alerts + Last Ingest */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card className="p-4">
          <h2 className="font-semibold mb-3 flex items-center gap-2">
            <Bell className="w-4 h-4" /> Alerts Summary
          </h2>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm">Active</span>
              <Badge variant="default">{stats.alerts.active}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-sm">Triggered</span>
              <Badge variant="secondary">{stats.alerts.triggered}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-sm">Expired</span>
              <Badge variant="outline">{stats.alerts.expired}</Badge>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <h2 className="font-semibold mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4" /> Last Ingest Job
          </h2>
          {stats.ingest.lastJob ? (
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm">Status</span>
                <Badge variant={stats.ingest.lastJob.status === 'completed' ? 'default' : 'destructive'}>
                  {stats.ingest.lastJob.status}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Records</span>
                <span className="text-sm font-medium">{stats.ingest.lastJob.records_processed.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm">Completed</span>
                <span className="text-sm text-muted-foreground">
                  {new Date(stats.ingest.lastJob.completed_at).toLocaleString()}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No ingest jobs yet</p>
          )}
        </Card>
      </div>
    </div>
  );
}
