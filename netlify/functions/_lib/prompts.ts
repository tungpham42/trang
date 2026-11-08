export const LANGUAGES = [
  'auto',
  'English',
  'Vietnamese',
  'Spanish',
  'French',
  'German',
  'Portuguese',
  'Chinese',
  'Japanese',
  'Korean',
  'Indonesian',
  'Hindi',
];

export const SYSTEM =
  'You are an expert teaching assistant who turns lecture material into accurate study aids. ' +
  'Use only information present in the provided material. Never invent facts, numbers or citations. ' +
  'If part of the text is garbled (for example broken PDF extraction), skip it instead of guessing.';

function languageLine(language: string): string {
  return language === 'auto'
    ? 'Write in the same language as the source material.'
    : `Write in ${language}.`;
}

export function notesPrompt(a: { title: string; text: string; index: number; total: number; language: string }): string {
  return `Lecture: "${a.title}" (part ${a.index} of ${a.total}).

Turn the material below into structured study notes in Markdown:
- Use "## " headings for topics in the order they appear, and "### " for sub-topics.
- Under each heading use concise bullet points. Keep definitions, formulas, step-by-step procedures, examples, numbers and named people or terms.
- Bold key terms the first time they appear.
- Keep every exam-relevant idea. Drop filler, greetings, repeated slide headers/footers and the [Page n] / [Slide n] markers.
- Do not add an introduction or conclusion, and never mention "this part" or "the text".
${languageLine(a.language)}

MATERIAL:
"""
${a.text}
"""`;
}

export function mergePrompt(a: {
  title: string;
  notes: string[];
  language: string;
  mode: 'condense' | 'final';
}): string {
  const joined = a.notes.map((n, i) => `--- NOTES ${i + 1} ---\n${n}`).join('\n\n');
  const task =
    a.mode === 'final'
      ? `Merge the notes below (consecutive parts of the lecture "${a.title}") into ONE coherent summary in Markdown:
1. Start with "## Overview": 3-5 sentences on what the lecture covers.
2. Then one "## " section per main topic in lecture order, with "### " sub-topics and bullets. Merge topics that were split across parts. Keep all definitions, formulas, procedures, examples and numbers.
3. End with "## Key terms" (one line per term: definition) and "## Key takeaways" (5-8 bullets).
Never mention "parts" or "notes".`
      : `Merge the notes below (consecutive parts of the lecture "${a.title}") into ONE set of notes in the same format: "## " topic headings, "### " sub-topics and bullets. Remove duplicates, keep every definition, formula, procedure, example and number, and keep the original order. Do not add an overview or takeaways.`;
  return `${task}
${languageLine(a.language)}

${joined}`;
}

export function cardsPrompt(a: { section: string; count: number; language: string }): string {
  return `From the study notes below, write about ${a.count} flashcards.

Rules:
- One idea per card. "front" is a clear question or prompt answerable from memory (definition, why/how, compare, step, formula, example). "back" is a concise, correct answer (1-3 sentences, or a short list in plain text).
- Cover every important point in the notes and skip trivia. No duplicates.
- Each card must stand alone: never write "the lecture", "the notes", "the slide" or "as mentioned".
- Plain text only (no Markdown headings). Simple inline math or code is fine.
${languageLine(a.language)}

Return exactly this JSON shape and nothing else:
{"cards":[{"front":"...","back":"..."}]}

NOTES:
"""
${a.section}
"""`;
}
