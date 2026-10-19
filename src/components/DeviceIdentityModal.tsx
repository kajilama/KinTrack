import React, { useState } from 'react';
import { UserCheck, Smartphone, Plus, Check, X, Crosshair } from 'lucide-react';
import { FamilyMember } from '../types';

interface DeviceIdentityModalProps {
  isOpen: boolean;
  onClose: () => void;
  members: Record<string, FamilyMember>;
  activeMemberId: string;
  onSelectIdentity: (memberId: string) => void;
  isRealGpsEnabled: boolean;
  onToggleRealGps: (enabled: boolean) => void;
  isSimulatorActive: boolean;
  onToggleSimulator: (active: boolean) => void;
  onOpenMemberManagement?: () => void;
}

export const DeviceIdentityModal: React.FC<DeviceIdentityModalProps> = ({
  isOpen,
  onClose,
  members,
  activeMemberId,
  onSelectIdentity,
  isRealGpsEnabled,
  onToggleRealGps,
  isSimulatorActive,
  onToggleSimulator,
  onOpenMemberManagement,
}) => {
  if (!isOpen) return null;

  const memberList = Object.values(members);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-3xl p-6 shadow-2xl text-slate-100 ring-1 ring-white/10">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">This Device&apos;s Identity</h3>
              <p className="text-xs text-slate-400">Choose which family member this phone represents</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Member Selector List */}
        <div className="mt-4 space-y-2 max-h-60 overflow-y-auto">
          {memberList.length === 0 ? (
            <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 text-center text-xs text-slate-400">
              No family members registered yet in this circle.
            </div>
          ) : (
            memberList.map((member) => {
              const isSelected = member.id === activeMemberId;

              return (
                <button
                  key={member.id}
                  onClick={() => {
                    onSelectIdentity(member.id);
                    onClose();
                  }}
                  className={`w-full p-3 rounded-2xl border transition flex items-center justify-between ${
                    isSelected
                      ? 'bg-indigo-950/50 border-indigo-500 ring-1 ring-indigo-500/40'
                      : 'bg-slate-800/50 border-slate-700/50 hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-full overflow-hidden ring-2 shrink-0"
                      style={{ borderColor: member.color }}
                    >
                      <img src={member.avatar} alt={member.name} className="w-full h-full object-cover" />
                    </div>
                    <div className="text-left">
                      <h5 className="font-bold text-xs text-white flex items-center gap-1.5">
                        {member.name}
                        <span
                          className="text-[9px] px-1.5 py-0.2 rounded-full font-semibold"
                          style={{ backgroundColor: `${member.color}25`, color: member.color }}
                        >
                          {member.role}
                        </span>
                      </h5>
                      <p className="text-[11px] text-slate-400">
                        Battery: {member.battery}% · {member.location?.placeName || 'Active'}
                      </p>
                    </div>
                  </div>

                  {isSelected ? (
                    <div className="w-6 h-6 rounded-full bg-indigo-500 text-white flex items-center justify-center shrink-0">
                      <Check className="w-4 h-4" />
                    </div>
                  ) : (
                    <span className="text-[11px] text-slate-400 font-medium shrink-0">Select</span>
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* Manage Members Link Button */}
        {onOpenMemberManagement && (
          <button
            onClick={() => {
              onClose();
              onOpenMemberManagement();
            }}
            className="mt-3 w-full py-2.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 text-xs font-bold transition flex items-center justify-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Manage All Members &amp; Devices</span>
          </button>
        )}

        {/* GPS Tracking Mode Switches */}
        <div className="mt-4 pt-4 border-t border-slate-800 space-y-2.5 text-xs">
          <label className="flex items-center justify-between p-3 rounded-2xl bg-slate-950/60 border border-slate-800 cursor-pointer">
            <div className="flex items-center gap-2.5">
              <Crosshair className="w-4 h-4 text-emerald-400" />
              <div>
                <span className="font-semibold text-white block">Broadcast Real Phone GPS</span>
                <span className="text-[10px] text-slate-400">
                  Transmit this device&apos;s live hardware coordinates
                </span>
              </div>
            </div>
            <input
              type="checkbox"
              checked={isRealGpsEnabled}
              onChange={(e) => onToggleRealGps(e.target.checked)}
              className="w-4 h-4 rounded accent-emerald-500"
            />
          </label>

          <label className="flex items-center justify-between p-3 rounded-2xl bg-slate-950/60 border border-slate-800 cursor-pointer">
            <div>
              <span className="font-semibold text-white block">Simulation / Demo Movement</span>
              <span className="text-[10px] text-slate-400">
                Simulates driving &amp; walking trips for demonstration
              </span>
            </div>
            <input
              type="checkbox"
              checked={isSimulatorActive}
              onChange={(e) => onToggleSimulator(e.target.checked)}
              className="w-4 h-4 rounded accent-indigo-500"
            />
          </label>
        </div>

        <button
          onClick={onClose}
          className="mt-4 w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
        >
          Done
        </button>
      </div>
    </div>
  );
};
