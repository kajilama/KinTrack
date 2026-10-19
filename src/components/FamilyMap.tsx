import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { FamilyMember, SavedPlace, SosAlert, LocationPoint, RemoteAlarmEvent } from '../types';
import { unlockAudioContext } from '../utils/audio';
import {
  Navigation,
  Layers,
  Battery,
  BatteryCharging,
  ShieldAlert,
  AlertOctagon,
  Phone,
  MessageSquare,
  MessageCircle,
  BellRing,
  Volume2,
  MapPin,
} from 'lucide-react';

interface FamilyMapProps {
  members: Record<string, FamilyMember>;
  places: SavedPlace[];
  activeSos: SosAlert[];
  selectedMemberId: string | null;
  activeAlarms?: Record<string, RemoteAlarmEvent>;
  theme?: 'dark' | 'light';
  onSelectMember: (memberId: string | null) => void;
  onTriggerSos?: () => void;
  historyRoute?: LocationPoint[] | null;
  historyPlaybackPoint?: LocationPoint | null;
  onOpenChatWithMember?: (memberId: string) => void;
  onMapClickForPlace?: (lat: number, lng: number) => void;
  onTriggerRemoteAlarm?: (memberId: string, memberName: string) => void;
  onSilenceRemoteAlarm?: (memberId: string) => void;
  onRequestLocation?: (memberId: string) => void;
}

export const FamilyMap: React.FC<FamilyMapProps> = ({
  members,
  places,
  activeSos,
  selectedMemberId,
  activeAlarms = {},
  theme = 'dark',
  onSelectMember,
  onTriggerSos,
  historyRoute,
  historyPlaybackPoint,
  onOpenChatWithMember,
  onMapClickForPlace,
  onTriggerRemoteAlarm,
  onSilenceRemoteAlarm,
  onRequestLocation,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Record<string, L.Marker>>({});
  const circlesRef = useRef<Record<string, L.Circle>>({});
  const placeMarkersRef = useRef<Record<string, L.Marker>>({});
  const historyPolylineRef = useRef<L.Polyline | null>(null);
  const playbackMarkerRef = useRef<L.Marker | null>(null);
  const sosMarkersRef = useRef<Record<string, L.Marker>>({});
  const hasAutoCenteredRef = useRef(false);

  const [mapViewMode, setMapViewMode] = useState<'streets' | 'satellite'>('streets');
  const tileLayerRef = useRef<L.TileLayer | null>(null);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // Center on default family area
    const map = L.map(mapContainerRef.current, {
      zoomControl: false,
      attributionControl: false,
      maxZoom: 19,
      minZoom: 3,
    }).setView([37.7749, -122.4194], 14);

    mapRef.current = map;

    // Map click handler: deselect active member to dismiss sheets and unlock mobile audio context
    map.on('click', () => {
      unlockAudioContext();
      onSelectMember(null);
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update Tile Layer dynamically based on theme (dark / light) and street / satellite view
  useEffect(() => {
    const map = mapRef.current;
    const container = mapContainerRef.current;
    if (!map || !container) return;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }

    if (mapViewMode === 'satellite') {
      // Natural color satellite imagery without dark-theme invert filter
      container.classList.remove('dark-theme');
      const tileLayer = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        {
          maxZoom: 18,
          attribution: '&copy; Esri World Imagery',
        }
      ).addTo(map);
      tileLayerRef.current = tileLayer;
    } else {
      // Street Map - responds instantaneously to Light vs Dark Mode
      if (theme === 'light') {
        container.classList.remove('dark-theme');
      } else {
        container.classList.add('dark-theme');
      }
      const tileLayer = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map);
      tileLayerRef.current = tileLayer;
    }
  }, [theme, mapViewMode]);

  // Update Places (Geofence Circles)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear removed places
    const currentPlaceIds = new Set(places.map((p) => p.id));
    for (const id in circlesRef.current) {
      if (!currentPlaceIds.has(id)) {
        circlesRef.current[id].remove();
        delete circlesRef.current[id];
      }
    }
    for (const id in placeMarkersRef.current) {
      if (!currentPlaceIds.has(id)) {
        placeMarkersRef.current[id].remove();
        delete placeMarkersRef.current[id];
      }
    }

    places.forEach((place) => {
      const latlng: L.LatLngExpression = [place.lat, place.lng];

      // Geofence boundary circle
      if (!circlesRef.current[place.id]) {
        circlesRef.current[place.id] = L.circle(latlng, {
          radius: place.radiusMeters,
          color: place.color,
          fillColor: place.color,
          fillOpacity: 0.12,
          weight: 2,
          dashArray: '4, 6',
        }).addTo(map);
      } else {
        circlesRef.current[place.id].setLatLng(latlng);
        circlesRef.current[place.id].setRadius(place.radiusMeters);
        circlesRef.current[place.id].setStyle({ color: place.color, fillColor: place.color });
      }

      // Label Marker for Place
      const placeIcon = L.divIcon({
        className: 'place-marker',
        html: `
          <div style="transform: translate(-50%, -100%);" class="flex flex-col items-center pointer-events-auto cursor-pointer">
            <div class="px-2 py-0.5 rounded-full bg-slate-900/90 text-[10px] font-semibold text-slate-200 border border-slate-700/80 shadow-md whitespace-nowrap flex items-center gap-1">
              <span class="w-1.5 h-1.5 rounded-full" style="background-color: ${place.color};"></span>
              ${place.name}
            </div>
            <div class="w-1.5 h-1.5 bg-slate-900 rotate-45 -mt-0.5 border-r border-b border-slate-700"></div>
          </div>
        `,
        iconSize: [0, 0],
      });

      if (!placeMarkersRef.current[place.id]) {
        placeMarkersRef.current[place.id] = L.marker(latlng, {
          icon: placeIcon,
          interactive: false,
        }).addTo(map);
      } else {
        placeMarkersRef.current[place.id].setLatLng(latlng);
        placeMarkersRef.current[place.id].setIcon(placeIcon);
      }
    });
  }, [places]);

  // Update Member Markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const memberIds = Object.keys(members);

    // Remove obsolete markers
    for (const id in markersRef.current) {
      if (!members[id]) {
        markersRef.current[id].remove();
        delete markersRef.current[id];
      }
    }

    memberIds.forEach((id) => {
      const member = members[id];
      const isSelected = selectedMemberId === id;
      const isDriving = member.speedMph >= 15;
      const latlng: L.LatLngExpression = [member.location.lat, member.location.lng];
      const speedLimit = member.currentSpeedLimitMph || member.location.speedLimitMph || 35;
      const isOverLimit = isDriving && member.speedMph > speedLimit + 5;
      const roadName = member.currentRoadName || member.location.roadName || '';

      const html = `
        <div class="relative cursor-pointer group flex flex-col items-center" style="transform: translate(-50%, -50%);">
          <!-- Pulse ring if driving or active -->
          <div class="absolute inset-0 -m-2 rounded-full pointer-events-none ${
            isOverLimit
              ? 'bg-rose-500/50 animate-ping'
              : isDriving
              ? 'bg-amber-400/40 animate-ping'
              : isSelected
              ? 'bg-indigo-400/30 animate-pulse'
              : ''
          }"></div>

          <!-- Avatar Container -->
          <div class="relative w-12 h-12 rounded-full ring-4 shadow-xl overflow-hidden transition-transform transform group-hover:scale-110 ${
            isOverLimit
              ? 'ring-rose-500 scale-105'
              : isSelected
              ? 'ring-indigo-400 scale-105'
              : 'ring-white/90'
          }" style="border: 2px solid ${member.color}; background-color: #0f172a;">
            <img src="${member.avatar}" alt="${member.name}" class="w-full h-full object-cover" />
          </div>

          <!-- Battery badge -->
          <div class="absolute -top-1 -right-1 flex items-center gap-0.5 px-1 py-0.2 rounded-full bg-slate-900/90 text-[9px] font-bold text-white border border-slate-700 shadow-sm pointer-events-none">
            <span>${member.battery}%</span>
          </div>

          <!-- Speed & Auto Road Speed Limit Sign Badges -->
          ${
            member.speedMph > 0
              ? `
            <div class="mt-1 flex items-center gap-1 shadow-2xl pointer-events-none">
              <!-- Live Driving Speed Badge -->
              <div class="flex items-center gap-1 px-1.5 py-0.5 rounded-lg text-[10px] font-black text-white shadow border ${
                isOverLimit
                  ? 'bg-rose-600 border-rose-400 animate-pulse ring-1 ring-rose-400'
                  : 'bg-indigo-600 border-indigo-400/50'
              }">
                <span>${isDriving ? '🚗' : '🚶'}</span>
                <span>${member.speedMph} mph</span>
              </div>

              <!-- Official Road Speed Limit Sign (Auto-Detected from OSM) -->
              ${
                isDriving
                  ? `
                <div class="w-7 h-9 bg-white rounded-md border-2 border-black p-0.5 flex flex-col items-center justify-between shadow-lg text-black leading-none shrink-0" title="Auto-detected road speed limit: ${speedLimit} mph">
                  <span style="font-size: 5px; font-weight: 900; letter-spacing: -0.5px;">SPEED</span>
                  <span style="font-size: 5px; font-weight: 900; letter-spacing: -0.5px;">LIMIT</span>
                  <span style="font-size: 11px; font-weight: 900;">${speedLimit}</span>
                </div>
                `
                  : ''
              }
            </div>

            ${
              roadName && isDriving
                ? `
              <div class="mt-0.5 px-1.5 py-0.2 rounded bg-slate-950/90 border border-slate-800 text-[9px] font-semibold text-slate-300 max-w-[120px] truncate shadow pointer-events-none">
                ${roadName}
              </div>
              `
                : ''
            }
            `
              : `
            <div class="mt-1 px-1.5 py-0.2 rounded-full bg-slate-900/90 text-[9px] font-semibold text-slate-300 shadow border border-slate-700 whitespace-nowrap pointer-events-none">
              ${member.role}
            </div>
            `
          }
        </div>
      `;

      const customIcon = L.divIcon({
        className: 'member-pin',
        html,
        iconSize: [60, 60],
        iconAnchor: [30, 30],
      });

      if (!markersRef.current[id]) {
        const marker = L.marker(latlng, { icon: customIcon }).addTo(map);
        marker.on('click', () => {
          onSelectMember(id);
        });
        markersRef.current[id] = marker;
      } else {
        markersRef.current[id].setLatLng(latlng);
        markersRef.current[id].setIcon(customIcon);
      }
    });
  }, [members, selectedMemberId, onSelectMember]);

  // Center on selected member
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedMemberId) return;

    const member = members[selectedMemberId];
    if (member) {
      map.flyTo([member.location.lat, member.location.lng], 15, {
        duration: 1.2,
      });
    }
  }, [selectedMemberId]);

  // Active SOS alert beacons
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear stale SOS markers
    for (const id in sosMarkersRef.current) {
      sosMarkersRef.current[id].remove();
      delete sosMarkersRef.current[id];
    }

    activeSos.forEach((sos) => {
      const sosIcon = L.divIcon({
        className: 'sos-marker',
        html: `
          <div style="transform: translate(-50%, -50%);" class="relative flex items-center justify-center">
            <div class="absolute w-20 h-20 rounded-full bg-rose-500/30 animate-ping"></div>
            <div class="absolute w-12 h-12 rounded-full bg-rose-600/40 animate-pulse"></div>
            <div class="relative w-8 h-8 rounded-full bg-rose-600 text-white font-extrabold flex items-center justify-center shadow-2xl border-2 border-white text-xs">
              SOS
            </div>
          </div>
        `,
        iconSize: [40, 40],
      });

      sosMarkersRef.current[sos.id] = L.marker([sos.lat, sos.lng], {
        icon: sosIcon,
        zIndexOffset: 1000,
      }).addTo(map);
    });
  }, [activeSos]);

  // Render 30-day history route polyline if active
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (historyPolylineRef.current) {
      historyPolylineRef.current.remove();
      historyPolylineRef.current = null;
    }

    if (historyRoute && historyRoute.length > 1) {
      const latlngs = historyRoute.map((pt) => [pt.lat, pt.lng] as [number, number]);
      const polyline = L.polyline(latlngs, {
        color: '#38bdf8',
        weight: 4,
        opacity: 0.8,
        dashArray: '6, 8',
      }).addTo(map);

      historyPolylineRef.current = polyline;
      map.fitBounds(polyline.getBounds(), { padding: [50, 50] });
    }
  }, [historyRoute]);

  // Playback marker on history route
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (playbackMarkerRef.current) {
      playbackMarkerRef.current.remove();
      playbackMarkerRef.current = null;
    }

    if (historyPlaybackPoint) {
      const playbackIcon = L.divIcon({
        className: 'playback-icon',
        html: `
          <div style="transform: translate(-50%, -50%);" class="relative">
            <div class="w-6 h-6 rounded-full bg-sky-400 ring-4 ring-white shadow-xl flex items-center justify-center text-[10px]">
              🚗
            </div>
          </div>
        `,
        iconSize: [24, 24],
      });

      playbackMarkerRef.current = L.marker(
        [historyPlaybackPoint.lat, historyPlaybackPoint.lng],
        { icon: playbackIcon, zIndexOffset: 999 }
      ).addTo(map);
    }
  }, [historyPlaybackPoint]);

  // Fit all family members in screen
  const fitAllFamily = () => {
    const map = mapRef.current;
    if (!map) return;

    const latlngs = Object.values(members).map((m) => [m.location.lat, m.location.lng] as [number, number]);
    if (latlngs.length > 0) {
      const bounds = L.latLngBounds(latlngs);
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 16 });
    }
  };

  // Automatically fit bounds when members load
  useEffect(() => {
    const memberCount = Object.keys(members).length;
    if (memberCount > 0 && !hasAutoCenteredRef.current) {
      fitAllFamily();
      hasAutoCenteredRef.current = true;
    }
  }, [Object.keys(members).length]);

  const selectedMember = selectedMemberId ? members[selectedMemberId] : null;

  return (
    <div className="relative w-full h-full overflow-hidden">
      {/* Map Canvas */}
      <div ref={mapContainerRef} className={`w-full h-full z-0 ${theme === 'light' ? 'bg-slate-100' : 'bg-slate-950'}`} />

      {/* Auto Road Speed Limit HUD when a member is driving or selected */}
      {(() => {
        const drivingMember =
          (selectedMember && selectedMember.speedMph >= 10 ? selectedMember : null) ||
          Object.values(members).find((m) => m.speedMph >= 15);

        if (!drivingMember) return null;

        const speedLimit = drivingMember.currentSpeedLimitMph || drivingMember.location.speedLimitMph || 35;
        const isOver = drivingMember.speedMph > speedLimit + 5;
        const road = drivingMember.currentRoadName || drivingMember.location.roadName || 'Monitored Road';

        return (
          <div className="absolute top-26 left-3 sm:left-4 z-20 flex items-center gap-2.5 p-2 rounded-2xl bg-slate-900/95 backdrop-blur-md border border-slate-700/80 shadow-2xl animate-in fade-in slide-in-from-left-2 text-xs max-w-[85vw] sm:max-w-md ring-1 ring-white/10">
            {/* Authentic Speed Limit Sign */}
            <div className="w-8 h-10 bg-white rounded-md border-2 border-black p-0.5 flex flex-col items-center justify-between shadow text-black leading-none shrink-0">
              <span className="text-[5px] font-black uppercase tracking-tighter">SPEED</span>
              <span className="text-[5px] font-black uppercase tracking-tighter">LIMIT</span>
              <span className="text-xs font-black">{speedLimit}</span>
            </div>

            <div className="leading-tight truncate pr-1">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-white text-xs truncate">
                  {drivingMember.name} • {drivingMember.speedMph} mph
                </span>
                <span
                  className={`text-[9px] px-1.5 py-0.2 rounded font-black shrink-0 ${
                    isOver
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse'
                      : 'bg-emerald-500/20 text-emerald-300'
                  }`}
                >
                  {isOver ? `+${drivingMember.speedMph - speedLimit} mph OVER` : 'Under Limit'}
                </span>
              </div>
              <span className="text-[10px] text-slate-400 block truncate mt-0.5">
                📍 {road} • <span className="text-indigo-400 font-semibold">Auto-detected Speed Limit</span>
              </span>
            </div>
          </div>
        );
      })()}

      {/* Floating Map Controls in Top Right Corner */}
      <div className="absolute right-3 top-16 z-20 flex flex-col gap-2.5 items-end">
        {/* 1. Current Location / Center Family */}
        <button
          onClick={fitAllFamily}
          className={`w-11 h-11 rounded-2xl backdrop-blur-md border flex items-center justify-center shadow-xl transition active:scale-95 group ${
            theme === 'light'
              ? 'bg-white/95 border-slate-300 text-slate-700 hover:bg-slate-100'
              : 'bg-slate-900/90 border-slate-700/80 text-slate-200 hover:bg-slate-800'
          }`}
          title="Current Location / Center All Family"
        >
          <Navigation className="w-5 h-5 text-indigo-500 group-hover:scale-110 transition" />
        </button>

        {/* 2. Street vs Satellite View Toggle Button (Icon Only) */}
        <button
          onClick={() =>
            setMapViewMode((curr) => (curr === 'satellite' ? 'streets' : 'satellite'))
          }
          className={`w-11 h-11 rounded-2xl backdrop-blur-md border flex items-center justify-center shadow-xl transition active:scale-95 group ${
            theme === 'light'
              ? 'bg-white/95 border-slate-300 text-slate-700 hover:bg-slate-100'
              : 'bg-slate-900/90 border-slate-700/80 text-slate-200 hover:bg-slate-800'
          }`}
          title={mapViewMode === 'satellite' ? 'Switch to Street View' : 'Switch to Satellite View'}
        >
          <Layers className={`w-5 h-5 transition ${mapViewMode === 'satellite' ? 'text-amber-400 scale-110' : 'text-sky-400 group-hover:scale-110'}`} />
        </button>

        {/* 3. Emergency SOS Button - Just below satellite/street view toggle */}
        <button
          onClick={onTriggerSos}
          className="w-11 h-11 rounded-2xl bg-rose-600/95 hover:bg-rose-500 border border-rose-400/50 text-white flex flex-col items-center justify-center shadow-xl shadow-rose-900/40 transition active:scale-95 animate-pulse"
          title="Emergency SOS Alarm"
        >
          <AlertOctagon className="w-5 h-5 text-white" />
          <span className="text-[8px] font-black tracking-tighter">SOS</span>
        </button>
      </div>
    </div>
  );
};
