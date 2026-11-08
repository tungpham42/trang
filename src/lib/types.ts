import type { Timestamp } from 'firebase/firestore';

export type SourceType = 'pdf' | 'pptx' | 'text' | 'transcript';
export type LectureStatus = 'processing' | 'ready' | 'error';
export type Stage = 'queued' | 'summarizing' | 'merging' | 'cards' | 'done';
export type Density = 'light' | 'normal' | 'thorough';

export interface Lecture {
  id: string;
  uid: string;
  title: string;
  sourceType: SourceType;
  sourceName?: string;
  language: string;
  density: Density;
  charCount: number;
  status: LectureStatus;
  stage: Stage;
  progress: number;
  stageDetail?: string;
  error?: string;
  summary: string;
  cardCount: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Card {
  id: string;
  uid: string;
  lectureId: string;
  front: string;
  back: string;
  ease: number;
  interval: number; // days
  reps: number;
  due: Timestamp;
  seq: number;
  createdAt: Timestamp;
  lastReviewedAt?: Timestamp;
}

export interface Transcript {
  id: string;
  uid: string;
  title: string;
  text: string;
  lang: string;
  durationSec: number;
  createdAt: Timestamp;
}

export interface UserSettings {
  reminderEnabled: boolean;
  reminderEveryHours: number;
  quietStartHour: number;
  quietEndHour: number;
  tzOffsetMinutes: number;
  fcmTokens: string[];
  lastReminderAt?: Timestamp;
}
