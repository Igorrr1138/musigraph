/**
 * Bio sanitation + light structuring.
 *
 * Takes raw biography text (Last.fm HTML-ish content) and returns a
 * lead paragraph plus grouped body sections with smart era headings.
 */

export interface BioSection {
  heading?: string;
  paragraphs: string[];
}

export interface ParsedBio {
  lead: string;
  body: string[];
  sections: BioSection[];
  wordCount: number;
}

const BOILERPLATE = [
  /Read more on Last\.?fm[^]*$/gi,
  /User-contributed text is available under[^]*$/gi,
  /Read more about [^.]*on Last\.?fm\.?/gi,
];

export function processBioText(rawBio: string): ParsedBio {
  if (!rawBio) return { lead: '', body: [], sections: [], wordCount: 0 };

  let cleaned = rawBio
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<a\b[^>]*>(.*?)<\/a>/gi, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  for (const re of BOILERPLATE) cleaned = cleaned.replace(re, '');

  cleaned = cleaned.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();

  let paragraphs = cleaned
    .split(/\n\s*\n|\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 20);

  // If everything collapsed into one giant block, chunk it by sentences.
  if (paragraphs.length === 1 && paragraphs[0].length > 700) {
    paragraphs = chunkBySentences(paragraphs[0], 3);
  }

  const lead = paragraphs[0] ?? '';
  const body = paragraphs.slice(1);

  return { lead, body, sections: buildSections(body), wordCount: countWords(cleaned) };
}

function countWords(s: string): number {
  return s.split(/\s+/).filter(Boolean).length;
}

function chunkBySentences(text: string, perChunk: number): string[] {
  const sentences = text.match(/[^.!?]+[.!?]+(\s|$)/g) ?? [text];
  const out: string[] = [];
  for (let i = 0; i < sentences.length; i += perChunk) {
    const chunk = sentences.slice(i, i + perChunk).join('').trim();
    if (chunk) out.push(chunk);
  }
  return out;
}

/** Group body paragraphs under era headings when the bio is long enough. */
function buildSections(body: string[]): BioSection[] {
  if (body.length === 0) return [];
  if (body.length < 3) return [{ paragraphs: body }];

  const third = Math.ceil(body.length / 3);
  const groups = [body.slice(0, third), body.slice(third, third * 2), body.slice(third * 2)].filter(
    (g) => g.length > 0,
  );

  const labels = ['Early years & formation', 'Career highlights', 'Recent work'];
  return groups.map((paragraphs, i) => ({
    heading: labels[i] ?? labels[labels.length - 1],
    paragraphs,
  }));
}

/** Split a paragraph into plain-text and year tokens for highlighted rendering. */
export function splitYears(text: string): Array<{ text: string; isYear: boolean }> {
  const parts: Array<{ text: string; isYear: boolean }> = [];
  const re = /\b((?:1[5-9]|20)\d{2}s?)\b/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push({ text: text.slice(last, m.index), isYear: false });
    parts.push({ text: m[0], isYear: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last), isYear: false });
  return parts;
}
