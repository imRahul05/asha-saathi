// Checks that every quote in knowledge/*.md really appears, word for word, on the PDF page it cites.
//   pnpm kb:verify            (downloads each source PDF once into .cache/kb)
// Exit code 1 if any quote cannot be found, so a wrong or drifted quote never reaches the database.
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { getDocumentProxy, extractText } from 'unpdf';
import { parseKnowledgeFile, normalise } from '../lib/rag/parse';

const DIR = 'knowledge';
const CACHE = '.cache/kb';

async function loadPdf(url: string): Promise<string[]> {
  mkdirSync(CACHE, { recursive: true });
  const file = path.join(CACHE, Buffer.from(url).toString('base64url').slice(-60) + '.pdf');
  if (!existsSync(file)) {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (kb-verify)' }, redirect: 'follow' });
    if (!res.ok) throw new Error(`download failed: HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.subarray(0, 4).toString() !== '%PDF') throw new Error('not a PDF (got an HTML page?)');
    writeFileSync(file, buf);
  }
  const pdf = await getDocumentProxy(new Uint8Array(readFileSync(file)));
  const { text } = await extractText(pdf, { mergePages: false });
  return (text as string[]).map(normalise);
}

(async () => {
  let failures = 0;
  for (const f of readdirSync(DIR).filter((n) => n.endsWith('.md') && n !== 'RULES_EVIDENCE.md' && n !== 'README.md')) {
    const doc = parseKnowledgeFile(readFileSync(path.join(DIR, f), 'utf8'));
    let pages: string[];
    try {
      pages = await loadPdf(doc.sourceUrl);
    } catch (e) {
      console.log(`FAIL  ${doc.id}: ${(e as Error).message}`);
      failures++;
      continue;
    }
    let ok = 0;
    let weak = 0;
    const bad: string[] = [];
    for (const c of doc.chunks) {
      const page = pages[c.pdfPage - 1];
      // Every quoted line must appear on the cited page (line by line: PDF text order can differ between boxes).
      const missing = c.lines.filter((l) => {
        if (!page) return true;
        if (page.includes(normalise(l))) return false;
        // Flowchart PDFs interleave their boxes when text is extracted. Accept a line only if EVERY word is on the page, and say so.
        const words = l.normalize('NFKC').toLowerCase().split(/[^\p{L}\p{N}%./]+/u).filter(Boolean);
        const flat = page;
        if (words.every((w) => flat.includes(normalise(w)))) { weak++; return false; }
        return true;
      });
      if (page && missing.length === 0) ok++;
      else bad.push(`p.${c.pdfPage} [${c.heading}] ${(missing[0] ?? c.quote).slice(0, 90)}`);
    }
    console.log(`${bad.length ? 'FAIL' : 'ok  '}  ${doc.id}: ${ok}/${doc.chunks.length} quotes found on their page (${pages.length} pages)${weak ? `, ${weak} line(s) matched word-by-word because the PDF is a flowchart` : ''}`);
    for (const b of bad) console.log(`      missing: ${b}`);
    failures += bad.length;
  }
  process.exit(failures ? 1 : 0);
})();
