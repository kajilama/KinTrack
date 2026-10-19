import React, { useState, useEffect } from 'react';
import { AlertOctagon, PhoneCall, Navigation, ShieldCheck, VolumeX, Volume2, X } from 'lucide-react';
import { SosAlert, FamilyMember } from '../types';
import { startEmergencySiren, stopEmergencySiren } from '../utils/audio';

interface SosAlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeSos: SosAlert[];
  currentMember: FamilyMember;
  onTriggerSos: () => void;
  onResolveSos: (alertId: string) => void;
}

export const SosAlertModal: React.FC<SosAlertModalProps> = ({
  isOpen,
  onClose,
  activeSos,
  currentMember,
  onTriggerSos,
  onResolveSos,
}) => {
  const [isHolding, setIsHolding] = useState<boolean>(false);
  const [holdProgress, setHoldProgress] = useState<number>(0);
  const [isSirenMuted, setIsSirenMuted] = useState<boolean>(false);

  const currentActiveAlert = activeSos.find((a) => a.status === 'active');

  // Trigger siren when active SOS exists
  useEffect(() => {
    if (currentActiveAlert && !isSirenMuted) {
      startEmergencySiren();
    } else {
      stopEmergencySiren();
    }

    return () => {
      stopEmergencySiren();
    };
  }, [currentActiveAlert, isSirenMuted]);

  // Hold-to-trigger timer
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isHolding) {
      interval = setInterval(() => {
        setHoldProgress((p) => {
          if (p >= 100) {
            setIsHolding(false);
            onTriggerSos();
            return 0;
          }
          return p + 5;
        });
      }, 50);
    } else {
      setHoldProgress(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isHolding, onTriggerSos]);

  if (!isOpen && !currentActiveAlert) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in">
      {/* If an active SOS is currently triggered */}
      {currentActiveAlert ? (
        <div className="bg-rose-950 border-2 border-rose-500 w-full max-w-md rounded-3xl p-6 shadow-[0_0_50px_rgba(244,63,94,0.6)] text-white text-center relative ring-4 ring-rose-500/30 animate-pulse">
          <div className="w-20 h-20 mx-auto rounded-full bg-rose-600 flex items-center justify-center mb-4 shadow-xl ring-8 ring-rose-500/20">
            <AlertOctagon className="w-10 h-10 text-white animate-bounce" />
          </div>

          <div className="inline-block px-3 py-1 rounded-full bg-rose-500/20 text-rose-300 font-bold text-xs uppercase tracking-wider mb-2">
            Active Emergency SOS
          </div>

          <h2 className="text-2xl font-black">{currentActiveAlert.memberName} Needs Help!</h2>
          <p className="text-xs text-rose-200 mt-1">
            {currentActiveAlert.address || `GPS: ${currentActiveAlert.lat.toFixed(4)}, ${currentActiveAlert.lng.toFixed(4)}`}
          </p>

          <div className="my-4 p-3 rounded-2xl bg-black/40 border border-rose-800/80 flex items-center justify-around text-xs">
            <div>
              <span className="text-rose-400 block text-[10px]">BATTERY</span>
              <span className="font-bold">{currentActiveAlert.battery}%</span>
            </div>
            <div className="w-px h-6 bg-rose-800" />
            <div>
              <span className="text-rose-400 block text-[10px]">TIME</span>
              <span className="font-bold">
                {new Date(currentActiveAlert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <div className="w-px h-6 bg-rose-800" />
            <div>
              <span className="text-rose-400 block text-[10px]">SIREN</span>
              <button
                onClick={() => setIsSirenMuted(!isSirenMuted)}
                className="font-bold text-rose-300 hover:text-white flex items-center gap-1"
              >
                {isSirenMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5 animate-pulse" />}
                {isSirenMuted ? 'Muted' : 'Playing'}
              </button>
            </div>
          </div>

          {/* Action buttons */}
          <div className="space-y-2 mt-4">
            <a
              href={`https://maps.google.com/?q=${currentActiveAlert.lat},${currentActiveAlert.lng}`}
              target="_blank"
              rel="noreferrer"
              className="w-full py-3 rounded-2xl bg-white hover:bg-slate-100 text-slate-950 font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg transition active:scale-95"
            >
              <Navigation className="w-4 h-4 text-rose-600" />
              Navigate to {currentActiveAlert.memberName}
            </a>

            <a
              href="tel:911"
              className="w-full py-2.5 rounded-2xl bg-rose-800 hover:bg-rose-700 text-white font-bold text-xs flex items-center justify-center gap-2 transition"
            >
              <PhoneCall className="w-4 h-4" />
              Call 911 Emergency Services
            </a>

            <button
              onClick={() => {
                stopEmergencySiren();
                onResolveSos(currentActiveAlert.id);
              }}
              className="w-full py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition shadow"
            >
              <ShieldCheck className="w-4 h-4" />
              I Am Safe / Resolve Emergency
            </button>
          </div>
        </div>
      ) : (
        /* SOS Trigger Panel */
        <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-3xl p-6 shadow-2xl text-slate-100 text-center relative ring-1 ring-white/10">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="w-16 h-16 mx-auto rounded-3xl bg-rose-500/20 text-rose-500 flex items-center justify-center mb-3">
            <AlertOctagon className="w-8 h-8" />
          </div>

          <h3 className="text-xl font-bold text-white">Emergency SOS Alert</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
            Broadcasting SOS immediately alerts all 4 family phones with your precise GPS coordinates, directions, and
            sounds a loud emergency siren.
          </p>

          {/* Hold Button */}
          <div className="my-6">
            <button
              onMouseDown={() => setIsHolding(true)}
              onMouseUp={() => setIsHolding(false)}
              onMouseLeave={() => setIsHolding(false)}
              onTouchStart={() => setIsHolding(true)}
              onTouchEnd={() => setIsHolding(false)}
              className="relative w-36 h-36 mx-auto rounded-full bg-gradient-to-tr from-rose-700 to-rose-500 text-white font-black text-xl shadow-[0_0_40px_rgba(244,63,94,0.4)] flex flex-col items-center justify-center active:scale-95 transition overflow-hidden select-none"
            >
              {/* Progress ring fill */}
              <div
                className="absolute inset-0 bg-white/20 transition-all"
                style={{ height: `${holdProgress}%`, bottom: 0, top: 'auto' }}
              />
              <span className="relative z-10">SOS</span>
              <span className="relative z-10 text-[10px] font-semibold tracking-wider uppercase opacity-90 mt-0.5">
                {isHolding ? `HOLD (${Math.round(holdProgress)}%)` : 'HOLD 2 SEC'}
              </span>
            </button>
          </div>

          {/* Instant click trigger option */}
          <button
            onClick={() => onTriggerSos()}
            className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-rose-400 hover:text-rose-300 text-xs font-semibold transition border border-rose-500/30"
          >
            Or Tap Here for Instant 1-Click SOS
          </button>
        </div>
      )}
    </div>
  );
};
