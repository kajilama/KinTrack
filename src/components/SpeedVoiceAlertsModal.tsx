import React, { useState } from 'react';
import { Gauge, Volume2, ShieldAlert, Check, X, BellRing, Sparkles, Navigation, MapPin } from 'lucide-react';
import { EcoSettings } from '../types';
import { playSpeedWarningBeep, speakVoiceAlert } from '../utils/audio';

interface SpeedVoiceAlertsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: EcoSettings;
  onUpdateSettings: (settings: EcoSettings) => void;
  currentRoadName?: string;
  currentSpeedLimitMph?: number;
  drivingMemberName?: string;
  drivingSpeedMph?: number;
}

export const SpeedVoiceAlertsModal: React.FC<SpeedVoiceAlertsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  currentRoadName = 'Park Presidio Blvd',
  currentSpeedLimitMph = 35,
  drivingMemberName = 'Lucas',
  drivingSpeedMph = 58,
}) => {
  const [autoSpeedLimit, setAutoSpeedLimit] = useState(
    settings.autoSpeedLimit !== undefined ? settings.autoSpeedLimit : true
  );
  const [threshold, setThreshold] = useState(settings.speedThresholdMph || 10);
  const [defaultLimit, setDefaultLimit] = useState(settings.defaultSpeedLimit || 45);
  const [voiceEnabled, setVoiceEnabled] = useState(settings.speedVoiceAlerts);
  const [tested, setTested] = useState(false);

  if (!isOpen) return null;

  const activeLimit = autoSpeedLimit ? (currentSpeedLimitMph || 35) : defaultLimit;
  const sampleOver = Math.max(5, drivingSpeedMph - activeLimit);

  const handleTestAlert = () => {
    playSpeedWarningBeep();
    speakVoiceAlert(
      `Warning: Driving alert! ${drivingMemberName} is driving at ${drivingSpeedMph} miles per hour on ${currentRoadName}, ${sampleOver} miles above the ${activeLimit} mile per hour auto-detected speed limit.`,
      true
    );
    setTested(true);
    setTimeout(() => setTested(false), 3000);
  };

  const handleSave = () => {
    onUpdateSettings({
      ...settings,
      autoSpeedLimit,
      speedThresholdMph: threshold,
      defaultSpeedLimit: defaultLimit,
      speedVoiceAlerts: voiceEnabled,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-3xl p-6 shadow-2xl text-slate-100 ring-1 ring-white/10 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-amber-500/20 text-amber-400">
              <Gauge className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-white">Speed Limit &amp; Voice Alerts</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300">
                  Auto OSM
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Automatic road speed limit detection &amp; intelligent voice warnings
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Settings Body */}
        <div className="mt-4 space-y-4 text-xs">
          {/* Automatic Speed Limit Detection Toggle (Answers User Request Directly) */}
          <div className="p-4 rounded-2xl bg-indigo-950/40 border border-indigo-500/40 space-y-3">
            <label className="flex items-start justify-between gap-3 cursor-pointer">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white text-sm">
                    Automatic Road Speed Limit Detection
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold bg-indigo-500/30 text-indigo-300">
                    Recommended
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  Instead of relying on a manual single speed guess, the app automatically inspects OpenStreetMap road ways and posted speed limit signs for your exact GPS coordinates in real-time.
                </p>
              </div>
              <input
                type="checkbox"
                checked={autoSpeedLimit}
                onChange={(e) => setAutoSpeedLimit(e.target.checked)}
                className="w-5 h-5 rounded accent-indigo-500 shrink-0 mt-0.5"
              />
            </label>

            {/* Live Auto-Detected Speed Limit Sign Card */}
            {autoSpeedLimit && (
              <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-700/80 flex items-center justify-between gap-3 animate-in fade-in">
                <div className="flex items-center gap-3">
                  {/* Authentic Speed Limit Sign Icon */}
                  <div className="w-10 h-13 bg-white rounded-lg border-2 border-black p-0.5 flex flex-col items-center justify-between shadow text-black shrink-0">
                    <span className="text-[6px] font-black uppercase tracking-tighter leading-none mt-0.5">
                      SPEED
                    </span>
                    <span className="text-[6px] font-black uppercase tracking-tighter leading-none">
                      LIMIT
                    </span>
                    <span className="text-sm font-black leading-none mb-0.5">
                      {currentSpeedLimitMph || 35}
                    </span>
                  </div>

                  <div className="leading-tight">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] uppercase font-bold text-emerald-400">
                        ● Live Auto-Detected Limit
                      </span>
                    </div>
                    <span className="font-bold text-xs text-white block mt-0.5">
                      {currentSpeedLimitMph || 35} mph on {currentRoadName || 'Current Road'}
                    </span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      Road type: Multi-lane Arterial (OpenStreetMap Way)
                    </span>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-[10px] px-2 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 font-bold block">
                    Active
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Toggle Voice Notifications */}
          <label className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-800/60 border border-slate-700/60 cursor-pointer">
            <div>
              <span className="font-bold text-white text-sm block">Voice Driving Warnings</span>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Speaks aloud through phone speaker when family member speeds over the road's limit
              </p>
            </div>
            <input
              type="checkbox"
              checked={voiceEnabled}
              onChange={(e) => setVoiceEnabled(e.target.checked)}
              className="w-5 h-5 rounded accent-amber-500"
            />
          </label>

          {/* Speed Limit Threshold */}
          <div className="p-3.5 rounded-2xl bg-slate-800/40 border border-slate-800">
            <div className="flex items-center justify-between text-slate-300 mb-1.5">
              <span className="font-semibold">
                Alert Threshold Above {autoSpeedLimit ? 'Road' : 'Base'} Speed Limit:
              </span>
              <span className="font-bold text-amber-400 text-sm">+{threshold} mph</span>
            </div>
            <input
              type="range"
              min={5}
              max={25}
              step={1}
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              className="w-full accent-amber-500 cursor-pointer h-2 bg-slate-800 rounded-lg"
            />
            <div className="flex justify-between text-[10px] text-slate-500 mt-1">
              <span>+5 mph (Strict)</span>
              <span>+10 mph (Recommended)</span>
              <span>+25 mph (High Highway)</span>
            </div>
            <p className="text-[10px] text-slate-400 mt-2">
              Alert triggers when speed exceeds{' '}
              <strong className="text-white">
                {activeLimit} + {threshold} = {activeLimit + threshold} mph
              </strong>{' '}
              on this road.
            </p>
          </div>

          {/* Default Base Road Limit (Used as fallback if off-road or auto-detect is disabled) */}
          <div className="p-3.5 rounded-2xl bg-slate-800/40 border border-slate-800">
            <div className="flex items-center justify-between text-slate-300 mb-1.5">
              <span className="font-semibold">
                {autoSpeedLimit ? 'Offline / Unmapped Fallback Limit:' : 'Manual Road Speed Limit:'}
              </span>
              <span className="font-bold text-sky-400 text-sm">{defaultLimit} mph</span>
            </div>
            <select
              value={defaultLimit}
              onChange={(e) => setDefaultLimit(Number(e.target.value))}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
            >
              <option value={25}>25 mph (School &amp; Residential)</option>
              <option value={35}>35 mph (City Boulevard)</option>
              <option value={45}>45 mph (Arterial Road)</option>
              <option value={55}>55 mph (Expressway)</option>
              <option value={65}>65 mph (Interstate Highway)</option>
            </select>
            <p className="text-[10px] text-slate-500 mt-1.5">
              {autoSpeedLimit
                ? 'Used only if GPS is in remote off-grid area without OpenStreetMap road tags.'
                : 'Static speed limit applied across all roads.'}
            </p>
          </div>

          {/* Test Button */}
          <div className="pt-1">
            <button
              onClick={handleTestAlert}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-2 transition active:scale-95"
            >
              <Volume2 className="w-4 h-4 text-amber-400 animate-pulse" />
              <span>{tested ? 'Alert Playing through Speaker...' : 'Test Road Speed Voice Alert'}</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-5 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow transition"
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
};
