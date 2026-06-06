import { useState, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { api } from '../services/api';

export function usePushNotifications() {
  const [expoPushToken, setExpoPushToken] = useState<string | undefined>();
  const notificationListener = useRef<Notifications.EventSubscription | null>(null);

  useEffect(() => {
    registerForPushNotificationsAsync().then(async (token) => {
      if (!token) return;
      setExpoPushToken(token);

      // Register this token with the backend so the server can push to this device.
      // We fire-and-forget: if it fails the server just can't push to this device.
      try {
        const authToken = await SecureStore.getItemAsync('token');
        if (authToken) {
          await api.post('/api/notifications/register-token', {
            fcm_token: token,
            device_type: Platform.OS,
          });
        }
      } catch {
        // Not critical — app works without push
      }
    });

    notificationListener.current = Notifications.addNotificationReceivedListener(() => {
      // Notification received while app is foregrounded.
      // setNotificationHandler (in _layout.tsx) already controls display.
      // No additional handling needed here.
    });

    return () => {
      notificationListener.current?.remove();
    };
  }, []);

  return { expoPushToken };
}

async function registerForPushNotificationsAsync(): Promise<string | undefined> {
  if (!Device.isDevice) {
    console.log('Push notifications require a physical device');
    return undefined;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('Push notification permission denied');
    return undefined;
  }

  try {
    const token = (
      await Notifications.getExpoPushTokenAsync({
        projectId: process.env.EXPO_PUBLIC_PROJECT_ID,
      })
    ).data;
    return token;
  } catch (e) {
    console.log('Could not get push token:', e);
    return undefined;
  }
}
