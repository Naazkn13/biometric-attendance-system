import FontAwesome from '@expo/vector-icons/FontAwesome';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, router } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { useColorScheme } from '@/components/useColorScheme';

export {
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

// Keep splash screen up until fonts are loaded.
SplashScreen.preventAutoHideAsync();

// Show in-app alerts and play sound when a notification arrives while the app is open.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return <RootLayoutNav />;
}

import VoiceAssistant from '../components/VoiceAssistant';
import { useNotificationPoller } from '../hooks/useNotificationPoller';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { approveLeave } from '../services/api';
import * as SecureStore from 'expo-secure-store';
import * as Speech from 'expo-speech';

async function setupNotificationInfrastructure() {
  // ── Android: dedicated high-importance channel for leave requests ──
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('leave_requests', {
      name: 'Leave Requests',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      sound: 'default',
      // Notifications on this channel are NOT auto-cancelled — they stay
      // in the tray until the user acts (approve/reject) or swipes them away.
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });

    await Notifications.setNotificationChannelAsync('default', {
      name: 'General',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#3b82f6',
    });
  }

  // ── Register LEAVE_REQUEST category with Approve / Reject action buttons ──
  // These buttons appear directly in the notification shade on both Android and iOS.
  await Notifications.setNotificationCategoryAsync('LEAVE_REQUEST', [
    {
      identifier: 'approve',
      buttonTitle: '✅ Approve',
      options: {
        isDestructive: false,
        isAuthenticationRequired: false,
        opensAppToForeground: false, // Approve silently without opening app
      },
    },
    {
      identifier: 'reject',
      buttonTitle: '❌ Reject',
      options: {
        isDestructive: true,
        isAuthenticationRequired: false,
        opensAppToForeground: true, // Open app so admin can type rejection reason
      },
    },
  ]);
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  useNotificationPoller();   // voice TTS polling
  usePushNotifications();    // FCM token registration

  useEffect(() => {
    setupNotificationInfrastructure();

    // Handle taps on action buttons (Approve / Reject) from the notification shade
    const sub = Notifications.addNotificationResponseReceivedListener(async (response) => {
      const actionId = response.actionIdentifier;
      const data = response.notification.request.content.data as any;
      const leaveId: string | undefined = data?.leave_id;
      const notifId = response.notification.request.identifier;

      if (!leaveId) return;

      if (actionId === 'approve') {
        try {
          const role = await SecureStore.getItemAsync('userRole');
          if (role !== 'ADMIN' && role !== 'SUPERADMIN' && role !== 'HM') return;

          await approveLeave(leaveId);
          // Dismiss the sticky notification now that action is taken
          await Notifications.dismissNotificationAsync(notifId);
          Speech.speak('Leave approved.', { language: 'en-US' });
        } catch (e: any) {
          Speech.speak('Could not approve leave. Please try again from the app.', { language: 'en-US' });
        }
      } else if (actionId === 'reject') {
        // Open the Leaves tab so admin can fill in the rejection reason
        // The notification stays until admin acts in-app (or swipes it away)
        router.push('/(tabs)/leaves' as any);
      } else {
        // Plain tap (not an action button) — open Leaves tab for admin, default tab for others
        const role = await SecureStore.getItemAsync('userRole');
        if (data?.type === 'LEAVE_REQUEST' &&
            (role === 'ADMIN' || role === 'SUPERADMIN' || role === 'HM')) {
          router.push('/(tabs)/leaves' as any);
        }
      }
    });

    return () => sub.remove();
  }, []);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
      </Stack>
      {/* Global floating voice assistant */}
      <VoiceAssistant />
    </ThemeProvider>
  );
}
