import React from 'react';
import {
  Bell,
  MessageSquare,
  AlertOctagon,
  BellRing,
  Gauge,
  MapPin,
  Check,
  Trash2,
  X,
  ExternalLink,
  ChevronRight,
  Clock,
} from 'lucide-react';
import { AppNotification } from '../types';

interface NotificationCenterDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: AppNotification[];
  maxNotifications: number;
  onSelectNotification: (notification: AppNotification) => void;
  onMarkAllAsRead: () => void;
  onClearAll: () => void;
  onOpenSettings: () => void;
}

export const NotificationCenterDropdown: React.FC<NotificationCenterDropdownProps> = ({
  isOpen,
  onClose,
  notifications,
  maxNotifications,
  onSelectNotification,
  onMarkAllAsRead,
  onClearAll,
  onOpenSettings,
}) => {
  if (!isOpen) return null;

  const formatTimeAgo = (timestamp: number) => {
    const diffSeconds = Math.floor((Date.now() - timestamp) / 1000);
    if (diffSeconds < 60) return 'Just now';
    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${Math.floor(diffHours / 24)}d ago`;
  };

  const getNotificationIcon = (type: AppNotification['type']) => {
    switch (type) {
      case 'chat':
        return <MessageSquare className="w-4 h-4 text-indigo-400" />;
      case 'alarm':
        return <BellRing className="w-4 h-4 text-amber-400 animate-bounce" />;
      case 'sos':
        return <AlertOctagon className="w-4 h-4 text-rose-400 animate-pulse" />;
      case 'speed':
        return <Gauge className="w-4 h-4 text-amber-400" />;
      case 'geofence':
        return <MapPin className="w-4 h-4 text-emerald-400" />;
      default:
        return <Bell className="w-4 h-4 text-sky-400" />;
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;
  const displayedNotifications = notifications.slice(0, maxNotifications);

  return (
    <div className="absolute top-12 right-12 sm:right-14 w-80 sm:w-96 rounded-3xl bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 shadow-2xl z-50 animate-in fade-in slide-in-from-top-2 text-xs ring-1 ring-white/10 overflow-hidden">
      {/* Header */}
      <div className="p-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
            <Bell className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h4 className="font-bold text-white text-xs">Notifications</h4>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[9px] font-black bg-rose-500/20 text-rose-300 border border-rose-500/40">
                  {unreadCount} new
                </span>
              )}
            </div>
            <p className="text-[10px] text-slate-400">
              Showing last {displayedNotifications.length} of max {maxNotifications}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {unreadCount > 0 && (
            <button
              onClick={onMarkAllAsRead}
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-emerald-400 transition"
              title="Mark all as read"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
          )}
          {notifications.length > 0 && (
            <button
              onClick={onClearAll}
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-rose-400 transition"
              title="Clear all notifications"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Notifications List */}
      <div className="max-h-80 overflow-y-auto divide-y divide-slate-800/60">
        {displayedNotifications.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            <Bell className="w-8 h-8 text-slate-600 mx-auto mb-2 opacity-60" />
            <p className="font-medium text-xs text-slate-300">No notifications yet</p>
            <p className="text-[11px] text-slate-500 mt-1">
              Chat messages, safety alerts, speed warnings, and place arrivals will appear here.
            </p>
          </div>
        ) : (
          displayedNotifications.map((n) => (
            <div
              key={n.id}
              onClick={() => onSelectNotification(n)}
              className={`p-3 transition cursor-pointer flex items-start gap-2.5 hover:bg-slate-800/70 ${
                !n.read ? 'bg-indigo-950/20' : 'bg-transparent'
              }`}
            >
              <div className="mt-0.5 p-1.5 rounded-xl bg-slate-800 border border-slate-700/60 shrink-0">
                {getNotificationIcon(n.type)}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1.5">
                  <span className={`font-semibold text-xs truncate ${!n.read ? 'text-white' : 'text-slate-300'}`}>
                    {n.title}
                  </span>
                  <span className="text-[10px] text-slate-500 shrink-0 flex items-center gap-0.5">
                    <Clock className="w-2.5 h-2.5" />
                    {formatTimeAgo(n.timestamp)}
                  </span>
                </div>

                <p className="text-[11px] text-slate-400 line-clamp-2 mt-0.5 leading-snug">
                  {n.message}
                </p>

                {n.actionType && (
                  <div className="flex items-center gap-1 mt-1 text-[10px] text-indigo-400 font-semibold">
                    <span>Tap to view {n.actionType}</span>
                    <ChevronRight className="w-3 h-3" />
                  </div>
                )}
              </div>

              {!n.read && (
                <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0 mt-2" />
              )}
            </div>
          ))
        )}
      </div>

      {/* Footer with settings link */}
      <div className="p-2.5 border-t border-slate-800 bg-slate-950/40 flex items-center justify-between text-[11px]">
        <span className="text-slate-500">
          Limit: {maxNotifications} notifications
        </span>
        <button
          onClick={() => {
            onClose();
            onOpenSettings();
          }}
          className="text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1"
        >
          <span>Change limit in Settings</span>
          <ExternalLink className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
};
