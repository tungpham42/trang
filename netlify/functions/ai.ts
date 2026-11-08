import type { Handler } from '@netlify/functions';
import { adminAuth } from './_lib/firebase';
import { groqChat } from './_lib/groq';
import { HttpError, json } from './_lib/http';
import { cardsPrompt, LANGUAGES, mergePrompt, notesPrompt, SYSTEM } from './_lib/prompts';

const MAX_CHARS = { chunk: 14_000, merge: 30_000, section: 14_000, title: 200 };

function requireString(value: unknown, name: string, max: number): string {
  if (typeof value !== 'string' || !value.trim()) throw new HttpError(400, `Missing ${name}`);
  if (value.length > max) throw new HttpError(413, `${name} is too long`);
  return value;
}

function language(value: unknown): string {
  return typeof value === 'string' && LANGUAGES.includes(value) ? value : 'auto';
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === 'number' ? Math.round(value) : fallback;
  return Math.min(max, Math.max(min, n));
}

async function authenticate(header: string | undefined): Promise<string> {
  const token = header?.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) throw new HttpError(401, 'Please sign in');
  const auth = adminAuth(); // throws a 500 if the server is misconfigured
  try {
    return (await auth.verifyIdToken(token)).uid;
  } catch {
    throw new HttpError(401, 'Your session has expired. Please sign in again');
  }
}

function parseCards(raw: string): { front: string; back: string }[] {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new HttpError(502, 'The AI returned malformed flashcards');
  }
  const list = (data as { cards?: unknown } | null)?.cards;
  if (!Array.isArray(list)) throw new HttpError(502, 'The AI returned malformed flashcards');

  const seen = new Set<string>();
  const cards: { front: string; back: string }[] = [];
  for (const item of list) {
    const c = item as { front?: unknown; back?: unknown } | null;
    const front = typeof c?.front === 'string' ? c.front.trim().slice(0, 400) : '';
    const back = typeof c?.back === 'string' ? c.back.trim().slice(0, 1200) : '';
    if (!front || !back) continue;
    const key = front.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    cards.push({ front, back });
  }
  return cards;
}

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  try {
    await authenticate(event.headers.authorization);

    let body: Record<string, unknown>;
    try {
      body = JSON.parse(event.body || '{}');
    } catch {
      throw new HttpError(400, 'Invalid JSON');
    }

    const lang = language(body.language);

    switch (body.action) {
      case 'summarize_chunk': {
        const title = requireString(body.title, 'title', MAX_CHARS.title);
        const text = requireString(body.text, 'text', MAX_CHARS.chunk);
        const index = clampInt(body.index, 1, 500, 1);
        const total = clampInt(body.total, 1, 500, 1);
        const out = await groqChat({
          system: SYSTEM,
          user: notesPrompt({ title, text, index, total, language: lang }),
          maxTokens: 1200,
          temperature: 0.2,
        });
        return json(200, { text: out });
      }

      case 'merge_notes': {
        const title = requireString(body.title, 'title', MAX_CHARS.title);
        const notes = Array.isArray(body.notes) ? body.notes.filter((n): n is string => typeof n === 'string') : [];
        if (!notes.length) throw new HttpError(400, 'Missing notes');
        if (notes.join('').length > MAX_CHARS.merge) throw new HttpError(413, 'notes are too long');
        const mode = body.mode === 'final' ? 'final' : 'condense';
        const out = await groqChat({
          system: SYSTEM,
          user: mergePrompt({ title, notes, language: lang, mode }),
          maxTokens: 2200,
          temperature: 0.2,
        });
        return json(200, { text: out });
      }

      case 'flashcards': {
        const section = requireString(body.section, 'section', MAX_CHARS.section);
        const count = clampInt(body.count, 2, 30, 8);
        const raw = await groqChat({
          system: SYSTEM,
          user: cardsPrompt({ section, count, language: lang }),
          maxTokens: 3000,
          temperature: 0.3,
          json: true,
        });
        return json(200, { cards: parseCards(raw) });
      }

      default:
        throw new HttpError(400, 'Unknown action');
    }
  } catch (err) {
    if (err instanceof HttpError) {
      return json(err.status, { error: err.message }, err.retryAfter ? { 'Retry-After': String(err.retryAfter) } : {});
    }
    console.error(err);
    return json(500, { error: 'Something went wrong on the server' });
  }
};
