import React from 'react';
import { MapPin, Navigation, X } from 'lucide-react';

interface LocationRequestNotificationModalProps {
  request: {
    targetMemberId: string;
    senderName: string;
    timestamp: number;
    message: string;
  } | null;
  onEnableGps: () => void;
  onDismiss: () => void;
}

export const LocationRequestNotificationModal: React.FC<LocationRequestNotificationModalProps> = ({
  request,
  onEnableGps,
  onDismiss,
}) => {
  if (!request) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative max-w-sm w-full p-5 sm:p-6 rounded-3xl bg-slate-900 border border-sky-500/40 text-center shadow-2xl space-y-4 ring-1 ring-sky-500/20">
        <button
          onClick={onDismiss}
          className="absolute top-3 right-3 p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="mx-auto w-14 h-14 rounded-2xl bg-sky-500/20 border border-sky-400/40 flex items-center justify-center text-sky-400">
          <MapPin className="w-7 h-7 animate-bounce" />
        </div>

        <div>
          <h3 className="text-base font-bold text-white">Live Location Requested</h3>
          <p className="text-xs text-sky-300 font-medium mt-1">
            <span className="font-bold text-white">{request.senderName}</span> requested your updated GPS pin.
          </p>
          <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
            Due to device security protections, only you can enable GPS for this phone. Tap below to refresh your location for your family.
          </p>
        </div>

        <div className="space-y-2 pt-1">
          <button
            onClick={() => {
              onEnableGps();
              onDismiss();
            }}
            className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition"
          >
            <Navigation className="w-4 h-4" />
            <span>Turn On / Update GPS Location</span>
          </button>

          <button
            onClick={onDismiss}
            className="w-full py-2 text-slate-400 hover:text-slate-200 text-xs font-semibold transition"
          >
            Later
          </button>
        </div>
      </div>
    </div>
  );
};
