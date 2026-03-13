'use client';

/**
 * Station Photos — upload + gallery
 * Community-contributed station photos via Supabase Storage
 */

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/store/app';
import { Camera, Upload, Loader2, Image as ImageIcon, X } from 'lucide-react';
import { toast } from 'sonner';

interface Photo {
  name: string;
  url: string;
  createdAt: string;
}

interface StationPhotosProps {
  stationId: string;
}

export function StationPhotos({ stationId }: StationPhotosProps) {
  const { deviceId } = useAppStore();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch photos
  useEffect(() => {
    async function fetchPhotos() {
      try {
        const res = await fetch(`/api/stations/photos?stationId=${stationId}`);
        if (res.ok) {
          const data = await res.json();
          setPhotos(data.photos || []);
        }
      } catch {
        // Silently fail — photos are optional
      } finally {
        setLoading(false);
      }
    }
    fetchPhotos();
  }, [stationId]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !deviceId) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('stationId', stationId);
      formData.append('deviceId', deviceId);

      const res = await fetch('/api/stations/photos', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        setPhotos((prev) => [{ name: file.name, url: data.url, createdAt: new Date().toISOString() }, ...prev]);
        toast.success('Photo uploaded!');
      } else {
        const err = await res.json();
        toast.error(err.error || 'Upload failed');
      }
    } catch {
      toast.error('Upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Camera className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">Photos</span>
          {photos.length > 0 && (
            <span className="text-xs text-muted-foreground">({photos.length})</span>
          )}
        </div>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleUpload}
            className="hidden"
          />
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Upload className="w-3 h-3" />
            )}
            Add Photo
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex gap-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="w-20 h-20 rounded-md bg-muted animate-pulse" />
          ))}
        </div>
      ) : photos.length > 0 ? (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {photos.map((photo) => (
            <button
              key={photo.name}
              onClick={() => setSelectedPhoto(photo.url)}
              className="flex-shrink-0 w-20 h-20 rounded-md overflow-hidden border hover:ring-2 hover:ring-emerald-500 transition-all"
            >
              <img
                src={photo.url}
                alt="Station photo"
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </button>
          ))}
        </div>
      ) : (
        <div className="text-xs text-muted-foreground flex items-center gap-1">
          <ImageIcon className="w-3 h-3" />
          No photos yet — be the first to add one!
        </div>
      )}

      {/* Lightbox */}
      {selectedPhoto && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setSelectedPhoto(null)}
        >
          <button
            className="absolute top-4 right-4 text-white hover:text-gray-300"
            onClick={() => setSelectedPhoto(null)}
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={selectedPhoto}
            alt="Station photo"
            className="max-w-full max-h-full rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
