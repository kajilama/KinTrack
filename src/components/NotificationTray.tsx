import React from 'react';
import {
  Bell,
  X,
  MessageSquare,
  BellRing,
  Gauge,
  MapPin,
  AlertOctagon,
  Navigation,
  CheckCheck,
  Trash2,
  Settings,
  ChevronRight,
} from 'lucide-react';
import { AppNotification } from '../types';
import { formatTimeAgo } from '../utils/geo';

interface NotificationTrayProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: AppNotification[];
  onClearAll: () => void;
  onMarkAllRead: () => void;
  onSelectNotification: (notif: AppNotification) => void;
  maxStored: number;
  onOpenSettings?: () => void;
}

export const NotificationTray: React.FC<NotificationTrayProps> = ({
  isOpen,
  onClose,
  notifications,
  onClearAll,
  onMarkAllRead,
  onSelectNotification,
  maxStored,
  onOpenSettings,
}) => {
  if (!isOpen) return null;

  const unreadCount = notifications.filter((n) => !n.read).length;

  const getIcon = (type: AppNotification['type']) => {
    switch (type) {
      case 'chat':
        return <MessageSquare className="w-4 h-4 text-sky-400" />;
      case 'alarm':
        return <BellRing className="w-4 h-4 text-rose-400 animate-pulse" />;
      case 'speed':
        return <Gauge className="w-4 h-4 text-amber-400" />;
      case 'geofence':
        return <MapPin className="w-4 h-4 text-emerald-400" />;
      case 'sos':
        return <AlertOctagon className="w-4 h-4 text-rose-500 animate-bounce" />;
      case 'location_request':
        return <Navigation className="w-4 h-4 text-indigo-400" />;
      default:
        return <Bell className="w-4 h-4 text-slate-400" />;
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]"
        onClick={onClose}
      />

      {/* Notification Dropdown Container */}
      <div className="absolute top-12 right-12 sm:right-14 w-80 sm:w-96 rounded-3xl bg-slate-900/98 backdrop-blur-xl border border-slate-700/80 shadow-2xl p-3 z-50 animate-in fade-in slide-in-from-top-2 text-xs ring-1 ring-white/10 max-h-[82vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-2.5 border-b border-slate-800 px-1">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-xl bg-indigo-500/20 text-indigo-400">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="font-bold text-sm text-white">Notifications</h3>
                {unreadCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-rose-500 text-white">
                    {unreadCount} new
                  </span>
                )}
              </div>
              <p className="text-[10px] text-slate-400">
                Holding last {maxStored} alerts • Configurable in Settings
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <button
                onClick={onMarkAllRead}
                className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition"
                title="Mark all as read"
              >
                <CheckCheck className="w-4 h-4 text-emerald-400" />
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
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Notifications Scroll List */}
        <div className="py-2 overflow-y-auto space-y-1.5 pr-0.5 flex-1 max-h-[55vh]">
          {notifications.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs space-y-1">
              <Bell className="w-8 h-8 text-slate-600 mx-auto stroke-1 mb-2" />
              <p className="font-medium text-slate-300">No notifications yet</p>
              <p className="text-[11px] text-slate-500">
                Chat messages, speed warnings, arrivals, and alarms will appear here.
              </p>
            </div>
          ) : (
            notifications.map((notif) => (
              <div
                key={notif.id}
                onClick={() => onSelectNotification(notif)}
                className={`p-2.5 rounded-2xl border transition cursor-pointer flex items-start gap-2.5 group ${
                  !notif.read
                    ? 'bg-slate-800/80 border-indigo-500/40 hover:bg-slate-800'
                    : 'bg-slate-950/60 border-slate-800/80 hover:bg-slate-800/50'
                }`}
              >
                {/* Type Icon */}
                <div className="p-2 rounded-xl bg-slate-900 border border-slate-700/60 shrink-0 mt-0.5">
                  {getIcon(notif.type)}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <span
                      className={`text-xs block truncate ${
                        !notif.read ? 'font-bold text-white' : 'font-semibold text-slate-300'
                      }`}
                    >
                      {notif.title}
                    </span>
                    <span className="text-[10px] text-slate-500 shrink-0">
                      {formatTimeAgo(notif.timestamp)}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-400 line-clamp-2 mt-0.5 leading-relaxed">
                    {notif.message}
                  </p>
                </div>

                <ChevronRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-300 shrink-0 mt-2 transition" />
              </div>
            ))
          )}
        </div>

        {/* Footer info & link to settings */}
        <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400 px-1">
          <span>
            {notifications.length} of {maxStored} saved
          </span>

          {onOpenSettings && (
            <button
              onClick={() => {
                onClose();
                onOpenSettings();
              }}
              className="text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1 transition"
            >
              <Settings className="w-3 h-3" />
              <span>Change Limit</span>
            </button>
          )}
        </div>
      </div>
    </>
  );
};
