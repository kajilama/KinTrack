import React from 'react';
import {
  X,
  Moon,
  Sun,
  Volume2,
  Gauge,
  Shield,
  Layers,
  Battery,
  Users,
  Compass,
  MapPin,
  Share2,
  BellRing,
  HelpCircle,
  Copy,
  Check,
  EyeOff,
  Eye,
  LogOut,
  RefreshCw,
} from 'lucide-react';
import { EcoSettings, SavedPlace } from '../types';
import { playGeofenceChime, playSpeedWarningBeep, speakVoiceAlert } from '../utils/audio';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  ecoSettings: EcoSettings;
  onUpdateEcoSettings: React.Dispatch<React.SetStateAction<EcoSettings>>;
  circleId: string;
  circleName: string;
  inviteCode: string;
  onOpenPlaces: () => void;
  onOpenMembers: () => void;
  onOpenUniversalAuth: () => void;
  onOpenGuide: () => void;
  onClearTestData?: () => void;
  onLoadDemoData?: () => void;
  maxNotifications?: number;
  onUpdateMaxNotifications?: (val: number) => void;
  onClearNotifications?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  theme,
  onToggleTheme,
  ecoSettings,
  onUpdateEcoSettings,
  circleId,
  circleName,
  inviteCode,
  onOpenPlaces,
  onOpenMembers,
  onOpenUniversalAuth,
  onOpenGuide,
  onClearTestData,
  onLoadDemoData,
  maxNotifications = 10,
  onUpdateMaxNotifications,
  onClearNotifications,
}) => {
  const [copied, setCopied] = React.useState(false);

  if (!isOpen) return null;

  const handleCopyInvite = () => {
    navigator.clipboard.writeText(inviteCode || circleId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleTestChime = () => {
    playGeofenceChime(true);
    speakVoiceAlert('KinTrack Audio Alert: Sarah has arrived at Home.');
  };

  const handleTestSpeedBeep = () => {
    playSpeedWarningBeep();
    speakVoiceAlert(
      `Speed Warning: Driving at 55 mph, ${ecoSettings.speedThresholdMph || 10} mph above the speed limit.`
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-3xl p-6 shadow-2xl text-slate-100 ring-1 ring-white/10 flex flex-col relative max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600/30 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-lg text-white">App Settings</h3>
              <p className="text-xs text-slate-400">Configurations, alerts, theme &amp; privacy</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="py-4 space-y-6">
          {/* Section 1: Appearance & Theme */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              {theme === 'dark' ? <Moon className="w-4 h-4 text-indigo-400" /> : <Sun className="w-4 h-4 text-amber-400" />}
              <span>Appearance &amp; Display</span>
            </h4>

            <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 flex items-center justify-between">
              <div>
                <span className="font-semibold text-sm text-white block">Theme Mode</span>
                <span className="text-xs text-slate-400">
                  Currently using {theme === 'dark' ? 'Dark Mode (Night)' : 'Light Mode (Clean Day)'}
                </span>
              </div>
              <button
                onClick={onToggleTheme}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition shadow active:scale-95 border border-slate-700"
              >
                {theme === 'dark' ? (
                  <>
                    <Sun className="w-4 h-4 text-amber-400" />
                    <span>Switch to Light</span>
                  </>
                ) : (
                  <>
                    <Moon className="w-4 h-4 text-indigo-400" />
                    <span>Switch to Dark</span>
                  </>
                )}
              </button>
            </div>

            {/* Text Size & UI Scale for High DPI displays (Pixel 9 Pro XL, Galaxy S26 Ultra) */}
            <div className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-semibold text-sm text-white block">Text Size &amp; Display Scale</span>
                  <span className="text-xs text-slate-400">
                    Adjust font size for high-density phone screens (Pixel, Galaxy)
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2">
                {[
                  { id: 'normal', label: 'Normal', scale: '100%' },
                  { id: 'comfortable', label: 'Medium', scale: '115%' },
                  { id: 'large', label: 'Large', scale: '130%' },
                  { id: 'xlarge', label: 'Extra', scale: '145%' },
                ].map((s) => {
                  const currentScale = ecoSettings.fontScale || 'normal';
                  const isSelected = currentScale === s.id;
                  return (
                    <button
                      key={s.id}
                      onClick={() => {
                        onUpdateEcoSettings((prev) => ({
                          ...prev,
                          fontScale: s.id as any,
                        }));
                      }}
                      className={`p-2 rounded-xl text-center border transition ${
                        isSelected
                          ? 'bg-indigo-600 text-white font-bold border-indigo-400 shadow'
                          : 'bg-slate-800/80 border-slate-700/60 text-slate-300 hover:text-white'
                      }`}
                    >
                      <span className="block text-xs font-bold">{s.label}</span>
                      <span className="block text-[10px] opacity-75">{s.scale}</span>
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-slate-400 italic">
                Sample preview text: &quot;KinTrack Family location, geofences &amp; driving speed alerts&quot;
              </p>
            </div>
          </div>

          {/* Section 2: Audible Alerts & Voice Notifications */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-emerald-400" />
                <span>Audible &amp; Voice Alerts</span>
              </h4>
              <button
                onClick={handleTestChime}
                className="text-[11px] text-emerald-400 hover:text-emerald-300 font-bold transition flex items-center gap-1"
              >
                <span>🔊 Test Chime</span>
              </button>
            </div>

            <div className="space-y-2">
              {/* Geofence Arrivals / Departures */}
              <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="font-semibold text-sm text-white block">
                    Place Arrival &amp; Departure Chime
                  </span>
                  <span className="text-xs text-slate-400">
                    Spoken voice chime when family members enter or leave saved places
                  </span>
                </div>
                <button
                  onClick={() =>
                    onUpdateEcoSettings((prev) => ({
                      ...prev,
                      geofenceVoiceAlerts: !prev.geofenceVoiceAlerts,
                    }))
                  }
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    ecoSettings.geofenceVoiceAlerts ? 'bg-indigo-600' : 'bg-slate-800'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                      ecoSettings.geofenceVoiceAlerts ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Speed Warnings */}
              <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-sm text-white block">
                      Speed Warning Voice Alert
                    </span>
                    <span className="text-xs text-slate-400">
                      Audible voice alert when driving exceeds configurable speed above limit
                    </span>
                  </div>
                  <button
                    onClick={() =>
                      onUpdateEcoSettings((prev) => ({
                        ...prev,
                        speedVoiceAlerts: !prev.speedVoiceAlerts,
                      }))
                    }
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      ecoSettings.speedVoiceAlerts ? 'bg-indigo-600' : 'bg-slate-800'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                        ecoSettings.speedVoiceAlerts ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {ecoSettings.speedVoiceAlerts && (
                  <div className="pt-2 border-t border-slate-800/80 space-y-3 text-xs">
                    <label className="flex items-center justify-between p-2.5 rounded-xl bg-indigo-950/40 border border-indigo-500/30 cursor-pointer">
                      <div>
                        <span className="font-bold text-white block text-xs">Auto Road Speed Limit (OSM)</span>
                        <p className="text-[10px] text-slate-300">
                          Auto-detects posted speed signs on each road (residential 25, arterial 35, highway 65)
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={ecoSettings.autoSpeedLimit}
                        onChange={(e) =>
                          onUpdateEcoSettings((prev) => ({
                            ...prev,
                            autoSpeedLimit: e.target.checked,
                          }))
                        }
                        className="w-4 h-4 rounded text-indigo-500 accent-indigo-500 shrink-0 ml-2"
                      />
                    </label>

                    <div>
                      <div className="flex justify-between text-slate-300 font-medium mb-1">
                        <span>Speed Threshold Above Limit:</span>
                        <span className="font-bold text-amber-400">
                          +{ecoSettings.speedThresholdMph || 10} mph
                        </span>
                      </div>
                      <div className="flex gap-2">
                        {[5, 10, 15, 20].map((val) => (
                          <button
                            key={val}
                            onClick={() =>
                              onUpdateEcoSettings((prev) => ({
                                ...prev,
                                speedThresholdMph: val,
                              }))
                            }
                            className={`flex-1 py-1.5 rounded-xl font-bold transition text-xs ${
                              ecoSettings.speedThresholdMph === val
                                ? 'bg-amber-500 text-slate-950 shadow'
                                : 'bg-slate-800 text-slate-400 hover:text-white'
                            }`}
                          >
                            +{val} mph
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-slate-300 font-medium mb-1">
                        <span>Offline / Unmapped Road Fallback Limit:</span>
                        <span className="font-bold text-sky-400">
                          {ecoSettings.defaultSpeedLimit || 45} mph
                        </span>
                      </div>
                      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                        {[25, 35, 45, 55, 65, 75].map((limit) => (
                          <button
                            key={limit}
                            onClick={() =>
                              onUpdateEcoSettings((prev) => ({
                                ...prev,
                                defaultSpeedLimit: limit,
                              }))
                            }
                            className={`px-3 py-1.5 rounded-xl font-bold transition text-xs shrink-0 ${
                              ecoSettings.defaultSpeedLimit === limit
                                ? 'bg-sky-500 text-slate-950 shadow'
                                : 'bg-slate-800 text-slate-400 hover:text-white'
                            }`}
                          >
                            {limit} mph
                          </button>
                        ))}
                      </div>
                      <p className="text-[10px] text-slate-500 mt-1">
                        OpenStreetMap auto-detects real road speed limits; this fallback is only used if off-road or unmapped.
                      </p>
                    </div>

                    <button
                      onClick={handleTestSpeedBeep}
                      className="text-[11px] text-amber-400 hover:text-amber-300 font-bold transition flex items-center gap-1 pt-1"
                    >
                      <span>🔊 Test Speed Warning Voice Alert</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Section 3: Notification History & Storage Limit */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <BellRing className="w-4 h-4 text-amber-400" />
              <span>Notification Center &amp; History</span>
            </h4>

            <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3 text-xs">
              <div>
                <div className="flex justify-between text-slate-300 font-medium mb-1">
                  <span className="font-semibold text-white">Stored Notifications History:</span>
                  <span className="font-bold text-indigo-400">{maxNotifications} notifications</span>
                </div>
                <p className="text-[11px] text-slate-400 mb-2">
                  Number of recent chat, SOS, geofence, and lost phone alerts stored in top bar notification drawer.
                </p>
                <div className="flex gap-2">
                  {[5, 10, 15, 25, 50].map((val) => (
                    <button
                      key={val}
                      onClick={() => onUpdateMaxNotifications && onUpdateMaxNotifications(val)}
                      className={`flex-1 py-1.5 rounded-xl font-bold transition text-xs ${
                        maxNotifications === val
                          ? 'bg-indigo-600 text-white shadow'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {val}
                    </button>
                  ))}
                </div>
              </div>

              {onClearNotifications && (
                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                  <span className="text-slate-400 text-[11px]">Clear all stored alert history</span>
                  <button
                    onClick={onClearNotifications}
                    className="px-2.5 py-1 rounded-lg bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 border border-rose-500/40 text-[11px] font-semibold transition"
                  >
                    Clear History
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Section 4: Battery & GPS Optimization (Life360 Pain Point Solved) */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <Battery className="w-4 h-4 text-sky-400" />
              <span>Battery &amp; Location Updates</span>
            </h4>

            <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2 text-xs">
              <label className="text-slate-300 font-semibold block">GPS Reporting Mode</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { mode: 'eco_smart', label: 'Eco Smart', sub: '30s sync' },
                  { mode: 'high_accuracy', label: 'High Prec.', sub: '10s sync' },
                  { mode: 'battery_saver', label: 'Saver', sub: '60s sync' },
                ].map((item) => (
                  <button
                    key={item.mode}
                    onClick={() =>
                      onUpdateEcoSettings((prev) => ({
                        ...prev,
                        mode: item.mode as any,
                        gpsIntervalSeconds:
                          item.mode === 'high_accuracy' ? 10 : item.mode === 'battery_saver' ? 60 : 30,
                      }))
                    }
                    className={`p-2 rounded-xl text-center border transition ${
                      ecoSettings.mode === item.mode
                        ? 'bg-indigo-600/30 border-indigo-500 text-white font-bold'
                        : 'bg-slate-800/60 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span className="block text-xs font-bold">{item.label}</span>
                    <span className="block text-[10px] text-slate-400">{item.sub}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Low Battery Circle Broadcast (< 15%) */}
            <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-semibold text-sm text-white block">
                    Low Battery Circle Broadcast
                  </span>
                  <span className="text-xs text-slate-400">
                    Automatically alert circle chat when phone battery drops below threshold
                  </span>
                </div>
                <button
                  onClick={() =>
                    onUpdateEcoSettings((prev) => ({
                      ...prev,
                      lowBatteryBroadcastEnabled: prev.lowBatteryBroadcastEnabled !== false ? false : true,
                    }))
                  }
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    ecoSettings.lowBatteryBroadcastEnabled !== false ? 'bg-indigo-600' : 'bg-slate-800'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                      ecoSettings.lowBatteryBroadcastEnabled !== false ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {ecoSettings.lowBatteryBroadcastEnabled !== false && (
                <div className="pt-2 border-t border-slate-800/80 space-y-2">
                  <div className="flex justify-between text-slate-300 font-medium">
                    <span className="text-white">Alert Threshold:</span>
                    <span className="font-bold text-amber-400">
                      Below {ecoSettings.lowBatteryThresholdPercent || 15}%
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {[10, 15, 20, 25].map((val) => {
                      const isSel = (ecoSettings.lowBatteryThresholdPercent || 15) === val;
                      return (
                        <button
                          key={val}
                          onClick={() =>
                            onUpdateEcoSettings((prev) => ({
                              ...prev,
                              lowBatteryThresholdPercent: val,
                            }))
                          }
                          className={`py-1.5 rounded-xl font-bold transition text-xs ${
                            isSel
                              ? 'bg-amber-500 text-slate-950 shadow'
                              : 'bg-slate-800 text-slate-400 hover:text-white'
                          }`}
                        >
                          {val}% {val === 15 ? '★' : ''}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[10px] text-slate-400">
                    ★ 15% is recommended. Sends an automatic notice to circle members so they know your phone may power off soon.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Section 4: Circle & Account */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-400" />
              <span>Circle &amp; Account Management</span>
            </h4>

            <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-bold text-white block text-sm">{circleName}</span>
                  <span className="text-slate-400 text-xs">Invite Code: <strong className="text-emerald-400">{inviteCode || circleId}</strong></span>
                </div>
                <button
                  onClick={handleCopyInvite}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold transition flex items-center gap-1.5 text-xs shadow border border-slate-700"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied!' : 'Copy Code'}</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800">
                <button
                  onClick={() => {
                    onClose();
                    onOpenPlaces();
                  }}
                  className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold transition flex items-center justify-center gap-1.5 shadow"
                >
                  <MapPin className="w-3.5 h-3.5 text-sky-400" />
                  <span>Saved Places</span>
                </button>
                <button
                  onClick={() => {
                    onClose();
                    onOpenMembers();
                  }}
                  className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold transition flex items-center justify-center gap-1.5 shadow"
                >
                  <Users className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Manage Members</span>
                </button>
              </div>

              <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                <button
                  onClick={() => {
                    onClose();
                    onOpenUniversalAuth();
                  }}
                  className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1"
                >
                  <span>Switch Circle / Sign In</span>
                </button>

                <button
                  onClick={() => {
                    onClose();
                    onOpenGuide();
                  }}
                  className="text-xs text-slate-400 hover:text-white flex items-center gap-1"
                >
                  <HelpCircle className="w-3.5 h-3.5 text-sky-400" />
                  <span>Setup Guide</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="pt-3 border-t border-slate-800 text-center">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg transition active:scale-95"
          >
            Done &amp; Save Preferences
          </button>
        </div>
      </div>
    </div>
  );
};
