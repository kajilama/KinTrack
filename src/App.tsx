import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Users,
  UserPlus,
  Compass,
  History,
  MessageSquare,
  AlertOctagon,
  Mic,
  HelpCircle,
  Gauge,
  Wifi,
  WifiOff,
  Crosshair,
  Volume2,
  QrCode,
  Sparkles,
  BellRing,
  Bell,
  Phone,
  Menu,
  X,
  Moon,
  Sun,
  Settings,
  MapPin,
  Bot,
  RefreshCw,
  Check,
  Server,
} from 'lucide-react';
import { FamilyMap } from './components/FamilyMap';
import { EcoStatusBar } from './components/EcoStatusBar';
import { JarvisAiModal } from './components/JarvisAiModal';
import { RemoteAlarmModal } from './components/RemoteAlarmModal';
import { LocationRequestNotificationModal } from './components/LocationRequestNotificationModal';
import { HistoryTimeline } from './components/HistoryTimeline';
import { FamilyChat } from './components/FamilyChat';
import { PlacesManagerModal } from './components/PlacesManagerModal';
import { SosAlertModal } from './components/SosAlertModal';
import { FamilyStorageGuideModal } from './components/FamilyStorageGuideModal';
import { SpeedVoiceAlertsModal } from './components/SpeedVoiceAlertsModal';
import { DeviceIdentityModal } from './components/DeviceIdentityModal';
import { MemberManagementModal } from './components/MemberManagementModal';
import { PWAInstallBanner } from './components/PWAInstallBanner';
import { QRCodeModal } from './components/QRCodeModal';
import { UniversalSignInModal } from './components/UniversalSignInModal';
import { SettingsModal } from './components/SettingsModal';
import { MemberDetailSheet } from './components/MemberDetailSheet';
import { NotificationCenterDropdown } from './components/NotificationCenterDropdown';
import { ConnectionHubModal } from './components/ConnectionHubModal';
import { apiFetch, apiUrl, getServerUrl } from './utils/apiConfig';
import { useAuth } from './context/AuthContext';
import {
  startNativeLocationWatcher,
  clearNativeLocationWatcher,
  isNativeApp,
} from './utils/nativeLocation';
import {
  CircleData,
  FamilyMember,
  FamilyRole,
  SavedPlace,
  ChatMessage,
  SosAlert,
  RemoteAlarmEvent,
  EcoSettings,
  LocationPoint,
  AppNotification,
} from './types';
import { advanceSimulationStep, getDistanceMeters } from './utils/geo';
import {
  playGeofenceChime,
  playSpeedWarningBeep,
  speakVoiceAlert,
  playChatMessageSound,
  startLostPhonePiercingAlarm,
  unlockAudioContext,
} from './utils/audio';

export default function App() {
  // Theme state: dark / light
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('orbit_theme') as 'dark' | 'light') || 'dark';
  });

  // Determine circle ID from URL param or localStorage (default to 'ORBIT-FAMILY')
  const [circleId, setCircleId] = useState<string>(() => {
    const params = new URLSearchParams(window.location.search);
    const paramCircle = params.get('circle');
    if (paramCircle) return paramCircle.trim().toUpperCase();
    const saved = localStorage.getItem('orbit_active_circle_id');
    return saved ? saved.trim().toUpperCase() : 'ORBIT-FAMILY';
  });

  // State
  const [circleData, setCircleData] = useState<CircleData | null>(null);
  const [activeMemberId, setActiveMemberId] = useState<string>(() => {
    return localStorage.getItem('orbit_active_member_id') || '';
  });
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);

  // Active Bottom Sheet / Panel
  const [activeTab, setActiveTab] = useState<'map' | 'chat' | 'history' | 'places'>('map');

  // Modals & Menu
  const [isTopMenuOpen, setIsTopMenuOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isVoiceOpen, setIsVoiceOpen] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isSpeedModalOpen, setIsSpeedModalOpen] = useState(false);
  const [isPlacesModalOpen, setIsPlacesModalOpen] = useState(false);
  const [isSosModalOpen, setIsSosModalOpen] = useState(false);
  const [isIdentityModalOpen, setIsIdentityModalOpen] = useState(false);
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [isConnectionHubOpen, setIsConnectionHubOpen] = useState(false);
  const [isServerConnected, setIsServerConnected] = useState(true);
  const [isUniversalAuthOpen, setIsUniversalAuthOpen] = useState(() => {
    return localStorage.getItem('orbit_onboarding_completed') !== 'true';
  });

  // Direct member chat target and Remote Alarm & Location Request states
  const [targetChatMemberId, setTargetChatMemberId] = useState<string | null>(null);
  const [activeIncomingAlarm, setActiveIncomingAlarm] = useState<RemoteAlarmEvent | null>(null);
  const [incomingLocationRequest, setIncomingLocationRequest] = useState<any | null>(null);

  // Sync state & toast for manual and background reload
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncToast, setSyncToast] = useState<string | null>(null);
  const [isFreshBoxDismissed, setIsFreshBoxDismissed] = useState<boolean>(() => {
    return localStorage.getItem('kintrack_fresh_box_dismissed') === 'true';
  });

  // Top Bar Notification Center State (Default stores last 5 notifications, customizable in settings)
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [maxNotifications, setMaxNotifications] = useState<number>(() => {
    const saved = localStorage.getItem('orbit_max_notifications');
    return saved ? parseInt(saved, 10) : 5;
  });
  const [notifications, setNotifications] = useState<AppNotification[]>(() => {
    try {
      const saved = localStorage.getItem('orbit_notifications');
      if (saved) return JSON.parse(saved);
    } catch {}
    return [
      {
        id: 'notif-welcome',
        type: 'system',
        title: 'KinTrack Family Connected',
        message: 'Real-time location, road speed limits, and family alerts active.',
        timestamp: Date.now(),
        read: false,
      },
    ];
  });

  // Reference for activeMemberId to avoid stale closures in SSE stream handlers
  const activeMemberIdRef = useRef(activeMemberId);
  useEffect(() => {
    activeMemberIdRef.current = activeMemberId;
  }, [activeMemberId]);

  // Helper to append new notification with user-configured max limit
  const addNotification = useCallback(
    (notif: AppNotification) => {
      setNotifications((prev) => {
        const updated = [notif, ...prev.filter((n) => n.id !== notif.id)].slice(0, maxNotifications);
        try {
          localStorage.setItem('orbit_notifications', JSON.stringify(updated));
        } catch {}
        return updated;
      });
    },
    [maxNotifications]
  );

  const handleUpdateMaxNotifications = (val: number) => {
    setMaxNotifications(val);
    localStorage.setItem('orbit_max_notifications', val.toString());
    setNotifications((prev) => prev.slice(0, val));
  };

  const handleMarkAllNotificationsAsRead = () => {
    setNotifications((prev) => {
      const updated = prev.map((n) => ({ ...n, read: true }));
      try {
        localStorage.setItem('orbit_notifications', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const handleClearNotifications = () => {
    setNotifications([]);
    localStorage.removeItem('orbit_notifications');
  };

  // Firebase Google Auth hook
  const { user, signInWithGoogle, logout } = useAuth();

  const sharedAppUrl = `${window.location.origin}/?circle=${encodeURIComponent(circleId)}`;

  // History route & playback
  const [historyRoute, setHistoryRoute] = useState<LocationPoint[] | null>(null);
  const [historyPlaybackPoint, setHistoryPlaybackPoint] = useState<LocationPoint[] | null>(null);

  // Device GPS & Simulation (Simulation is strictly OFF by default; GPS auto-enabled on native Android/iOS)
  const [isRealGpsEnabled, setIsRealGpsEnabled] = useState(() => isNativeApp());
  const [isSimulatorActive, setIsSimulatorActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  // Physical battery & charging state
  const [myBattery, setMyBattery] = useState(90);
  const [isCharging, setIsCharging] = useState(false);

  // Eco, Battery & Display settings
  const [ecoSettings, setEcoSettings] = useState<EcoSettings>(() => {
    return {
      mode: 'eco_smart',
      gpsIntervalSeconds: 30,
      wakeLockActive: false,
      backgroundAudioKeepalive: true,
      speedVoiceAlerts: true,
      geofenceVoiceAlerts: true,
      speedThresholdMph: 10,
      autoSpeedLimit: true,
      defaultSpeedLimit: 45,
      lowBatteryThresholdPercent: 15,
      lowBatteryBroadcastEnabled: true,
      fontScale: (localStorage.getItem('kintrack_font_scale') as any) || 'normal',
    };
  });

  // Track previous members, places, and chat to trigger alerts on background polling
  const lastAlertTimeRef = useRef<Record<string, number>>({});
  const lastSeenChatIdRef = useRef<string>('');
  const prevPlaceMapRef = useRef<Record<string, string | undefined>>({});
  const prevMemberCountRef = useRef<number>(0);

  // Helper to bootstrap a healthy initial circle when offline or before backend is connected
  const initFallbackCircle = useCallback(() => {
    const myId = activeMemberId || (user ? `user-${user.uid.slice(0, 8)}` : 'member-admin');
    const myName = user?.displayName || 'Family Admin';
    const fallback: CircleData = {
      circleId: circleId || 'ORBIT-FAMILY',
      name: 'Orbit Family Circle',
      adminMemberId: myId,
      inviteCode: circleId || 'ORBIT-FAMILY',
      speedLimitAlertThresholdMph: 10,
      members: {
        [myId]: {
          id: myId,
          name: myName,
          role: 'Admin',
          avatar:
            user?.photoURL ||
            'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=256&h=256&q=80',
          color: '#10b981',
          battery: myBattery,
          isCharging,
          lastUpdated: Date.now(),
          speedMph: 0,
          isOnline: true,
          location: {
            lat: 37.7749,
            lng: -122.4194,
            speed: 0,
            accuracy: 10,
            timestamp: Date.now(),
            placeName: 'Joined Circle',
          },
        },
      },
      places: [
        {
          id: 'place-home',
          name: 'Home',
          category: 'home',
          lat: 37.7749,
          lng: -122.4194,
          radiusMeters: 150,
          address: 'Home Safe Haven',
          color: '#3b82f6',
        },
      ],
      chat: [
        {
          id: 'msg-welcome',
          memberId: 'system',
          memberName: 'Family Assistant',
          memberAvatar:
            'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=256&h=256&q=80',
          text: 'KinTrack Family is active. Connect to your Family Server Hub to see other devices in real-time.',
          timestamp: Date.now(),
          type: 'text',
        },
      ],
      sosAlerts: [],
      activeAlarms: {},
    };

    setActiveMemberId(myId);
    setCircleData(fallback);
    localStorage.setItem(`orbit-circle-${circleId}`, JSON.stringify(fallback));
  }, [activeMemberId, user, circleId, myBattery, isCharging]);

  // 1. Resilient Circle Data Fetch & Offline detection with Cache-Busting
  const fetchCircle = useCallback(async (isManual = false) => {
    try {
      if (isManual) setIsSyncing(true);
      // Explicit cache busting with timestamp query param and no-store
      const res = await apiFetch(`/api/circle/${circleId}?_t=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
        },
      });

      if (res.ok) {
        setIsServerConnected(true);
        const data: CircleData = await res.json();

        // 1. Detect if a new member joined circle (e.g. 2nd phone joined)
        const currentMemberCount = Object.keys(data.members || {}).length;
        if (prevMemberCountRef.current > 0 && currentMemberCount > prevMemberCountRef.current) {
          const newMembers = Object.values(data.members || {}).filter(
            (m) => !circleData?.members[m.id]
          );
          newMembers.forEach((nm) => {
            addNotification({
              id: `member-joined-${nm.id}-${Date.now()}`,
              type: 'system',
              title: 'Family Member Joined',
              message: `${nm.name} joined the circle.`,
              timestamp: Date.now(),
              read: false,
            });
          });
        }
        prevMemberCountRef.current = currentMemberCount;

        // 2. Check for incoming chat messages (ensures chat pops up on receiver side even in PWA session)
        if (data.chat && data.chat.length > 0) {
          const latestMsg = data.chat[data.chat.length - 1];
          const myId = activeMemberIdRef.current;
          if (latestMsg && latestMsg.id !== lastSeenChatIdRef.current) {
            // First time initialization just records the ID
            if (lastSeenChatIdRef.current !== '') {
              const isFromOther = latestMsg.memberId !== myId;
              const isTargetedToMe = !latestMsg.recipientMemberId || latestMsg.recipientMemberId === myId;
              if (isFromOther && isTargetedToMe) {
                playChatMessageSound();
                setActiveTab('chat');
                if (latestMsg.recipientMemberId === myId) {
                  setTargetChatMemberId(latestMsg.memberId);
                }
                addNotification({
                  id: `chat-${latestMsg.id}`,
                  type: 'chat',
                  title: latestMsg.memberName || 'Circle Member',
                  message: latestMsg.text || 'Sent a new message',
                  timestamp: latestMsg.timestamp || Date.now(),
                  senderName: latestMsg.memberName,
                  senderAvatar: latestMsg.memberAvatar,
                  actionType: 'open_chat',
                  actionPayload: { memberId: latestMsg.recipientMemberId ? latestMsg.memberId : undefined },
                  read: false,
                });
              }
            }
            lastSeenChatIdRef.current = latestMsg.id;
          }
        }

        // 3. Check for Geofence arrival / departure events across all circle members
        if (ecoSettings.geofenceVoiceAlerts && data.members && data.places) {
          for (const mId in data.members) {
            const member = data.members[mId];
            const prevPlaceId = prevPlaceMapRef.current[mId];
            const currentPlaceId = member.currentPlaceId;

            if (prevPlaceId !== undefined && prevPlaceId !== currentPlaceId) {
              if (currentPlaceId) {
                const place = data.places.find((p) => p.id === currentPlaceId);
                if (place) {
                  playGeofenceChime(true);
                  speakVoiceAlert(`${member.name} has arrived at ${place.name}.`);
                  addNotification({
                    id: `geofence-enter-${mId}-${Date.now()}`,
                    type: 'geofence',
                    title: `${member.name} Arrived`,
                    message: `Arrived at ${place.name}`,
                    timestamp: Date.now(),
                    read: false,
                  });
                }
              } else if (prevPlaceId) {
                const place = data.places.find((p) => p.id === prevPlaceId);
                if (place) {
                  playGeofenceChime(false);
                  speakVoiceAlert(`${member.name} has left ${place.name}.`);
                  addNotification({
                    id: `geofence-leave-${mId}-${Date.now()}`,
                    type: 'geofence',
                    title: `${member.name} Left`,
                    message: `Left ${place.name}`,
                    timestamp: Date.now(),
                    read: false,
                  });
                }
              }
            }
            prevPlaceMapRef.current[mId] = currentPlaceId;
          }
        }

        setCircleData(data);
        localStorage.setItem(`orbit-circle-${circleId}`, JSON.stringify(data));

        // Establish active member identity for current device (WITHOUT forcing selectedMemberId open!)
        const memberIds = Object.keys(data.members || {});
        const savedActiveId = localStorage.getItem('orbit_active_member_id');
        if (savedActiveId && data.members[savedActiveId]) {
          setActiveMemberId(savedActiveId);
        } else if (user) {
          const googleMemberId = `user-${user.uid.slice(0, 8)}`;
          if (data.members[googleMemberId]) {
            setActiveMemberId(googleMemberId);
          }
        } else if (localStorage.getItem('orbit_onboarding_completed') === 'true') {
          if (data.adminMemberId && data.members[data.adminMemberId]) {
            setActiveMemberId(data.adminMemberId);
          } else if (memberIds.length > 0) {
            setActiveMemberId(memberIds[0]);
          }
        }
      } else {
        setIsServerConnected(false);
        const cached = localStorage.getItem(`orbit-circle-${circleId}`);
        if (cached) {
          setCircleData(JSON.parse(cached));
        } else {
          initFallbackCircle();
        }
      }
    } catch (err) {
      console.warn('Backend fetch failed, using cached or fallback circle state:', err);
      setIsServerConnected(false);
      const cached = localStorage.getItem(`orbit-circle-${circleId}`);
      if (cached) {
        setCircleData(JSON.parse(cached));
      } else {
        initFallbackCircle();
      }
    } finally {
      if (isManual) {
        setTimeout(() => setIsSyncing(false), 500);
      }
    }
  }, [circleId, user, ecoSettings.geofenceVoiceAlerts, addNotification, initFallbackCircle]);

  const handleManualRefresh = async () => {
    unlockAudioContext();
    setIsSyncing(true);
    await fetchCircle(true);
    setSyncToast('Circle & locations synced');
    setTimeout(() => setSyncToast(null), 2500);
  };

  useEffect(() => {
    fetchCircle();

    // High frequency 2.5s polling interval ensures all phones stay in 100% sync even if SSE disconnects
    const syncInterval = setInterval(() => fetchCircle(false), 2500);

    // Guaranteed fallback bootstrap so user is NEVER stuck on loading screen
    const bootTimer = setTimeout(() => {
      setCircleData((curr) => {
        if (!curr) {
          initFallbackCircle();
        }
        return curr;
      });
    }, 2000);

    const handleServerUrlChange = () => {
      fetchCircle(true);
    };
    window.addEventListener('kintrack_server_url_changed', handleServerUrlChange);

    const handleVisChange = () => {
      if (document.visibilityState === 'visible') {
        fetchCircle(false);
      }
    };
    window.addEventListener('visibilitychange', handleVisChange);
    window.addEventListener('focus', () => fetchCircle(false));

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Battery API
    if ('getBattery' in navigator) {
      (navigator as any).getBattery().then((battery: any) => {
        setMyBattery(Math.round(battery.level * 100));
        setIsCharging(battery.charging);

        battery.addEventListener('levelchange', () => {
          setMyBattery(Math.round(battery.level * 100));
        });
        battery.addEventListener('chargingchange', () => {
          setIsCharging(battery.charging);
        });
      });
    }

    return () => {
      clearInterval(syncInterval);
      clearTimeout(bootTimer);
      window.removeEventListener('kintrack_server_url_changed', handleServerUrlChange);
      window.removeEventListener('visibilitychange', handleVisChange);
      window.removeEventListener('focus', () => fetchCircle(false));
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [fetchCircle, initFallbackCircle]);

  // Synchronize theme (dark / light mode) with document and localStorage
  useEffect(() => {
    localStorage.setItem('orbit_theme', theme);
    const root = document.documentElement;
    if (theme === 'light') {
      root.classList.add('light-mode');
      root.classList.remove('dark');
    } else {
      root.classList.remove('light-mode');
      root.classList.add('dark');
    }
  }, [theme]);

  // Synchronize Text Size & Display Scale (optimizing readability on Pixel 9 Pro XL & Galaxy S26 Ultra)
  useEffect(() => {
    const scale = ecoSettings.fontScale || 'normal';
    localStorage.setItem('kintrack_font_scale', scale);
    const root = document.documentElement;
    if (scale === 'comfortable') {
      root.style.fontSize = '18.5px';
    } else if (scale === 'large') {
      root.style.fontSize = '21px';
    } else if (scale === 'xlarge') {
      root.style.fontSize = '23.5px';
    } else {
      root.style.fontSize = '16px';
    }
  }, [ecoSettings.fontScale]);

  // In-App "Hey Jarvis" hands-free wake word listener
  useEffect(() => {
    if (isVoiceOpen) return;
    const win = window as any;
    const SpeechRecognitionClass = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (!SpeechRecognitionClass) return;

    let recognizer: any = null;
    let isDisposed = false;

    try {
      recognizer = new SpeechRecognitionClass();
      recognizer.continuous = true;
      recognizer.interimResults = true;
      recognizer.lang = 'en-US';

      recognizer.onresult = (event: any) => {
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const phrase = (event.results[i][0]?.transcript || '').toLowerCase();
          if (phrase.includes('hey jarvis') || phrase.includes('jarvis')) {
            unlockAudioContext();
            setIsVoiceOpen(true);
            try {
              recognizer.stop();
            } catch {}
            break;
          }
        }
      };

      recognizer.onerror = () => {};
      recognizer.onend = () => {
        // Keep listening in background if app is still active and Jarvis modal is closed
        if (!isDisposed && !isVoiceOpen && document.visibilityState === 'visible') {
          setTimeout(() => {
            if (!isDisposed && !isVoiceOpen) {
              try {
                recognizer.start();
              } catch {}
            }
          }, 1000);
        }
      };

      // Start after initial user engagement
      const initWakeWord = () => {
        try {
          recognizer.start();
        } catch {}
        window.removeEventListener('click', initWakeWord);
        window.removeEventListener('touchstart', initWakeWord);
      };

      window.addEventListener('click', initWakeWord, { once: true });
      window.addEventListener('touchstart', initWakeWord, { once: true });
    } catch {}

    return () => {
      isDisposed = true;
      if (recognizer) {
        try {
          recognizer.stop();
        } catch {}
      }
    };
  }, [isVoiceOpen]);

  // Low battery circle broadcast tracker (fires once per low battery incident)
  const lastLowBatteryAlertSentRef = useRef<boolean>(false);

  useEffect(() => {
    if (ecoSettings.lowBatteryBroadcastEnabled === false || isCharging || !activeMemberId || !circleData) {
      if (isCharging || myBattery > (ecoSettings.lowBatteryThresholdPercent || 15)) {
        lastLowBatteryAlertSentRef.current = false;
      }
      return;
    }

    const threshold = ecoSettings.lowBatteryThresholdPercent || 15;
    if (myBattery <= threshold && !lastLowBatteryAlertSentRef.current) {
      lastLowBatteryAlertSentRef.current = true;
      const member = circleData.members[activeMemberId];
      const memberName = member?.name || 'My';
      const batteryText = `⚠️ Low Battery Notice: ${memberName}'s phone battery has dropped to ${myBattery}%. Please call or message soon before it powers off.`;

      // Post automatic notice to circle chat
      apiFetch(`/api/circle/${circleId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId: activeMemberId,
          text: batteryText,
          type: 'text',
        }),
      }).catch((err) => console.warn('Low battery broadcast error:', err));

      addNotification({
        id: `low-battery-${Date.now()}`,
        type: 'alarm',
        title: 'Low Battery Alert Sent',
        message: `Alerted family circle: battery at ${myBattery}%`,
        timestamp: Date.now(),
        read: false,
      });
    }
  }, [myBattery, isCharging, activeMemberId, circleId, ecoSettings.lowBatteryBroadcastEnabled, ecoSettings.lowBatteryThresholdPercent, circleData, addNotification]);

  // Save active member ID to localStorage
  useEffect(() => {
    if (activeMemberId) {
      localStorage.setItem('orbit_active_member_id', activeMemberId);
    }
  }, [activeMemberId]);

  // 2. Link authenticated Google user to circle member (Fresh onboarding with NO test data)
  useEffect(() => {
    if (!user || !circleData) return;

    const googleMemberId = `user-${user.uid.slice(0, 8)}`;

    if (!circleData.members[googleMemberId]) {
      const isFirst = Object.keys(circleData.members).length === 0;

      // Acquire user's live physical location if available
      const initLocation = {
        lat: 37.7749,
        lng: -122.4194,
        speed: 0,
        accuracy: 10,
        timestamp: Date.now(),
        placeName: 'Home',
      };

      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            initLocation.lat = pos.coords.latitude;
            initLocation.lng = pos.coords.longitude;
          },
          () => {},
          { timeout: 5000 }
        );
      }

      const googleMember: FamilyMember = {
        id: googleMemberId,
        name: user.displayName || 'Family Admin',
        role: isFirst ? 'Admin' : 'Member',
        avatar:
          user.photoURL ||
          'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=256&h=256&q=80',
        color: '#3b82f6',
        battery: myBattery,
        isCharging,
        lastUpdated: Date.now(),
        speedMph: 0,
        isOnline: true,
        location: initLocation,
      };

      // Save to backend
      apiFetch(`/api/circle/${circleId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(googleMember),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.members) {
            setCircleData((prev) => (prev ? { ...prev, members: data.members } : prev));
          }
        })
        .catch((err) => console.warn('Could not register Google member on server:', err));

      setCircleData((prev) =>
        prev
          ? {
              ...prev,
              adminMemberId: prev.adminMemberId || googleMemberId,
              members: { ...prev.members, [googleMemberId]: googleMember },
            }
          : prev
      );

      setActiveMemberId(googleMemberId);
      setSelectedMemberId(googleMemberId);
      setIsSimulatorActive(false); // Ensure simulator stays OFF
    }
  }, [user, circleData?.circleId]);

  // 3. Real-Time SSE Stream for live phone synchronization & member updates
  useEffect(() => {
    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource(apiUrl(`/api/circle/${circleId}/stream`));
      eventSource.onopen = () => setIsServerConnected(true);
      eventSource.onerror = () => setIsServerConnected(false);

      eventSource.addEventListener('location_update', (e) => {
        const payload = JSON.parse(e.data);
        setCircleData((prev) => {
          if (!prev) return prev;
          const member = prev.members[payload.memberId];
          if (!member) return prev;

          const updatedMember: FamilyMember = {
            ...member,
            location: payload.location,
            battery: payload.battery,
            isCharging: payload.isCharging,
            speedMph: payload.speedMph,
            currentPlaceId: payload.currentPlaceId,
            currentSpeedLimitMph: payload.currentSpeedLimitMph || member.currentSpeedLimitMph,
            currentRoadName: payload.currentRoadName || member.currentRoadName,
            speedLimitSource: payload.speedLimitSource || member.speedLimitSource,
            lastUpdated: Date.now(),
          };

          return {
            ...prev,
            members: {
              ...prev.members,
              [payload.memberId]: updatedMember,
            },
          };
        });

        // Trigger Geofence Voice Alert if enabled
        if (payload.placeEvent && ecoSettings.geofenceVoiceAlerts) {
          const { type, memberName, placeName } = payload.placeEvent;
          playGeofenceChime(type === 'enter');
          speakVoiceAlert(
            type === 'enter'
              ? `${memberName} has arrived at ${placeName}.`
              : `${memberName} has left ${placeName}.`
          );
        }
      });

      eventSource.addEventListener('members_updated', (e) => {
        const members: Record<string, FamilyMember> = JSON.parse(e.data);
        setCircleData((prev) => (prev ? { ...prev, members } : prev));
      });

      eventSource.addEventListener('member_removed', (e) => {
        const { memberId } = JSON.parse(e.data);
        setCircleData((prev) => {
          if (!prev) return prev;
          const copy = { ...prev.members };
          delete copy[memberId];
          return { ...prev, members: copy };
        });
      });

      eventSource.addEventListener('circle_reset', (e) => {
        const freshCircle: CircleData = JSON.parse(e.data);
        setCircleData(freshCircle);
      });

      eventSource.addEventListener('chat_message', (e) => {
        const msg: ChatMessage = JSON.parse(e.data);
        setCircleData((prev) => {
          if (!prev) return prev;
          if (prev.chat.some((m) => m.id === msg.id)) return prev;
          return {
            ...prev,
            chat: [...prev.chat, msg],
          };
        });

        const myId = activeMemberIdRef.current;
        const isFromOther = msg.memberId !== myId;
        const isTargetedToMe = !msg.recipientMemberId || msg.recipientMemberId === myId;

        if (isFromOther && isTargetedToMe) {
          // Play audible sound alert
          playChatMessageSound();

          // Automatically trigger or open chat box on the receiver's side
          setActiveTab('chat');
          if (msg.recipientMemberId === myId) {
            setTargetChatMemberId(msg.memberId);
          }

          // Store notification in top bar notification center
          addNotification({
            id: `chat-${msg.id}`,
            type: 'chat',
            title: `${msg.memberName || 'Circle Member'}`,
            message: msg.text || 'Sent a new message',
            timestamp: msg.timestamp || Date.now(),
            senderName: msg.memberName,
            senderAvatar: msg.memberAvatar,
            actionType: 'open_chat',
            actionPayload: { memberId: msg.recipientMemberId ? msg.memberId : undefined },
            read: false,
          });
        }
      });

      eventSource.addEventListener('sos_alert', (e) => {
        const alert: SosAlert = JSON.parse(e.data);
        setCircleData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            sosAlerts: [alert, ...prev.sosAlerts.filter((a) => a.id !== alert.id)],
          };
        });
        setIsSosModalOpen(true);
        addNotification({
          id: `sos-${alert.id}`,
          type: 'sos',
          title: `🚨 SOS: ${alert.memberName}`,
          message: alert.message || 'Emergency assistance requested!',
          timestamp: alert.timestamp || Date.now(),
          senderName: alert.memberName,
          senderAvatar: alert.memberAvatar,
          actionType: 'open_sos',
          actionPayload: { alertId: alert.id },
          read: false,
        });
      });

      eventSource.addEventListener('sos_resolved', () => {
        setCircleData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            sosAlerts: prev.sosAlerts.map((a) => ({ ...a, status: 'resolved' })),
          };
        });
      });

      eventSource.addEventListener('places_updated', (e) => {
        const places: SavedPlace[] = JSON.parse(e.data);
        setCircleData((prev) => (prev ? { ...prev, places } : prev));
      });

      // Remote Alarm Triggered
      eventSource.addEventListener('remote_alarm_triggered', (e) => {
        const alarm: RemoteAlarmEvent = JSON.parse(e.data);
        setCircleData((prev) => {
          if (!prev) return prev;
          const activeAlarms = { ...(prev.activeAlarms || {}), [alarm.alarmId]: alarm };
          return { ...prev, activeAlarms };
        });
        const myId = activeMemberIdRef.current;
        if (alarm.targetMemberId === myId) {
          setActiveIncomingAlarm(alarm);
          addNotification({
            id: `alarm-${alarm.alarmId}`,
            type: 'alarm',
            title: '🚨 Remote Phone Alarm Ringing!',
            message: `${alarm.requestedByName || 'Family Member'} triggered emergency ringing to locate this phone!`,
            timestamp: alarm.timestamp || Date.now(),
            senderName: alarm.requestedByName,
            actionType: 'open_alarm',
            read: false,
          });
        }
      });

      // Remote Alarm Silenced
      eventSource.addEventListener('remote_alarm_silenced', (e) => {
        const { alarmId, targetMemberId } = JSON.parse(e.data);
        setCircleData((prev) => {
          if (!prev) return prev;
          const activeAlarms = { ...(prev.activeAlarms || {}) };
          if (alarmId && activeAlarms[alarmId]) {
            delete activeAlarms[alarmId];
          } else {
            for (const k in activeAlarms) {
              if (activeAlarms[k].targetMemberId === targetMemberId) delete activeAlarms[k];
            }
          }
          return { ...prev, activeAlarms };
        });
        const myId = activeMemberIdRef.current;
        if (targetMemberId === myId) {
          setActiveIncomingAlarm(null);
        }
      });

      // Active Alarms Map Updated
      eventSource.addEventListener('active_alarms_updated', (e) => {
        const activeAlarms: Record<string, RemoteAlarmEvent> = JSON.parse(e.data);
        setCircleData((prev) => (prev ? { ...prev, activeAlarms } : prev));
        const myId = activeMemberIdRef.current;
        const myAlarm = Object.values(activeAlarms).find(
          (a) => a.targetMemberId === myId && a.status === 'active'
        );
        setActiveIncomingAlarm(myAlarm || null);
      });

      // Remote Location Requested (Admin asked device to turn on GPS)
      eventSource.addEventListener('location_requested', (e) => {
        const payload = JSON.parse(e.data);
        const myId = activeMemberIdRef.current;
        if (payload.targetMemberId === myId) {
          setIncomingLocationRequest(payload);
          addNotification({
            id: `loc-req-${Date.now()}`,
            type: 'system',
            title: 'Location Request',
            message: `${payload.requestedByName || 'Admin'} requested live GPS coordinates for this device.`,
            timestamp: Date.now(),
            actionType: 'view_map',
            read: false,
          });
        }
      });
    } catch (err) {
      console.warn('SSE subscription error:', err);
    }

    return () => {
      eventSource?.close();
    };
  }, [circleId, ecoSettings.geofenceVoiceAlerts]);

  // 4. Real Physical Device Geolocation (Native Android Capacitor & Web with high accuracy)
  useEffect(() => {
    if (!isRealGpsEnabled || !activeMemberId) return;

    let watchRef: string | number | null = null;
    let isCancelled = false;

    startNativeLocationWatcher(
      (coords) => {
        if (isCancelled) return;
        const speedMph = coords.speedMph || 0;
        const lat = coords.lat;
        const lng = coords.lng;
        const accuracy = coords.accuracy || 10;

        apiFetch(`/api/circle/${circleId}/member/${activeMemberId}/location`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lat,
            lng,
            speed: speedMph,
            accuracy,
            battery: myBattery,
            isCharging,
            activity: speedMph > 15 ? 'driving' : speedMph > 2 ? 'walking' : 'stationary',
          }),
        })
          .then((res) => res.json())
          .then((data) => {
            if (data.member && ecoSettings.speedVoiceAlerts && speedMph >= 15) {
              const roadLimit =
                ecoSettings.autoSpeedLimit && data.member.currentSpeedLimitMph
                  ? data.member.currentSpeedLimitMph
                  : ecoSettings.defaultSpeedLimit || 45;
              const threshold = ecoSettings.speedThresholdMph || 10;
              const now = Date.now();
              if (speedMph >= roadLimit + threshold) {
                const lastAlert = lastAlertTimeRef.current[activeMemberId] || 0;
                if (now - lastAlert > 45000) {
                  lastAlertTimeRef.current[activeMemberId] = now;
                  playSpeedWarningBeep();
                  const roadInfo = data.member.currentRoadName ? ` on ${data.member.currentRoadName}` : '';
                  speakVoiceAlert(
                    `Speed Warning: You are driving at ${speedMph} miles per hour${roadInfo}, ${
                      speedMph - roadLimit
                    } miles above the ${roadLimit} mile per hour speed limit.`
                  );
                }
              }
            }
          })
          .catch((err) => console.warn('Location post error:', err));
      },
      (err) => console.warn('Geolocation error:', err)
    ).then((id) => {
      if (isCancelled) {
        clearNativeLocationWatcher(id);
      } else {
        watchRef = id;
      }
    });

    return () => {
      isCancelled = true;
      if (watchRef !== null) {
        clearNativeLocationWatcher(watchRef);
      }
    };
  }, [isRealGpsEnabled, circleId, activeMemberId, myBattery, isCharging, ecoSettings]);

  // 5. Movement Simulation Loop (Runs ONLY when manually turned on for demonstration)
  useEffect(() => {
    if (!isSimulatorActive || !circleData) return;

    const interval = setInterval(() => {
      setStepIndex((idx) => {
        const nextIdx = idx + 1;
        setCircleData((curr) => {
          if (!curr) return curr;
          const updatedMembers = advanceSimulationStep(curr.members, curr.places, nextIdx);

          if (ecoSettings.speedVoiceAlerts) {
            const threshold = ecoSettings.speedThresholdMph || 10;
            const now = Date.now();

            for (const mId in updatedMembers) {
              const m = updatedMembers[mId];
              const limit =
                ecoSettings.autoSpeedLimit && m.currentSpeedLimitMph
                  ? m.currentSpeedLimitMph
                  : ecoSettings.defaultSpeedLimit || 45;

              if (m.speedMph >= limit + threshold) {
                const lastAlert = lastAlertTimeRef.current[mId] || 0;
                if (now - lastAlert > 45000) {
                  lastAlertTimeRef.current[mId] = now;
                  playSpeedWarningBeep();
                  const roadInfo = m.currentRoadName ? ` on ${m.currentRoadName}` : '';
                  speakVoiceAlert(
                    `Speed Warning: ${m.name} is driving at ${m.speedMph} miles per hour${roadInfo}, ${
                      m.speedMph - limit
                    } miles above the ${limit} mile per hour speed limit.`
                  );
                }
              }
            }
          }

          return {
            ...curr,
            members: updatedMembers,
          };
        });
        return nextIdx;
      });
    }, 3500);

    return () => clearInterval(interval);
  }, [isSimulatorActive, circleData?.places, ecoSettings]);

  // Handlers for Member Management
  const handleAddMember = async (memberData: {
    name: string;
    role: FamilyRole;
    phone?: string;
    color: string;
    avatar: string;
  }) => {
    try {
      const res = await apiFetch(`/api/circle/${circleId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(memberData),
      });
      if (res.ok) {
        const data = await res.json();
        setCircleData((prev) => (prev ? { ...prev, members: data.members } : prev));
        if (data.member?.id) {
          setSelectedMemberId(data.member.id);
        }
      }
    } catch (err) {
      console.error('Failed to add member:', err);
    }
  };

  const handleUpdateMember = async (memberId: string, updates: Partial<FamilyMember>) => {
    try {
      const res = await apiFetch(`/api/circle/${circleId}/members/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        const data = await res.json();
        setCircleData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            members: { ...prev.members, [memberId]: data.member },
          };
        });
      }
    } catch (err) {
      console.error('Failed to update member:', err);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    try {
      const res = await apiFetch(`/api/circle/${circleId}/members/${memberId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        const data = await res.json();
        setCircleData((prev) => {
          if (!prev) return prev;
          const copy = { ...prev.members };
          delete copy[memberId];
          return {
            ...prev,
            members: copy,
            adminMemberId: data.adminMemberId || prev.adminMemberId,
          };
        });

        if (activeMemberId === memberId) {
          const remaining = Object.keys(circleData?.members || {}).filter((id) => id !== memberId);
          if (remaining.length > 0) {
            setActiveMemberId(remaining[0]);
            setSelectedMemberId(remaining[0]);
          }
        }
      }
    } catch (err) {
      console.error('Failed to remove member:', err);
    }
  };

  const handleTransferAdmin = async (newAdminMemberId: string) => {
    try {
      const res = await apiFetch(`/api/circle/${circleId}/admin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newAdminMemberId }),
      });
      if (res.ok) {
        setCircleData((prev) => (prev ? { ...prev, adminMemberId: newAdminMemberId } : prev));
      }
    } catch (err) {
      console.error('Failed to transfer admin:', err);
    }
  };

  const handleClearTestData = async () => {
    try {
      const res = await apiFetch(`/api/circle/${circleId}/clear-test-data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keepMemberId: activeMemberId }),
      });
      if (res.ok) {
        const data = await res.json();
        setCircleData(data.circle);
        setIsSimulatorActive(false);
      }
    } catch (err) {
      console.error('Failed to clear test data:', err);
    }
  };

  const handleLoadDemoData = async () => {
    try {
      const res = await apiFetch(`/api/circle/${circleId}/seed-demo`, {
        method: 'POST',
      });
      if (res.ok) {
        const data = await res.json();
        setCircleData(data.circle);
        setIsSimulatorActive(true);
      }
    } catch (err) {
      console.error('Failed to load demo data:', err);
    }
  };

  // Remote Alarm Handlers (Find lost or misplaced device)
  const handleTriggerRemoteAlarm = async (targetMemberId: string, targetMemberName: string) => {
    try {
      const res = await apiFetch(`/api/circle/${circleId}/remote-alarm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'trigger',
          targetMemberId,
          senderMemberId: activeMemberId,
          senderName: activeMember?.name || 'Admin',
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.activeAlarms) {
          setCircleData((prev) => (prev ? { ...prev, activeAlarms: data.activeAlarms } : prev));
        }
      }
    } catch (err) {
      console.error('Trigger alarm error:', err);
    }
  };

  const handleSilenceRemoteAlarm = async (targetMemberId: string) => {
    try {
      const res = await apiFetch(`/api/circle/${circleId}/remote-alarm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'silence',
          targetMemberId,
          senderMemberId: activeMemberId,
          senderName: activeMember?.name || 'Admin',
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.activeAlarms) {
          setCircleData((prev) => (prev ? { ...prev, activeAlarms: data.activeAlarms } : prev));
        }
        if (targetMemberId === activeMemberId) {
          setActiveIncomingAlarm(null);
        }
      }
    } catch (err) {
      console.error('Silence alarm error:', err);
    }
  };

  const handleRequestLocation = async (targetMemberId: string) => {
    try {
      await apiFetch(`/api/circle/${circleId}/request-location`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetMemberId,
          senderMemberId: activeMemberId,
          senderName: activeMember?.name || 'Admin',
        }),
      });
    } catch (err) {
      console.error('Request location error:', err);
    }
  };

  // Chat, SOS, Places handlers
  const handleSendMessage = async (text: string, type: any = 'text', locationData?: any, recipientMemberId?: string) => {
    if (!circleData) return;
    try {
      await apiFetch(`/api/circle/${circleId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId: activeMemberId,
          text,
          type,
          locationData,
          recipientMemberId,
        }),
      });
    } catch (err) {
      console.warn('Send chat error:', err);
    }
  };

  const handleTriggerSos = async () => {
    if (!circleData) return;
    const currentMember = circleData.members[activeMemberId] || Object.values(circleData.members)[0];
    try {
      await apiFetch(`/api/circle/${circleId}/sos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId: activeMemberId,
          action: 'trigger',
          lat: currentMember?.location?.lat,
          lng: currentMember?.location?.lng,
          address: currentMember?.location?.address,
        }),
      });
      setIsSosModalOpen(true);
    } catch (err) {
      console.warn('SOS trigger error:', err);
    }
  };

  const handleResolveSos = async (alertId: string) => {
    try {
      await apiFetch(`/api/circle/${circleId}/sos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memberId: activeMemberId,
          action: 'resolve',
          alertId,
        }),
      });
      setIsSosModalOpen(false);
    } catch (err) {
      console.warn('SOS resolve error:', err);
    }
  };

  const handleAddPlace = async (place: Partial<SavedPlace>) => {
    try {
      await apiFetch(`/api/circle/${circleId}/places`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(place),
      });
    } catch (err) {
      console.warn('Add place error:', err);
    }
  };

  const handleDeletePlace = async (placeId: string) => {
    try {
      await apiFetch(`/api/circle/${circleId}/places/${placeId}`, {
        method: 'DELETE',
      });
    } catch (err) {
      console.warn('Delete place error:', err);
    }
  };

  const handleImportBackup = async (data: any) => {
    try {
      const res = await apiFetch(`/api/circle/${circleId}/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        setCircleData(data);
      }
    } catch (err) {
      console.warn('Import error:', err);
    }
  };

  const handleJoinCircle = (code: string, role: string, userName?: string, phone?: string) => {
    const targetCode = code.trim().toUpperCase();
    setCircleId(targetCode);
    localStorage.setItem('orbit_active_circle_id', targetCode);

    const userMemberId = user ? `user-${user.uid.slice(0, 8)}` : `member-${Date.now().toString().slice(-4)}`;
    const memberObj: FamilyMember = {
      id: userMemberId,
      name: userName || user?.displayName || 'Family Member',
      role: (role as any) || 'Member',
      phone: phone || undefined,
      avatar:
        user?.photoURL ||
        'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=256&h=256&q=80',
      color: '#10b981',
      battery: myBattery,
      isCharging,
      lastUpdated: Date.now(),
      speedMph: 0,
      isOnline: true,
      location: {
        lat: 37.7749,
        lng: -122.4194,
        speed: 0,
        accuracy: 5,
        timestamp: Date.now(),
        placeName: 'Joined Circle',
      },
    };

    apiFetch(`/api/circle/${targetCode}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(memberObj),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.members) {
          setCircleData((prev) => (prev ? { ...prev, members: data.members } : prev));
        }
      })
      .catch((err) => console.warn('Could not post joined member:', err));

    setActiveMemberId(userMemberId);
    setSelectedMemberId(userMemberId);
    setIsSimulatorActive(false);
  };

  const handleCreateCircle = (name: string, adminName?: string, phone?: string) => {
    const newCode = `ORBIT-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const userMemberId = user ? `user-${user.uid.slice(0, 8)}` : 'member-admin';

    const creatorMember: FamilyMember = {
      id: userMemberId,
      name: adminName || user?.displayName || 'Family Admin',
      role: 'Admin',
      phone: phone || undefined,
      avatar:
        user?.photoURL ||
        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&h=256&q=80',
      color: '#3b82f6',
      battery: myBattery,
      isCharging,
      lastUpdated: Date.now(),
      speedMph: 0,
      isOnline: true,
      location: {
        lat: 37.7749,
        lng: -122.4194,
        speed: 0,
        accuracy: 5,
        timestamp: Date.now(),
        placeName: 'Circle Created',
      },
    };

    apiFetch('/api/circle/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, member: creatorMember }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.circle) {
          setCircleId(data.circle.circleId);
          setCircleData(data.circle);
          localStorage.setItem('orbit_active_circle_id', data.circle.circleId);
          setActiveMemberId(userMemberId);
          setSelectedMemberId(userMemberId);
          setIsSimulatorActive(false);
        }
      })
      .catch((err) => console.warn('Failed to create circle on backend:', err));
  };

  const handleUpdateProfileName = (name: string, role: string, phone?: string) => {
    if (!activeMemberId || !circleData) return;
    const targetMember = circleData.members[activeMemberId] || activeMember;
    const updatedMember: FamilyMember = {
      ...targetMember,
      name: name.trim() || targetMember.name,
      role: (role as FamilyRole) || targetMember.role,
      phone: phone !== undefined ? phone : targetMember.phone,
    };

    apiFetch(`/api/circle/${circleId}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updatedMember),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.members) {
          setCircleData((prev) => (prev ? { ...prev, members: data.members } : prev));
        }
      })
      .catch((err) => console.warn('Could not update profile:', err));
  };

  const handleSelectNotification = (notif: AppNotification) => {
    // Mark clicked notification as read
    setNotifications((prev) => {
      const updated = prev.map((n) => (n.id === notif.id ? { ...n, read: true } : n));
      try {
        localStorage.setItem('orbit_notifications', JSON.stringify(updated));
      } catch {}
      return updated;
    });

    setIsNotificationsOpen(false);

    if (notif.actionType === 'open_chat') {
      setActiveTab('chat');
      if (notif.actionPayload?.memberId) {
        setTargetChatMemberId(notif.actionPayload.memberId);
      }
    } else if (notif.actionType === 'open_sos') {
      setIsSosModalOpen(true);
    } else if (notif.actionType === 'view_map') {
      setActiveTab('map');
      if (notif.actionPayload?.memberId) {
        setSelectedMemberId(notif.actionPayload.memberId);
      }
    }
  };

  if (!circleData) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-950 text-white font-sans p-4">
        <div className="flex flex-col items-center gap-4 max-w-sm text-center">
          <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center animate-pulse shadow-lg shadow-indigo-600/30">
            <Compass className="w-7 h-7 text-white" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white tracking-wide">KinTrack Family</h2>
            <p className="text-xs text-slate-400 mt-1">Connecting to Orbit Family Circle...</p>
          </div>

          <div className="flex flex-col gap-2 w-full mt-2">
            <button
              onClick={() => initFallbackCircle()}
              className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white transition shadow-md"
            >
              Enter Family Circle (Offline / Direct)
            </button>
            <button
              onClick={() => setIsConnectionHubOpen(true)}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition flex items-center justify-center gap-1.5"
            >
              <Server className="w-3.5 h-3.5 text-indigo-400" />
              Configure Hub Server (URL)
            </button>
          </div>
        </div>
        <ConnectionHubModal
          isOpen={isConnectionHubOpen}
          onClose={() => setIsConnectionHubOpen(false)}
          onReconnected={() => fetchCircle(true)}
        />
      </div>
    );
  }

  // Active Member fallback resolution
  const activeMember: FamilyMember =
    (activeMemberId && circleData.members[activeMemberId]) ||
    (circleData.adminMemberId && circleData.members[circleData.adminMemberId]) ||
    Object.values(circleData.members)[0] || {
      id: activeMemberId || 'member-me',
      name: user?.displayName || 'My Device',
      role: 'Admin',
      avatar:
        user?.photoURL ||
        'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=256&h=256&q=80',
      color: '#3b82f6',
      battery: myBattery,
      isCharging,
      lastUpdated: Date.now(),
      speedMph: 0,
      isOnline: true,
      location: {
        lat: 37.7749,
        lng: -122.4194,
        speed: 0,
        accuracy: 10,
        timestamp: Date.now(),
        placeName: 'Home',
      },
    };

  const activeSosList = circleData.sosAlerts.filter((a) => a.status === 'active');
  const memberList = Object.values(circleData.members);

  return (
    <div
      className={`relative flex flex-col h-screen w-screen ${
        theme === 'light' ? 'bg-slate-100 text-slate-900' : 'bg-slate-950 text-slate-100'
      } select-none overflow-hidden font-sans`}
    >
      {/* Auto-Dismissing GPS Locked (ECO Mode) Banner & Mini Status Indicator */}
      <EcoStatusBar
        settings={ecoSettings}
        onUpdateSettings={setEcoSettings}
        myBattery={myBattery}
        isCharging={isCharging}
        gpsActive={isRealGpsEnabled || isSimulatorActive}
      />

      {/* Top Application Header Bar */}
      <header
        className={`absolute top-0 inset-x-0 z-40 flex items-center justify-between px-3 md:px-5 py-2.5 ${
          theme === 'light' ? 'bg-white/95 border-slate-200' : 'bg-slate-950/90 border-slate-800/80'
        } backdrop-blur-md border-b`}
      >
        {/* Left: Branding & Circle Name (FREE badge & circle code moved to menu to guarantee responsive fit) */}
        <div className="flex items-center gap-2 min-w-0 shrink">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-sky-400 flex items-center justify-center shadow-md shadow-indigo-500/20 shrink-0">
            <Compass className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="font-black text-xs sm:text-sm text-white tracking-tight truncate">
              KinTrack Family
            </h1>
            <div className="text-[10px] text-slate-400 truncate flex items-center gap-1">
              <span className="truncate font-medium">{circleData.name}</span>
            </div>
          </div>
        </div>

        {/* Right: Reload, Jarvis AI, Profile, Notification Icon, and Sliding Menu (All with shrink-0) */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {/* Refresh / Reload Button */}
          <button
            onClick={handleManualRefresh}
            className={`p-1.5 sm:p-2 rounded-xl sm:rounded-2xl border transition active:scale-95 shadow-sm flex items-center justify-center shrink-0 ${
              isSyncing
                ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                : theme === 'light'
                ? 'bg-slate-100 border-slate-300 hover:bg-slate-200 text-slate-700'
                : 'bg-slate-900 border-slate-700 hover:bg-slate-800 text-slate-200'
            }`}
            title="Refresh & Sync Circle Data"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin text-cyan-400' : 'text-slate-300'}`} />
          </button>

          {/* Jarvis Voice & Chat AI Assistant Button */}
          <button
            onClick={() => setIsVoiceOpen(true)}
            className="flex items-center gap-1.5 px-2 py-1.5 sm:px-2.5 sm:py-1.5 rounded-xl sm:rounded-2xl bg-gradient-to-r from-indigo-600 via-indigo-700 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white font-bold text-xs shadow-md border border-cyan-400/30 transition active:scale-95 shrink-0"
            title="Ask Jarvis AI (Voice & Chat)"
          >
            <Bot className="w-3.5 h-3.5 text-cyan-200 animate-pulse" />
            <span className="hidden xs:inline sm:inline">Jarvis</span>
          </button>

          {/* Active Device Member Identifier (Profile) */}
          <button
            onClick={() => setIsIdentityModalOpen(true)}
            className="flex items-center gap-1.5 p-1 sm:px-2.5 sm:py-1.5 rounded-full bg-slate-900 border border-slate-700/80 hover:bg-slate-800 text-xs text-slate-200 transition shadow-sm shrink-0"
            title="Active Device: Tap to switch identity"
          >
            <div
              className="w-5 h-5 sm:w-4 sm:h-4 rounded-full overflow-hidden ring-1 shrink-0"
              style={{ borderColor: activeMember.color || '#3b82f6' }}
            >
              <img src={activeMember.avatar} alt={activeMember.name} className="w-full h-full object-cover" />
            </div>
            <span className="font-semibold text-[11px] truncate max-w-[55px] sm:max-w-none hidden xs:inline">
              {activeMember.name.split(' ')[0]}
            </span>
          </button>

          {/* Top Bar Notification Bell Icon (Next to profile, in front of sliding menu) */}
          <button
            onClick={() => {
              setIsNotificationsOpen((prev) => !prev);
              if (isTopMenuOpen) setIsTopMenuOpen(false);
            }}
            className={`relative p-1.5 sm:p-2 rounded-xl sm:rounded-2xl border transition active:scale-95 shadow-sm shrink-0 ${
              isNotificationsOpen
                ? 'bg-indigo-600 border-indigo-400 text-white'
                : theme === 'light'
                ? 'bg-slate-100 border-slate-300 hover:bg-slate-200 text-slate-700'
                : 'bg-slate-900 border-slate-700 hover:bg-slate-800 text-slate-200'
            }`}
            title="Notifications"
          >
            <Bell className="w-4 h-4" />
            {notifications.filter((n) => !n.read).length > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-rose-500 text-white font-black text-[9px] flex items-center justify-center border-2 border-slate-950 animate-pulse">
                {notifications.filter((n) => !n.read).length > 9
                  ? '9+'
                  : notifications.filter((n) => !n.read).length}
              </span>
            )}
          </button>

          {/* Top Overflow Menu Toggle Button (Settings & Navigation) */}
          <button
            onClick={() => {
              setIsTopMenuOpen((prev) => !prev);
              if (isNotificationsOpen) setIsNotificationsOpen(false);
            }}
            className={`p-1.5 sm:p-2 rounded-xl sm:rounded-2xl border transition active:scale-95 shadow-sm shrink-0 ${
              isTopMenuOpen
                ? 'bg-indigo-600 border-indigo-400 text-white'
                : theme === 'light'
                ? 'bg-slate-100 border-slate-300 hover:bg-slate-200 text-slate-700'
                : 'bg-slate-900 border-slate-700 hover:bg-slate-800 text-slate-200'
            }`}
            title="Open Menu & Settings"
          >
            {isTopMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>

        {/* Sync Toast Notification */}
        {syncToast && (
          <div className="absolute top-14 inset-x-0 z-50 flex justify-center pointer-events-none animate-in fade-in slide-in-from-top-2">
            <div className="px-3.5 py-1.5 rounded-full bg-slate-900/95 border border-cyan-500/50 text-cyan-300 text-xs font-semibold shadow-xl backdrop-blur-md flex items-center gap-2">
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span>{syncToast}</span>
            </div>
          </div>
        )}

        {/* Top Bar Notification Center Dropdown */}
        <NotificationCenterDropdown
          isOpen={isNotificationsOpen}
          onClose={() => setIsNotificationsOpen(false)}
          notifications={notifications}
          maxNotifications={maxNotifications}
          onSelectNotification={handleSelectNotification}
          onMarkAllAsRead={handleMarkAllNotificationsAsRead}
          onClearAll={handleClearNotifications}
          onOpenSettings={() => setIsSettingsOpen(true)}
        />

        {/* Dropdown Menu Panel */}
        {isTopMenuOpen && (
          <div className="absolute top-12 right-3 w-64 rounded-3xl bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 shadow-2xl p-2.5 z-50 animate-in fade-in slide-in-from-top-2 text-xs space-y-1 ring-1 ring-white/10">
            {/* Circle Invite Code Card inside Menu */}
            <div className="p-2.5 rounded-2xl bg-indigo-950/60 border border-indigo-500/30 flex items-center justify-between mb-1">
              <div className="truncate mr-2">
                <span className="text-[10px] uppercase font-bold text-indigo-300 block">Invite Code</span>
                <span className="font-mono font-black text-xs text-white">{circleData.inviteCode || circleId}</span>
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(circleData.inviteCode || circleId);
                  setSyncToast('Invite code copied to clipboard!');
                  setTimeout(() => setSyncToast(null), 2000);
                }}
                className="px-2 py-1 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[10px] transition shrink-0"
              >
                Copy
              </button>
            </div>

            {/* Settings */}
            <button
              onClick={() => {
                setIsTopMenuOpen(false);
                setIsSettingsOpen(true);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-2xl hover:bg-slate-800 text-slate-200 font-semibold transition text-left"
            >
              <Settings className="w-4 h-4 text-slate-400" />
              <span>Settings &amp; Preferences</span>
            </button>

            {/* Quick Theme Switcher inside Menu */}
            <button
              onClick={() => {
                setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
                setIsTopMenuOpen(false);
              }}
              className="w-full flex items-center justify-between px-3 py-2 rounded-2xl hover:bg-slate-800 text-slate-200 font-semibold transition text-left"
            >
              <div className="flex items-center gap-2.5">
                {theme === 'dark' ? (
                  <Sun className="w-4 h-4 text-amber-400" />
                ) : (
                  <Moon className="w-4 h-4 text-indigo-400" />
                )}
                <span>{theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}</span>
              </div>
              <span className="text-[10px] uppercase font-bold text-slate-400 px-1.5 py-0.5 rounded bg-slate-800">
                {theme}
              </span>
            </button>

            {/* Family Server Hub & Multi-Phone Sync */}
            <button
              onClick={() => {
                setIsTopMenuOpen(false);
                setIsConnectionHubOpen(true);
              }}
              className="w-full flex items-center justify-between px-3 py-2 rounded-2xl hover:bg-slate-800 text-slate-200 font-semibold transition text-left"
            >
              <div className="flex items-center gap-2.5">
                <Server className="w-4 h-4 text-emerald-400" />
                <span>Family Server Hub</span>
              </div>
              <span
                className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                  isServerConnected ? 'bg-emerald-950/80 text-emerald-400' : 'bg-rose-950/80 text-rose-400'
                }`}
              >
                {isServerConnected ? 'Online' : 'Offline'}
              </span>
            </button>

            {/* Manual Refresh / Sync */}
            <button
              onClick={() => {
                setIsTopMenuOpen(false);
                handleManualRefresh();
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-2xl hover:bg-slate-800 text-slate-200 font-semibold transition text-left"
            >
              <RefreshCw className="w-4 h-4 text-cyan-400" />
              <span>Refresh &amp; Sync Circle Now</span>
            </button>

            {/* Manage Members */}
            <button
              onClick={() => {
                setIsTopMenuOpen(false);
                setIsMemberModalOpen(true);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-2xl hover:bg-slate-800 text-slate-200 font-semibold transition text-left"
            >
              <Users className="w-4 h-4 text-indigo-400" />
              <span>Circle Members ({memberList.length})</span>
            </button>

            {/* Saved Places */}
            <button
              onClick={() => {
                setIsTopMenuOpen(false);
                setIsPlacesModalOpen(true);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-2xl hover:bg-slate-800 text-slate-200 font-semibold transition text-left"
            >
              <MapPin className="w-4 h-4 text-emerald-400" />
              <span>Saved Places ({circleData.places?.length || 0})</span>
            </button>

            {/* Speed Alerts & Limits */}
            <button
              onClick={() => {
                setIsTopMenuOpen(false);
                setIsSpeedModalOpen(true);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-2xl hover:bg-slate-800 text-slate-200 font-semibold transition text-left"
            >
              <Gauge className="w-4 h-4 text-amber-400" />
              <span>Speed &amp; Voice Alerts</span>
            </button>

            {/* Switch Active Phone Identity */}
            <button
              onClick={() => {
                setIsTopMenuOpen(false);
                setIsIdentityModalOpen(true);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-2xl hover:bg-slate-800 text-slate-200 font-semibold transition text-left"
            >
              <Compass className="w-4 h-4 text-sky-400" />
              <span>Switch Active Device</span>
            </button>

            {/* QR Code / Share Link */}
            <button
              onClick={() => {
                setIsTopMenuOpen(false);
                setIsQrModalOpen(true);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-2xl hover:bg-slate-800 text-slate-200 font-semibold transition text-left"
            >
              <QrCode className="w-4 h-4 text-indigo-400" />
              <span>QR Code / Share Circle</span>
            </button>

            {/* Setup & Google Drive Guide */}
            <button
              onClick={() => {
                setIsTopMenuOpen(false);
                setIsGuideOpen(true);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-2xl hover:bg-slate-800 text-slate-200 font-semibold transition text-left"
            >
              <HelpCircle className="w-4 h-4 text-sky-400" />
              <span>Setup &amp; Backup Guide</span>
            </button>

            <div className="border-t border-slate-800 my-1" />

            {/* Sign In / Switch Circle */}
            <button
              onClick={() => {
                setIsTopMenuOpen(false);
                setIsUniversalAuthOpen(true);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-2xl hover:bg-slate-800 text-indigo-300 font-bold transition text-left"
            >
              <Users className="w-4 h-4 text-indigo-400" />
              <span>Join / Switch Circle</span>
            </button>
          </div>
        )}
      </header>

      {/* Active Remote Alarm Ringing Banner across all members */}
      {circleData.activeAlarms &&
        Object.values(circleData.activeAlarms).some((a) => a.status === 'active') && (
          <div className="absolute top-12 inset-x-0 z-30 bg-rose-600 text-white px-4 py-2.5 flex items-center justify-between shadow-2xl animate-pulse">
            <div className="flex items-center gap-2 text-xs font-bold truncate">
              <BellRing className="w-4 h-4 animate-bounce shrink-0" />
              <span className="truncate">
                🚨 Lost Device Alarm Ringing on{' '}
                {Object.values(circleData.activeAlarms)
                  .filter((a) => a.status === 'active')
                  .map((a) => a.targetMemberName)
                  .join(', ')}!
              </span>
            </div>
            <button
              onClick={() => {
                const ringing = Object.values(circleData.activeAlarms!).find(
                  (a) => a.status === 'active'
                );
                if (ringing) handleSilenceRemoteAlarm(ringing.targetMemberId);
              }}
              className="px-3 py-1 bg-white text-rose-700 font-black rounded-xl text-xs hover:bg-slate-100 transition shadow shrink-0 ml-2"
            >
              Silence Siren
            </button>
          </div>
        )}

      {/* Main Interactive Map View */}
      <main className="relative flex-1 w-full h-full pt-12 pb-16">
        <FamilyMap
          members={circleData.members}
          places={circleData.places}
          activeSos={activeSosList}
          selectedMemberId={selectedMemberId}
          activeAlarms={circleData.activeAlarms}
          theme={theme}
          onSelectMember={(mId) => {
            setSelectedMemberId(mId);
          }}
          onTriggerSos={() => setIsSosModalOpen(true)}
          historyRoute={historyRoute}
          historyPlaybackPoint={historyPlaybackPoint ? (historyPlaybackPoint as any) : null}
          onOpenChatWithMember={(mId) => {
            setTargetChatMemberId(mId);
            setActiveTab('chat');
          }}
          onTriggerRemoteAlarm={handleTriggerRemoteAlarm}
          onSilenceRemoteAlarm={handleSilenceRemoteAlarm}
          onRequestLocation={handleRequestLocation}
        />

        {/* Life360 Member Detail Drawer / Sheet (Directions, 30-Day Trips, Chat, Cellular actions) */}
        {selectedMemberId && circleData.members[selectedMemberId] && (
          <MemberDetailSheet
            member={circleData.members[selectedMemberId]}
            circleId={circleId}
            places={circleData.places}
            isAlarmActive={Object.values(circleData.activeAlarms || {}).some(
              (a) => a.targetMemberId === selectedMemberId && a.status === 'active'
            )}
            onClose={() => {
              setSelectedMemberId(null);
              setHistoryRoute(null);
              setHistoryPlaybackPoint(null);
            }}
            onOpenChat={(mId) => {
              setTargetChatMemberId(mId);
              setActiveTab('chat');
              setSelectedMemberId(null);
            }}
            onTriggerRemoteAlarm={handleTriggerRemoteAlarm}
            onSilenceRemoteAlarm={handleSilenceRemoteAlarm}
            onRequestLocation={handleRequestLocation}
            onSetRoute={setHistoryRoute}
            onSetPlaybackPoint={(pt) => setHistoryPlaybackPoint(pt ? [pt] : null)}
            onSaveCurrentPlace={(lat, lng, name) => {
              setIsPlacesModalOpen(true);
            }}
          />
        )}

        {/* Member Floating Selector Tray (Horizontal list with Add Member button) */}
        <div className="absolute top-14 left-3 z-20 flex gap-1.5 overflow-x-auto max-w-[85vw] sm:max-w-lg pb-1 scrollbar-none items-center">
          {memberList.map((member) => {
            const isSelected = selectedMemberId === member.id;
            const isDriving = member.speedMph >= 15;

            return (
              <button
                key={member.id}
                onClick={() => setSelectedMemberId(member.id)}
                className={`flex items-center gap-2 px-2.5 py-1.5 rounded-2xl border transition backdrop-blur-md shadow-lg shrink-0 ${
                  isSelected
                    ? 'bg-slate-900/95 border-indigo-500 ring-2 ring-indigo-500/40 text-white'
                    : 'bg-slate-950/80 border-slate-800 hover:bg-slate-900/90 text-slate-300'
                }`}
              >
                <div
                  className="relative w-7 h-7 rounded-full overflow-hidden ring-1 shrink-0"
                  style={{ borderColor: member.color || '#3b82f6' }}
                >
                  <img src={member.avatar} alt={member.name} className="w-full h-full object-cover" />
                  {isDriving && (
                    <span className="absolute -top-1 -right-1 text-[8px]">🚗</span>
                  )}
                </div>

                <div className="text-left leading-tight pr-1">
                  <span className="font-semibold text-xs block truncate max-w-[80px]">
                    {member.name.split(' ')[0]}
                  </span>
                  <span className="text-[10px] text-slate-400 block">
                    {member.speedMph > 0 ? `${member.speedMph} mph` : `${member.battery}%`}
                  </span>
                </div>
              </button>
            );
          })}

          {/* Quick Add Member button in tray */}
          <button
            onClick={() => setIsMemberModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl border border-indigo-500/40 bg-indigo-950/50 hover:bg-indigo-900/70 text-indigo-300 text-xs font-semibold backdrop-blur-md shadow-lg shrink-0 transition"
            title="Add or invite family members"
          >
            <UserPlus className="w-4 h-4 text-indigo-400" />
            <span>+ Add Member</span>
          </button>
        </div>

        {/* Fresh Start Helper Card (Visible when only 1 or 0 members in circle and not dismissed) */}
        {!isFreshBoxDismissed && memberList.length <= 1 && (
          <div className="absolute top-28 left-3 sm:left-4 z-20 max-w-sm p-4 rounded-3xl bg-slate-950/90 backdrop-blur-md border border-indigo-500/40 shadow-2xl text-xs space-y-2.5 animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-white flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-400" />
                Fresh Circle Started
              </span>
              <div className="flex items-center gap-2">
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-semibold">
                  No Test Data
                </span>
                <button
                  onClick={() => {
                    setIsFreshBoxDismissed(true);
                    localStorage.setItem('kintrack_fresh_box_dismissed', 'true');
                  }}
                  className="p-1 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition"
                  title="Dismiss box"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <p className="text-slate-300 leading-relaxed text-[11px]">
              You&apos;re currently the first member in this circle. Invite your family with your invite code or add dependent devices to start tracking together.
            </p>
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => setIsMemberModalOpen(true)}
                className="flex-1 py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow transition"
              >
                <Users className="w-3.5 h-3.5" />
                <span>Manage / Invite</span>
              </button>
              <button
                onClick={() => setIsQrModalOpen(true)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
                title="Show QR Code"
              >
                <QrCode className="w-4 h-4 text-indigo-400" />
              </button>
            </div>
          </div>
        )}

        {/* Floating Modals for Drawer Views */}
        {activeTab === 'chat' && (
          <div className="absolute inset-x-3 bottom-16 top-14 md:inset-auto md:right-4 md:bottom-20 md:w-96 md:h-[600px] z-30 animate-in fade-in slide-in-from-bottom-4">
            <FamilyChat
              chat={circleData.chat}
              currentMember={activeMember}
              members={circleData.members}
              initialTargetMemberId={targetChatMemberId}
              onSendMessage={handleSendMessage}
              onClose={() => {
                setActiveTab('map');
                setTargetChatMemberId(null);
              }}
              onLocateMember={(lat, lng) => {
                setActiveTab('map');
              }}
            />
          </div>
        )}

        {activeTab === 'history' && (
          <div className="absolute inset-x-3 bottom-16 md:inset-auto md:left-6 md:bottom-20 md:w-[480px] z-30 animate-in fade-in slide-in-from-bottom-4">
            <HistoryTimeline
              member={circleData.members[selectedMemberId || activeMemberId] || activeMember}
              circleId={circleId}
              onClose={() => {
                setActiveTab('map');
                setHistoryRoute(null);
                setHistoryPlaybackPoint(null);
              }}
              onSetRoute={setHistoryRoute}
              onSetPlaybackPoint={(pt) => setHistoryPlaybackPoint(pt ? [pt] : null)}
            />
          </div>
        )}
      </main>

      {/* Bottom App Navigation Bar */}
      <footer
        className={`absolute bottom-0 inset-x-0 z-30 ${
          theme === 'light' ? 'bg-white/95 border-slate-200' : 'bg-slate-950/95 border-slate-800/80'
        } backdrop-blur-md border-t px-4 py-2 flex items-center justify-around`}
      >
        <button
          onClick={() => setActiveTab('map')}
          className={`flex flex-col items-center gap-1 transition ${
            activeTab === 'map' ? 'text-indigo-400' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Compass className="w-5 h-5" />
          <span className="text-[10px] font-semibold">Live Map</span>
        </button>

        <button
          onClick={() => setIsMemberModalOpen(true)}
          className="flex flex-col items-center gap-1 text-slate-400 hover:text-indigo-300 transition"
        >
          <Users className="w-5 h-5" />
          <span className="text-[10px] font-semibold">Members</span>
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`flex flex-col items-center gap-1 transition ${
            activeTab === 'history' ? 'text-indigo-400' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <History className="w-5 h-5" />
          <span className="text-[10px] font-semibold">30d History</span>
        </button>

        <button
          onClick={() => {
            setTargetChatMemberId(null);
            setActiveTab('chat');
          }}
          className={`relative flex flex-col items-center gap-1 transition ${
            activeTab === 'chat' ? 'text-indigo-400' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <MessageSquare className="w-5 h-5" />
          <span className="text-[10px] font-semibold">Circle Chat</span>
          {circleData.chat.length > 0 && (
            <span className="absolute -top-1 right-2 w-2 h-2 rounded-full bg-indigo-500" />
          )}
        </button>

        <button
          onClick={() => setIsPlacesModalOpen(true)}
          className="flex flex-col items-center gap-1 text-slate-400 hover:text-slate-200 transition"
        >
          <Compass className="w-5 h-5" />
          <span className="text-[10px] font-semibold">Places</span>
        </button>
      </footer>

      {/* Member Management Modal */}
      <MemberManagementModal
        isOpen={isMemberModalOpen}
        onClose={() => setIsMemberModalOpen(false)}
        circleId={circleId}
        circleName={circleData.name}
        inviteCode={circleData.inviteCode}
        adminMemberId={circleData.adminMemberId}
        members={circleData.members}
        activeMemberId={activeMemberId}
        activeAlarms={circleData.activeAlarms}
        onSelectActiveMember={(mId) => {
          setActiveMemberId(mId);
          setSelectedMemberId(mId);
        }}
        onAddMember={handleAddMember}
        onUpdateMember={handleUpdateMember}
        onRemoveMember={handleRemoveMember}
        onTransferAdmin={handleTransferAdmin}
        onClearTestData={handleClearTestData}
        onLoadDemoData={handleLoadDemoData}
        onTriggerRemoteAlarm={handleTriggerRemoteAlarm}
        onSilenceRemoteAlarm={handleSilenceRemoteAlarm}
        onRequestLocation={handleRequestLocation}
        onOpenChatWithMember={(mId) => {
          setTargetChatMemberId(mId);
          setActiveTab('chat');
          setIsMemberModalOpen(false);
        }}
        onOpenQrModal={() => {
          setIsMemberModalOpen(false);
          setIsQrModalOpen(true);
        }}
      />

      {/* Jarvis Voice & Chat AI Family Intelligence Agent (Powered by Gemini 3.8 Flash) */}
      <JarvisAiModal
        isOpen={isVoiceOpen}
        onClose={() => setIsVoiceOpen(false)}
        circleId={circleId}
        circleName={circleData.name}
        members={circleData.members}
        places={circleData.places}
        onSelectMember={(mId) => {
          setSelectedMemberId(mId);
          setIsVoiceOpen(false);
        }}
      />

      {/* Remote Alarm Piercing Siren Modal (Fires on this phone when triggered by admin) */}
      <RemoteAlarmModal
        alarm={activeIncomingAlarm}
        onSilence={handleSilenceRemoteAlarm}
      />

      {/* Location Request Prompt Modal (When admin asks phone to turn on GPS) */}
      <LocationRequestNotificationModal
        request={incomingLocationRequest}
        onEnableGps={() => {
          setIsRealGpsEnabled(true);
          if (navigator.geolocation && activeMemberId) {
            navigator.geolocation.getCurrentPosition(
              (pos) => {
                apiFetch(`/api/circle/${circleId}/member/${activeMemberId}/location`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    lat: pos.coords.latitude,
                    lng: pos.coords.longitude,
                    speed: pos.coords.speed ? Math.round(pos.coords.speed * 2.23694) : 0,
                    accuracy: pos.coords.accuracy,
                    battery: myBattery,
                    isCharging,
                    activity: 'stationary',
                  }),
                }).catch(() => {});
              },
              () => {},
              { enableHighAccuracy: true }
            );
          }
        }}
        onDismiss={() => setIncomingLocationRequest(null)}
      />

      {/* Emergency SOS Alarm Modal */}
      <SosAlertModal
        isOpen={isSosModalOpen}
        onClose={() => setIsSosModalOpen(false)}
        activeSos={circleData.sosAlerts}
        currentMember={activeMember}
        onTriggerSos={handleTriggerSos}
        onResolveSos={handleResolveSos}
      />

      {/* Saved Places / Geofence Modal */}
      <PlacesManagerModal
        isOpen={isPlacesModalOpen}
        onClose={() => setIsPlacesModalOpen(false)}
        places={circleData.places}
        onAddPlace={handleAddPlace}
        onDeletePlace={handleDeletePlace}
        initialLat={activeMember?.location?.lat || 37.7749}
        initialLng={activeMember?.location?.lng || -122.4194}
      />

      {/* Speed & Voice Notification Modal with Live Auto-Detected Road Limit */}
      <SpeedVoiceAlertsModal
        isOpen={isSpeedModalOpen}
        onClose={() => setIsSpeedModalOpen(false)}
        settings={ecoSettings}
        onUpdateSettings={setEcoSettings}
        currentRoadName={
          (selectedMemberId && circleData.members[selectedMemberId]?.currentRoadName) ||
          Object.values(circleData.members).find((m) => m.currentRoadName)?.currentRoadName ||
          'Park Presidio Blvd'
        }
        currentSpeedLimitMph={
          (selectedMemberId && circleData.members[selectedMemberId]?.currentSpeedLimitMph) ||
          Object.values(circleData.members).find((m) => m.currentSpeedLimitMph)?.currentSpeedLimitMph ||
          35
        }
        drivingMemberName={
          (selectedMemberId && circleData.members[selectedMemberId]?.name) ||
          Object.values(circleData.members).find((m) => m.speedMph >= 15)?.name ||
          'Lucas'
        }
        drivingSpeedMph={
          (selectedMemberId && circleData.members[selectedMemberId]?.speedMph) ||
          Object.values(circleData.members).find((m) => m.speedMph >= 15)?.speedMph ||
          58
        }
      />

      {/* Device Identity Modal */}
      <DeviceIdentityModal
        isOpen={isIdentityModalOpen}
        onClose={() => setIsIdentityModalOpen(false)}
        members={circleData.members}
        activeMemberId={activeMemberId}
        onSelectIdentity={(mId) => {
          setActiveMemberId(mId);
          setSelectedMemberId(mId);
        }}
        isRealGpsEnabled={isRealGpsEnabled}
        onToggleRealGps={setIsRealGpsEnabled}
        isSimulatorActive={isSimulatorActive}
        onToggleSimulator={setIsSimulatorActive}
        onOpenMemberManagement={() => setIsMemberModalOpen(true)}
      />

      {/* Setup Guide Modal */}
      <FamilyStorageGuideModal
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
        circleData={circleData}
        onImportCircleBackup={handleImportBackup}
      />

      {/* QR Code Modal */}
      <QRCodeModal
        isOpen={isQrModalOpen}
        onClose={() => setIsQrModalOpen(false)}
        targetUrl={sharedAppUrl}
        circleId={circleId}
        inviteCode={circleData.inviteCode || circleId}
      />

      {/* Universal Sign-In / Join Modal */}
      <UniversalSignInModal
        isOpen={isUniversalAuthOpen}
        onClose={() => setIsUniversalAuthOpen(false)}
        circleName={circleData.name}
        inviteCode={circleData.inviteCode}
        currentMemberName={activeMember?.name}
        currentRole={activeMember?.role}
        onJoinCircle={handleJoinCircle}
        onCreateCircle={handleCreateCircle}
        onUpdateProfileName={handleUpdateProfileName}
      />

      {/* App Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        theme={theme}
        onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
        ecoSettings={ecoSettings}
        onUpdateEcoSettings={setEcoSettings}
        maxNotifications={maxNotifications}
        onUpdateMaxNotifications={handleUpdateMaxNotifications}
        onClearNotifications={handleClearNotifications}
        circleId={circleId}
        circleName={circleData.name}
        inviteCode={circleData.inviteCode}
        onOpenPlaces={() => setIsPlacesModalOpen(true)}
        onOpenMembers={() => setIsMemberModalOpen(true)}
        onOpenUniversalAuth={() => setIsUniversalAuthOpen(true)}
        onOpenGuide={() => setIsGuideOpen(true)}
        onClearTestData={handleClearTestData}
        onLoadDemoData={handleLoadDemoData}
        onOpenConnectionHub={() => setIsConnectionHubOpen(true)}
      />

      {/* Family Server Hub & Multi-Phone Connection Modal */}
      <ConnectionHubModal
        isOpen={isConnectionHubOpen}
        onClose={() => setIsConnectionHubOpen(false)}
        onReconnected={() => fetchCircle(true)}
      />
    </div>
  );
}
