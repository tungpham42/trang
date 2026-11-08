import { schedule } from '@netlify/functions';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { adminDb, adminMessaging } from './_lib/firebase';

// Runs hourly. For every user who turned reminders on, it sends a push notification
// when flashcards are due, the chosen interval has passed and it is not quiet hours.
const TOLERANCE_MS = 5 * 60 * 1000;
const DEAD_TOKEN_CODES = [
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
];

function isQuietHour(hour: number, start: number, end: number): boolean {
  if (start === end) return false;
  return start > end ? hour >= start || hour < end : hour >= start && hour < end;
}

export const handler = schedule('@hourly', async () => {
  const db = adminDb();
  const messaging = adminMessaging();
  const siteUrl = process.env.URL || '';
  const now = Date.now();
  let notified = 0;

  const users = await db.collection('users').where('reminderEnabled', '==', true).get();

  for (const userDoc of users.docs) {
    try {
      const u = userDoc.data();
      const tokens: string[] = Array.isArray(u.fcmTokens) ? u.fcmTokens : [];
      if (!tokens.length) continue;

      const everyMs = (u.reminderEveryHours ?? 4) * 3_600_000;
      const last = u.lastReminderAt?.toMillis?.() ?? 0;
      if (now - last < everyMs - TOLERANCE_MS) continue;

      const offsetMin: number = u.tzOffsetMinutes ?? 0; // minutes ahead of UTC
      const localHour = new Date(now + offsetMin * 60_000).getUTCHours();
      if (isQuietHour(localHour, u.quietStartHour ?? 22, u.quietEndHour ?? 7)) continue;

      const count = (
        await db
          .collection('cards')
          .where('uid', '==', userDoc.id)
          .where('due', '<=', Timestamp.now())
          .count()
          .get()
      ).data().count;
      if (!count) continue;

      const result = await messaging.sendEachForMulticast({
        tokens,
        notification: {
          title: 'Time for a quick review',
          body: `${count} flashcard${count === 1 ? '' : 's'} due. A few minutes is enough.`,
        },
        ...(siteUrl ? { webpush: { fcmOptions: { link: `${siteUrl}/study` } } } : {}),
      });

      const dead = tokens.filter((_, i) => {
        const r = result.responses[i];
        return !r.success && DEAD_TOKEN_CODES.includes(r.error?.code ?? '');
      });

      await userDoc.ref.update({
        lastReminderAt: Timestamp.now(),
        ...(dead.length ? { fcmTokens: FieldValue.arrayRemove(...dead) } : {}),
      });
      notified++;
    } catch (err) {
      console.error(`Reminder failed for ${userDoc.id}`, err);
    }
  }

  console.log(`Reminders: checked ${users.size} users, notified ${notified}`);
  return { statusCode: 200 };
});
