import React, { useState } from 'react';
import {
  Users,
  UserPlus,
  Crown,
  Smartphone,
  Shield,
  Trash2,
  Edit2,
  Check,
  X,
  Copy,
  CheckCircle2,
  QrCode,
  Share2,
  Battery,
  BatteryCharging,
  Phone,
  Gauge,
  Sparkles,
  RefreshCw,
  AlertTriangle,
  BellRing,
  Volume2,
  MessageSquare,
  MessageCircle,
  MapPin,
  Send,
} from 'lucide-react';
import { FamilyMember, FamilyRole, RemoteAlarmEvent } from '../types';
import { formatTimeAgo } from '../utils/geo';

interface MemberManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  circleId: string;
  circleName: string;
  inviteCode: string;
  adminMemberId: string;
  members: Record<string, FamilyMember>;
  activeMemberId: string;
  activeAlarms?: Record<string, RemoteAlarmEvent>;
  onSelectActiveMember: (memberId: string) => void;
  onAddMember: (memberData: {
    name: string;
    role: FamilyRole;
    phone?: string;
    color: string;
    avatar: string;
  }) => Promise<void>;
  onUpdateMember: (
    memberId: string,
    updates: Partial<FamilyMember>
  ) => Promise<void>;
  onRemoveMember: (memberId: string) => Promise<void>;
  onTransferAdmin: (newAdminMemberId: string) => Promise<void>;
  onClearTestData?: () => Promise<void>;
  onLoadDemoData?: () => Promise<void>;
  onOpenQrModal?: () => void;
  onTriggerRemoteAlarm?: (memberId: string, memberName: string) => Promise<void>;
  onSilenceRemoteAlarm?: (memberId: string) => Promise<void>;
  onRequestLocation?: (memberId: string) => Promise<void>;
  onOpenChatWithMember?: (memberId: string) => void;
}

const AVATAR_PRESETS = [
  {
    name: 'Dad / Man',
    url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&h=256&q=80',
  },
  {
    name: 'Mom / Woman',
    url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=256&h=256&q=80',
  },
  {
    name: 'Daughter / Girl',
    url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=256&h=256&q=80',
  },
  {
    name: 'Son / Boy',
    url: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=256&h=256&q=80',
  },
  {
    name: 'Teenager',
    url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=256&h=256&q=80',
  },
  {
    name: 'Grandmother',
    url: 'https://images.unsplash.com/photo-1581579438747-1dc8d17bbce4?auto=format&fit=crop&w=256&h=256&q=80',
  },
  {
    name: 'Grandfather',
    url: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=256&h=256&q=80',
  },
  {
    name: 'Child / Kid',
    url: 'https://images.unsplash.com/photo-1543610892-0b1f7e6d8ac1?auto=format&fit=crop&w=256&h=256&q=80',
  },
];

const COLOR_PRESETS = [
  '#3b82f6', // Blue
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#ec4899', // Pink / Rose
  '#8b5cf6', // Purple
  '#06b6d4', // Cyan
  '#f97316', // Orange
];

export const MemberManagementModal: React.FC<MemberManagementModalProps> = ({
  isOpen,
  onClose,
  circleId,
  circleName,
  inviteCode,
  adminMemberId,
  members,
  activeMemberId,
  activeAlarms = {},
  onSelectActiveMember,
  onAddMember,
  onUpdateMember,
  onRemoveMember,
  onTransferAdmin,
  onClearTestData,
  onLoadDemoData,
  onOpenQrModal,
  onTriggerRemoteAlarm,
  onSilenceRemoteAlarm,
  onRequestLocation,
  onOpenChatWithMember,
}) => {
  const [activeTab, setActiveTab] = useState<'members' | 'add' | 'invite'>('members');
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Add Member State
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<FamilyRole>('Member');
  const [newPhone, setNewPhone] = useState('');
  const [newColor, setNewColor] = useState(COLOR_PRESETS[0]);
  const [newAvatar, setNewAvatar] = useState(AVATAR_PRESETS[0].url);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit Member State
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState<FamilyRole>('Member');
  const [editPhone, setEditPhone] = useState('');
  const [editColor, setEditColor] = useState('#3b82f6');
  const [editAvatar, setEditAvatar] = useState('');
  const [editSpeedThreshold, setEditSpeedThreshold] = useState<number>(10);

  // Delete & Remote Alarm Confirmation States
  const [memberToDelete, setMemberToDelete] = useState<FamilyMember | null>(null);
  const [confirmAlarmMember, setConfirmAlarmMember] = useState<FamilyMember | null>(null);
  const [isTriggeringAlarm, setIsTriggeringAlarm] = useState(false);

  if (!isOpen) return null;

  const memberList = Object.values(members);
  const isCurrentUserAdmin = activeMemberId === adminMemberId;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(inviteCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCopyLink = () => {
    const joinUrl = `${window.location.origin}/?circle=${encodeURIComponent(inviteCode || circleId)}`;
    navigator.clipboard.writeText(joinUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleStartEdit = (member: FamilyMember) => {
    setEditingMemberId(member.id);
    setEditName(member.name);
    setEditRole(member.role);
    setEditPhone(member.phone || '');
    setEditColor(member.color || '#3b82f6');
    setEditAvatar(member.avatar);
    setEditSpeedThreshold(member.speedLimitThresholdMph || 10);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMemberId || !editName.trim()) return;

    await onUpdateMember(editingMemberId, {
      name: editName.trim(),
      role: editRole,
      phone: editPhone.trim(),
      color: editColor,
      avatar: editAvatar,
      speedLimitThresholdMph: editSpeedThreshold,
    });

    setEditingMemberId(null);
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    setIsSubmitting(true);
    try {
      await onAddMember({
        name: newName.trim(),
        role: newRole,
        phone: newPhone.trim(),
        color: newColor,
        avatar: newAvatar,
      });

      setNewName('');
      setNewPhone('');
      setActiveTab('members');
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!memberToDelete) return;
    await onRemoveMember(memberToDelete.id);
    setMemberToDelete(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-3 sm:p-4 animate-in fade-in">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-xl rounded-3xl shadow-2xl text-slate-100 ring-1 ring-white/10 flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800/80 flex items-center justify-between bg-slate-900/90 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-white">Family Members</h3>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-semibold border border-indigo-500/30">
                  {memberList.length} {memberList.length === 1 ? 'Device' : 'Devices'}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {circleName} · Invite: <code className="text-indigo-400 font-mono">{inviteCode}</code>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 px-4 pt-2 gap-2 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('members')}
            className={`pb-2.5 px-3 flex items-center gap-1.5 border-b-2 transition ${
              activeTab === 'members'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Member Directory ({memberList.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('add')}
            className={`pb-2.5 px-3 flex items-center gap-1.5 border-b-2 transition ${
              activeTab === 'add'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <UserPlus className="w-4 h-4" />
            <span>+ Add Member / Device</span>
          </button>

          <button
            onClick={() => setActiveTab('invite')}
            className={`pb-2.5 px-3 flex items-center gap-1.5 border-b-2 transition ${
              activeTab === 'invite'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Share2 className="w-4 h-4" />
            <span>Invite Family</span>
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* TAB 1: Member Directory List */}
          {activeTab === 'members' && (
            <div className="space-y-3">
              {memberList.length === 0 ? (
                <div className="text-center py-10 px-4 bg-slate-950/40 border border-slate-800 rounded-3xl space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center mx-auto">
                    <Users className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold text-white">No members in circle yet</h4>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    This circle is fresh! Add yourself or family members using the &quot;Add Member&quot; tab or share your invite code.
                  </p>
                  <button
                    onClick={() => setActiveTab('add')}
                    className="mt-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white transition shadow"
                  >
                    + Add Your Device or Member
                  </button>
                </div>
              ) : (
                memberList.map((member) => {
                  const isThisDevice = member.id === activeMemberId;
                  const isAdmin = member.id === adminMemberId;
                  const isEditing = editingMemberId === member.id;
                  const isDriving = member.speedMph >= 15;

                  if (isEditing) {
                    return (
                      <form
                        key={member.id}
                        onSubmit={handleSaveEdit}
                        className="p-4 rounded-2xl bg-slate-950 border border-indigo-500/60 space-y-3 animate-in fade-in text-xs"
                      >
                        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                          <span className="font-bold text-white">Editing Member: {member.name}</span>
                          <button
                            type="button"
                            onClick={() => setEditingMemberId(null)}
                            className="p-1 text-slate-400 hover:text-white"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="text-slate-400 block mb-1">Display Name</label>
                            <input
                              type="text"
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                              required
                            />
                          </div>

                          <div>
                            <label className="text-slate-400 block mb-1">Family Role</label>
                            <select
                              value={editRole}
                              onChange={(e) => setEditRole(e.target.value as any)}
                              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none"
                            >
                              <option value="Admin">Circle Admin</option>
                              <option value="Parent">Parent</option>
                              <option value="Dad">Dad</option>
                              <option value="Mom">Mom</option>
                              <option value="Son">Son</option>
                              <option value="Daughter">Daughter</option>
                              <option value="Child">Child</option>
                              <option value="Teen">Teen Driver</option>
                              <option value="Grandparent">Grandparent</option>
                              <option value="Member">Family Member</option>
                            </select>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="text-slate-400 block mb-1">Phone Number (Optional)</label>
                            <input
                              type="text"
                              value={editPhone}
                              onChange={(e) => setEditPhone(e.target.value)}
                              placeholder="+1 (555) 000-0000"
                              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none"
                            />
                          </div>

                          <div>
                            <label className="text-slate-400 block mb-1">Speed Limit Alert (Over Limit)</label>
                            <select
                              value={editSpeedThreshold}
                              onChange={(e) => setEditSpeedThreshold(Number(e.target.value))}
                              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none"
                            >
                              <option value={5}>+5 mph over limit</option>
                              <option value={10}>+10 mph over limit</option>
                              <option value={15}>+15 mph over limit</option>
                              <option value={20}>+20 mph over limit</option>
                            </select>
                          </div>
                        </div>

                        {/* Color Picker */}
                        <div>
                          <label className="text-slate-400 block mb-1">Map Pin Color</label>
                          <div className="flex gap-2">
                            {COLOR_PRESETS.map((c) => (
                              <button
                                key={c}
                                type="button"
                                onClick={() => setEditColor(c)}
                                className={`w-7 h-7 rounded-full border-2 transition ${
                                  editColor === c ? 'border-white scale-110 shadow-lg' : 'border-transparent'
                                }`}
                                style={{ backgroundColor: c }}
                              />
                            ))}
                          </div>
                        </div>

                        <div className="flex gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => setEditingMemberId(null)}
                            className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            className="flex-1 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold shadow"
                          >
                            Save Changes
                          </button>
                        </div>
                      </form>
                    );
                  }

                  const isAlarmActive = Object.values(activeAlarms).some(
                    (a) => a.targetMemberId === member.id && a.status === 'active'
                  );

                  return (
                    <div
                      key={member.id}
                      className={`p-3.5 sm:p-4 rounded-2xl border transition flex flex-col gap-3 ${
                        isThisDevice
                          ? 'bg-slate-900/90 border-indigo-500/60 ring-1 ring-indigo-500/40 shadow-lg shadow-indigo-950/20'
                          : 'bg-slate-950/60 border-slate-800 hover:bg-slate-900/60'
                      }`}
                    >
                      {/* Top Row: Avatar, Identity & Settings */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div
                            className="relative w-12 h-12 rounded-full overflow-hidden shrink-0 ring-2"
                            style={{ borderColor: member.color || '#3b82f6' }}
                          >
                            <img
                              src={member.avatar}
                              alt={member.name}
                              className="w-full h-full object-cover"
                            />
                            {isDriving && (
                              <span className="absolute bottom-0 right-0 text-[10px]">🚗</span>
                            )}
                          </div>

                          <div className="overflow-hidden">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <h4 className="font-bold text-sm text-white truncate">{member.name}</h4>
                              <span
                                className="text-[10px] px-2 py-0.2 rounded-full font-semibold"
                                style={{
                                  backgroundColor: `${member.color || '#3b82f6'}20`,
                                  color: member.color || '#3b82f6',
                                }}
                              >
                                {member.role}
                              </span>
                              {isAdmin && (
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-semibold flex items-center gap-0.5">
                                  <Crown className="w-3 h-3 text-amber-400" />
                                  Admin
                                </span>
                              )}
                              {isThisDevice && (
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 font-semibold flex items-center gap-0.5">
                                  <Smartphone className="w-3 h-3 text-indigo-400" />
                                  You (This Phone)
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2 text-xs text-slate-400 mt-1 flex-wrap">
                              {/* Battery */}
                              <span className="flex items-center gap-1 text-[11px]">
                                {member.isCharging ? (
                                  <BatteryCharging className="w-3.5 h-3.5 text-emerald-400" />
                                ) : (
                                  <Battery className="w-3.5 h-3.5 text-slate-400" />
                                )}
                                <span>{member.battery}%</span>
                              </span>

                              <span className="text-slate-600">·</span>

                              {/* Speed or Location */}
                              <span className="text-[11px] truncate max-w-[160px]">
                                {member.speedMph > 0
                                  ? `${member.speedMph} mph (${isDriving ? 'driving' : 'walking'})`
                                  : member.location.placeName || 'Active'}
                              </span>

                              <span className="text-slate-600">·</span>

                              {/* Last seen */}
                              <span className="text-[11px] text-slate-500">
                                {formatTimeAgo(member.lastUpdated)}
                              </span>
                            </div>

                            {member.phone ? (
                              <p className="text-[11px] text-emerald-400 flex items-center gap-1 mt-0.5 font-mono">
                                <Phone className="w-3 h-3 text-emerald-500" />
                                <span>{member.phone}</span>
                              </p>
                            ) : (
                              <p className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                                <span>No phone number added</span>
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Top Right Quick Config */}
                        <div className="flex items-center gap-1 shrink-0">
                          {!isThisDevice && (
                            <button
                              onClick={() => onSelectActiveMember(member.id)}
                              className="px-2 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold transition"
                              title="Set this device's identity to this member"
                            >
                              Set as Me
                            </button>
                          )}

                          <button
                            onClick={() => handleStartEdit(member)}
                            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                            title="Edit profile &amp; phone number"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          {isCurrentUserAdmin && !isAdmin && (
                            <button
                              onClick={() => onTransferAdmin(member.id)}
                              className="p-1.5 rounded-xl bg-slate-800 hover:bg-amber-950/50 text-slate-400 hover:text-amber-400 transition"
                              title="Make this member Circle Admin"
                            >
                              <Crown className="w-3.5 h-3.5" />
                            </button>
                          )}

                          <button
                            onClick={() => setMemberToDelete(member)}
                            className="p-1.5 rounded-xl bg-slate-800 hover:bg-rose-950/60 text-slate-400 hover:text-rose-400 transition"
                            title="Remove member from circle"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Bottom Action Row: Cellular Call, SMS, Member Chat, Lost Device Alarm, Request GPS */}
                      <div className="pt-2 border-t border-slate-800/80 flex items-center gap-1.5 flex-wrap">
                        {/* Cellular Phone Call */}
                        {member.phone ? (
                          <a
                            href={`tel:${member.phone}`}
                            className="px-2.5 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/40 text-xs font-semibold flex items-center gap-1.5 transition active:scale-95 shadow-sm"
                            title={`Call ${member.name} directly via cellular phone`}
                          >
                            <Phone className="w-3.5 h-3.5" />
                            <span>Call</span>
                          </a>
                        ) : (
                          <button
                            onClick={() => handleStartEdit(member)}
                            className="px-2 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 text-xs flex items-center gap-1 transition"
                            title="Add phone number to call"
                          >
                            <Phone className="w-3.5 h-3.5 text-slate-500" />
                            <span>+ Add Phone</span>
                          </button>
                        )}

                        {/* Cellular SMS */}
                        {member.phone && (
                          <a
                            href={`sms:${member.phone}?&body=Hey%20${encodeURIComponent(member.name)},%20checking%20in%20with%20Orbit%20Family%20360!`}
                            className="px-2.5 py-1.5 rounded-xl bg-sky-600/20 hover:bg-sky-600/30 text-sky-400 border border-sky-500/40 text-xs font-semibold flex items-center gap-1.5 transition active:scale-95 shadow-sm"
                            title={`Send cellular text message to ${member.name}`}
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            <span>SMS</span>
                          </a>
                        )}

                        {/* Direct Member Chat */}
                        <button
                          onClick={() => {
                            if (onOpenChatWithMember) onOpenChatWithMember(member.id);
                            onClose();
                          }}
                          className="px-2.5 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 text-xs font-semibold flex items-center gap-1.5 transition active:scale-95 shadow-sm"
                          title="Open 1-on-1 or circle chat"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          <span>Chat</span>
                        </button>

                        {/* Ring Lost Phone / Piercing Siren */}
                        {isAlarmActive ? (
                          <button
                            onClick={() => onSilenceRemoteAlarm?.(member.id)}
                            className="px-2.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white animate-pulse text-xs font-black flex items-center gap-1.5 transition shadow-lg shadow-rose-950/60 ml-auto"
                            title="Alarm is currently sounding! Click to silence."
                          >
                            <Volume2 className="w-3.5 h-3.5" />
                            <span>Stop Siren</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => setConfirmAlarmMember(member)}
                            className="px-2.5 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-semibold flex items-center gap-1.5 transition active:scale-95 shadow-sm ml-auto"
                            title="Sound piercing full-volume alarm on this device to locate lost phone"
                          >
                            <BellRing className="w-3.5 h-3.5 text-amber-400" />
                            <span>Ring Phone</span>
                          </button>
                        )}

                        {/* Remote GPS Request */}
                        <button
                          onClick={() => {
                            onRequestLocation?.(member.id);
                            alert(`Sent high-priority location request to ${member.name}'s phone!`);
                          }}
                          className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition active:scale-95"
                          title="Send prompt to member phone to turn on GPS"
                        >
                          <MapPin className="w-3.5 h-3.5 text-sky-400" />
                          <span>Request GPS</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* TAB 2: Add Member Form */}
          {activeTab === 'add' && (
            <form onSubmit={handleAddSubmit} className="space-y-4 text-xs">
              <div className="p-3.5 rounded-2xl bg-indigo-950/30 border border-indigo-500/30 text-indigo-300">
                💡 Add family devices, children, teens, or grandparents directly to your circle.
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 block mb-1 font-medium">Full Name</label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="e.g., Chloe, Lucas, Grandma"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
                    required
                  />
                </div>

                <div>
                  <label className="text-slate-400 block mb-1 font-medium">Family Role</label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as any)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white focus:outline-none"
                  >
                    <option value="Dad">Dad</option>
                    <option value="Mom">Mom</option>
                    <option value="Parent">Parent</option>
                    <option value="Son">Son</option>
                    <option value="Daughter">Daughter</option>
                    <option value="Child">Child</option>
                    <option value="Teen">Teen Driver</option>
                    <option value="Grandparent">Grandparent</option>
                    <option value="Member">Family Member</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-slate-400 block mb-1 font-medium">Phone Number (Optional)</label>
                <input
                  type="text"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="+1 (555) 123-4567"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white placeholder:text-slate-500 focus:outline-none"
                />
              </div>

              {/* Avatar Presets */}
              <div>
                <label className="text-slate-400 block mb-1.5 font-medium">Choose Avatar</label>
                <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                  {AVATAR_PRESETS.map((preset) => (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() => setNewAvatar(preset.url)}
                      className={`relative rounded-2xl overflow-hidden aspect-square border-2 transition ${
                        newAvatar === preset.url
                          ? 'border-indigo-500 ring-2 ring-indigo-500/50 scale-105 shadow-md'
                          : 'border-slate-800 hover:border-slate-700 opacity-80 hover:opacity-100'
                      }`}
                      title={preset.name}
                    >
                      <img src={preset.url} alt={preset.name} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>

              {/* Map Pin Color */}
              <div>
                <label className="text-slate-400 block mb-1.5 font-medium">Map Accent Color</label>
                <div className="flex gap-2.5">
                  {COLOR_PRESETS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setNewColor(c)}
                      className={`w-8 h-8 rounded-full border-2 transition ${
                        newColor === c ? 'border-white scale-110 shadow-lg' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm shadow-lg transition active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <UserPlus className="w-4 h-4" />
                <span>{isSubmitting ? 'Adding Member...' : 'Add Member to Circle'}</span>
              </button>
            </form>
          )}

          {/* TAB 3: Invite Family */}
          {activeTab === 'invite' && (
            <div className="space-y-4 text-xs">
              <div className="p-4 rounded-3xl bg-slate-950 border border-slate-800 text-center space-y-3">
                <span className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">
                  Circle Invite Code
                </span>
                <div className="text-2xl sm:text-3xl font-black font-mono text-indigo-400 tracking-wider">
                  {inviteCode}
                </div>
                <div className="flex justify-center gap-2">
                  <button
                    onClick={handleCopyCode}
                    className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold flex items-center gap-1.5 shadow transition"
                  >
                    {copiedCode ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    <span>{copiedCode ? 'Copied Code!' : 'Copy Code'}</span>
                  </button>

                  <button
                    onClick={handleCopyLink}
                    className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold flex items-center gap-1.5 border border-slate-700 transition"
                  >
                    {copiedLink ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
                    <span>{copiedLink ? 'Copied Link!' : 'Copy Join Link'}</span>
                  </button>

                  {onOpenQrModal && (
                    <button
                      onClick={onOpenQrModal}
                      className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold flex items-center gap-1.5 border border-slate-700 transition"
                      title="Show QR Code for phone camera"
                    >
                      <QrCode className="w-4 h-4 text-indigo-400" />
                      <span className="hidden sm:inline">QR Code</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800 space-y-2">
                <h5 className="font-bold text-white flex items-center gap-2">
                  <Shield className="w-4 h-4 text-emerald-400" />
                  <span>How family members connect</span>
                </h5>
                <ol className="list-decimal list-inside space-y-1 text-slate-300 leading-relaxed text-[11px]">
                  <li>Share the join link or invite code with family members via SMS or WhatsApp.</li>
                  <li>They open the link on their iPhone or Samsung Galaxy browser.</li>
                  <li>They sign in with their Google account and tap &quot;Join Circle&quot;.</li>
                  <li>Their phone broadcasts real-time GPS coordinates directly to your map!</li>
                </ol>
              </div>
            </div>
          )}
        </div>

        {/* Footer: Demo Data & Fresh Start Controls */}
        <div className="p-3.5 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between gap-2 text-[11px] flex-wrap">
          <div className="flex items-center gap-2">
            {onClearTestData && (
              <button
                onClick={onClearTestData}
                className="px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:bg-rose-950/40 hover:border-rose-500/40 text-slate-400 hover:text-rose-300 transition flex items-center gap-1.5 font-medium"
                title="Wipe demo members and start fresh"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Start Fresh (Clear Test Data)</span>
              </button>
            )}

            {onLoadDemoData && (
              <button
                onClick={onLoadDemoData}
                className="px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:bg-indigo-950/40 hover:border-indigo-500/40 text-slate-400 hover:text-indigo-300 transition flex items-center gap-1.5 font-medium"
                title="Load 4 sample family members for demonstration"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Load Demo Family (4 Members)</span>
              </button>
            )}
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold ml-auto"
          >
            Done
          </button>
        </div>

        {/* Remote Alarm Confirmation Modal Overlay */}
        {confirmAlarmMember && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in">
            <div className="bg-slate-900 border-2 border-amber-400 max-w-sm w-full rounded-3xl p-5 shadow-2xl text-center space-y-3.5 ring-4 ring-amber-400/20">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-400/40 text-amber-300 flex items-center justify-center mx-auto">
                <BellRing className="w-7 h-7 animate-bounce" />
              </div>
              <h4 className="font-extrabold text-white text-base">Sound Piercing Alarm?</h4>
              <p className="text-xs text-amber-200 font-medium">
                Target Device: <strong className="text-white">{confirmAlarmMember.name}</strong>
              </p>
              <p className="text-[11px] text-slate-300 leading-relaxed px-1">
                This will trigger an acoustic high-pitch siren and vibration at maximum digital volume on their phone even if set to low volume or silent mode.
              </p>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setConfirmAlarmMember(null)}
                  disabled={isTriggeringAlarm}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isTriggeringAlarm}
                  onClick={async () => {
                    if (onTriggerRemoteAlarm && confirmAlarmMember) {
                      setIsTriggeringAlarm(true);
                      try {
                        await onTriggerRemoteAlarm(confirmAlarmMember.id, confirmAlarmMember.name);
                        setConfirmAlarmMember(null);
                      } finally {
                        setIsTriggeringAlarm(false);
                      }
                    }
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black shadow-lg flex items-center justify-center gap-1.5"
                >
                  <BellRing className="w-4 h-4" />
                  <span>{isTriggeringAlarm ? 'Triggering...' : 'Ring Alarm Now'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal Overlay */}
        {memberToDelete && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="bg-slate-900 border border-rose-500/50 max-w-sm w-full rounded-3xl p-5 shadow-2xl text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h4 className="font-bold text-white text-base">Remove Member?</h4>
              <p className="text-xs text-slate-300 leading-relaxed">
                Are you sure you want to remove <strong>{memberToDelete.name}</strong> from this circle?
                Their location tracking and history will be disconnected.
              </p>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setMemberToDelete(null)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow"
                >
                  Yes, Remove
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
