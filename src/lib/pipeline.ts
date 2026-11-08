import { makeFlashcards, mergeNotes, summarizeChunk } from './api';
import type { CardDraft } from './api';
import { chunkText } from './chunk';
import { DENSITIES } from './constants';
import { addCards, deleteCardsForLecture, updateLecture } from './db';
import type { Density, Stage } from './types';

const MERGE_LIMIT = 10_000; // chars of notes we are happy to merge in one request
const SECTION_LIMIT = 5_500; // chars of summary per flashcard request

function report(lectureId: string, stage: Stage, progress: number, detail = '') {
  // Progress is best-effort; never let it break the pipeline.
  updateLecture(lectureId, { stage, progress: Math.round(progress), stageDetail: detail }).catch(() => undefined);
}

function totalLength(items: string[]): number {
  return items.reduce((sum, s) => sum + s.length, 0);
}

/** Groups notes so every group has at least two items (so each round shrinks the list). */
function groupNotes(notes: string[], limit: number): string[][] {
  const groups: string[][] = [];
  let current: string[] = [];
  let length = 0;
  for (const note of notes) {
    if (current.length >= 2 && length + note.length > limit) {
      groups.push(current);
      current = [];
      length = 0;
    }
    current.push(note);
    length += note.length;
  }
  if (current.length) groups.push(current);
  return groups;
}

async function buildSummary(
  lectureId: string,
  title: string,
  notes: string[],
  language: string
): Promise<string> {
  let level = notes;
  let round = 0;

  while (level.length > 2 && totalLength(level) > MERGE_LIMIT && round < 8) {
    const groups = groupNotes(level, MERGE_LIMIT);
    const next: string[] = [];
    for (let i = 0; i < groups.length; i++) {
      report(lectureId, 'merging', 55 + (i / groups.length) * 5, `round ${round + 1}`);
      if (groups[i].length === 1) {
        next.push(groups[i][0]);
      } else {
        const { text } = await mergeNotes({ title, notes: groups[i], language, mode: 'condense' });
        next.push(text);
      }
    }
    if (next.length >= level.length) break;
    level = next;
    round++;
  }

  report(lectureId, 'merging', 62, 'final summary');
  const { text } = await mergeNotes({ title, notes: level, language, mode: 'final' });
  return text;
}

/** Splits the summary into pieces of at most ~SECTION_LIMIT chars, keeping "## " sections together. */
export function splitSections(summary: string): string[] {
  const parts = summary
    .split(/^(?=## )/m)
    .map((p) => p.trim())
    .filter(Boolean);
  const out: string[] = [];
  let buffer = '';
  for (const part of parts) {
    if (buffer && buffer.length + part.length + 2 > SECTION_LIMIT) {
      out.push(buffer);
      buffer = part;
    } else {
      buffer = buffer ? `${buffer}\n\n${part}` : part;
    }
  }
  if (buffer) out.push(buffer);
  return out;
}

function dedupe(cards: CardDraft[]): CardDraft[] {
  const seen = new Set<string>();
  return cards.filter((c) => {
    const key = c.front.toLowerCase().replace(/\W+/g, ' ').trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Turns a finished summary into flashcards covering every section, replacing any old cards. */
export async function generateCards(a: {
  uid: string;
  lectureId: string;
  summary: string;
  language: string;
  density: Density;
}): Promise<number> {
  const charsPerCard = DENSITIES.find((d) => d.value === a.density)?.charsPerCard ?? 350;
  const sections = splitSections(a.summary);
  if (!sections.length) throw new Error('There is no summary to make flashcards from.');

  const all: CardDraft[] = [];
  for (let i = 0; i < sections.length; i++) {
    report(a.lectureId, 'cards', 65 + (i / sections.length) * 33, `${i + 1}/${sections.length}`);
    const count = Math.min(30, Math.max(3, Math.round(sections[i].length / charsPerCard)));
    const { cards } = await makeFlashcards({ section: sections[i], count, language: a.language });
    all.push(...cards);
  }

  const unique = dedupe(all);
  if (!unique.length) throw new Error('No flashcards were generated. Please try again.');

  // Only replace the old cards once the new ones exist.
  await deleteCardsForLecture(a.uid, a.lectureId);
  await addCards(a.uid, a.lectureId, unique);
  return unique.length;
}

export async function runPipeline(a: {
  uid: string;
  lectureId: string;
  title: string;
  text: string;
  language: string;
  density: Density;
}): Promise<void> {
  try {
    const chunks = chunkText(a.text);
    if (!chunks.length) throw new Error('No readable text was found in this material.');

    const notes: string[] = [];
    for (let i = 0; i < chunks.length; i++) {
      report(a.lectureId, 'summarizing', (i / chunks.length) * 55, `${i + 1}/${chunks.length}`);
      const { text } = await summarizeChunk({
        title: a.title,
        text: chunks[i],
        index: i + 1,
        total: chunks.length,
        language: a.language,
      });
      notes.push(text);
    }

    const summary = notes.length === 1 ? notes[0] : await buildSummary(a.lectureId, a.title, notes, a.language);
    await updateLecture(a.lectureId, { summary, stage: 'cards', progress: 65, stageDetail: '' });

    const cardCount = await generateCards({
      uid: a.uid,
      lectureId: a.lectureId,
      summary,
      language: a.language,
      density: a.density,
    });
    await updateLecture(a.lectureId, { status: 'ready', stage: 'done', progress: 100, stageDetail: '', cardCount, error: '' });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Something went wrong';
    await updateLecture(a.lectureId, { status: 'error', error: message }).catch(() => undefined);
  }
}

/** Retry flashcards from an existing summary (after a failure, or to regenerate). */
export async function regenerateCards(a: {
  uid: string;
  lectureId: string;
  summary: string;
  language: string;
  density: Density;
}): Promise<void> {
  try {
    await updateLecture(a.lectureId, { status: 'processing', stage: 'cards', progress: 65, stageDetail: '', error: '' });
    const cardCount = await generateCards(a);
    await updateLecture(a.lectureId, { status: 'ready', stage: 'done', progress: 100, stageDetail: '', cardCount });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Something went wrong';
    await updateLecture(a.lectureId, { status: 'error', error: message }).catch(() => undefined);
  }
}
