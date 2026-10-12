/**
 * RealtimeContext - BarLounge SaaS
 * Listens to Realtime Broadcast events, manages notification state and alert audio
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { subscribeToRealtime, RealtimeEventPayload, dbEngine } from '../lib/dbEngine';
import { AppNotification } from '../types/database';
import { useAuth } from './AuthContext';

interface RealtimeContextType {
  unreadCount: number;
  notifications: AppNotification[];
  latestBanner: { title: string; message: string; type: string } | null;
  clearBanner: () => void;
  markAsRead: (notifId: string) => void;
  markAllRead: () => void;
  playChime: () => void;
  lastEventTimestamp: number;
}

const RealtimeContext = createContext<RealtimeContextType | undefined>(undefined);

// Web Audio synthesizer for pleasant alerts
function playSoundAlert(type: 'order' | 'bell' | 'cash') {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    
    if (type === 'order') {
      // Two-tone rising chime (order incoming)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.12); // A5
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    } else if (type === 'bell') {
      // Bell ding (addition or call)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(783.99, ctx.currentTime); // G5
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.8);
    } else {
      // Soft click
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, ctx.currentTime);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    }
  } catch (e) {
    // Audio Context might be locked prior to user interaction
  }
}

export const RealtimeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentRestaurant, currentUser } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [latestBanner, setLatestBanner] = useState<{ title: string; message: string; type: string } | null>(null);
  const [lastEventTimestamp, setLastEventTimestamp] = useState<number>(Date.now());

  const refreshNotifications = useCallback(() => {
    if (!currentRestaurant) return;
    const list = dbEngine.getNotifications(currentRestaurant.id, currentUser?.id);
    setNotifications(list);
    setUnreadCount(list.filter((n) => !n.is_read).length);
  }, [currentRestaurant, currentUser]);

  useEffect(() => {
    refreshNotifications();
  }, [refreshNotifications]);

  useEffect(() => {
    const unsubscribe = subscribeToRealtime((payload: RealtimeEventPayload) => {
      setLastEventTimestamp(Date.now());
      refreshNotifications();

      // Trigger alerts for staff
      if (payload.type === 'ORDER_CREATED') {
        playSoundAlert('order');
        setLatestBanner({
          title: 'Nouvelle commande !',
          message: `Commande #${payload.data.order_number} reçue pour la Table ${payload.data.table_number || ''}`,
          type: 'ORDER_NEW'
        });
      } else if (payload.type === 'BILL_REQUESTED') {
        playSoundAlert('bell');
        setLatestBanner({
          title: "Demande d'addition !",
          message: `Un client a demandé l'addition pour sa table`,
          type: 'BILL_REQUESTED'
        });
      } else if (payload.type === 'SERVICE_REQUESTED') {
        playSoundAlert('bell');
        setLatestBanner({
          title: 'Appel Table',
          message: `Un client sollicite un serveur`,
          type: 'CALL_SERVER'
        });
      } else if (payload.type === 'PAYMENT_PROCESSED') {
        playSoundAlert('cash');
      }
    });

    return () => {
      unsubscribe();
    };
  }, [refreshNotifications]);

  const clearBanner = () => setLatestBanner(null);

  const markAsRead = (notifId: string) => {
    dbEngine.markNotificationAsRead(notifId);
    refreshNotifications();
  };

  const markAllRead = () => {
    if (currentRestaurant) {
      dbEngine.markAllNotificationsAsRead(currentRestaurant.id);
      refreshNotifications();
    }
  };

  const playChime = () => playSoundAlert('order');

  return (
    <RealtimeContext.Provider
      value={{
        unreadCount,
        notifications,
        latestBanner,
        clearBanner,
        markAsRead,
        markAllRead,
        playChime,
        lastEventTimestamp
      }}
    >
      {children}
    </RealtimeContext.Provider>
  );
};

export const useRealtime = () => {
  const ctx = useContext(RealtimeContext);
  if (!ctx) {
    throw new Error('useRealtime must be used within RealtimeProvider');
  }
  return ctx;
};
