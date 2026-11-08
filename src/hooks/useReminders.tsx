import { useEffect, useRef } from 'react';
import { App as AntApp, Button } from 'antd';
import { useNavigate } from 'react-router-dom';
import { getMessaging, onMessage } from 'firebase/messaging';
import { app } from '../lib/firebase';
import { isPushEnabledOnDevice, isQuietHour, pushSupported } from '../lib/reminders';
import type { UserSettings } from '../lib/types';

/**
 * Passive-learning nudges while the app is open:
 *  - with push enabled on this device, push messages that arrive in the foreground are shown in-app;
 *  - otherwise, an in-app reminder appears every N hours when cards are due (outside quiet hours).
 * Reminders when the tab is closed come from the scheduled Netlify function via push.
 */
export function useReminders(due: number, settings: UserSettings | null) {
  const { notification } = AntApp.useApp();
  const navigate = useNavigate();
  const dueRef = useRef(due);
  dueRef.current = due;

  const pushOn = isPushEnabledOnDevice();
  const enabled = !!settings?.reminderEnabled;
  const everyHours = settings?.reminderEveryHours ?? 4;
  const quietStart = settings?.quietStartHour ?? 22;
  const quietEnd = settings?.quietEndHour ?? 7;

  useEffect(() => {
    if (!pushOn) return;
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    (async () => {
      if (!(await pushSupported()) || cancelled) return;
      const off = onMessage(getMessaging(app), (payload) => {
        notification.info({
          key: 'review-nudge',
          message: payload.notification?.title ?? 'Time for a quick review',
          description: payload.notification?.body,
          btn: (
            <Button type="primary" size="small" onClick={() => navigate('/study')}>
              Study now
            </Button>
          ),
        });
      });
      if (cancelled) off();
      else unsubscribe = off;
    })();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [pushOn, notification, navigate]);

  useEffect(() => {
    if (!enabled || pushOn) return;
    const id = window.setInterval(() => {
      const count = dueRef.current;
      if (count <= 0 || isQuietHour(new Date().getHours(), quietStart, quietEnd)) return;
      notification.info({
        key: 'review-nudge',
        message: 'Time for a quick review',
        description: `${count >= 100 ? '100+' : count} flashcard${count === 1 ? ' is' : 's are'} waiting. A few minutes is enough.`,
        duration: 10,
        btn: (
          <Button type="primary" size="small" onClick={() => navigate('/study')}>
            Study now
          </Button>
        ),
      });
    }, everyHours * 3_600_000);
    return () => window.clearInterval(id);
  }, [enabled, pushOn, everyHours, quietStart, quietEnd, notification, navigate]);
}
