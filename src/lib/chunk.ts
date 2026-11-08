const MARKER = /^\[(Page|Slide) \d+\]/;

/**
 * Splits long text into chunks of roughly `maxChars`, breaking on line boundaries and
 * preferring to start a new chunk at a page/slide marker.
 */
export function chunkText(text: string, maxChars = 6500): string[] {
  const clean = text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  if (!clean) return [];

  // Hard-split any single line that is longer than a chunk.
  const lines: string[] = [];
  for (const line of clean.split('\n')) {
    if (line.length <= maxChars) {
      lines.push(line);
      continue;
    }
    for (let i = 0; i < line.length; i += maxChars) lines.push(line.slice(i, i + maxChars));
  }

  const chunks: string[] = [];
  let current = '';
  for (const line of lines) {
    const startsSection = MARKER.test(line);
    const tooLong = current.length + line.length + 1 > maxChars;
    const goodBreak = startsSection && current.length > maxChars * 0.6;
    if (current && (tooLong || goodBreak)) {
      chunks.push(current);
      current = '';
    }
    current += (current ? '\n' : '') + line;
  }
  if (current) chunks.push(current);

  // Fold a tiny last chunk into the one before it.
  if (chunks.length > 1 && chunks[chunks.length - 1].length < 1200) {
    const tail = chunks.pop() as string;
    chunks[chunks.length - 1] += '\n' + tail;
  }
  return chunks;
}
