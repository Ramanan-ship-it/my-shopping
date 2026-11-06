import React, { useState, useEffect } from 'react';
import { Bell, CheckCircle2, AlertTriangle, Clock, RefreshCw, X } from 'lucide-react';
import { api } from '../../services/api';
import { Notification } from '../../types';
import { Badge } from './Badge';

interface NotificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onCountChange?: (count: number) => void;
}

export const NotificationDrawer: React.FC<NotificationDrawerProps> = ({
  isOpen,
  onClose,
  onCountChange,
}) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [triggering, setTriggering] = useState<boolean>(false);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const res = await api.notifications.getAll();
      setNotifications(res.notifications || []);
      setUnreadCount(res.unread_count || 0);
      onCountChange?.(res.unread_count || 0);
    } catch (err) {
      console.error('Failed to load notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen]);

  const handleMarkRead = async (id: string) => {
    try {
      await api.notifications.markRead(id);
      setNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, is_read: 1 } : n))
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
      onCountChange?.(Math.max(0, unreadCount - 1));
    } catch (err) {
      console.error('Failed to mark read:', err);
    }
  };

  const handleTriggerReminders = async () => {
    try {
      setTriggering(true);
      await api.notifications.triggerReminders();
      await fetchNotifications();
    } catch (err) {
      console.error('Failed to trigger reminder scan:', err);
    } finally {
      setTriggering(false);
    }
  };

  if (!isOpen) return null;

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'low_stock':
        return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      case 'payment_overdue':
      case 'payment_due':
        return <Clock className="w-4 h-4 text-rose-500" />;
      default:
        return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden no-print">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />

      <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col">
          {/* Header */}
          <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-950/50">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-lg">
                <Bell className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-base">
                  Notifications & Alerts
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {unreadCount} unread alert{unreadCount === 1 ? '' : 's'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleTriggerReminders}
                disabled={triggering}
                title="Scan database for credit dues and low stock"
                className="p-1.5 text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${triggering ? 'animate-spin text-emerald-500' : ''}`} />
              </button>
              <button
                onClick={onClose}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {loading ? (
              <div className="py-12 text-center text-slate-400 text-sm">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-500" />
                Checking alerts...
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-16 text-center">
                <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-3 text-slate-400">
                  <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                </div>
                <h4 className="font-semibold text-slate-900 dark:text-white text-sm">All caught up!</h4>
                <p className="text-xs text-slate-500 mt-1">No alerts or low stock warnings pending.</p>
              </div>
            ) : (
              notifications.map(notif => (
                <div
                  key={notif.id}
                  className={`p-3.5 rounded-xl border transition-all ${
                    notif.is_read
                      ? 'bg-slate-50/60 dark:bg-slate-800/40 border-slate-200/60 dark:border-slate-800/60 opacity-75'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {getTypeIcon(notif.type)}
                      <span className="font-semibold text-xs text-slate-900 dark:text-white">
                        {notif.title}
                      </span>
                    </div>
                    {!notif.is_read && (
                      <button
                        onClick={() => handleMarkRead(notif.id)}
                        className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium hover:underline"
                      >
                        Mark read
                      </button>
                    )}
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-1.5 leading-relaxed">
                    {notif.message}
                  </p>

                  <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-400">
                    <span>{new Date(notif.created_at).toLocaleDateString()}</span>
                    <Badge variant={notif.type === 'low_stock' ? 'amber' : notif.type.includes('payment') ? 'rose' : 'emerald'} size="sm">
                      {notif.type.replace('_', ' ')}
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
