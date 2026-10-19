import React, { useEffect, useState } from 'react';
import { Volume2, BellRing, Smartphone, ShieldAlert, Check, VolumeX } from 'lucide-react';
import { RemoteAlarmEvent } from '../types';
import { startLostPhonePiercingAlarm, stopLostPhonePiercingAlarm, unlockAudioContext } from '../utils/audio';

interface RemoteAlarmModalProps {
  alarm: RemoteAlarmEvent | null;
  onSilence: (alarmId: string, targetMemberId: string) => void;
}

export const RemoteAlarmModal: React.FC<RemoteAlarmModalProps> = ({ alarm, onSilence }) => {
  const [strobeState, setStrobeState] = useState(false);
  const [audioUnlocked, setAudioUnlocked] = useState(false);

  useEffect(() => {
    if (alarm && alarm.status === 'active') {
      // Unlock audio and start piercing siren loop and vibration
      unlockAudioContext();
      startLostPhonePiercingAlarm(alarm.targetMemberName || 'This Phone');

      // Visual strobe flasher for finding phone in dark or under couches
      const interval = setInterval(() => {
        setStrobeState((prev) => !prev);
      }, 300);

      return () => {
        clearInterval(interval);
        stopLostPhonePiercingAlarm();
      };
    } else {
      stopLostPhonePiercingAlarm();
    }
  }, [alarm]);

  if (!alarm || alarm.status !== 'active') return null;

  const handleScreenTouch = () => {
    unlockAudioContext();
    startLostPhonePiercingAlarm(alarm.targetMemberName || 'This Phone');
    setAudioUnlocked(true);
  };

  const handleTurnOff = (e: React.MouseEvent) => {
    e.stopPropagation();
    stopLostPhonePiercingAlarm();
    onSilence(alarm.alarmId, alarm.targetMemberId);
  };

  return (
    <div
      onClick={handleScreenTouch}
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-colors duration-150 select-none cursor-pointer ${
        strobeState ? 'bg-amber-600/95' : 'bg-rose-950/98'
      }`}
    >
      <div className="relative max-w-md w-full p-6 sm:p-8 rounded-3xl bg-slate-950/95 border-2 border-amber-400 text-center shadow-2xl shadow-rose-900/80 ring-8 ring-amber-400/40 animate-in zoom-in-95 duration-150">
        {/* Pulsing Bell Icon */}
        <div className="mx-auto w-24 h-24 rounded-full bg-amber-500/25 border-2 border-amber-400 flex items-center justify-center mb-4 animate-bounce">
          <BellRing className="w-12 h-12 text-amber-300 animate-pulse" />
        </div>

        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/20 border border-rose-500/60 text-rose-300 text-xs font-black uppercase tracking-widest mb-2 animate-pulse">
          <Volume2 className="w-4 h-4" />
          <span>Maximum Volume Siren Active</span>
        </div>

        <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-tight">
          Lost Phone Finder
        </h2>

        <p className="text-amber-200 text-sm font-semibold mt-1.5">
          Triggered by <span className="underline decoration-amber-400 font-bold">{alarm.triggeredByName}</span>
        </p>

        <p className="text-slate-300 text-xs leading-relaxed mt-2.5 px-2">
          This alarm is sounding at the highest possible volume and vibrating so you can locate this device even if the ringer is silent or muted.
        </p>

        {/* Audio interaction banner if browser requested gesture */}
        <div className="mt-4 p-2.5 rounded-xl bg-amber-500/20 border border-amber-400/40 text-[11px] text-amber-200 flex items-center justify-center gap-2">
          <Volume2 className="w-4 h-4 text-amber-300 shrink-0 animate-ping" />
          <span>Tap anywhere on screen to amplify sound to peak volume</span>
        </div>

        {/* Turn Off Button */}
        <div className="mt-5 space-y-2">
          <button
            onClick={handleTurnOff}
            className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 active:scale-95 text-slate-950 font-black text-base shadow-xl shadow-emerald-950/60 flex items-center justify-center gap-2 transition"
          >
            <Check className="w-6 h-6 stroke-[3]" />
            <span>I Found My Phone — Turn Off Siren</span>
          </button>

          <p className="text-[11px] text-slate-400">
            Silences the siren immediately and notifies the family circle.
          </p>
        </div>
      </div>
    </div>
  );
};
