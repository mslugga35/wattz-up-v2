'use client';

/**
 * Report Wait Time Dialog
 * Users can report current station conditions
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Clock, Users, Zap, CheckCircle } from 'lucide-react';
import { StationWithEstimate, ObservationType } from '@/types';
import { submitObservation } from '@/lib/api';
import { useAppStore } from '@/store/app';
import { toast } from 'sonner';

interface ReportDialogProps {
  station: StationWithEstimate;
  trigger?: React.ReactNode;
}

export function ReportDialog({ station, trigger }: ReportDialogProps) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedType, setSelectedType] = useState<ObservationType | null>(null);
  const [queuePosition, setQueuePosition] = useState<number | null>(null);
  const [stallsAvailable, setStallsAvailable] = useState<number | null>(null);
  const { deviceId } = useAppStore();

  const observationTypes: { id: ObservationType; label: string; icon: typeof CheckCircle; color: string }[] = [
    { id: 'available', label: 'Available Now', icon: CheckCircle, color: 'bg-green-500' },
    { id: 'short_wait', label: '< 10 min wait', icon: Clock, color: 'bg-yellow-500' },
    { id: 'long_wait', label: '10+ min wait', icon: Users, color: 'bg-orange-500' },
    { id: 'full', label: 'All Full', icon: Zap, color: 'bg-red-500' },
  ];

  const handleSubmit = async () => {
    if (!selectedType || !deviceId) return;

    setSubmitting(true);
    try {
      await submitObservation({
        stationId: station.id,
        deviceId,
        observationType: selectedType,
        queuePosition,
        stallsAvailable,
      });

      toast.success('Thanks for reporting!', {
        description: 'Your observation helps other EV drivers.',
      });
      setOpen(false);
      setSelectedType(null);
      setQueuePosition(null);
      setStallsAvailable(null);
    } catch (error) {
      toast.error('Failed to submit', {
        description: 'Please try again.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-1">
            <Clock className="w-4 h-4" />
            Report Status
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Report Station Status</DialogTitle>
          <DialogDescription>
            Help others know what to expect at {station.name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Quick status buttons */}
          <div className="grid grid-cols-2 gap-2">
            {observationTypes.map((type) => (
              <button
                key={type.id}
                onClick={() => setSelectedType(type.id as ObservationType)}
                className={`p-3 rounded-lg border-2 transition-all ${
                  selectedType === type.id
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className={`p-1.5 rounded-full ${type.color}`}>
                    <type.icon className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-sm font-medium">{type.label}</span>
                </div>
              </button>
            ))}
          </div>

          {/* Optional details */}
          {selectedType && (
            <div className="space-y-3 pt-2 border-t">
              <p className="text-sm text-muted-foreground">Optional details:</p>

              <div className="flex items-center gap-2">
                <span className="text-sm">Cars waiting:</span>
                <div className="flex gap-1">
                  {[0, 1, 2, 3, 4, 5].map((num) => (
                    <Button
                      key={num}
                      variant={queuePosition === num ? 'default' : 'outline'}
                      size="sm"
                      className="w-8 h-8 p-0"
                      onClick={() => setQueuePosition(num)}
                    >
                      {num === 5 ? '5+' : num}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm">Stalls open:</span>
                <div className="flex gap-1">
                  {[0, 1, 2, 3, 4].map((num) => (
                    <Button
                      key={num}
                      variant={stallsAvailable === num ? 'default' : 'outline'}
                      size="sm"
                      className="w-8 h-8 p-0"
                      onClick={() => setStallsAvailable(num)}
                    >
                      {num === 4 ? '4+' : num}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!selectedType || submitting}>
            {submitting ? 'Submitting...' : 'Submit Report'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
