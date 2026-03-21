/**
 * Push notification permission helpers.
 * - iOS: uses @react-native-firebase/messaging (APNs).
 * - Android 13+: POST_NOTIFICATIONS runtime permission (Firebase messaging().requestPermission is a no-op on Android).
 */
import {
  Alert,
  Linking,
  PermissionsAndroid,
  Platform,
} from 'react-native';
import messaging, {AuthorizationStatus} from '@react-native-firebase/messaging';

function isIosAuthorized(status: number): boolean {
  return (
    status === AuthorizationStatus.AUTHORIZED ||
    status === AuthorizationStatus.PROVISIONAL ||
    status === AuthorizationStatus.EPHEMERAL
  );
}

/** Whether the OS currently allows showing notifications for this app. */
export async function isNotificationPermissionGranted(): Promise<boolean> {
  if (Platform.OS === 'ios') {
    const status = await messaging().hasPermission();
    return isIosAuthorized(status);
  }
  if (Platform.OS === 'android' && Platform.Version >= 33) {
    return PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
    );
  }
  // Android 12 and below: granted at install time
  return true;
}

/** Show system permission dialog where applicable. Returns true if granted. */
export async function requestNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'ios') {
    const status = await messaging().requestPermission({
      alert: true,
      badge: true,
      sound: true,
    });
    return isIosAuthorized(status);
  }
  if (Platform.OS === 'android' && Platform.Version >= 33) {
    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
    );
    return result === PermissionsAndroid.RESULTS.GRANTED;
  }
  return true;
}

/**
 * After login: request permission once; if still denied, offer Settings.
 * Call only from auth success path (not on every screen).
 */
export async function promptNotificationPermissionAfterLogin(): Promise<void> {
  try {
    const already = await isNotificationPermissionGranted();
    if (already) {
      return;
    }

    const granted = await requestNotificationPermission();
    if (granted) {
      return;
    }

    Alert.alert(
      'Enable notifications',
      'Get alerts for security events and camera activity. You can turn this on anytime in system settings.',
      [
        {text: 'Not now', style: 'cancel'},
        {
          text: 'Open Settings',
          onPress: () => {
            Linking.openSettings().catch(() => {});
          },
        },
      ],
      {cancelable: true},
    );
  } catch (e) {
    console.warn('Notification permission prompt failed:', e);
  }
}
