import { useEffect, useRef } from 'react';
import * as Speech from 'expo-speech';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { api } from '../services/api';

export function useNotificationPoller() {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Track IDs already spoken this session to avoid re-speaking on each poll
  const spokenIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    checkNotifications();
    intervalRef.current = setInterval(checkNotifications, 30000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const checkNotifications = async () => {
    try {
      const token = await SecureStore.getItemAsync('token');
      if (!token) return;

      // Fetch unread (not yet spoken) notifications
      const response = await api.get('/api/notifications/pending');
      const notifications = response.data;

      if (!notifications || notifications.length === 0) return;

      for (const notif of notifications) {
        if (spokenIds.current.has(notif.id)) continue;
        spokenIds.current.add(notif.id);

        // Speak via TTS
        if (notif.spoken_message) {
          Speech.speak(notif.spoken_message, { language: 'en-US' });
        }

        // Show an in-app banner even when foregrounded (local notification)
        await Notifications.scheduleNotificationAsync({
          content: {
            title: notif.title || 'AttendPay',
            body: notif.spoken_message || notif.title,
            data: {
              notification_id: notif.id,
              type: notif.notification_type,
            },
          },
          trigger: null, // fire immediately
        });

        // Only mark as spoken (keeps is_read = false so it shows in the tab with badge)
        await api.post(`/api/notifications/${notif.id}/mark-spoken`).catch(() => {});
      }
    } catch (e: any) {
      // Silent — don't log noise in prod
    }
  };
}
