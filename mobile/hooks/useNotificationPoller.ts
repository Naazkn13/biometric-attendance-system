import { useEffect, useRef } from 'react';
import * as Speech from 'expo-speech';
import * as SecureStore from 'expo-secure-store';
import { api } from '../services/api';

export function useNotificationPoller() {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Poll every 30 seconds
    intervalRef.current = setInterval(checkNotifications, 30000);

    // Initial check
    checkNotifications();

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const checkNotifications = async () => {
    try {
      const token = await SecureStore.getItemAsync('token');
      if (!token) return; // Not logged in

      // Fetch pending unread notifications
      const response = await api.get('/api/notifications/pending');
      const notifications = response.data;

      if (notifications && notifications.length > 0) {
        for (const notif of notifications) {
          if (notif.spoken_message) {
            // Speak it out loud
            Speech.speak(notif.spoken_message, { language: 'en-US' });
            
            // Mark as spoken
            await api.post(`/api/notifications/${notif.id}/mark-spoken`);
          }
        }
      }
    } catch (e: any) {
      console.log('Error polling notifications:', e);
    }
  };
}
