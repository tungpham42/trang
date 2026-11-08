import * as pdfjsLib from 'pdfjs-dist';
import JSZip from 'jszip';
import { MAX_FILE_BYTES } from './constants';
import type { SourceType } from './types';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.js',
  import.meta.url
).toString();

export interface Extracted {
  text: string;
  sourceType: SourceType;
  warning?: string;
}

const DRAWINGML_NS = 'http://schemas.openxmlformats.org/drawingml/2006/main';

export async function extractFromFile(file: File): Promise<Extracted> {
  if (file.size > MAX_FILE_BYTES) {
    throw new Error(`This file is larger than ${Math.round(MAX_FILE_BYTES / 1024 / 1024)} MB.`);
  }
  const name = file.name.toLowerCase();

  if (name.endsWith('.pdf')) return extractPdf(file);
  if (name.endsWith('.pptx')) return extractPptx(file);
  if (name.endsWith('.txt') || name.endsWith('.md')) {
    return { text: await file.text(), sourceType: 'text' };
  }
  if (name.endsWith('.ppt')) {
    throw new Error('Old .ppt files are not supported. Save the deck as .pptx or export it to PDF first.');
  }
  if (name.endsWith('.key') || name.endsWith('.docx') || name.endsWith('.doc')) {
    throw new Error('Please export this file to PDF (or save slides as .pptx) and upload that instead.');
  }
  throw new Error('Unsupported file type. Upload a PDF, PPTX, TXT or MD file.');
}

async function extractPdf(file: File): Promise<Extracted> {
  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  try {
    const pages: string[] = [];
    let realChars = 0;

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      let raw = '';
      for (const item of content.items) {
        if ('str' in item) raw += item.str + (item.hasEOL ? '\n' : ' ');
      }
      const body = raw
        .replace(/[ \t]+\n/g, '\n')
        .replace(/ {2,}/g, ' ')
        .trim();
      realChars += body.length;
      if (body) pages.push(`[Page ${i}]\n${body}`);
    }

    const text = pages.join('\n\n');
    const warning =
      realChars < pdf.numPages * 40
        ? 'Very little text was found. This PDF may be scanned images, which need OCR first (not supported yet).'
        : undefined;
    return { text, sourceType: 'pdf', warning };
  } finally {
    void pdf.destroy();
  }
}

function paragraphsOf(xml: string): string[] {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const out: string[] = [];
  const paragraphs = doc.getElementsByTagNameNS(DRAWINGML_NS, 'p');
  for (let i = 0; i < paragraphs.length; i++) {
    const runs = paragraphs[i].getElementsByTagNameNS(DRAWINGML_NS, 't');
    let line = '';
    for (let j = 0; j < runs.length; j++) line += runs[j].textContent ?? '';
    line = line.trim();
    if (line) out.push(line);
  }
  return out;
}

async function extractPptx(file: File): Promise<Extracted> {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const slidePaths = Object.keys(zip.files)
    .filter((p) => /^ppt\/slides\/slide\d+\.xml$/.test(p))
    .sort((a, b) => slideNumber(a) - slideNumber(b));

  if (!slidePaths.length) throw new Error('No slides were found in this file.');

  const slides: string[] = [];
  let realChars = 0;

  for (const path of slidePaths) {
    const n = slideNumber(path);
    const slideXml = await zip.file(path)!.async('string');
    const body = paragraphsOf(slideXml).join('\n');

    let notes = '';
    const relsFile = zip.file(`ppt/slides/_rels/slide${n}.xml.rels`);
    if (relsFile) {
      const rels = await relsFile.async('string');
      const match = rels.match(/Target="\.\.\/notesSlides\/(notesSlide\d+\.xml)"/);
      const notesFile = match ? zip.file(`ppt/notesSlides/${match[1]}`) : null;
      if (notesFile) {
        notes = paragraphsOf(await notesFile.async('string'))
          .filter((l) => !/^\d+$/.test(l)) // drop the slide-number placeholder
          .join('\n');
      }
    }

    realChars += body.length + notes.length;
    if (body || notes) {
      slides.push(`[Slide ${n}]\n${body}${notes ? `\nSpeaker notes: ${notes}` : ''}`);
    }
  }

  const warning =
    realChars < slidePaths.length * 20
      ? 'Very little text was found. The slides may be mostly images.'
      : undefined;
  return { text: slides.join('\n\n'), sourceType: 'pptx', warning };
}

function slideNumber(path: string): number {
  const m = path.match(/slide(\d+)\.xml$/);
  return m ? parseInt(m[1], 10) : 0;
}
