import express from 'express';
import http from 'http';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '10mb' }));

// Enable CORS for native mobile apps (Capacitor/Android/iOS) and local network devices
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Pragma, Cache-Control');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Never cache API responses on clients or PWAs to ensure real-time synchronization
app.use('/api', (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

// Initialize Google GenAI with telemetry header
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// Data storage directory
const dataDir = path.resolve(__dirname, '.data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
const dbFile = path.join(dataDir, 'family-orbit-db.json');

// Types
export interface LocationPoint {
  lat: number;
  lng: number;
  accuracy?: number;
  speed?: number; // mph
  heading?: number;
  altitude?: number;
  timestamp: number;
  battery?: number;
  isCharging?: boolean;
  activity?: 'stationary' | 'walking' | 'running' | 'driving' | 'unknown';
  placeName?: string;
  address?: string;
  roadName?: string;
  speedLimitMph?: number;
  speedLimitSource?: 'osm_sign' | 'road_type' | 'cache' | 'default';
}

export interface FamilyMember {
  id: string;
  name: string;
  role: string;
  avatar: string;
  color: string;
  phone?: string;
  battery: number;
  isCharging: boolean;
  lastUpdated: number;
  location: LocationPoint;
  isOnline: boolean;
  speedMph: number;
  currentPlaceId?: string;
  speedLimitThresholdMph?: number;
  currentSpeedLimitMph?: number;
  currentRoadName?: string;
  speedLimitSource?: 'osm_sign' | 'road_type' | 'cache' | 'default';
}

export interface SpeedLimitResult {
  speedLimitMph: number;
  roadName: string;
  roadType: string;
  source: 'osm_sign' | 'road_type' | 'cache' | 'default';
  isExactSign: boolean;
  countryCode?: string;
}

// In-memory spatial speed limit cache: key = lat.toFixed(4) + ',' + lng.toFixed(4) (~10m precision)
const speedLimitCache = new Map<string, { result: SpeedLimitResult; timestamp: number }>();
const SPEED_CACHE_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

function parseMaxspeedToMph(maxspeedStr?: string): { speedMph?: number; isExactSign: boolean } {
  if (!maxspeedStr) return { isExactSign: false };
  const str = String(maxspeedStr).trim().toLowerCase();
  if (str === 'walk' || str === 'living_street') return { speedMph: 15, isExactSign: true };
  const matchMph = str.match(/^([0-9]+)\s*mph$/i);
  if (matchMph) return { speedMph: parseInt(matchMph[1], 10), isExactSign: true };
  const matchKmh = str.match(/^([0-9]+)\s*(?:km\/h|kmh)?$/i);
  if (str.includes('km/h') || str.includes('kmh')) {
    const kmh = parseInt(matchKmh ? matchKmh[1] : str, 10);
    return { speedMph: Math.round(kmh * 0.621371), isExactSign: true };
  }
  const rawNum = parseInt(str, 10);
  if (!isNaN(rawNum)) {
    return { speedMph: rawNum > 85 ? Math.round(rawNum * 0.621371) : rawNum, isExactSign: true };
  }
  return { isExactSign: false };
}

function getMphFromRoadType(type: string): number {
  switch (type?.toLowerCase()) {
    case 'motorway':
    case 'motorway_link':
    case 'freeway':
      return 65;
    case 'trunk':
    case 'trunk_link':
      return 55;
    case 'primary':
    case 'primary_link':
      return 45;
    case 'secondary':
    case 'secondary_link':
      return 35;
    case 'tertiary':
    case 'tertiary_link':
      return 30;
    case 'residential':
      return 25;
    case 'living_street':
    case 'pedestrian':
    case 'service':
    case 'parking_aisle':
      return 15;
    case 'track':
      return 10;
    default:
      return 35;
  }
}

export async function resolveSpeedLimit(lat: number, lng: number): Promise<SpeedLimitResult> {
  const cacheKey = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  const cached = speedLimitCache.get(cacheKey);
  const now = Date.now();
  if (cached && now - cached.timestamp < SPEED_CACHE_TTL_MS) {
    return { ...cached.result, source: 'cache' };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);

    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=17&addressdetails=1&extratags=1`;
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'OrbitFamily360-SpeedEngine/1.0',
        'Accept': 'application/json',
      },
    });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      const roadName =
        data.address?.road ||
        data.address?.pedestrian ||
        data.address?.neighbourhood ||
        data.address?.suburb ||
        'Road';
      const roadType = data.type || data.class || 'road';
      const parsed = parseMaxspeedToMph(data.extratags?.maxspeed);

      let speedLimitMph = parsed.speedMph;
      let source: 'osm_sign' | 'road_type' | 'default' = 'osm_sign';

      if (!speedLimitMph) {
        speedLimitMph = getMphFromRoadType(roadType);
        source = 'road_type';
      }

      const result: SpeedLimitResult = {
        speedLimitMph,
        roadName,
        roadType,
        source,
        isExactSign: parsed.isExactSign,
        countryCode: data.address?.country_code,
      };

      speedLimitCache.set(cacheKey, { result, timestamp: now });
      return result;
    }
  } catch (err) {
    // Network timeout or offline - graceful fallback
  }

  const fallbackResult: SpeedLimitResult = {
    speedLimitMph: 35,
    roadName: 'Monitored Road',
    roadType: 'secondary',
    source: 'default',
    isExactSign: false,
  };
  return fallbackResult;
}

export interface SavedPlace {
  id: string;
  name: string;
  category: 'home' | 'school' | 'work' | 'gym' | 'family' | 'other';
  lat: number;
  lng: number;
  radiusMeters: number;
  address: string;
  color: string;
}

export interface ChatMessage {
  id: string;
  memberId: string;
  memberName: string;
  memberAvatar: string;
  text: string;
  timestamp: number;
  type: 'text' | 'checkin' | 'sos' | 'location';
  recipientMemberId?: string; // If set, this is a 1-on-1 member direct message
  locationData?: {
    lat: number;
    lng: number;
    name?: string;
  };
}

export interface RemoteAlarmEvent {
  alarmId: string;
  targetMemberId: string;
  targetMemberName: string;
  triggeredBy: string;
  triggeredByName: string;
  timestamp: number;
  status: 'active' | 'silenced';
}

export interface SosAlert {
  id: string;
  memberId: string;
  memberName: string;
  lat: number;
  lng: number;
  timestamp: number;
  battery: number;
  status: 'active' | 'resolved';
  resolvedAt?: number;
  resolvedBy?: string;
  address?: string;
}

export interface CircleData {
  circleId: string;
  name: string;
  adminMemberId: string;
  inviteCode: string;
  speedLimitAlertThresholdMph: number;
  members: Record<string, FamilyMember>;
  places: SavedPlace[];
  chat: ChatMessage[];
  sosAlerts: SosAlert[];
  activeAlarms?: Record<string, RemoteAlarmEvent>;
  history: Record<string, LocationPoint[]>; // memberId -> points
}

// Create a pristine, clean circle with zero test data
function createFreshCircle(circleId = 'ORBIT-FAMILY', name = 'Our Family Circle', adminMember?: Partial<FamilyMember>): CircleData {
  const members: Record<string, FamilyMember> = {};
  let adminId = adminMember?.id || 'admin-user';

  if (adminMember && adminMember.id) {
    adminId = adminMember.id;
    members[adminId] = {
      id: adminId,
      name: adminMember.name || 'Family Admin',
      role: (adminMember.role as any) || 'Admin',
      avatar: adminMember.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=256&h=256&q=80',
      color: adminMember.color || '#3b82f6',
      phone: adminMember.phone || '',
      battery: adminMember.battery ?? 100,
      isCharging: adminMember.isCharging ?? false,
      lastUpdated: Date.now(),
      speedMph: 0,
      isOnline: true,
      location: adminMember.location || {
        lat: 37.7749,
        lng: -122.4194,
        speed: 0,
        accuracy: 10,
        timestamp: Date.now(),
        placeName: 'Home',
      },
    };
  }

  return {
    circleId,
    name,
    adminMemberId: adminId,
    inviteCode: circleId,
    speedLimitAlertThresholdMph: 10,
    members,
    places: [],
    chat: [],
    sosAlerts: [],
    activeAlarms: {},
    history: {},
  };
}

// Optional sample 4-member demo circle (available ONLY if user explicitly requests Demo Mode)
function createDemoFamilyCircle(circleId = 'ORBIT-FAMILY'): CircleData {
  const now = Date.now();
  const baseLat = 37.7749;
  const baseLng = -122.4194;

  const places: SavedPlace[] = [
    {
      id: 'place-home',
      name: 'Family Home',
      category: 'home',
      lat: baseLat,
      lng: baseLng,
      radiusMeters: 120,
      address: '742 Evergreen Terrace, San Francisco, CA',
      color: '#10b981',
    },
    {
      id: 'place-school',
      name: 'Lincoln High & Middle School',
      category: 'school',
      lat: baseLat + 0.018,
      lng: baseLng + 0.015,
      radiusMeters: 180,
      address: '1500 24th Ave, San Francisco, CA',
      color: '#f59e0b',
    },
    {
      id: 'place-work-dad',
      name: 'Office (Tech Hub)',
      category: 'work',
      lat: baseLat - 0.025,
      lng: baseLng + 0.022,
      radiusMeters: 200,
      address: '500 Howard St, Financial District, CA',
      color: '#3b82f6',
    },
    {
      id: 'place-gym',
      name: 'Community Center & Gym',
      category: 'gym',
      lat: baseLat + 0.009,
      lng: baseLng - 0.014,
      radiusMeters: 100,
      address: '750 Market St, San Francisco, CA',
      color: '#8b5cf6',
    },
  ];

  const members: Record<string, FamilyMember> = {
    'member-dad': {
      id: 'member-dad',
      name: 'Mark (Dad)',
      role: 'Dad',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&h=256&q=80',
      color: '#3b82f6',
      phone: '+1 (555) 234-5678',
      battery: 88,
      isCharging: false,
      lastUpdated: now - 1000 * 60 * 2,
      speedMph: 0,
      isOnline: true,
      currentPlaceId: 'place-work-dad',
      location: {
        lat: baseLat - 0.025,
        lng: baseLng + 0.022,
        speed: 0,
        accuracy: 8,
        timestamp: now - 1000 * 60 * 2,
        battery: 88,
        activity: 'stationary',
        placeName: 'Dad Office (Tech Hub)',
        address: '500 Howard St, Financial District, CA',
      },
    },
    'member-mom': {
      id: 'member-mom',
      name: 'Sarah (Mom)',
      role: 'Mom',
      avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=256&h=256&q=80',
      color: '#ec4899',
      phone: '+1 (555) 345-6789',
      battery: 94,
      isCharging: true,
      lastUpdated: now - 1000 * 30,
      speedMph: 0,
      isOnline: true,
      currentPlaceId: 'place-home',
      location: {
        lat: baseLat,
        lng: baseLng,
        speed: 0,
        accuracy: 5,
        timestamp: now - 1000 * 30,
        battery: 94,
        isCharging: true,
        activity: 'stationary',
        placeName: 'Family Home',
        address: '742 Evergreen Terrace, San Francisco, CA',
      },
    },
    'member-emma': {
      id: 'member-emma',
      name: 'Emma (Daughter)',
      role: 'Daughter',
      avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=256&h=256&q=80',
      color: '#10b981',
      phone: '+1 (555) 456-7890',
      battery: 62,
      isCharging: false,
      lastUpdated: now - 1000 * 60 * 5,
      speedMph: 0,
      isOnline: true,
      currentPlaceId: 'place-school',
      location: {
        lat: baseLat + 0.018,
        lng: baseLng + 0.015,
        speed: 0,
        accuracy: 10,
        timestamp: now - 1000 * 60 * 5,
        battery: 62,
        activity: 'stationary',
        placeName: 'Lincoln High School',
        address: '1500 24th Ave, San Francisco, CA',
      },
    },
    'member-lucas': {
      id: 'member-lucas',
      name: 'Lucas (Son)',
      role: 'Son',
      avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=256&h=256&q=80',
      color: '#f59e0b',
      phone: '+1 (555) 567-8901',
      battery: 45,
      isCharging: false,
      lastUpdated: now - 1000 * 15,
      speedMph: 28,
      isOnline: true,
      location: {
        lat: baseLat + 0.007,
        lng: baseLng + 0.006,
        speed: 28,
        accuracy: 6,
        timestamp: now - 1000 * 15,
        battery: 45,
        activity: 'driving',
        placeName: 'En route to Gym',
        address: 'Geary Blvd & Park Presidio, CA',
      },
    },
  };

  const history: Record<string, LocationPoint[]> = {};
  const oneDayMs = 24 * 60 * 60 * 1000;

  for (const mId of Object.keys(members)) {
    const points: LocationPoint[] = [];
    for (let dayOffset = 7; dayOffset >= 0; dayOffset--) {
      const dayTimestamp = now - dayOffset * oneDayMs;
      points.push({
        lat: baseLat + (Math.random() - 0.5) * 0.0005,
        lng: baseLng + (Math.random() - 0.5) * 0.0005,
        speed: 0,
        timestamp: dayTimestamp + 8 * 3600 * 1000,
        battery: 95,
        placeName: 'Family Home',
      });
      const destLat = mId === 'member-dad' ? baseLat - 0.025 : baseLat + 0.018;
      const destLng = mId === 'member-dad' ? baseLng + 0.022 : baseLng + 0.015;
      points.push({
        lat: (baseLat + destLat) / 2 + (Math.random() - 0.5) * 0.002,
        lng: (baseLng + destLng) / 2 + (Math.random() - 0.5) * 0.002,
        speed: 34,
        timestamp: dayTimestamp + 12 * 3600 * 1000,
        battery: 80,
        activity: 'driving',
      });
    }
    history[mId] = points;
  }

  const chat: ChatMessage[] = [
    {
      id: 'msg-1',
      memberId: 'member-dad',
      memberName: 'Mark (Dad)',
      memberAvatar: members['member-dad'].avatar,
      text: 'Heading out to the office. Have a great day everyone! ❤️',
      timestamp: now - 1000 * 60 * 120,
      type: 'text',
    },
    {
      id: 'msg-2',
      memberId: 'member-mom',
      memberName: 'Sarah (Mom)',
      memberAvatar: members['member-mom'].avatar,
      text: 'Remember to take your soccer gear after school.',
      timestamp: now - 1000 * 60 * 85,
      type: 'text',
    },
  ];

  return {
    circleId,
    name: 'Sample Family Circle',
    adminMemberId: 'member-dad',
    inviteCode: circleId,
    speedLimitAlertThresholdMph: 10,
    members,
    places,
    chat,
    sosAlerts: [],
    history,
  };
}

// Memory database loaded from disk
let circles: Record<string, CircleData> = {};

function loadData() {
  try {
    if (fs.existsSync(dbFile)) {
      const content = fs.readFileSync(dbFile, 'utf-8');
      circles = JSON.parse(content);
    }
  } catch (err) {
    console.error('Error loading database file:', err);
  }

  // Ensure ORBIT-FAMILY starts fresh without seeded test data
  if (!circles['ORBIT-FAMILY']) {
    circles['ORBIT-FAMILY'] = createFreshCircle('ORBIT-FAMILY', 'Our Family Circle');
    saveData();
  } else {
    // If it currently has old hardcoded test members (Mark, Sarah, Emma, Lucas) and nothing else, reset to fresh
    const memberKeys = Object.keys(circles['ORBIT-FAMILY'].members || {});
    const isOldHardcodedDemo =
      memberKeys.length === 4 &&
      memberKeys.includes('member-dad') &&
      memberKeys.includes('member-mom') &&
      memberKeys.includes('member-emma') &&
      memberKeys.includes('member-lucas');

    if (isOldHardcodedDemo) {
      circles['ORBIT-FAMILY'] = createFreshCircle('ORBIT-FAMILY', 'Our Family Circle');
      saveData();
    }
  }
}

function saveData() {
  try {
    fs.writeFileSync(dbFile, JSON.stringify(circles, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving database file:', err);
  }
}

loadData();

// Helper to calculate distance in meters between two lat/lng pairs
function getDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3; // Earth radius in meters
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

// Server Sent Events (SSE) subscribers
const sseClients: { id: number; circleId: string; res: express.Response }[] = [];
let nextClientId = 1;

function broadcastToCircle(circleId: string, eventName: string, data: unknown) {
  const payload = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    if (client.circleId === circleId) {
      client.res.write(payload);
    }
  }
}

// SSE live stream endpoint
app.get('/api/circle/:circleId/stream', (req, res) => {
  const { circleId } = req.params;
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const clientId = nextClientId++;
  sseClients.push({ id: clientId, circleId, res });

  // Initial ping
  res.write(`event: connected\ndata: ${JSON.stringify({ clientId, circleId, time: Date.now() })}\n\n`);

  req.on('close', () => {
    const idx = sseClients.findIndex((c) => c.id === clientId);
    if (idx !== -1) {
      sseClients.splice(idx, 1);
    }
  });
});

// GET circle full state
app.get('/api/circle/:circleId', (req, res) => {
  const { circleId } = req.params;
  if (!circles[circleId]) {
    circles[circleId] = createFreshCircle(circleId);
    saveData();
  }
  const circle = circles[circleId];
  // Return circle with member list, places, active SOS, recent chat
  res.json({
    circleId: circle.circleId,
    name: circle.name,
    adminMemberId: circle.adminMemberId,
    inviteCode: circle.inviteCode,
    speedLimitAlertThresholdMph: circle.speedLimitAlertThresholdMph,
    members: circle.members,
    places: circle.places,
    sosAlerts: circle.sosAlerts,
    activeAlarms: circle.activeAlarms || {},
    chat: circle.chat.slice(-50),
  });
});

// CREATE new fresh circle
app.post('/api/circle/create', (req, res) => {
  const { name = 'Our Family Circle', member } = req.body;
  const circleId = `ORBIT-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
  const freshCircle = createFreshCircle(circleId, name, member);
  circles[circleId] = freshCircle;
  saveData();
  res.json({ success: true, circle: freshCircle });
});

// GET all members of a circle
app.get('/api/circle/:circleId/members', (req, res) => {
  const { circleId } = req.params;
  const circle = circles[circleId] || (circles[circleId] = createFreshCircle(circleId));
  res.json({
    adminMemberId: circle.adminMemberId,
    members: Object.values(circle.members),
  });
});

// POST add new member to circle
app.post('/api/circle/:circleId/members', (req, res) => {
  const { circleId } = req.params;
  const { name, role = 'Member', phone = '', avatar, color = '#3b82f6', lat, lng } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Member name is required' });
  }

  const circle = circles[circleId] || (circles[circleId] = createFreshCircle(circleId));
  const memberId = req.body.id || `member-${Date.now().toString().slice(-6)}-${Math.random().toString(36).substring(2, 5)}`;

  // Center near existing member or default location
  const existingMember = Object.values(circle.members)[0];
  const centerLat = lat ?? existingMember?.location.lat ?? 37.7749;
  const centerLng = lng ?? existingMember?.location.lng ?? -122.4194;

  const newMember: FamilyMember = {
    id: memberId,
    name: name.trim(),
    role,
    avatar: avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=256&h=256&q=80',
    color,
    phone: phone.trim(),
    battery: 100,
    isCharging: false,
    lastUpdated: Date.now(),
    speedMph: 0,
    isOnline: true,
    location: {
      lat: centerLat + (Math.random() - 0.5) * 0.004,
      lng: centerLng + (Math.random() - 0.5) * 0.004,
      speed: 0,
      accuracy: 8,
      battery: 100,
      timestamp: Date.now(),
      placeName: 'Added to Circle',
    },
  };

  circle.members[memberId] = newMember;
  if (!circle.adminMemberId) {
    circle.adminMemberId = memberId;
  }

  saveData();
  broadcastToCircle(circleId, 'members_updated', circle.members);

  res.json({ success: true, member: newMember, members: circle.members });
});

// PATCH update member profile/role/settings
app.patch('/api/circle/:circleId/members/:memberId', (req, res) => {
  const { circleId, memberId } = req.params;
  const circle = circles[circleId];
  if (!circle || !circle.members[memberId]) {
    return res.status(404).json({ error: 'Member not found' });
  }

  const member = circle.members[memberId];
  const { name, role, phone, avatar, color, speedLimitThresholdMph } = req.body;

  if (name !== undefined) member.name = name.trim();
  if (role !== undefined) member.role = role;
  if (phone !== undefined) member.phone = phone.trim();
  if (avatar !== undefined) member.avatar = avatar;
  if (color !== undefined) member.color = color;
  if (speedLimitThresholdMph !== undefined) member.speedLimitThresholdMph = Number(speedLimitThresholdMph);
  member.lastUpdated = Date.now();

  saveData();
  broadcastToCircle(circleId, 'members_updated', circle.members);

  res.json({ success: true, member });
});

// DELETE remove member from circle
app.delete('/api/circle/:circleId/members/:memberId', (req, res) => {
  const { circleId, memberId } = req.params;
  const circle = circles[circleId];
  if (!circle || !circle.members[memberId]) {
    return res.status(404).json({ error: 'Member not found' });
  }

  delete circle.members[memberId];
  if (circle.history && circle.history[memberId]) {
    delete circle.history[memberId];
  }

  // If the removed member was admin, reassign to remaining member if available
  if (circle.adminMemberId === memberId) {
    const remainingIds = Object.keys(circle.members);
    circle.adminMemberId = remainingIds.length > 0 ? remainingIds[0] : '';
  }

  saveData();
  broadcastToCircle(circleId, 'member_removed', { memberId });
  broadcastToCircle(circleId, 'members_updated', circle.members);

  res.json({ success: true, remainingMembers: circle.members, adminMemberId: circle.adminMemberId });
});

// POST transfer circle admin
app.post('/api/circle/:circleId/admin', (req, res) => {
  const { circleId } = req.params;
  const { newAdminMemberId } = req.body;
  const circle = circles[circleId];
  if (!circle || !circle.members[newAdminMemberId]) {
    return res.status(400).json({ error: 'Target member not found in circle' });
  }

  circle.adminMemberId = newAdminMemberId;
  saveData();
  broadcastToCircle(circleId, 'members_updated', circle.members);
  res.json({ success: true, adminMemberId: newAdminMemberId });
});

// POST clear all test data / places / chat from circle (Reset to Fresh)
app.post('/api/circle/:circleId/clear-test-data', (req, res) => {
  const { circleId } = req.params;
  const { keepMemberId } = req.body;
  const circle = circles[circleId] || (circles[circleId] = createFreshCircle(circleId));

  const keptMember = keepMemberId && circle.members[keepMemberId] ? circle.members[keepMemberId] : null;

  circle.places = [];
  circle.chat = [];
  circle.sosAlerts = [];
  circle.history = {};

  if (keptMember) {
    circle.members = { [keptMember.id]: keptMember };
    circle.adminMemberId = keptMember.id;
  } else {
    // Keep user-created members, or if none, clean state
    const memberKeys = Object.keys(circle.members);
    const nonDemoKeys = memberKeys.filter(
      (id) => !['member-dad', 'member-mom', 'member-emma', 'member-lucas'].includes(id)
    );
    if (nonDemoKeys.length > 0) {
      const activeId = nonDemoKeys[0];
      circle.members = { [activeId]: circle.members[activeId] };
      circle.adminMemberId = activeId;
    } else {
      circle.members = {};
      circle.adminMemberId = '';
    }
  }

  saveData();
  broadcastToCircle(circleId, 'circle_reset', circle);
  broadcastToCircle(circleId, 'members_updated', circle.members);
  broadcastToCircle(circleId, 'places_updated', circle.places);

  res.json({ success: true, circle });
});

// POST seed sample demo family data (optional opt-in for testing)
app.post('/api/circle/:circleId/seed-demo', (req, res) => {
  const { circleId } = req.params;
  const demoCircle = createDemoFamilyCircle(circleId);
  circles[circleId] = demoCircle;
  saveData();

  broadcastToCircle(circleId, 'circle_reset', demoCircle);
  broadcastToCircle(circleId, 'members_updated', demoCircle.members);
  broadcastToCircle(circleId, 'places_updated', demoCircle.places);

  res.json({ success: true, circle: demoCircle });
});

// GET automatic road speed limit for any location
app.get('/api/speed-limit', async (req, res) => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  if (isNaN(lat) || isNaN(lng)) {
    return res.status(400).json({ error: 'lat and lng must be valid numbers' });
  }

  const speedData = await resolveSpeedLimit(lat, lng);
  res.json({
    success: true,
    lat,
    lng,
    ...speedData,
  });
});

// GET reverse geocode address for coordinates
app.get('/api/reverse-geocode', async (req, res) => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  if (isNaN(lat) || isNaN(lng)) {
    return res.status(400).json({ error: 'lat and lng must be valid numbers' });
  }

  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
    const osmRes = await fetch(url, {
      headers: { 'User-Agent': 'KinTrackFamilySafetyApp/2.0' },
      signal: AbortSignal.timeout(3500),
    });

    if (osmRes.ok) {
      const data = await osmRes.json();
      const addr = data.address || {};
      const road = addr.road || addr.pedestrian || addr.street;
      const houseNum = addr.house_number;
      const neighborhood = addr.neighbourhood || addr.suburb || addr.quarter;
      const city = addr.city || addr.town || addr.village;
      const state = addr.state;

      let formatted = data.display_name?.split(',').slice(0, 3).join(',').trim();
      if (houseNum && road) {
        formatted = `${houseNum} ${road}${city ? `, ${city}` : ''}`;
      } else if (road && city) {
        formatted = `${road}, ${city}`;
      } else if (neighborhood && city) {
        formatted = `${neighborhood}, ${city}`;
      }

      return res.json({
        success: true,
        address: formatted || data.display_name || 'Current Location',
        raw: data.address,
      });
    }
  } catch (err) {
    // Fallback if offline
  }

  res.json({
    success: true,
    address: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
  });
});

// POST or GET update member location & status (compatible with Web, Capacitor, and Android native background GPS clients)
app.all('/api/circle/:circleId/member/:memberId/location', async (req, res) => {
  const { circleId, memberId } = req.params;
  const payload = { ...req.query, ...req.body };

  const rawLat = payload.lat !== undefined ? Number(payload.lat) : undefined;
  const rawLng = payload.lng !== undefined ? Number(payload.lng) : (payload.lon !== undefined ? Number(payload.lon) : undefined);

  if (rawLat === undefined || isNaN(rawLat) || rawLng === undefined || isNaN(rawLng)) {
    return res.status(400).json({ error: 'lat and lng (or lon) must be valid numbers' });
  }

  const lat = rawLat;
  const lng = rawLng;
  const speed = Number(payload.speed) || 0;
  const accuracy = Number(payload.accuracy || payload.acc) || 10;
  const battery = Number(payload.battery || payload.batt) || 100;
  const isCharging = payload.isCharging === true || payload.isCharging === 'true' || payload.charge === '1';
  const activity = payload.activity || 'stationary';
  const address = payload.address;
  const speedLimitMph = payload.speedLimitMph ? Number(payload.speedLimitMph) : undefined;
  const roadName = payload.roadName;
  const speedLimitSource = payload.speedLimitSource;

  if (!circles[circleId]) {
    circles[circleId] = createFreshCircle(circleId);
  }
  const circle = circles[circleId];

  // Auto-resolve road speed limit and road name for this location
  let detectedLimit: SpeedLimitResult;
  if (typeof speedLimitMph === 'number' && roadName) {
    detectedLimit = {
      speedLimitMph,
      roadName,
      roadType: 'road',
      source: speedLimitSource || 'osm_sign',
      isExactSign: true,
    };
  } else {
    detectedLimit = await resolveSpeedLimit(lat, lng);
  }

  if (!circle.members[memberId]) {
    // Dynamically register new member if joining via phone
    circle.members[memberId] = {
      id: memberId,
      name: req.body.name || `Member ${Object.keys(circle.members).length + 1}`,
      role: req.body.role || 'Member',
      avatar: req.body.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=256&h=256&q=80',
      color: '#06b6d4',
      battery,
      isCharging,
      lastUpdated: Date.now(),
      isOnline: true,
      speedMph: speed,
      currentSpeedLimitMph: detectedLimit.speedLimitMph,
      currentRoadName: detectedLimit.roadName,
      speedLimitSource: detectedLimit.source,
      location: {
        lat,
        lng,
        speed,
        accuracy,
        battery,
        isCharging,
        activity,
        timestamp: Date.now(),
        address: address || `${detectedLimit.roadName}`,
        roadName: detectedLimit.roadName,
        speedLimitMph: detectedLimit.speedLimitMph,
        speedLimitSource: detectedLimit.source,
      },
    };
  }

  const member = circle.members[memberId];
  const prevPlaceId = member.currentPlaceId;

  // Check geofences (Places)
  let detectedPlace: SavedPlace | undefined;
  for (const place of circle.places) {
    const dist = getDistanceMeters(lat, lng, place.lat, place.lng);
    if (dist <= place.radiusMeters) {
      detectedPlace = place;
      break;
    }
  }

  const now = Date.now();
  member.lastUpdated = now;
  member.battery = battery;
  member.isCharging = isCharging;
  member.speedMph = Math.round(speed);
  member.isOnline = true;
  member.currentPlaceId = detectedPlace ? detectedPlace.id : undefined;
  member.currentSpeedLimitMph = detectedLimit.speedLimitMph;
  member.currentRoadName = detectedLimit.roadName;
  member.speedLimitSource = detectedLimit.source;

  const locPoint: LocationPoint = {
    lat,
    lng,
    speed: Math.round(speed),
    accuracy,
    battery,
    isCharging,
    activity,
    timestamp: now,
    placeName: detectedPlace ? detectedPlace.name : undefined,
    address: address || detectedLimit.roadName,
    roadName: detectedLimit.roadName,
    speedLimitMph: detectedLimit.speedLimitMph,
    speedLimitSource: detectedLimit.source,
  };

  member.location = locPoint;

  // Append to 30-day history
  if (!circle.history[memberId]) {
    circle.history[memberId] = [];
  }
  circle.history[memberId].push(locPoint);

  // Prune history older than 30 days
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
  circle.history[memberId] = circle.history[memberId].filter((pt) => pt.timestamp >= thirtyDaysAgo);

  // Detect Geofence Enter / Exit Events
  let placeEvent: { type: 'enter' | 'exit'; memberName: string; placeName: string } | null = null;
  if (detectedPlace && detectedPlace.id !== prevPlaceId) {
    placeEvent = { type: 'enter', memberName: member.name, placeName: detectedPlace.name };
  } else if (!detectedPlace && prevPlaceId) {
    const oldPlace = circle.places.find((p) => p.id === prevPlaceId);
    if (oldPlace) {
      placeEvent = { type: 'exit', memberName: member.name, placeName: oldPlace.name };
    }
  }

  saveData();

  // Broadcast to other phones with live auto-detected speed limit
  broadcastToCircle(circleId, 'location_update', {
    memberId,
    location: locPoint,
    battery,
    isCharging,
    speedMph: member.speedMph,
    currentPlaceId: member.currentPlaceId,
    currentSpeedLimitMph: member.currentSpeedLimitMph,
    currentRoadName: member.currentRoadName,
    speedLimitSource: member.speedLimitSource,
    placeEvent,
  });

  res.json({
    success: true,
    member,
    placeEvent,
  });
});

// GET 30-day location history for member
app.get('/api/circle/:circleId/history/:memberId', (req, res) => {
  const { circleId, memberId } = req.params;
  const days = Number(req.query.days) || 30;
  if (!circles[circleId]) {
    return res.status(404).json({ error: 'Circle not found' });
  }
  const circle = circles[circleId];
  const memberHistory = circle.history[memberId] || [];
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const filtered = memberHistory.filter((pt) => pt.timestamp >= cutoff);

  res.json({
    memberId,
    count: filtered.length,
    points: filtered,
  });
});

// POST family chat message
app.post('/api/circle/:circleId/chat', (req, res) => {
  const { circleId } = req.params;
  const { memberId, text, type = 'text', locationData, recipientMemberId } = req.body;
  if (!circles[circleId]) {
    circles[circleId] = createFreshCircle(circleId);
  }
  const circle = circles[circleId];
  const member = circle.members[memberId] || { name: 'Member', avatar: '' };

  const message: ChatMessage = {
    id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    memberId,
    memberName: member.name,
    memberAvatar: member.avatar,
    text: text || '',
    timestamp: Date.now(),
    type,
    recipientMemberId: recipientMemberId || undefined,
    locationData,
  };

  circle.chat.push(message);
  saveData();

  broadcastToCircle(circleId, 'chat_message', message);
  res.json({ success: true, message });
});

// POST Remote Alarm (Loud siren triggered by admin to find lost/misplaced device)
app.post('/api/circle/:circleId/remote-alarm', (req, res) => {
  const { circleId } = req.params;
  const { action = 'trigger', targetMemberId, senderMemberId, senderName = 'Circle Admin', alarmId } = req.body;

  if (!circles[circleId]) {
    circles[circleId] = createFreshCircle(circleId);
  }
  const circle = circles[circleId];
  if (!circle.activeAlarms) {
    circle.activeAlarms = {};
  }

  const targetMember = circle.members[targetMemberId];
  const targetName = targetMember ? targetMember.name : 'Device';

  if (action === 'trigger') {
    const newAlarmId = alarmId || `alarm-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const alarmEvent: RemoteAlarmEvent = {
      alarmId: newAlarmId,
      targetMemberId,
      targetMemberName: targetName,
      triggeredBy: senderMemberId || 'admin',
      triggeredByName: senderName,
      timestamp: Date.now(),
      status: 'active',
    };

    circle.activeAlarms[newAlarmId] = alarmEvent;

    // Log chat notice
    const chatMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      memberId: senderMemberId || 'system',
      memberName: senderName,
      memberAvatar: circle.members[senderMemberId]?.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=64&h=64&q=80',
      text: `🚨 Remotely sounded full-volume alarm on ${targetName}'s device to locate lost phone!`,
      timestamp: Date.now(),
      type: 'text',
    };
    circle.chat.push(chatMsg);

    saveData();
    broadcastToCircle(circleId, 'remote_alarm_triggered', alarmEvent);
    broadcastToCircle(circleId, 'active_alarms_updated', circle.activeAlarms);
    broadcastToCircle(circleId, 'chat_message', chatMsg);

    return res.json({ success: true, alarm: alarmEvent, activeAlarms: circle.activeAlarms });
  } else if (action === 'silence') {
    const activeKeys = Object.keys(circle.activeAlarms);
    const targetKey = alarmId || activeKeys.find((id) => circle.activeAlarms![id].targetMemberId === targetMemberId);

    if (targetKey && circle.activeAlarms[targetKey]) {
      const silencedAlarm = circle.activeAlarms[targetKey];
      delete circle.activeAlarms[targetKey];

      const chatMsg: ChatMessage = {
        id: `msg-${Date.now()}`,
        memberId: senderMemberId || 'system',
        memberName: senderName,
        memberAvatar: circle.members[senderMemberId]?.avatar || '',
        text: `🔕 Remote alarm on ${targetName}'s device has been silenced.`,
        timestamp: Date.now(),
        type: 'text',
      };
      circle.chat.push(chatMsg);

      saveData();
      broadcastToCircle(circleId, 'remote_alarm_silenced', { alarmId: targetKey, targetMemberId });
      broadcastToCircle(circleId, 'active_alarms_updated', circle.activeAlarms);
      broadcastToCircle(circleId, 'chat_message', chatMsg);

      return res.json({ success: true, alarmId: targetKey, activeAlarms: circle.activeAlarms });
    }

    return res.json({ success: true, message: 'No active alarm found', activeAlarms: circle.activeAlarms });
  }

  res.status(400).json({ error: 'Invalid remote alarm action' });
});

// POST Remote Location Request (Admin requests target member to turn on GPS)
app.post('/api/circle/:circleId/request-location', (req, res) => {
  const { circleId } = req.params;
  const { targetMemberId, senderMemberId, senderName = 'Admin' } = req.body;

  if (!circles[circleId]) {
    circles[circleId] = createFreshCircle(circleId);
  }
  const circle = circles[circleId];
  const targetMember = circle.members[targetMemberId];
  const targetName = targetMember ? targetMember.name : 'Family Member';

  const reqPayload = {
    targetMemberId,
    senderMemberId,
    senderName,
    timestamp: Date.now(),
    message: `${senderName} requested your updated live location pin. Tap to enable GPS now.`,
  };

  const chatMsg: ChatMessage = {
    id: `msg-${Date.now()}`,
    memberId: senderMemberId || 'system',
    memberName: senderName,
    memberAvatar: circle.members[senderMemberId]?.avatar || '',
    text: `📍 Requested live GPS location update from ${targetName}.`,
    timestamp: Date.now(),
    type: 'checkin',
  };
  circle.chat.push(chatMsg);
  saveData();

  broadcastToCircle(circleId, 'location_requested', reqPayload);
  broadcastToCircle(circleId, 'chat_message', chatMsg);

  res.json({ success: true, message: `Location requested from ${targetName}` });
});

// Helper for dynamic local Jarvis engine when Gemini API key is missing or offline
function generateJarvisResponse(contextData: any, query: string): string {
  const q = (query || '').toLowerCase().trim();
  const members = contextData.members || [];
  const drivingMembers = members.filter((m: any) => m.isDriving || m.speedMph >= 15);
  const lowBatteryMembers = members.filter((m: any) => parseInt(m.battery) < 20);
  const historyList = contextData.memberHistories || [];

  // Match member query (e.g., "where's mom", "where is dad", "sarah")
  let targetMember: any = null;
  let targetHistory: any = null;
  for (const m of members) {
    const nameLower = m.name.toLowerCase();
    const roleLower = m.role.toLowerCase();
    if (q.includes(nameLower) || (roleLower !== 'member' && q.includes(roleLower))) {
      targetMember = m;
      targetHistory = historyList.find((h: any) => h.memberId === m.id || h.memberName.toLowerCase().includes(nameLower));
      break;
    }
  }

  // Question about a specific member's location / morning history
  if (targetMember) {
    const isMorningQuery = q.includes('morning') || q.includes('earlier') || q.includes('today') || q.includes('was');
    const curLoc = targetMember.currentPlace || targetMember.currentRoad || 'GPS coordinates';
    const drivingStatus = targetMember.speedMph > 0 ? `driving at ${targetMember.speedMph} mph on ${targetMember.currentRoad}` : 'stationary';
    let response = `📍 **${targetMember.name}** is currently at **${curLoc}** (${drivingStatus}, battery at ${targetMember.battery}).`;

    if (isMorningQuery) {
      const morningStops = targetHistory?.morningPoints || [];
      if (morningStops.length > 0) {
        const uniquePlaces = Array.from(new Set(morningStops.map((p: any) => p.placeOrRoad)));
        response += `\n\n🌅 **Earlier today in the morning:**\n• Recorded in transit: ${uniquePlaces.slice(0, 3).join(' ➔ ')}`;
        if (morningStops[0]?.time) {
          response += ` (first activity at ${morningStops[0].time})`;
        }
      } else {
        response += `\n\n🌅 Earlier today in the morning, ${targetMember.name} was recorded around Home and nearby routes.`;
      }
    }
    return response;
  }

  // Question about battery
  if (q.includes('battery') || q.includes('charge') || q.includes('power')) {
    return `🔋 **KinTrack Family Battery Audit:**\n\n` +
      members.map((m: any) => `• **${m.name}**: ${m.battery} ${m.isCharging ? '⚡ (Charging)' : ''}`).join('\n') +
      (lowBatteryMembers.length > 0
        ? `\n\n⚠️ **Notice:** ${lowBatteryMembers.map((m: any) => m.name).join(', ')} phone is low!`
        : '\n\n✅ All devices currently have sufficient battery.');
  }

  // Question about driving or speeding
  if (q.includes('speed') || q.includes('driving') || q.includes('car')) {
    if (drivingMembers.length === 0) {
      return `🚗 **Motion & Speed Analysis:**\n\nAll family members are currently stationary or walking. No active vehicles detected on the road.`;
    }
    return `🚗 **Active Drivers on the Road:**\n\n` +
      drivingMembers.map((m: any) => `• **${m.name}**: ${m.speedMph} mph on ${m.currentRoad} (Speed limit: ${m.roadSpeedLimit}) ${m.isSpeeding ? '⚠️ Over limit!' : '✅ Within speed limit'}`).join('\n');
  }

  // Question about places
  if (q.includes('place') || q.includes('visit') || q.includes('where is everyone')) {
    return `📍 **Family Location Overview:**\n\n` +
      members.map((m: any) => `• **${m.name}**: at **${m.currentPlace}** (battery: ${m.battery})`).join('\n') +
      `\n\n🛡️ **Monitored Geofenced Places:** ${contextData.places?.map((p: any) => p.name).join(', ') || 'Home, School, Work'}`;
  }

  // Comprehensive Jarvis Executive Report
  return `### 🤖 Jarvis Family Safety & Intelligence Report

**Time:** ${new Date().toLocaleTimeString()} • **Circle:** ${contextData.circleName} (${members.length} members connected)

---

#### 📍 Current Family Status
${members.length === 0 ? '_No active members currently connected._' : members.map((m: any) => `• **${m.name}** (${m.role}): **${m.currentPlace}** — ${m.speedMph > 0 ? `🚗 ${m.speedMph} mph` : 'Stationary'} • 🔋 ${m.battery}`).join('\n')}

---

#### 🚗 Motion & Driving Trends
• **Active Drivers:** ${drivingMembers.length > 0 ? drivingMembers.map((m: any) => `${m.name} (${m.speedMph} mph)`).join(', ') : 'None — all members are stationary or walking.'}
• **Speed Limit Enforcement:** Active with audio speech warnings configured.

---

#### 🔋 Device Health & Battery Audit
${lowBatteryMembers.length > 0 ? lowBatteryMembers.map((m: any) => `⚠️ **${m.name}'s phone is low at ${m.battery}!** Please remind them to charge.`).join('\n') : '✅ All family devices have healthy battery levels.'}

---

#### 💡 Safety Insights
• Geofences active: ${contextData.places?.length || 0} zones monitored with automatic arrival/departure voice alerts.
• Ask me anytime: *"Where's mom?"*, *"Where was Sarah this morning?"*, or *"Who has low battery?"*!`;
}

// Handler for Jarvis AI assistant
async function handleJarvisRequest(req: express.Request, res: express.Response) {
  const { circleId } = req.params;
  const { query, mode = 'general' } = req.body;

  if (!circles[circleId]) {
    circles[circleId] = createFreshCircle(circleId);
  }
  const circle = circles[circleId];

  const membersList = Object.values(circle.members);
  const placesList = circle.places || [];
  const recentChat = circle.chat.slice(-10);
  const activeSos = circle.sosAlerts.filter((s) => s.status === 'active');
  const activeAlarms = Object.values(circle.activeAlarms || {}).filter((a) => a.status === 'active');

  // Extract history timeline points (morning, afternoon, 24h) for Jarvis
  const memberHistories = Object.entries(circle.history || {}).map(([mId, points]) => {
    const member = circle.members[mId];
    const last24h = Date.now() - 24 * 60 * 60 * 1000;
    const recent = (points || []).filter((p) => p.timestamp >= last24h);
    const morningPoints = recent
      .filter((p) => {
        const hour = new Date(p.timestamp).getHours();
        return hour >= 5 && hour < 12;
      })
      .map((p) => ({
        time: new Date(p.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        placeOrRoad: p.placeName || p.roadName || p.address || 'In transit',
        speedMph: p.speed,
      }));

    return {
      memberId: mId,
      memberName: member?.name || mId,
      morningPoints,
      todayTotalPoints: recent.length,
    };
  });

  const contextData = {
    circleName: circle.name,
    memberCount: membersList.length,
    members: membersList.map((m) => ({
      id: m.id,
      name: m.name,
      role: m.role,
      phone: m.phone || 'Not registered',
      battery: `${m.battery}% (charging: ${m.isCharging ? 'yes' : 'no'})`,
      speedMph: m.speedMph,
      isDriving: m.speedMph >= 15,
      isOnline: m.isOnline,
      currentPlace: m.location?.placeName || m.location?.address || 'Unknown GPS location',
      currentRoad: m.currentRoadName || m.location?.roadName || 'Road',
      roadSpeedLimit: m.currentSpeedLimitMph ? `${m.currentSpeedLimitMph} mph (auto-detected for ${m.currentRoadName || 'road'})` : '35 mph (auto-detected)',
      isSpeeding: m.currentSpeedLimitMph ? m.speedMph > m.currentSpeedLimitMph : false,
      speedDifferentialMph: m.currentSpeedLimitMph ? m.speedMph - m.currentSpeedLimitMph : 0,
      coordinates: `${m.location?.lat?.toFixed(4) || 0}, ${m.location?.lng?.toFixed(4) || 0}`,
      lastSeenSecondsAgo: Math.round((Date.now() - m.lastUpdated) / 1000),
      speedLimitAlertThreshold: `+${m.speedLimitThresholdMph || circle.speedLimitAlertThresholdMph || 10} mph`,
    })),
    memberHistories,
    places: placesList.map((p) => ({
      name: p.name,
      category: p.category,
      address: p.address,
      radiusMeters: p.radiusMeters,
    })),
    recentChat: recentChat.map((c) => `[${c.memberName}]: ${c.text}`),
    activeSosAlerts: activeSos.map((s) => `${s.memberName} at ${s.address || 'GPS coords'}`),
    activeAlarms: activeAlarms.map((a) => `Alarm ringing on ${a.targetMemberName}'s device`),
    currentTimeIso: new Date().toISOString(),
  };

  const systemInstruction = `You are Jarvis, the elite voice and chat AI personal safety and family intelligence agent for KinTrack Family.
You have real-time access to live member GPS coordinates, road speed limits, battery levels, place arrivals/departures, SOS alarms, and historical movements for today (morning, afternoon, evening).
Your capabilities:
1. When asked about a member's location and their history (e.g., "Hey Jarvis, where's mom and where was she earlier today in the morning?"):
   - Tell where they are right now clearly and immediately.
   - Look up their morning points in 'memberHistories' and summarize where they were earlier in the morning with times and locations/roads.
   - Note their current battery and driving speed.
2. When asked about battery or charging:
   - Provide an instant audit of who has low battery and who is charging.
3. When asked about speeding or driving:
   - Report who is currently driving, their speed, and if they are exceeding the road speed limit.
4. When asked for reports or summaries:
   - Provide a clean, structured executive report with emojis and bullet points.
5. Tone: Polite, confident, highly intelligent, protective, and concise like a loyal personal butler/analyst. Answer directly without fluff.`;

  try {
    const prompt = `Live KinTrack Family Data:
${JSON.stringify(contextData, null, 2)}

User Query to Jarvis:
"${query || 'Generate a complete family tracking, location, and safety report for today.'}"`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        systemInstruction,
        temperature: 0.3,
      },
    });

    const reply = response.text || generateJarvisResponse(contextData, query);
    return res.json({ success: true, reply, timestamp: Date.now() });
  } catch (err: any) {
    console.warn('Gemini API call failed, using Jarvis local engine:', err);
    const reply = generateJarvisResponse(contextData, query);
    return res.json({ success: true, reply, timestamp: Date.now(), isFallback: true });
  }
}

// POST Jarvis AI Assistant endpoints (supports both /jarvis and /ai/assistant)
app.post('/api/circle/:circleId/jarvis', handleJarvisRequest);
app.post('/api/circle/:circleId/ai/assistant', handleJarvisRequest);

// POST Emergency SOS Alert
app.post('/api/circle/:circleId/sos', (req, res) => {
  const { circleId } = req.params;
  const { memberId, action = 'trigger', lat, lng, address } = req.body;
  if (!circles[circleId]) {
    circles[circleId] = createFreshCircle(circleId);
  }
  const circle = circles[circleId];
  const member = circle.members[memberId];

  if (action === 'trigger') {
    const alert: SosAlert = {
      id: `sos-${Date.now()}`,
      memberId,
      memberName: member?.name || 'Family Member',
      lat: lat ?? member?.location.lat ?? 0,
      lng: lng ?? member?.location.lng ?? 0,
      battery: member?.battery ?? 100,
      timestamp: Date.now(),
      status: 'active',
      address: address || member?.location.address,
    };
    circle.sosAlerts.push(alert);

    // Also add emergency notice in circle chat
    circle.chat.push({
      id: `msg-${Date.now()}`,
      memberId,
      memberName: member?.name || 'Family Member',
      memberAvatar: member?.avatar || '',
      text: `🚨 EMERGENCY SOS TRIGGERED! I need immediate help!`,
      timestamp: Date.now(),
      type: 'sos',
      locationData: { lat: alert.lat, lng: alert.lng },
    });

    saveData();
    broadcastToCircle(circleId, 'sos_alert', alert);
    return res.json({ success: true, alert });
  } else if (action === 'resolve') {
    const alertId = req.body.alertId;
    const alert = circle.sosAlerts.find((a) => a.id === alertId || a.status === 'active');
    if (alert) {
      alert.status = 'resolved';
      alert.resolvedAt = Date.now();
      alert.resolvedBy = member?.name || 'Family Admin';
    }
    saveData();
    broadcastToCircle(circleId, 'sos_resolved', { alertId: alert?.id });
    return res.json({ success: true, alert });
  }

  res.status(400).json({ error: 'Invalid action' });
});

// POST save / update Place (Geofence)
app.post('/api/circle/:circleId/places', (req, res) => {
  const { circleId } = req.params;
  const { id, name, category, lat, lng, radiusMeters, address, color } = req.body;
  if (!circles[circleId]) {
    circles[circleId] = createFreshCircle(circleId);
  }
  const circle = circles[circleId];
  const placeId = id || `place-${Date.now()}`;

  const existingIdx = circle.places.findIndex((p) => p.id === placeId);
  const newPlace: SavedPlace = {
    id: placeId,
    name: name || 'Saved Place',
    category: category || 'other',
    lat: Number(lat),
    lng: Number(lng),
    radiusMeters: Number(radiusMeters) || 150,
    address: address || `${Number(lat).toFixed(4)}, ${Number(lng).toFixed(4)}`,
    color: color || '#3b82f6',
  };

  if (existingIdx !== -1) {
    circle.places[existingIdx] = newPlace;
  } else {
    circle.places.push(newPlace);
  }

  saveData();
  broadcastToCircle(circleId, 'places_updated', circle.places);
  res.json({ success: true, place: newPlace });
});

// DELETE place
app.delete('/api/circle/:circleId/places/:placeId', (req, res) => {
  const { circleId, placeId } = req.params;
  if (!circles[circleId]) {
    return res.status(404).json({ error: 'Circle not found' });
  }
  const circle = circles[circleId];
  circle.places = circle.places.filter((p) => p.id !== placeId);
  saveData();
  broadcastToCircle(circleId, 'places_updated', circle.places);
  res.json({ success: true });
});

// EXPORT 30-day circle data (for Google Drive or local admin backup)
app.get('/api/circle/:circleId/export', (req, res) => {
  const { circleId } = req.params;
  const circle = circles[circleId];
  if (!circle) {
    return res.status(404).json({ error: 'Circle not found' });
  }
  res.setHeader('Content-Disposition', `attachment; filename="orbit-backup-${circleId}-${new Date().toISOString().slice(0, 10)}.json"`);
  res.setHeader('Content-Type', 'application/json');
  res.json(circle);
});

// IMPORT circle backup
app.post('/api/circle/:circleId/import', (req, res) => {
  const { circleId } = req.params;
  const backupData = req.body;
  if (!backupData || !backupData.members) {
    return res.status(400).json({ error: 'Invalid backup structure' });
  }
  circles[circleId] = {
    ...backupData,
    circleId,
  };
  saveData();
  broadcastToCircle(circleId, 'circle_reset', circles[circleId]);
  res.json({ success: true, message: 'Circle restored successfully' });
});

// Serve frontend: Vite middlewares in dev, static files in production
async function startServer() {
  const httpServer = http.createServer(app);

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        watch: null,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  httpServer.listen(port, '0.0.0.0', () => {
    console.log(`Orbit Family 360 server running on http://localhost:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
