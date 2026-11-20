// Reads knowledge/<id>.md. Format: front-matter, then "## heading" sections; inside, "Page: N" followed by a "> quote" block.
// Lines that are not quotes (notes, "NOT FOUND") are never indexed: only text copied from the source can be cited.

export type KbChunk = {
  heading: string;
  /** As written in the file, e.g. "17 (printed 3)" */
  pageLabel: string;
  /** PDF page number (the first integer in the label) */
  pdfPage: number;
  /** Quote lines, bullets and quote markers removed */
  lines: string[];
  quote: string;
};

export type KbDoc = { id: string; label: string; title: string; year: string | null; sourceUrl: string; publisher: string; chunks: KbChunk[] };

/** For comparing a quote with PDF text: ligatures folded, bullets and ALL whitespace removed, lowercase. */
export function normalise(s: string): string {
  return s
    .normalize('NFKC')
    .replace(/[•●▪◦·*]/g, '')
    .replace(/\s+/g, '')
    .toLowerCase();
}

export function parseKnowledgeFile(text: string): KbDoc {
  const fm = /^---\n([\s\S]*?)\n---\n/.exec(text);
  if (!fm) throw new Error('knowledge file has no front-matter');
  const meta: Record<string, string> = {};
  for (const l of fm[1].split('\n')) {
    const i = l.indexOf(':');
    if (i > 0) meta[l.slice(0, i).trim()] = l.slice(i + 1).trim();
  }
  if (!meta.id || !meta.source_url || !meta.title) throw new Error(`front-matter needs id, title, source_url (${meta.id ?? '?'})`);

  const chunks: KbChunk[] = [];
  let heading = '';
  let pageLabel: string | null = null;
  let lines: string[] = [];
  const flush = () => {
    if (pageLabel && lines.length) {
      const n = Number(/\d+/.exec(pageLabel)?.[0]);
      if (Number.isFinite(n)) chunks.push({ heading, pageLabel, pdfPage: n, lines, quote: lines.join(' ') });
    }
    pageLabel = null;
    lines = [];
  };
  for (const raw of text.slice(fm[0].length).split('\n')) {
    const line = raw.trimEnd();
    const h = /^##\s+(.+)$/.exec(line);
    if (h) { flush(); heading = h[1].trim(); continue; }
    const p = /^Page:\s*(.+)$/.exec(line);
    if (p) { flush(); pageLabel = p[1].trim(); continue; }
    const q = /^>\s?(.*)$/.exec(line);
    if (q && pageLabel) {
      const t = q[1].replace(/^\s*[•●▪◦*-]\s*/, '').trim();
      if (t) lines.push(t);
    }
  }
  flush();
  return { id: meta.id, label: meta.label ?? meta.title, title: meta.title, year: meta.year ?? null, sourceUrl: meta.source_url, publisher: meta.publisher ?? '', chunks };
}
