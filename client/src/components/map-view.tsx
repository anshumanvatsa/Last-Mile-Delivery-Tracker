'use client';

import { useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';

interface MapPin {
  id: string;
  lat: number;
  lng: number;
  type: 'order' | 'agent';
  label: string;
  status?: string;
  isAvailable?: boolean;
  popupContent: string;
}

interface MapViewProps {
  pins: MapPin[];
  center?: [number, number];
  zoom?: number;
}

export default function MapView({ pins, center = [20.5937, 78.9629], zoom = 5 }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const initializedRef = useRef(false);

  // Initialize map once on mount
  useEffect(() => {
    if (!containerRef.current || initializedRef.current) return;

    // Prevent double-init (React strict mode / hot reload)
    if ((containerRef.current as any)._leaflet_id) return;

    initializedRef.current = true;

    import('leaflet').then((L) => {
      if (!containerRef.current) return;
      if ((containerRef.current as any)._leaflet_id) return; // already initialized

      // Fix default icon CDN issue
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
        iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
      });

      const map = L.map(containerRef.current, {
        center,
        zoom,
        zoomControl: true,
        scrollWheelZoom: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 18,
      }).addTo(map);

      mapRef.current = map;
    });

    // Cleanup on unmount
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        initializedRef.current = false;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // only on mount

  // Update markers whenever pins change (separate effect)
  useEffect(() => {
    if (!mapRef.current) return;

    import('leaflet').then((L) => {
      if (!mapRef.current) return;

      // Remove old markers
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];

      if (pins.length === 0) return;

      const newMarkers: any[] = [];

      pins.forEach((pin) => {
        // Custom icon based on type
        let html = '';
        if (pin.type === 'order') {
          html = `<div style="width:28px;height:28px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:#3b82f6;border:3px solid white;box-shadow:0 3px 10px rgba(59,130,246,0.5)"></div>`;
        } else if (pin.isAvailable) {
          html = `<div style="width:30px;height:30px;border-radius:50%;background:#22c55e;border:3px solid white;box-shadow:0 3px 10px rgba(34,197,94,0.5);display:flex;align-items:center;justify-content:center;font-size:14px">🚴</div>`;
        } else {
          html = `<div style="width:30px;height:30px;border-radius:50%;background:#ef4444;border:3px solid white;box-shadow:0 3px 10px rgba(239,68,68,0.5);display:flex;align-items:center;justify-content:center;font-size:14px">🚚</div>`;
        }

        const icon = L.divIcon({
          html,
          iconSize: [30, 30],
          iconAnchor: [15, 30],
          className: '',
        });

        const marker = L.marker([pin.lat, pin.lng], { icon })
          .bindPopup(
            `<div style="font-family:system-ui,sans-serif;min-width:180px;padding:4px">
              <div style="font-weight:600;margin-bottom:6px;color:#f8fafc">${pin.label}</div>
              ${pin.popupContent}
            </div>`,
            { maxWidth: 260 }
          )
          .addTo(mapRef.current);

        newMarkers.push(marker);
      });

      markersRef.current = newMarkers;

      // Fit bounds to markers
      try {
        const group = L.featureGroup(newMarkers);
        mapRef.current.fitBounds(group.getBounds().pad(0.2), { maxZoom: 8 });
      } catch {
        // Ignore bounds error if markers not ready
      }
    });
  }, [pins]);

  return (
    <div className="space-y-3">
      {/* Legend */}
      <div className="flex items-center gap-5 text-xs text-white/50">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-blue-500 shadow shadow-blue-500/50" />
          Active Orders ({pins.filter((p) => p.type === 'order').length})
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-green-500 shadow shadow-green-500/50" />
          Available ({pins.filter((p) => p.type === 'agent' && p.isAvailable).length})
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-500 shadow shadow-red-500/50" />
          Busy ({pins.filter((p) => p.type === 'agent' && !p.isAvailable).length})
        </div>
      </div>

      {/* Map container — must keep stable ref */}
      <div
        ref={containerRef}
        style={{ height: '520px', borderRadius: '12px', overflow: 'hidden', zIndex: 0 }}
        className="border border-white/10 bg-[#0a0f1e]"
      />
    </div>
  );
}
