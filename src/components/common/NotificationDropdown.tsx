import React from 'react';
import { useRealtime } from '../../context/RealtimeContext';
import { Bell, CheckCheck, Clock, ShoppingBag, Receipt, PhoneCall } from 'lucide-react';

interface NotificationDropdownProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NotificationDropdown: React.FC<NotificationDropdownProps> = ({ isOpen, onClose }) => {
  const { notifications, unreadCount, markAsRead, markAllRead } = useRealtime();

  if (!isOpen) return null;

  const getIcon = (type: string) => {
    switch (type) {
      case 'ORDER_NEW':
        return <ShoppingBag className="w-4 h-4 text-emerald-600" />;
      case 'BILL_REQUESTED':
        return <Receipt className="w-4 h-4 text-amber-600" />;
      case 'CALL_SERVER':
        return <PhoneCall className="w-4 h-4 text-blue-600" />;
      default:
        return <Bell className="w-4 h-4 text-slate-500" />;
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute right-0 top-12 w-80 md:w-96 bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-amber-400" />
            <h4 className="font-semibold text-sm">Notifications en direct</h4>
            {unreadCount > 0 && (
              <span className="bg-amber-500 text-slate-950 font-bold text-xs px-2 py-0.5 rounded-full">
                {unreadCount}
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="text-xs text-slate-300 hover:text-white flex items-center gap-1 transition"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              Tout lire
            </button>
          )}
        </div>

        <div className="max-h-96 overflow-y-auto divide-y divide-slate-100">
          {notifications.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              Aucune notification récente.
            </div>
          ) : (
            notifications.map((notif) => (
              <div
                key={notif.id}
                onClick={() => markAsRead(notif.id)}
                className={`p-3.5 flex gap-3 cursor-pointer transition ${
                  notif.is_read ? 'bg-white hover:bg-slate-50' : 'bg-amber-50/60 hover:bg-amber-50'
                }`}
              >
                <div className="mt-0.5 shrink-0 p-2 rounded-xl bg-slate-100">
                  {getIcon(notif.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <p className={`text-xs font-semibold ${notif.is_read ? 'text-slate-800' : 'text-slate-950'}`}>
                      {notif.title}
                    </p>
                    <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
                      <Clock className="w-3 h-3" />
                      {new Date(notif.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 line-clamp-2">{notif.message}</p>
                </div>
                {!notif.is_read && (
                  <span className="w-2 h-2 rounded-full bg-amber-500 mt-2 shrink-0" />
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
};
