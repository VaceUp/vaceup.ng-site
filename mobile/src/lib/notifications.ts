/** Push notification scaffold: request permission and capture the Expo push
 * token. The backend endpoint that stores tokens per device ships with the
 * notifications milestone; until then the token is logged once so ops can
 * see it during development builds. */
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) {
    // Push tokens require a physical device; emulators return nothing.
    return null;
  }
  const existing = await Notifications.getPermissionsAsync();
  let granted = existing.granted;
  if (!granted) {
    const requested = await Notifications.requestPermissionsAsync();
    granted = requested.granted;
  }
  if (!granted) return null;

  // The projectId comes from app.json extra.eas.projectId after EAS init.
  try {
    const token = await Notifications.getExpoPushTokenAsync();
    if (__DEV__) console.log('Expo push token ready (backend storage pending):', token.data);
    return token.data;
  } catch (error) {
    if (Platform.OS === 'android') {
      // Android requires a Firebase project for push; documented in the README.
      console.warn('Push token unavailable on Android without FCM credentials.', error);
    }
    return null;
  }
}
