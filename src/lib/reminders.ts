import { arrayRemove, arrayUnion, doc, updateDoc } from 'firebase/firestore';
import { deleteToken, getMessaging, getToken, isSupported } from 'firebase/messaging';
import { app, db, firebaseConfig } from './firebase';

const TOKEN_KEY = 'll_push_token';

export function isQuietHour(hour: number, start: number, end: number): boolean {
  if (start === end) return false;
  return start > end ? hour >= start || hour < end : hour >= start && hour < end;
}

export function isPushEnabledOnDevice(): boolean {
  try {
    return (
      typeof Notification !== 'undefined' &&
      Notification.permission === 'granted' &&
      !!localStorage.getItem(TOKEN_KEY)
    );
  } catch {
    return false;
  }
}

export async function pushSupported(): Promise<boolean> {
  try {
    return await isSupported();
  } catch {
    return false;
  }
}

/** Asks for permission, registers the service worker and stores this device's FCM token. */
export async function enablePush(uid: string): Promise<void> {
  if (!(await pushSupported())) throw new Error('This browser does not support push notifications.');
  const vapidKey = process.env.REACT_APP_FIREBASE_VAPID_KEY;
  if (!vapidKey) throw new Error('REACT_APP_FIREBASE_VAPID_KEY is not set.');

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Notification permission was not granted.');

  const params = new URLSearchParams();
  Object.entries(firebaseConfig).forEach(([k, v]) => {
    if (v) params.set(k, v);
  });
  const registration = await navigator.serviceWorker.register(`/firebase-messaging-sw.js?${params.toString()}`);

  const token = await getToken(getMessaging(app), { vapidKey, serviceWorkerRegistration: registration });
  if (!token) throw new Error('Could not get a push token for this browser.');

  await updateDoc(doc(db, 'users', uid), { fcmTokens: arrayUnion(token) });
  localStorage.setItem(TOKEN_KEY, token);
}

export async function disablePush(uid: string): Promise<void> {
  const token = localStorage.getItem(TOKEN_KEY);
  localStorage.removeItem(TOKEN_KEY);
  try {
    if (await pushSupported()) await deleteToken(getMessaging(app));
  } catch {
    // The token may already be gone; removing it from the user document is what matters.
  }
  if (token) await updateDoc(doc(db, 'users', uid), { fcmTokens: arrayRemove(token) });
}
