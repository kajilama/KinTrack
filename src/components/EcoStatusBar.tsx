import React, { useState, useEffect } from 'react';
import { BatteryCharging, ShieldCheck, Zap, X, Sliders, Radio } from 'lucide-react';
import { EcoSettings, EcoModeLevel } from '../types';

interface EcoStatusBarProps {
  settings: EcoSettings;
  onUpdateSettings: (settings: EcoSettings) => void;
  myBattery: number;
  isCharging: boolean;
  gpsActive: boolean;
}

export const EcoStatusBar: React.FC<EcoStatusBarProps> = ({
  settings,
  onUpdateSettings,
  myBattery,
  isCharging,
  gpsActive,
}) => {
  // Banner visibility: auto-dismisses after 3.5 seconds so it doesn't block top of the screen
  const [showBanner, setShowBanner] = useState<boolean>(true);
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);

  useEffect(() => {
    // Auto-dismiss the flashing GPS banner after 3.5 seconds
    const timer = setTimeout(() => {
      setShowBanner(false);
    }, 3500);

    return () => clearTimeout(timer);
  }, []);

  const selectMode = (mode: EcoModeLevel) => {
    let interval = 30;
    if (mode === 'high_accuracy') interval = 5;
    if (mode === 'eco_smart') interval = 30;
    if (mode === 'balanced') interval = 60;
    if (mode === 'geofence_only') interval = 180;

    onUpdateSettings({
      ...settings,
      mode,
      gpsIntervalSeconds: interval,
    });
  };

  return (
    <>
      {/* Auto-Dismissing Banner that disappears after a few seconds - positioned safely below header */}
      {showBanner && (
        <div
          style={{ top: 'calc(max(env(safe-area-inset-top, 0px), 16px) + 54px)' }}
          className="fixed inset-x-3 md:left-1/2 md:-translate-x-1/2 md:max-w-md z-50 transition-all duration-500 ease-out animate-in fade-in slide-in-from-top-4"
        >
          <div className="bg-slate-900/95 backdrop-blur-md border border-emerald-500/40 text-slate-100 rounded-2xl px-4 py-3 shadow-2xl flex items-center justify-between gap-3 ring-1 ring-emerald-500/20">
            <div className="flex items-center gap-3">
              <div className="relative flex items-center justify-center w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400">
                <Radio className="w-4 h-4 animate-pulse" />
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-slate-900 animate-ping" />
              </div>
              <div>
                <div className="flex items-center gap-1.5 font-semibold text-xs text-emerald-400 tracking-wide uppercase">
                  <span>GPS Locked (ECO Mode)</span>
                  <span className="text-[10px] text-slate-400 font-normal">
                    ({settings.gpsIntervalSeconds}s adaptive)
                  </span>
                </div>
                <p className="text-[11px] text-slate-300">
                  Auto-optimizing battery consumption for 4-phone circle
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => setShowSettingsModal(true)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                title="Configure ECO settings"
              >
                <Sliders className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setShowBanner(false)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
                title="Dismiss banner"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Persistent Mini Unobtrusive Pill in the top app header */}
      <button
        onClick={() => setShowSettingsModal(true)}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900/80 backdrop-blur-md border border-slate-700/60 text-[11px] text-slate-300 hover:bg-slate-800 hover:border-slate-600 transition shadow-sm"
        title="Tap to manage GPS & Battery ECO Mode"
      >
        <span
          className={`w-2 h-2 rounded-full ${
            gpsActive ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
          }`}
        />
        <span className="font-medium text-emerald-400">ECO</span>
        <span className="text-slate-400">·</span>
        <span className="text-slate-300 flex items-center gap-0.5">
          {isCharging ? (
            <BatteryCharging className="w-3 h-3 text-emerald-400" />
          ) : (
            <Zap className="w-3 h-3 text-amber-400" />
          )}
          {myBattery}%
        </span>
      </button>

      {/* Modal for In-Depth Battery & GPS ECO Configuration */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-3xl p-5 shadow-2xl text-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-white">Smart ECO & Battery Engine</h3>
                  <p className="text-xs text-slate-400">Optimized for 24/7 background family tracking</p>
                </div>
              </div>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="p-2 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <p className="text-xs text-slate-300 leading-relaxed">
                Choose how frequently this phone broadcasts its GPS coordinates. When stationary inside a saved place
                (e.g., Home or School), Orbit automatically throttles GPS queries to preserve battery.
              </p>

              {/* Modes */}
              <div className="space-y-2 pt-1">
                <button
                  onClick={() => selectMode('eco_smart')}
                  className={`w-full text-left p-3.5 rounded-2xl border transition flex items-start justify-between ${
                    settings.mode === 'eco_smart'
                      ? 'bg-emerald-950/40 border-emerald-500/60 ring-1 ring-emerald-500/30'
                      : 'bg-slate-800/40 border-slate-700/50 hover:bg-slate-800'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-emerald-400">Smart Adaptive ECO (Recommended)</span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-300 font-medium">
                        Default
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      Updates every 30s when walking, 10s when driving (&gt;15mph), and sleeps at saved places. Low ~2-3%
                      battery/day.
                    </p>
                  </div>
                </button>

                <button
                  onClick={() => selectMode('balanced')}
                  className={`w-full text-left p-3.5 rounded-2xl border transition flex items-start justify-between ${
                    settings.mode === 'balanced'
                      ? 'bg-emerald-950/40 border-emerald-500/60 ring-1 ring-emerald-500/30'
                      : 'bg-slate-800/40 border-slate-700/50 hover:bg-slate-800'
                  }`}
                >
                  <div>
                    <span className="font-semibold text-sm text-slate-200">Balanced (60s Updates)</span>
                    <p className="text-xs text-slate-400 mt-1">
                      Pings every 1 minute. Ideal for older Android phones and all-day outdoor activities.
                    </p>
                  </div>
                </button>

                <button
                  onClick={() => selectMode('geofence_only')}
                  className={`w-full text-left p-3.5 rounded-2xl border transition flex items-start justify-between ${
                    settings.mode === 'geofence_only'
                      ? 'bg-emerald-950/40 border-emerald-500/60 ring-1 ring-emerald-500/30'
                      : 'bg-slate-800/40 border-slate-700/50 hover:bg-slate-800'
                  }`}
                >
                  <div>
                    <span className="font-semibold text-sm text-slate-200">Ultra Battery Saver (3-5 min / Geofence)</span>
                    <p className="text-xs text-slate-400 mt-1">
                      Only checks on major location shifts and geofence boundary crosses. Barely registers on battery
                      stats.
                    </p>
                  </div>
                </button>

                <button
                  onClick={() => selectMode('high_accuracy')}
                  className={`w-full text-left p-3.5 rounded-2xl border transition flex items-start justify-between ${
                    settings.mode === 'high_accuracy'
                      ? 'bg-emerald-950/40 border-emerald-500/60 ring-1 ring-emerald-500/30'
                      : 'bg-slate-800/40 border-slate-700/50 hover:bg-slate-800'
                  }`}
                >
                  <div>
                    <span className="font-semibold text-sm text-slate-200">Real-Time Precision (5s Rapid Updates)</span>
                    <p className="text-xs text-slate-400 mt-1">
                      Turn-by-turn precision. Great for road trips and emergency tracking. Uses more battery.
                    </p>
                  </div>
                </button>
              </div>

              {/* Toggles */}
              <div className="pt-3 border-t border-slate-800 space-y-2.5">
                <label className="flex items-center justify-between text-xs cursor-pointer p-2 rounded-xl hover:bg-slate-800/40">
                  <div>
                    <span className="font-medium text-slate-200">Voice Geofence Announcements</span>
                    <p className="text-[11px] text-slate-400">Speak when family members arrive or leave saved places</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.geofenceVoiceAlerts}
                    onChange={(e) =>
                      onUpdateSettings({ ...settings, geofenceVoiceAlerts: e.target.checked })
                    }
                    className="w-4 h-4 rounded text-emerald-500 accent-emerald-500"
                  />
                </label>

                <label className="flex items-center justify-between text-xs cursor-pointer p-2 rounded-xl hover:bg-slate-800/40">
                  <div>
                    <span className="font-medium text-slate-200">Auto Road Speed Limit (OSM)</span>
                    <p className="text-[11px] text-slate-400">Auto-detects posted speed signs on each road</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.autoSpeedLimit}
                    onChange={(e) =>
                      onUpdateSettings({ ...settings, autoSpeedLimit: e.target.checked })
                    }
                    className="w-4 h-4 rounded text-emerald-500 accent-emerald-500"
                  />
                </label>

                <label className="flex items-center justify-between text-xs cursor-pointer p-2 rounded-xl hover:bg-slate-800/40">
                  <div>
                    <span className="font-medium text-slate-200">Speed Limit Voice Alert (&gt;10mph)</span>
                    <p className="text-[11px] text-slate-400">Audible warning if any family driver exceeds limit</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.speedVoiceAlerts}
                    onChange={(e) =>
                      onUpdateSettings({ ...settings, speedVoiceAlerts: e.target.checked })
                    }
                    className="w-4 h-4 rounded text-emerald-500 accent-emerald-500"
                  />
                </label>
              </div>
            </div>

            <button
              onClick={() => setShowSettingsModal(false)}
              className="mt-5 w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm transition"
            >
              Save &amp; Apply
            </button>
          </div>
        </div>
      )}
    </>
  );
};
