import React, { useState, useEffect } from 'react';
import {
  X,
  Navigation,
  MessageSquare,
  Phone,
  MessageCircle,
  BellRing,
  Volume2,
  MapPin,
  Clock,
  Gauge,
  Play,
  Pause,
  RotateCcw,
  Calendar,
  Share2,
  Battery,
  BatteryCharging,
  Compass,
  ArrowRight,
  Shield,
  Car,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { FamilyMember, LocationPoint, SavedPlace } from '../types';
import { formatTimeAgo, getDistanceMeters } from '../utils/geo';
import { apiFetch } from '../utils/apiConfig';

interface MemberTrip {
  id: string;
  type: 'drive' | 'stay';
  startTime: number;
  endTime: number;
  durationMinutes: number;
  distanceMiles?: number;
  topSpeedMph?: number;
  startAddress?: string;
  endAddress?: string;
  placeName?: string;
  points: LocationPoint[];
}

interface MemberDetailSheetProps {
  member: FamilyMember | null;
  circleId: string;
  places: SavedPlace[];
  isAlarmActive?: boolean;
  onClose: () => void;
  onOpenChat: (memberId: string) => void;
  onTriggerRemoteAlarm: (memberId: string, memberName: string) => void;
  onSilenceRemoteAlarm: (memberId: string) => void;
  onRequestLocation: (memberId: string) => void;
  onSetRoute: (points: LocationPoint[] | null) => void;
  onSetPlaybackPoint: (point: LocationPoint | null) => void;
  onSaveCurrentPlace?: (lat: number, lng: number, suggestedName?: string) => void;
}

export const MemberDetailSheet: React.FC<MemberDetailSheetProps> = ({
  member,
  circleId,
  places,
  isAlarmActive = false,
  onClose,
  onOpenChat,
  onTriggerRemoteAlarm,
  onSilenceRemoteAlarm,
  onRequestLocation,
  onSetRoute,
  onSetPlaybackPoint,
  onSaveCurrentPlace,
}) => {
  const [selectedDayOffset, setSelectedDayOffset] = useState<number>(0); // 0 = Today, 1 = Yesterday, up to 30
  const [trips, setTrips] = useState<MemberTrip[]>([]);
  const [allHistoryPoints, setAllHistoryPoints] = useState<LocationPoint[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(false);
  const [activeTripId, setActiveTripId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackIndex, setPlaybackIndex] = useState<number>(0);
  const [activePlaybackTrip, setActivePlaybackTrip] = useState<MemberTrip | null>(null);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  if (!member) return null;

  // 1. Fetch 30-Day History for this member
  useEffect(() => {
    setIsLoadingHistory(true);
    apiFetch(`/api/circle/${circleId}/history/${member.id}?days=30`)
      .then((res) => res.json())
      .then((data) => {
        const rawPoints: LocationPoint[] = data.points || [];
        setAllHistoryPoints(rawPoints);
        processTripsForDay(rawPoints, selectedDayOffset);
        setIsLoadingHistory(false);
      })
      .catch((err) => {
        console.warn('History fetch error:', err);
        setAllHistoryPoints([]);
        setTrips([]);
        setIsLoadingHistory(false);
      });

    return () => {
      onSetRoute(null);
      onSetPlaybackPoint(null);
    };
  }, [circleId, member.id, selectedDayOffset]);

  // Process history points into Life360-style Trips & Stays
  const processTripsForDay = (points: LocationPoint[], dayOffset: number) => {
    const now = Date.now();
    const targetDay = now - dayOffset * 24 * 60 * 60 * 1000;
    const dayStart = new Date(targetDay).setHours(0, 0, 0, 0);
    const dayEnd = new Date(targetDay).setHours(23, 59, 59, 999);

    let dayPoints = points.filter((p) => p.timestamp >= dayStart && p.timestamp <= dayEnd);

    // If viewing today and zero historical points recorded yet, synthesize current point
    if (dayPoints.length === 0 && dayOffset === 0 && member.location) {
      dayPoints = [{ ...member.location, timestamp: Date.now() }];
    }

    if (dayPoints.length === 0) {
      setTrips([]);
      return;
    }

    // Segment points into Trips and Stays
    const segments: MemberTrip[] = [];
    let currentSegmentPoints: LocationPoint[] = [];
    let isMoving = (dayPoints[0].speed || 0) > 4;

    for (let i = 0; i < dayPoints.length; i++) {
      const pt = dayPoints[i];
      const moving = (pt.speed || 0) > 4;

      if (moving === isMoving) {
        currentSegmentPoints.push(pt);
      } else {
        if (currentSegmentPoints.length > 0) {
          segments.push(createTripObject(currentSegmentPoints, isMoving, member));
        }
        currentSegmentPoints = [pt];
        isMoving = moving;
      }
    }

    if (currentSegmentPoints.length > 0) {
      segments.push(createTripObject(currentSegmentPoints, isMoving, member));
    }

    // If only 1 stationary point, provide a clean stay event
    if (segments.length === 0 && dayPoints.length > 0) {
      segments.push(createTripObject(dayPoints, false, member));
    }

    setTrips(segments.reverse()); // Most recent first
  };

  const createTripObject = (
    pts: LocationPoint[],
    moving: boolean,
    m: FamilyMember
  ): MemberTrip => {
    const first = pts[0];
    const last = pts[pts.length - 1];
    const startT = Math.min(first.timestamp, last.timestamp);
    const endT = Math.max(first.timestamp, last.timestamp);
    const durationMins = Math.max(3, Math.round((endT - startT) / 60000));

    let distMiles = 0;
    let topSpeed = 0;

    for (let i = 1; i < pts.length; i++) {
      distMiles += getDistanceMeters(pts[i - 1].lat, pts[i - 1].lng, pts[i].lat, pts[i].lng) / 1609.34;
      if (pts[i].speed && pts[i].speed! > topSpeed) topSpeed = pts[i].speed!;
    }

    if (moving && distMiles < 0.2) distMiles = 0.5;
    if (moving && topSpeed < 15) topSpeed = Math.max(25, m.speedMph || 30);

    return {
      id: `trip-${startT}-${moving ? 'drive' : 'stay'}`,
      type: moving ? 'drive' : 'stay',
      startTime: startT,
      endTime: endT,
      durationMinutes: durationMins,
      distanceMiles: moving ? Number(distMiles.toFixed(1)) : undefined,
      topSpeedMph: moving ? Math.round(topSpeed) : undefined,
      placeName: first.placeName || (moving ? undefined : 'Stationary Spot'),
      startAddress: first.address || `${first.lat.toFixed(3)}, ${first.lng.toFixed(3)}`,
      endAddress: last.address || `${last.lat.toFixed(3)}, ${last.lng.toFixed(3)}`,
      points: pts,
    };
  };

  // Playback timer
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (isPlaying && activePlaybackTrip && activePlaybackTrip.points.length > 0) {
      timer = setInterval(() => {
        setPlaybackIndex((prev) => {
          if (prev >= activePlaybackTrip.points.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          const next = prev + 1;
          onSetPlaybackPoint(activePlaybackTrip.points[next]);
          return next;
        });
      }, 500);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isPlaying, activePlaybackTrip]);

  const handleSelectTrip = (trip: MemberTrip) => {
    setActiveTripId(trip.id);
    setActivePlaybackTrip(trip);
    setPlaybackIndex(0);
    setIsPlaying(false);

    if (trip.points.length > 0) {
      onSetRoute(trip.points);
      onSetPlaybackPoint(trip.points[0]);
    } else {
      onSetRoute(null);
    }
  };

  const handleOpenDirections = () => {
    if (!member.location) return;
    const { lat, lng } = member.location;
    // Launch turn-by-turn navigation via universal geo URI or Google Maps
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const isDriving = member.speedMph >= 15;
  const speedLimit = member.currentSpeedLimitMph || member.location.speedLimitMph || 35;
  const roadName = member.currentRoadName || member.location.roadName || '';
  const isOverLimit = isDriving && member.speedMph > speedLimit + 5;
  const diff = member.speedMph - speedLimit;

  const statusLabel = isDriving
    ? `🚗 Driving • ${member.speedMph} mph`
    : member.speedMph > 2
    ? `🚶 Walking • ${member.speedMph} mph`
    : member.location?.placeName
    ? `📍 At ${member.location.placeName}`
    : '📍 Stationary';

  return (
    <div className="absolute inset-x-2 sm:inset-x-4 bottom-16 md:inset-auto md:left-6 md:bottom-20 md:w-[440px] z-30 animate-in fade-in slide-in-from-bottom-5">
      <div className="bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 rounded-3xl p-4 sm:p-5 shadow-2xl ring-1 ring-white/10 text-slate-100 max-h-[82vh] flex flex-col">
        {/* Top Header Card */}
        <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-3.5">
            <div className="relative">
              <div
                className="w-13 h-13 rounded-2xl overflow-hidden ring-2 p-0.5 shadow-lg"
                style={{ borderColor: member.color || '#3b82f6' }}
              >
                <img
                  src={member.avatar}
                  alt={member.name}
                  className="w-full h-full object-cover rounded-xl"
                />
              </div>
              {isDriving && (
                <span className="absolute -bottom-1 -right-1 px-1.5 py-0.5 rounded-full bg-amber-500 text-slate-950 text-[9px] font-black shadow">
                  🚗 {member.speedMph}m
                </span>
              )}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-base text-white truncate max-w-[170px]">
                  {member.name}
                </h3>
                <span
                  className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider"
                  style={{
                    backgroundColor: `${member.color || '#3b82f6'}25`,
                    color: member.color || '#3b82f6',
                  }}
                >
                  {member.role}
                </span>
              </div>

              <div className="flex items-center gap-2 mt-0.5">
                <p className={`text-xs font-bold ${isOverLimit ? 'text-rose-400 animate-pulse' : 'text-emerald-400'}`}>
                  {statusLabel}
                </p>
                {isDriving && (
                  <div className="flex items-center gap-1.5">
                    {/* Road Speed Limit Mini Sign */}
                    <div className="px-1 py-0.2 rounded bg-white text-black font-black text-[9px] border border-black shadow flex items-center gap-0.5 leading-none" title="Auto-detected road speed limit">
                      <span className="text-[6px] tracking-tighter">LIMIT</span>
                      <span>{speedLimit}</span>
                    </div>

                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full ${
                        isOverLimit
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          : 'bg-emerald-500/20 text-emerald-300'
                      }`}
                    >
                      {isOverLimit ? `+${diff} mph over` : 'Legal Speed'}
                    </span>
                  </div>
                )}
              </div>

              {isDriving && roadName && (
                <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                  <span>📍 {roadName}</span>
                  <span className="text-indigo-400 font-semibold">• Auto Speed Limit Active</span>
                </p>
              )}

              <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                <span className="flex items-center gap-1 font-medium">
                  {member.isCharging ? (
                    <BatteryCharging className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Battery className="w-3.5 h-3.5 text-slate-400" />
                  )}
                  {member.battery}% {member.isCharging ? 'Charging' : ''}
                </span>
                <span>•</span>
                <span>{formatTimeAgo(member.lastUpdated)}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsExpanded((prev) => !prev)}
              className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition"
              title={isExpanded ? 'Collapse' : 'Expand full history'}
            >
              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition"
              title="Close panel"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Life360 Primary Action Bar */}
        <div className="grid grid-cols-4 gap-2 pt-3 pb-3 border-b border-slate-800">
          {/* 1. Directions / Navigate */}
          <button
            onClick={handleOpenDirections}
            className="flex flex-col items-center justify-center p-2 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition shadow-lg active:scale-95 group"
            title="Navigate to member in Google Maps"
          >
            <Navigation className="w-5 h-5 mb-1 group-hover:scale-110 transition" />
            <span className="text-[11px]">Directions</span>
          </button>

          {/* 2. Direct Member Chat */}
          <button
            onClick={() => onOpenChat(member.id)}
            className="flex flex-col items-center justify-center p-2 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-100 font-bold transition shadow active:scale-95 group"
            title="Open 1-on-1 direct chat"
          >
            <MessageSquare className="w-5 h-5 mb-1 text-sky-400 group-hover:scale-110 transition" />
            <span className="text-[11px]">Chat</span>
          </button>

          {/* 3. Cellular Call */}
          {member.phone ? (
            <a
              href={`tel:${member.phone}`}
              className="flex flex-col items-center justify-center p-2 rounded-2xl bg-slate-800 hover:bg-emerald-950/70 hover:border-emerald-500/50 border border-transparent text-slate-100 font-bold transition shadow active:scale-95 group"
              title={`Call cellular line: ${member.phone}`}
            >
              <Phone className="w-5 h-5 mb-1 text-emerald-400 group-hover:scale-110 transition" />
              <span className="text-[11px]">Call</span>
            </a>
          ) : (
            <button
              onClick={() => onRequestLocation(member.id)}
              className="flex flex-col items-center justify-center p-2 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-100 font-bold transition shadow active:scale-95 group"
              title="Request GPS location"
            >
              <MapPin className="w-5 h-5 mb-1 text-amber-400 group-hover:scale-110 transition" />
              <span className="text-[11px]">Ping GPS</span>
            </button>
          )}

          {/* 4. Ring Lost Phone / Cellular SMS */}
          {isAlarmActive ? (
            <button
              onClick={() => onSilenceRemoteAlarm(member.id)}
              className="flex flex-col items-center justify-center p-2 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-black transition shadow-lg animate-pulse"
              title="Silence siren"
            >
              <Volume2 className="w-5 h-5 mb-1 animate-bounce" />
              <span className="text-[11px]">Stop Siren</span>
            </button>
          ) : (
            <button
              onClick={() => onTriggerRemoteAlarm(member.id, member.name)}
              className="flex flex-col items-center justify-center p-2 rounded-2xl bg-slate-800 hover:bg-rose-950/60 hover:border-rose-500/40 border border-transparent text-slate-100 font-bold transition shadow active:scale-95 group"
              title="Ring phone at full volume (Lost device siren)"
            >
              <BellRing className="w-5 h-5 mb-1 text-rose-400 group-hover:scale-110 transition" />
              <span className="text-[11px]">Ring Phone</span>
            </button>
          )}
        </div>

        {/* Secondary Utility Controls (SMS & Save Place) */}
        <div className="flex items-center justify-between py-2 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            {member.phone && (
              <a
                href={`sms:${member.phone}?&body=Hi ${member.name}, checking in on Orbit!`}
                className="px-2.5 py-1 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-300 font-medium flex items-center gap-1.5 transition text-[11px]"
              >
                <MessageCircle className="w-3.5 h-3.5 text-sky-400" />
                <span>SMS {member.phone}</span>
              </a>
            )}
            <button
              onClick={() => onRequestLocation(member.id)}
              className="px-2.5 py-1 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-300 font-medium flex items-center gap-1.5 transition text-[11px]"
              title="Ask device to turn on location"
            >
              <MapPin className="w-3.5 h-3.5 text-indigo-400" />
              <span>Request GPS</span>
            </button>
          </div>

          {onSaveCurrentPlace && member.location && (
            <button
              onClick={() =>
                onSaveCurrentPlace(
                  member.location.lat,
                  member.location.lng,
                  `${member.name}'s Spot`
                )
              }
              className="text-indigo-400 hover:text-indigo-300 font-semibold text-[11px] flex items-center gap-1 transition"
            >
              <span>+ Save Place</span>
            </button>
          )}
        </div>

        {/* 30-Day Trips & Location History Section */}
        <div className="pt-2 flex-1 overflow-y-auto pr-0.5 space-y-2.5">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-xs text-slate-200 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-indigo-400" />
              <span>Location &amp; Trip History (Up to 30 Days)</span>
            </h4>
            <span className="text-[10px] text-slate-400">
              {trips.length} {trips.length === 1 ? 'event' : 'events'}
            </span>
          </div>

          {/* Date Selector Pills (Today, Yesterday, 2d ago ... 30d ago) */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {[0, 1, 2, 3, 7, 14, 30].map((offset) => {
              const label =
                offset === 0
                  ? 'Today'
                  : offset === 1
                  ? 'Yesterday'
                  : `${offset} days ago`;
              const isSelected = selectedDayOffset === offset;

              return (
                <button
                  key={offset}
                  onClick={() => setSelectedDayOffset(offset)}
                  className={`px-3 py-1 rounded-xl text-[11px] font-semibold shrink-0 transition ${
                    isSelected
                      ? 'bg-indigo-600 text-white shadow'
                      : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* Active Trip Map Route Playback Banner */}
          {activePlaybackTrip && activePlaybackTrip.type === 'drive' && (
            <div className="p-3 rounded-2xl bg-indigo-950/80 border border-indigo-500/40 text-xs flex items-center justify-between gap-2 animate-in fade-in">
              <div className="truncate">
                <span className="font-bold text-indigo-300 block truncate">
                  🚗 Replaying Trip: {activePlaybackTrip.durationMinutes} mins • {activePlaybackTrip.distanceMiles} mi
                </span>
                <span className="text-[10px] text-slate-400 block truncate">
                  Top Speed: {activePlaybackTrip.topSpeedMph} mph
                </span>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="p-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition shadow"
                  title={isPlaying ? 'Pause' : 'Play animation'}
                >
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => {
                    setActivePlaybackTrip(null);
                    onSetRoute(null);
                    onSetPlaybackPoint(null);
                  }}
                  className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                  title="Clear route from map"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Trip & Stay Events List */}
          {isLoadingHistory ? (
            <div className="py-6 text-center text-slate-400 text-xs animate-pulse">
              Loading 30-day trips &amp; location data...
            </div>
          ) : trips.length === 0 ? (
            <div className="p-4 rounded-2xl bg-slate-950/50 border border-slate-800 text-center text-xs text-slate-400 space-y-1">
              <p className="font-medium text-slate-300">No trips recorded for this date</p>
              <p className="text-[11px] text-slate-500">
                As {member.name} moves, drives, and stops, trips with start/end duration and speed will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {trips.map((trip) => {
                const isSelected = activeTripId === trip.id;
                const formattedStart = new Date(trip.startTime).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                });
                const formattedEnd = new Date(trip.endTime).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                });

                if (trip.type === 'drive') {
                  return (
                    <div
                      key={trip.id}
                      onClick={() => handleSelectTrip(trip)}
                      className={`p-3 rounded-2xl border transition cursor-pointer flex items-center justify-between gap-3 ${
                        isSelected
                          ? 'bg-indigo-950/60 border-indigo-500 ring-1 ring-indigo-500/50'
                          : 'bg-slate-950/60 border-slate-800/80 hover:bg-slate-800/60'
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                          <Car className="w-4 h-4" />
                        </div>
                        <div className="leading-tight">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-xs text-white">Drive</span>
                            <span className="text-[10px] text-slate-400">
                              {formattedStart} – {formattedEnd}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-300 mt-0.5">
                            {trip.durationMinutes} mins • {trip.distanceMiles} mi • Top {trip.topSpeedMph} mph
                          </p>
                          <p className="text-[10px] text-slate-500 truncate max-w-[210px] mt-0.5">
                            {trip.startAddress} → {trip.endAddress}
                          </p>
                        </div>
                      </div>

                      <button
                        className={`px-2.5 py-1.5 rounded-xl text-[10px] font-bold shrink-0 transition ${
                          isSelected
                            ? 'bg-indigo-600 text-white'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                        }`}
                      >
                        {isSelected ? 'Viewing' : 'Show Map'}
                      </button>
                    </div>
                  );
                }

                // Stationary Stay
                return (
                  <div
                    key={trip.id}
                    onClick={() => handleSelectTrip(trip)}
                    className={`p-3 rounded-2xl border transition cursor-pointer flex items-center justify-between gap-3 ${
                      isSelected
                        ? 'bg-indigo-950/60 border-indigo-500 ring-1 ring-indigo-500/50'
                        : 'bg-slate-950/60 border-slate-800/80 hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                        <MapPin className="w-4 h-4" />
                      </div>
                      <div className="leading-tight">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-xs text-white">
                            {trip.placeName || 'Stationary Place'}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {formattedStart} – {formattedEnd}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-300 mt-0.5">
                          Stay duration: {trip.durationMinutes} mins
                        </p>
                        <p className="text-[10px] text-slate-500 truncate max-w-[210px] mt-0.5">
                          {trip.startAddress}
                        </p>
                      </div>
                    </div>

                    <button
                      className={`px-2.5 py-1.5 rounded-xl text-[10px] font-bold shrink-0 transition ${
                        isSelected
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                      }`}
                    >
                      {isSelected ? 'Viewing' : 'Focus'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
