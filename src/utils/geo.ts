import { FamilyMember, SavedPlace } from '../types';
import { apiFetch } from './apiConfig';

export function getDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth's radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  const miles = meters / 1609.34;
  return `${miles.toFixed(1)} mi`;
}

export function formatTimeAgo(timestamp: number): string {
  const diffSec = Math.floor((Date.now() - timestamp) / 1000);
  if (diffSec < 10) return 'Just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}

// Client-side cache for speed limit lookups
const clientSpeedLimitCache = new Map<string, { speedLimitMph: number; roadName: string; source: string }>();

export async function fetchRoadSpeedLimit(
  lat: number,
  lng: number
): Promise<{ speedLimitMph: number; roadName: string; source: string }> {
  const cacheKey = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  const cached = clientSpeedLimitCache.get(cacheKey);
  if (cached) return cached;

  try {
    const res = await apiFetch(`/api/speed-limit?lat=${lat}&lng=${lng}`);
    if (res.ok) {
      const data = await res.json();
      const result = {
        speedLimitMph: data.speedLimitMph || 35,
        roadName: data.roadName || 'Monitored Road',
        source: data.source || 'osm_sign',
      };
      clientSpeedLimitCache.set(cacheKey, result);
      return result;
    }
  } catch (err) {
    console.warn('Failed to fetch road speed limit:', err);
  }

  const fallback = { speedLimitMph: 35, roadName: 'Road', source: 'default' };
  return fallback;
}

// Generate realistic simulated trajectory for 4 family members
export function advanceSimulationStep(
  members: Record<string, FamilyMember>,
  places: SavedPlace[],
  stepIndex: number
): Record<string, FamilyMember> {
  const updated = { ...members };
  const baseLat = 37.7749;
  const baseLng = -122.4194;

  // Lucas is driving along Park Presidio Blvd (arterial road, posted speed limit 35 mph)
  if (updated['member-lucas']) {
    const lucas = { ...updated['member-lucas'] };
    const t = (stepIndex % 60) / 60;
    // Circular / loop drive path
    const angle = t * 2 * Math.PI;
    const newLat = baseLat + 0.007 + Math.sin(angle) * 0.008;
    const newLng = baseLng + 0.006 + Math.cos(angle) * 0.012;

    // Speed fluctuates: 25mph - 58mph (triggers over-speed when exceeding 35 mph limit + threshold)
    const isOverSpeed = (stepIndex % 12) >= 8;
    const speed = isOverSpeed ? 58 : Math.floor(32 + Math.sin(t * 10) * 8);
    const speedLimitMph = 35; // Auto-detected posted speed limit for Park Presidio Blvd
    const roadName = 'Park Presidio Blvd';

    lucas.speedMph = speed;
    lucas.currentSpeedLimitMph = speedLimitMph;
    lucas.currentRoadName = roadName;
    lucas.speedLimitSource = 'osm_sign';

    lucas.location = {
      ...lucas.location,
      lat: newLat,
      lng: newLng,
      speed,
      timestamp: Date.now(),
      activity: 'driving',
      roadName,
      speedLimitMph,
      speedLimitSource: 'osm_sign',
      address: isOverSpeed
        ? `Over-speed (${speed} in 35 mph limit): ${roadName}`
        : `Driving on ${roadName} (${speed} mph • Limit ${speedLimitMph})`,
    };
    lucas.lastUpdated = Date.now();
    lucas.battery = Math.max(15, lucas.battery - (stepIndex % 100 === 0 ? 1 : 0));
    updated['member-lucas'] = lucas;
  }

  // Sarah (Mom) occasionally leaves home to grocery store and returns
  if (updated['member-mom']) {
    const mom = { ...updated['member-mom'] };
    const phase = Math.floor(stepIndex / 15) % 4;
    let newLat = baseLat;
    let newLng = baseLng;
    let speed = 0;
    let placeName = 'Family Home';
    let activity: 'stationary' | 'driving' | 'walking' = 'stationary';
    let roadName = 'Residential Way';
    let speedLimitMph = 25; // 25 mph residential limit

    if (phase === 1) {
      // driving to store
      newLat = baseLat + 0.004;
      newLng = baseLng - 0.005;
      speed = 22;
      placeName = "En route to Trader Joe's";
      activity = 'driving';
      roadName = 'California St';
      speedLimitMph = 25;
    } else if (phase === 2) {
      // at grocery
      newLat = baseLat + 0.008;
      newLng = baseLng - 0.01;
      speed = 0;
      placeName = "Trader Joe's Grocery";
      activity = 'stationary';
    } else if (phase === 3) {
      // driving back
      newLat = baseLat + 0.003;
      newLng = baseLng - 0.004;
      speed = 18;
      placeName = 'Driving Home';
      activity = 'driving';
      roadName = '24th Avenue';
      speedLimitMph = 25;
    }

    mom.speedMph = speed;
    mom.currentSpeedLimitMph = speedLimitMph;
    mom.currentRoadName = roadName;
    mom.speedLimitSource = 'osm_sign';

    mom.location = {
      ...mom.location,
      lat: newLat,
      lng: newLng,
      speed,
      timestamp: Date.now(),
      activity,
      placeName,
      roadName,
      speedLimitMph,
      speedLimitSource: 'osm_sign',
    };
    mom.lastUpdated = Date.now();
    updated['member-mom'] = mom;
  }

  // Mark (Dad) stationary at office or taking lunch walk
  if (updated['member-dad']) {
    const dad = { ...updated['member-dad'] };
    const isWalking = (stepIndex % 30) > 20;
    const dadLat = baseLat - 0.025 + (isWalking ? (Math.random() - 0.5) * 0.001 : 0);
    const dadLng = baseLng + 0.022 + (isWalking ? (Math.random() - 0.5) * 0.001 : 0);

    dad.speedMph = isWalking ? 3 : 0;
    dad.currentSpeedLimitMph = 25;
    dad.currentRoadName = 'Howard St';
    dad.speedLimitSource = 'osm_sign';

    dad.location = {
      ...dad.location,
      lat: dadLat,
      lng: dadLng,
      speed: dad.speedMph,
      timestamp: Date.now(),
      activity: isWalking ? 'walking' : 'stationary',
      placeName: isWalking ? 'Lunch Walk near Financial District' : 'Dad Office (Tech Hub)',
      roadName: 'Howard St',
      speedLimitMph: 25,
      speedLimitSource: 'osm_sign',
    };
    dad.lastUpdated = Date.now();
    updated['member-dad'] = dad;
  }

  return updated;
}
