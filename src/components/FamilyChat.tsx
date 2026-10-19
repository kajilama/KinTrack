import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  MapPin,
  CheckCircle,
  Navigation,
  AlertTriangle,
  X,
  MessageSquare,
  Phone,
  MessageCircle,
  Users,
  Smartphone,
  Battery,
  BatteryCharging,
} from 'lucide-react';
import { ChatMessage, FamilyMember } from '../types';
import { apiFetch } from '../utils/apiConfig';

interface FamilyChatProps {
  chat: ChatMessage[];
  currentMember: FamilyMember;
  members?: Record<string, FamilyMember>;
  initialTargetMemberId?: string | null;
  onSendMessage: (text: string, type?: 'text' | 'checkin' | 'location', locationData?: any, recipientMemberId?: string) => void;
  onClose?: () => void;
  onLocateMember?: (lat: number, lng: number) => void;
}

export const FamilyChat: React.FC<FamilyChatProps> = ({
  chat,
  currentMember,
  members = {},
  initialTargetMemberId = null,
  onSendMessage,
  onClose,
  onLocateMember,
}) => {
  const [inputText, setInputText] = useState('');
  // 'all' for circle wide chat, or memberId for 1-on-1 direct chat
  const [selectedRecipientId, setSelectedRecipientId] = useState<string>(initialTargetMemberId || 'all');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialTargetMemberId) {
      setSelectedRecipientId(initialTargetMemberId);
    }
  }, [initialTargetMemberId]);

  const memberList = Object.values(members).filter((m) => m.id !== currentMember.id);
  const activeChatPartner = selectedRecipientId !== 'all' ? members[selectedRecipientId] : null;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chat, selectedRecipientId]);

  // Filter messages for current view
  const visibleMessages = chat.filter((msg) => {
    if (selectedRecipientId === 'all') {
      return !msg.recipientMemberId; // Circle wide group messages
    } else {
      // 1-on-1 direct messages between currentMember and activeChatPartner
      return (
        (msg.memberId === currentMember.id && msg.recipientMemberId === selectedRecipientId) ||
        (msg.memberId === selectedRecipientId && msg.recipientMemberId === currentMember.id)
      );
    }
  });

  const handleSend = () => {
    if (!inputText.trim()) return;
    onSendMessage(
      inputText.trim(),
      'text',
      undefined,
      selectedRecipientId !== 'all' ? selectedRecipientId : undefined
    );
    setInputText('');
  };

  const sendQuickCheckin = (text: string) => {
    onSendMessage(
      text,
      'checkin',
      undefined,
      selectedRecipientId !== 'all' ? selectedRecipientId : undefined
    );
  };

  const [isSharingCheckin, setIsSharingCheckin] = useState(false);

  const handleCheckInArrivedSafely = async () => {
    setIsSharingCheckin(true);
    const loc = currentMember.location;
    let place = loc?.address || loc?.placeName || loc?.roadName;

    // If place name is missing or generic, fetch reverse geocoded street address
    if ((!place || place === 'Current Location' || place === 'Home') && loc && loc.lat && loc.lng) {
      try {
        const res = await apiFetch(`/api/reverse-geocode?lat=${loc.lat}&lng=${loc.lng}`);
        if (res.ok) {
          const data = await res.json();
          if (data.address) {
            place = data.address;
          }
        }
      } catch (err) {
        console.warn('Could not reverse geocode address:', err);
      }
    }

    const resolvedAddress = place || (loc ? `${loc.lat.toFixed(4)}, ${loc.lng.toFixed(4)}` : 'Current Location');
    const batteryInfo = currentMember.battery !== undefined ? ` • 🔋 ${currentMember.battery}%` : '';
    const text = `✅ Arrived safely at ${resolvedAddress}${batteryInfo}`;

    onSendMessage(
      text,
      'checkin',
      loc ? {
        lat: loc.lat,
        lng: loc.lng,
        name: resolvedAddress,
      } : undefined,
      selectedRecipientId !== 'all' ? selectedRecipientId : undefined
    );

    setIsSharingCheckin(false);
  };

  const shareMyLocation = () => {
    onSendMessage(
      `📍 Shared my live location: ${currentMember.location?.placeName || currentMember.location?.address || 'Current GPS coordinates'}`,
      'location',
      {
        lat: currentMember.location?.lat || 37.7749,
        lng: currentMember.location?.lng || -122.4194,
        name: currentMember.location?.placeName || 'Current Location',
      },
      selectedRecipientId !== 'all' ? selectedRecipientId : undefined
    );
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden ring-1 ring-white/10">
      {/* Header */}
      <div className="p-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-900/95 backdrop-blur-md">
        <div className="flex items-center gap-3 overflow-hidden">
          {activeChatPartner ? (
            <div className="relative shrink-0">
              <img
                src={activeChatPartner.avatar}
                alt={activeChatPartner.name}
                className="w-10 h-10 rounded-full object-cover ring-2 ring-indigo-500"
              />
              <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-400 ring-2 ring-slate-900" />
            </div>
          ) : (
            <div className="w-10 h-10 rounded-2xl bg-indigo-600/30 border border-indigo-500/50 flex items-center justify-center text-indigo-400 shrink-0">
              <Users className="w-5 h-5" />
            </div>
          )}

          <div className="truncate">
            <h3 className="font-bold text-sm text-white truncate">
              {activeChatPartner ? activeChatPartner.name : 'Family Circle Group'}
            </h3>
            <p className="text-[11px] text-slate-400 truncate flex items-center gap-1.5">
              {activeChatPartner ? (
                <>
                  <span className="text-indigo-400 font-semibold">{activeChatPartner.role}</span>
                  <span>·</span>
                  <span>{activeChatPartner.location?.placeName || 'Active'}</span>
                </>
              ) : (
                <span>Posting as <strong className="text-indigo-400 font-semibold">{currentMember.name}</strong></span>
              )}
            </p>
          </div>
        </div>

        {/* Right Header Actions: Cellular Call & SMS buttons for member */}
        <div className="flex items-center gap-1.5 shrink-0">
          {activeChatPartner && (
            <>
              {activeChatPartner.phone ? (
                <>
                  <a
                    href={`tel:${activeChatPartner.phone}`}
                    className="p-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/40 transition flex items-center gap-1 text-xs font-semibold"
                    title={`Call ${activeChatPartner.name} via cellular line (${activeChatPartner.phone})`}
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Call</span>
                  </a>

                  <a
                    href={`sms:${activeChatPartner.phone}?&body=Hey%20${encodeURIComponent(activeChatPartner.name)},%20checking%20in%20with%20Orbit%20Family%20360!`}
                    className="p-2 rounded-xl bg-sky-600/20 hover:bg-sky-600/30 text-sky-400 border border-sky-500/40 transition flex items-center gap-1 text-xs font-semibold"
                    title={`Send cellular SMS to ${activeChatPartner.name}`}
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">SMS</span>
                  </a>
                </>
              ) : (
                <button
                  onClick={() => alert(`To make a cellular phone call or send SMS to ${activeChatPartner.name}, edit their profile in Members to add their phone number.`)}
                  className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-slate-200 text-[11px] border border-slate-700 flex items-center gap-1"
                  title="No cellular phone registered yet"
                >
                  <Phone className="w-3.5 h-3.5 text-slate-500" />
                  <span className="hidden sm:inline">Add Phone</span>
                </button>
              )}
            </>
          )}

          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Recipient Channel Selector: Group Chat vs Direct Member DMs */}
      {memberList.length > 0 && (
        <div className="px-3 py-1.5 bg-slate-950/60 border-b border-slate-800 flex items-center gap-1.5 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setSelectedRecipientId('all')}
            className={`px-2.5 py-1 rounded-xl text-xs font-semibold transition shrink-0 flex items-center gap-1.5 ${
              selectedRecipientId === 'all'
                ? 'bg-indigo-600 text-white shadow'
                : 'bg-slate-800/80 text-slate-400 hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Circle (Everyone)</span>
          </button>

          {memberList.map((m) => {
            const isSelected = selectedRecipientId === m.id;
            return (
              <button
                key={m.id}
                onClick={() => setSelectedRecipientId(m.id)}
                className={`px-2.5 py-1 rounded-xl text-xs font-semibold transition shrink-0 flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-indigo-600 text-white shadow'
                    : 'bg-slate-800/80 text-slate-400 hover:text-white'
                }`}
              >
                <img src={m.avatar} alt={m.name} className="w-3.5 h-3.5 rounded-full object-cover" />
                <span>{m.name.split(' ')[0]}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Quick Check-in Chips */}
      <div className="px-3 py-2 bg-slate-950/40 border-b border-slate-800 flex gap-2 overflow-x-auto scrollbar-none">
        <button
          onClick={() => sendQuickCheckin('I arrived safely! ❤️')}
          className="px-2.5 py-1 rounded-xl bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 text-xs font-medium whitespace-nowrap hover:bg-emerald-900/50 transition flex items-center gap-1 active:scale-95"
        >
          <CheckCircle className="w-3 h-3 text-emerald-400" />
          Arrived safely
        </button>

        <button
          onClick={() => sendQuickCheckin('On my way home! (ETA 15m) 🚗')}
          className="px-2.5 py-1 rounded-xl bg-sky-950/60 border border-sky-500/30 text-sky-300 text-xs font-medium whitespace-nowrap hover:bg-sky-900/50 transition flex items-center gap-1 active:scale-95"
        >
          <Navigation className="w-3 h-3 text-sky-400" />
          Driving home
        </button>

        <button
          onClick={shareMyLocation}
          className="px-2.5 py-1 rounded-xl bg-indigo-950/60 border border-indigo-500/30 text-indigo-300 text-xs font-medium whitespace-nowrap hover:bg-indigo-900/50 transition flex items-center gap-1 active:scale-95"
        >
          <MapPin className="w-3 h-3 text-indigo-400" />
          Share Live Pin
        </button>
      </div>

      {/* Messages Feed */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {visibleMessages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-2.5 text-slate-400">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
              <MessageSquare className="w-5 h-5" />
            </div>
            <h4 className="text-xs font-bold text-white">
              {activeChatPartner ? `No direct messages with ${activeChatPartner.name} yet` : 'No circle messages yet'}
            </h4>
            <p className="text-[11px] max-w-xs leading-relaxed">
              {activeChatPartner
                ? `Send a private direct check-in, share your live GPS pin, or use cellular Call/SMS above!`
                : 'This is your family private group chat. Send a quick check-in or share your live GPS pin to get started!'}
            </p>
          </div>
        ) : (
          visibleMessages.map((msg) => {
            const isMe = msg.memberId === currentMember.id;
            const isSos = msg.type === 'sos';

            return (
              <div
                key={msg.id}
                className={`flex items-start gap-2.5 ${isMe ? 'flex-row-reverse' : ''}`}
              >
                {!isMe && (
                  <img
                    src={msg.memberAvatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=64&h=64&q=80'}
                    alt={msg.memberName}
                    className="w-8 h-8 rounded-full object-cover shrink-0 ring-1 ring-slate-700"
                  />
                )}

                <div
                  className={`max-w-[78%] rounded-2xl p-3 shadow-md ${
                    isSos
                      ? 'bg-rose-950/80 border border-rose-500/60 text-rose-200'
                      : isMe
                      ? 'bg-indigo-600 text-white rounded-tr-none'
                      : 'bg-slate-800 text-slate-100 rounded-tl-none border border-slate-700/60'
                  }`}
                >
                  {!isMe && (
                    <p className="text-[10px] font-semibold text-slate-400 mb-0.5">
                      {msg.memberName}
                    </p>
                  )}

                  {isSos && (
                    <div className="flex items-center gap-1.5 text-xs font-bold text-rose-400 mb-1">
                      <AlertTriangle className="w-4 h-4 animate-bounce" />
                      <span>EMERGENCY ALERT</span>
                    </div>
                  )}

                  <p className="text-xs leading-relaxed">{msg.text}</p>

                  {msg.locationData && onLocateMember && (
                    <button
                      onClick={() =>
                        onLocateMember(msg.locationData!.lat, msg.locationData!.lng)
                      }
                      className="mt-2 py-1 px-2.5 rounded-lg bg-black/30 hover:bg-black/50 text-[11px] font-medium text-sky-300 flex items-center gap-1.5 transition"
                    >
                      <MapPin className="w-3.5 h-3.5" />
                      View on Map
                    </button>
                  )}

                  <span
                    className={`text-[9px] block text-right mt-1 ${
                      isMe ? 'text-indigo-200' : 'text-slate-400'
                    }`}
                  >
                    {new Date(msg.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 1-Tap Quick Action Row */}
      <div className="px-3 py-2 bg-slate-950/70 border-t border-slate-800 flex items-center gap-2 overflow-x-auto scrollbar-none">
        <button
          onClick={handleCheckInArrivedSafely}
          disabled={isSharingCheckin}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600/30 hover:bg-emerald-600/40 border border-emerald-500/50 text-emerald-300 text-xs font-bold transition shrink-0 active:scale-95 shadow-sm disabled:opacity-50"
          title="Share current address and announce safe arrival without typing"
        >
          <CheckCircle className={`w-3.5 h-3.5 text-emerald-400 ${isSharingCheckin ? 'animate-spin' : ''}`} />
          <span>{isSharingCheckin ? 'Sending Address...' : '✅ Arrived Safely (+ Address)'}</span>
        </button>

        <button
          onClick={shareMyLocation}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-medium transition shrink-0 active:scale-95 shadow-sm"
          title="Send real-time map pin"
        >
          <MapPin className="w-3.5 h-3.5 text-indigo-400" />
          <span>Share Pin</span>
        </button>

        <button
          onClick={() => sendQuickCheckin("👍 I'm all good!")}
          className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-medium transition shrink-0 active:scale-95 whitespace-nowrap"
        >
          👍 All good!
        </button>
      </div>

      {/* Input bar */}
      <div className="p-3 bg-slate-900 border-t border-slate-800 flex items-center gap-2">
        <input
          type="text"
          placeholder={
            activeChatPartner
              ? `Message ${activeChatPartner.name.split(' ')[0]}...`
              : 'Message family circle...'
          }
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSend();
          }}
          className="flex-1 bg-slate-800/80 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
        />
        <button
          onClick={handleSend}
          disabled={!inputText.trim()}
          className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:hover:bg-indigo-600 text-white transition shrink-0 shadow"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
