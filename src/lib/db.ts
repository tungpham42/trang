import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import type { Unsubscribe } from 'firebase/firestore';
import { db } from './firebase';
import type { SrsResult } from './srs';
import type { Card, Density, Lecture, SourceType, Transcript, UserSettings } from './types';

function withId<T>(d: { id: string; data(): unknown }): T {
  return { id: d.id, ...(d.data() as object) } as T;
}

function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ------------------------------ Lectures ------------------------------ */

export async function createLecture(
  uid: string,
  input: {
    title: string;
    sourceType: SourceType;
    sourceName?: string;
    language: string;
    density: Density;
    charCount: number;
  }
): Promise<string> {
  const now = Timestamp.now();
  const ref = await addDoc(collection(db, 'lectures'), {
    uid,
    ...input,
    status: 'processing',
    stage: 'queued',
    progress: 0,
    summary: '',
    cardCount: 0,
    createdAt: now,
    updatedAt: now,
  });
  return ref.id;
}

export function updateLecture(id: string, patch: Partial<Omit<Lecture, 'id' | 'uid' | 'createdAt'>>) {
  return updateDoc(doc(db, 'lectures', id), { ...patch, updatedAt: Timestamp.now() });
}

export function subscribeLectures(uid: string, cb: (items: Lecture[]) => void): Unsubscribe {
  const q = query(collection(db, 'lectures'), where('uid', '==', uid), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => withId<Lecture>(d))),
    (err) => console.error('lectures listener', err)
  );
}

/** Calls back with the lecture, or null when it does not exist / is not yours. */
export function subscribeLecture(id: string, cb: (item: Lecture | null) => void): Unsubscribe {
  return onSnapshot(
    doc(db, 'lectures', id),
    (snap) => cb(snap.exists() ? withId<Lecture>(snap) : null),
    () => cb(null)
  );
}

export async function deleteLecture(uid: string, id: string): Promise<void> {
  await deleteCardsForLecture(uid, id);
  await deleteDoc(doc(db, 'lectures', id));
}

/* ------------------------------- Cards -------------------------------- */

export async function addCards(uid: string, lectureId: string, cards: { front: string; back: string }[]) {
  const now = Timestamp.now();
  for (let i = 0; i < cards.length; i += 400) {
    const batch = writeBatch(db);
    cards.slice(i, i + 400).forEach((c, j) => {
      batch.set(doc(collection(db, 'cards')), {
        uid,
        lectureId,
        front: c.front,
        back: c.back,
        ease: 2.5,
        interval: 0,
        reps: 0,
        due: now, // new cards are due immediately
        seq: i + j,
        createdAt: now,
      });
    });
    await batch.commit();
  }
}

export async function deleteCardsForLecture(uid: string, lectureId: string): Promise<void> {
  const snap = await getDocs(
    query(collection(db, 'cards'), where('uid', '==', uid), where('lectureId', '==', lectureId))
  );
  for (let i = 0; i < snap.docs.length; i += 400) {
    const batch = writeBatch(db);
    snap.docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
}

export function subscribeCards(uid: string, lectureId: string, cb: (items: Card[]) => void): Unsubscribe {
  const q = query(collection(db, 'cards'), where('uid', '==', uid), where('lectureId', '==', lectureId));
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map((d) => withId<Card>(d));
      items.sort(
        (a, b) => a.createdAt.toMillis() - b.createdAt.toMillis() || (a.seq ?? 0) - (b.seq ?? 0)
      );
      cb(items);
    },
    (err) => console.error('cards listener', err)
  );
}

export function subscribeDueCount(uid: string, cb: (count: number) => void): Unsubscribe {
  const q = query(
    collection(db, 'cards'),
    where('uid', '==', uid),
    where('due', '<=', Timestamp.now()),
    limit(100)
  );
  return onSnapshot(
    q,
    (snap) => cb(snap.size),
    (err) => console.error('due listener', err)
  );
}

export function updateCardText(id: string, values: { front: string; back: string }) {
  return updateDoc(doc(db, 'cards', id), values);
}

export function deleteCard(id: string) {
  return deleteDoc(doc(db, 'cards', id));
}

export function reviewCard(id: string, r: SrsResult) {
  return updateDoc(doc(db, 'cards', id), {
    ease: r.ease,
    interval: r.interval,
    reps: r.reps,
    due: Timestamp.fromMillis(r.dueMs),
    lastReviewedAt: Timestamp.now(),
  });
}

/** Cards to study now. `all` ignores due dates (cram mode). */
export async function loadStudyQueue(uid: string, lectureId: string | undefined, all: boolean): Promise<Card[]> {
  const cards = collection(db, 'cards');

  if (lectureId) {
    const snap = await getDocs(query(cards, where('uid', '==', uid), where('lectureId', '==', lectureId)));
    const items = snap.docs.map((d) => withId<Card>(d));
    if (all) return shuffle(items);
    const now = Date.now();
    return items.filter((c) => c.due.toMillis() <= now).sort((a, b) => a.due.toMillis() - b.due.toMillis());
  }

  if (all) {
    const snap = await getDocs(query(cards, where('uid', '==', uid), limit(300)));
    return shuffle(snap.docs.map((d) => withId<Card>(d)));
  }
  const snap = await getDocs(
    query(cards, where('uid', '==', uid), where('due', '<=', Timestamp.now()), orderBy('due'), limit(200))
  );
  return snap.docs.map((d) => withId<Card>(d));
}

/* ----------------------------- Transcripts ---------------------------- */

export function createTranscript(
  uid: string,
  input: { title: string; text: string; lang: string; durationSec: number }
) {
  return addDoc(collection(db, 'transcripts'), { uid, ...input, createdAt: Timestamp.now() });
}

export function subscribeTranscripts(uid: string, cb: (items: Transcript[]) => void): Unsubscribe {
  const q = query(collection(db, 'transcripts'), where('uid', '==', uid), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => withId<Transcript>(d))),
    (err) => console.error('transcripts listener', err)
  );
}

export function deleteTranscript(id: string) {
  return deleteDoc(doc(db, 'transcripts', id));
}

/* ------------------------------- Settings ----------------------------- */

export const DEFAULT_SETTINGS: UserSettings = {
  reminderEnabled: false,
  reminderEveryHours: 4,
  quietStartHour: 22,
  quietEndHour: 7,
  tzOffsetMinutes: -new Date().getTimezoneOffset(),
  fcmTokens: [],
};

export async function ensureUserDoc(uid: string): Promise<void> {
  try {
    const ref = doc(db, 'users', uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) await setDoc(ref, { ...DEFAULT_SETTINGS, createdAt: Timestamp.now() });
  } catch (err) {
    console.warn('Could not create the user document yet', err);
  }
}

export function subscribeSettings(uid: string, cb: (s: UserSettings) => void): Unsubscribe {
  return onSnapshot(
    doc(db, 'users', uid),
    (snap) => cb({ ...DEFAULT_SETTINGS, ...(snap.data() as Partial<UserSettings> | undefined) }),
    (err) => console.error('settings listener', err)
  );
}

export function saveSettings(uid: string, patch: Partial<UserSettings>) {
  return setDoc(doc(db, 'users', uid), patch, { merge: true });
}
