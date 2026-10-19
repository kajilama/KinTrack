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

export type FamilyRole =
  | 'Dad'
  | 'Mom'
  | 'Son'
  | 'Daughter'
  | 'Child'
  | 'Teen'
  | 'Parent'
  | 'Grandparent'
  | 'Admin'
  | 'Member'
  | string;

export interface FamilyMember {
  id: string;
  name: string;
  role: FamilyRole;
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
  recipientMemberId?: string; // undefined for circle-wide group chat, or member ID for 1-on-1 member chat
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
  requestedByName?: string;
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
  message?: string;
  memberAvatar?: string;
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
  history?: Record<string, LocationPoint[]>;
}

export type EcoModeLevel = 'high_accuracy' | 'balanced' | 'eco_smart' | 'geofence_only';

export interface EcoSettings {
  mode: EcoModeLevel;
  gpsIntervalSeconds: number; // 5s, 15s, 60s, 300s
  wakeLockActive: boolean;
  backgroundAudioKeepalive: boolean;
  speedVoiceAlerts: boolean;
  geofenceVoiceAlerts: boolean;
  speedThresholdMph: number; // default +10mph
  autoSpeedLimit: boolean; // Auto-detect road speed limit via OSM & map location
  defaultSpeedLimit: number; // fallback baseline limit if unmapped
  lowBatteryThresholdPercent?: number; // default 15%
  lowBatteryBroadcastEnabled?: boolean; // broadcast low battery alert to circle
  fontScale?: 'normal' | 'comfortable' | 'large' | 'xlarge'; // UI text scale for high DPI devices
}

export interface VoiceQueryResult {
  text: string;
  targetMember?: FamilyMember;
  action?: 'navigate' | 'call' | 'sos' | 'battery' | 'status';
}

export interface AppNotification {
  id: string;
  type: 'chat' | 'alarm' | 'geofence' | 'speed' | 'sos' | 'location_request' | 'system';
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
  memberId?: string;
  memberName?: string;
  senderName?: string;
  senderAvatar?: string;
  actionType?: 'open_chat' | 'open_sos' | 'open_alarm' | 'view_map' | 'chat' | 'map' | 'alarm' | 'sos';
  actionPayload?: any;
  actionData?: any;
}
