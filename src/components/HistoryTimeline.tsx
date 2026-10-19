import React, { useState, useEffect } from 'react';
import { Calendar, Play, Pause, FastForward, Clock, Gauge, MapPin, Download, X } from 'lucide-react';
import { FamilyMember, LocationPoint } from '../types';

interface HistoryTimelineProps {
  member: FamilyMember;
  circleId?: string;
  onClose: () => void;
  onSetRoute: (points: LocationPoint[] | null) => void;
  onSetPlaybackPoint: (point: LocationPoint | null) => void;
}

export const HistoryTimeline: React.FC<HistoryTimelineProps> = ({
  member,
  circleId = 'ORBIT-FAMILY',
  onClose,
  onSetRoute,
  onSetPlaybackPoint,
}) => {
  const [selectedDayOffset, setSelectedDayOffset] = useState<number>(0); // 0 = Today, 1 = Yesterday, up to 30
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playSpeed, setPlaySpeed] = useState<number>(1);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [points, setPoints] = useState<LocationPoint[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Fetch points for selected day
  useEffect(() => {
    setIsLoading(true);
    // Fetch from backend
    fetch(`/api/circle/${circleId}/history/${member.id}?days=30`)
      .then((res) => res.json())
      .then((data) => {
        const allPoints: LocationPoint[] = data.points || [];

        const now = Date.now();
        const targetDay = now - selectedDayOffset * 24 * 60 * 60 * 1000;
        const dayStart = new Date(targetDay).setHours(0, 0, 0, 0);
        const dayEnd = new Date(targetDay).setHours(23, 59, 59, 999);

        let dayPoints = allPoints.filter((p) => p.timestamp >= dayStart && p.timestamp <= dayEnd);

        // If today and no history yet, use current live point as the starting seed
        if (dayPoints.length === 0 && selectedDayOffset === 0 && member.location) {
          dayPoints = [{ ...member.location, timestamp: Date.now() }];
        }

        setPoints(dayPoints);
        setCurrentIndex(0);
        onSetRoute(dayPoints.length > 0 ? dayPoints : null);
        setIsLoading(false);
      })
      .catch((err) => {
        console.warn('Failed to load history:', err);
        setPoints([]);
        onSetRoute(null);
        setIsLoading(false);
      });

    return () => {
      onSetRoute(null);
      onSetPlaybackPoint(null);
    };
  }, [circleId, member.id, selectedDayOffset]);

  // Handle Playback animation
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (isPlaying && points.length > 0) {
      const interval = Math.max(100, Math.floor(800 / playSpeed));
      timer = setInterval(() => {
        setCurrentIndex((prev) => {
          if (prev >= points.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          const next = prev + 1;
          onSetPlaybackPoint(points[next]);
          return next;
        });
      }, interval);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isPlaying, playSpeed, points]);

  const handleSliderChange = (idx: number) => {
    setCurrentIndex(idx);
    if (points[idx]) {
      onSetPlaybackPoint(points[idx]);
    }
  };

  const currentPoint = points[currentIndex];
  const maxSpeed = points.reduce((max, p) => Math.max(max, p.speed || 0), 0);
  const totalMiles = (points.length * 0.45).toFixed(1);

  const downloadHistoryJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(points, null, 2));
    const a = document.createElement('a');
    a.href = dataStr;
    a.download = `location-history-${member.name.replace(/\s+/g, '_')}-day-${selectedDayOffset}.json`;
    a.click();
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 shadow-2xl text-slate-100 ring-1 ring-white/10">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-sky-500/20 text-sky-400">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-white flex items-center gap-2">
              <span>30-Day Trip History</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-sky-400 border border-slate-700">
                {member.name}
              </span>
            </h3>
            <p className="text-xs text-slate-400">Review driving speeds, stops, and breadcrumb trails</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Day Selector Pill Bar (0 to 30 days) */}
      <div className="mt-3">
        <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
          <span>Select Timeline Date:</span>
          <span className="font-semibold text-slate-200">
            {selectedDayOffset === 0
              ? 'Today'
              : selectedDayOffset === 1
              ? 'Yesterday'
              : `${selectedDayOffset} days ago`}
          </span>
        </div>
        <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {[0, 1, 2, 3, 5, 7, 10, 14, 21, 30].map((daysAgo) => (
            <button
              key={daysAgo}
              onClick={() => setSelectedDayOffset(daysAgo)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition ${
                selectedDayOffset === daysAgo
                  ? 'bg-sky-500 text-slate-950 font-bold shadow-md'
                  : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300'
              }`}
            >
              {daysAgo === 0 ? 'Today' : daysAgo === 1 ? '1d ago' : `${daysAgo}d ago`}
            </button>
          ))}
        </div>
      </div>

      {/* Trip Summary Stats */}
      <div className="grid grid-cols-3 gap-2 mt-3">
        <div className="p-2.5 rounded-2xl bg-slate-800/60 border border-slate-700/50">
          <div className="flex items-center gap-1 text-[11px] text-slate-400">
            <MapPin className="w-3.5 h-3.5 text-emerald-400" />
            <span>Est. Distance</span>
          </div>
          <span className="font-bold text-sm text-white mt-0.5 block">{totalMiles} mi</span>
        </div>

        <div className="p-2.5 rounded-2xl bg-slate-800/60 border border-slate-700/50">
          <div className="flex items-center gap-1 text-[11px] text-slate-400">
            <Gauge className="w-3.5 h-3.5 text-amber-400" />
            <span>Top Speed</span>
          </div>
          <span className="font-bold text-sm text-white mt-0.5 block">{maxSpeed} mph</span>
        </div>

        <div className="p-2.5 rounded-2xl bg-slate-800/60 border border-slate-700/50">
          <div className="flex items-center gap-1 text-[11px] text-slate-400">
            <Clock className="w-3.5 h-3.5 text-sky-400" />
            <span>Waypoints</span>
          </div>
          <span className="font-bold text-sm text-white mt-0.5 block">{points.length} pts</span>
        </div>
      </div>

      {/* Interactive Playback Scrub Bar */}
      <div className="mt-4 p-3 rounded-2xl bg-slate-950/80 border border-slate-800">
        <div className="flex items-center justify-between text-xs mb-2">
          <span className="text-slate-400">Playback Scrub:</span>
          {currentPoint && (
            <span className="font-mono text-emerald-400 font-semibold">
              {new Date(currentPoint.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ·{' '}
              {currentPoint.speed || 0} mph
            </span>
          )}
        </div>

        <input
          type="range"
          min={0}
          max={Math.max(0, points.length - 1)}
          value={currentIndex}
          onChange={(e) => handleSliderChange(Number(e.target.value))}
          className="w-full accent-sky-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
        />

        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="p-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold transition flex items-center gap-1.5 text-xs shadow"
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              <span>{isPlaying ? 'Pause' : 'Play Route'}</span>
            </button>

            <button
              onClick={() => setPlaySpeed((s) => (s === 1 ? 2 : s === 2 ? 5 : 1))}
              className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 font-mono transition flex items-center gap-1"
            >
              <FastForward className="w-3 h-3 text-sky-400" />
              <span>{playSpeed}x</span>
            </button>
          </div>

          <button
            onClick={downloadHistoryJson}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition text-xs flex items-center gap-1"
            title="Download Day JSON Backup (Can be saved to Google Drive)"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Drive Backup</span>
          </button>
        </div>
      </div>
    </div>
  );
};

// Helper to generate realistic 24-hr route coordinates for playback
function generateSimulatedDayTrip(member: FamilyMember, dayStart: number): LocationPoint[] {
  const pts: LocationPoint[] = [];
  const baseLat = 37.7749;
  const baseLng = -122.4194;

  // 1. Morning at Home
  pts.push({
    lat: baseLat,
    lng: baseLng,
    speed: 0,
    timestamp: dayStart + 8 * 3600000,
    battery: 100,
    placeName: 'Family Home',
  });

  // 2. Commute drive with speed segments
  const waypoints = [
    { dLat: 0.005, dLng: 0.004, speed: 28, timeOffset: 8.3 * 3600000 },
    { dLat: 0.012, dLng: 0.008, speed: 45, timeOffset: 8.5 * 3600000 },
    { dLat: 0.02, dLng: 0.014, speed: 58, timeOffset: 8.7 * 3600000 }, // speed surge
    { dLat: 0.022, dLng: 0.02, speed: 35, timeOffset: 8.9 * 3600000 },
  ];

  waypoints.forEach((wp) => {
    pts.push({
      lat: baseLat + wp.dLat,
      lng: baseLng + wp.dLng,
      speed: wp.speed,
      timestamp: dayStart + wp.timeOffset,
      battery: 92,
      activity: 'driving',
    });
  });

  // 3. Destination (Office / School)
  pts.push({
    lat: baseLat + 0.022,
    lng: baseLng + 0.02,
    speed: 0,
    timestamp: dayStart + 9 * 3600000,
    battery: 89,
    placeName: member.role === 'Dad' ? 'Dad Office' : 'School Campus',
  });

  // 4. Evening return trip
  const returnWaypoints = [
    { dLat: 0.018, dLng: 0.016, speed: 42, timeOffset: 17.2 * 3600000 },
    { dLat: 0.01, dLng: 0.007, speed: 30, timeOffset: 17.5 * 3600000 },
    { dLat: 0.003, dLng: 0.002, speed: 20, timeOffset: 17.8 * 3600000 },
  ];

  returnWaypoints.forEach((wp) => {
    pts.push({
      lat: baseLat + wp.dLat,
      lng: baseLng + wp.dLng,
      speed: wp.speed,
      timestamp: dayStart + wp.timeOffset,
      battery: 65,
      activity: 'driving',
    });
  });

  // 5. Back Home for dinner
  pts.push({
    lat: baseLat,
    lng: baseLng,
    speed: 0,
    timestamp: dayStart + 18.2 * 3600000,
    battery: 58,
    placeName: 'Family Home',
  });

  return pts;
}
