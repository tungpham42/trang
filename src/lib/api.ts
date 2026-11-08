import { auth } from './firebase';

export interface CardDraft {
  front: string;
  back: string;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Calls the Netlify function, retrying on rate limits and transient server errors. */
async function call<T>(payload: Record<string, unknown>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const token = await auth.currentUser?.getIdToken();
    if (!token) throw new Error('You are signed out. Please sign in again.');

    let res: Response;
    try {
      res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
    } catch {
      if (attempt < 2) {
        await sleep(2000 * (attempt + 1));
        continue;
      }
      throw new Error('Could not reach the server. Check your internet connection.');
    }

    const retryable = res.status === 429 || res.status >= 502;
    if (retryable && attempt < 4) {
      const header = Number(res.headers.get('Retry-After'));
      const waitSec = Number.isFinite(header) && header > 0 ? Math.min(header, 60) : 3 * 2 ** attempt;
      await sleep(Math.ceil(waitSec) * 1000);
      continue;
    }

    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
    return data as T;
  }
}

export function summarizeChunk(a: {
  title: string;
  text: string;
  index: number;
  total: number;
  language: string;
}): Promise<{ text: string }> {
  return call({ action: 'summarize_chunk', ...a });
}

export function mergeNotes(a: {
  title: string;
  notes: string[];
  language: string;
  mode: 'condense' | 'final';
}): Promise<{ text: string }> {
  return call({ action: 'merge_notes', ...a });
}

export function makeFlashcards(a: {
  section: string;
  count: number;
  language: string;
}): Promise<{ cards: CardDraft[] }> {
  return call({ action: 'flashcards', ...a });
}
