import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { Db } from '@/lib/db/client';
import { parseKnowledgeFile, type KbDoc } from './parse';

const MAX_CHARS = 850; // keeps a retrieved passage short enough to read out in one or two sentences

export type Row = { id: string; docId: string; label: string; title: string; year: string | null; heading: string; page: string; url: string; content: string; hash: string };

/** One row per page block, split on whole quote lines when a block is long. Never cuts a quote in the middle. */
export function rowsForDoc(doc: KbDoc): Row[] {
  const rows: Row[] = [];
  doc.chunks.forEach((c, ci) => {
    const groups: string[][] = [[]];
    let len = 0;
    for (const line of c.lines) {
      if (len + line.length > MAX_CHARS && groups[groups.length - 1].length) { groups.push([]); len = 0; }
      groups[groups.length - 1].push(line);
      len += line.length + 1;
    }
    groups.forEach((g, gi) => {
      const content = g.join('\n');
      const id = `${doc.id}:${ci}:${gi}`;
      const hash = createHash('sha256').update([doc.label, doc.title, doc.year, c.heading, c.pageLabel, doc.sourceUrl, content].join('\u0001')).digest('hex').slice(0, 24);
      rows.push({ id, docId: doc.id, label: doc.label, title: doc.title, year: doc.year, heading: c.heading, page: c.pageLabel, url: doc.sourceUrl, content, hash });
    });
  });
  return rows;
}

export function loadKnowledge(dir = 'knowledge'): KbDoc[] {
  return readdirSync(dir)
    .filter((n) => n.endsWith('.md') && n !== 'RULES_EVIDENCE.md')
    .sort()
    .map((n) => parseKnowledgeFile(readFileSync(path.join(dir, n), 'utf8')));
}

/** Idempotent: inserts new chunks, updates changed ones, deletes ones no longer in the files. Running it twice changes nothing. */
export async function ingestKnowledge(db: Db, docs: KbDoc[] = loadKnowledge()) {
  const rows = docs.flatMap(rowsForDoc);
  const existing = await db.query<{ id: string; hash: string }>('select id, hash from kb_chunks');
  const have = new Map(existing.map((r) => [r.id, r.hash]));
  let added = 0, updated = 0, unchanged = 0;
  for (const r of rows) {
    const h = have.get(r.id);
    if (h === r.hash) { unchanged++; continue; }
    await db.query(
      `insert into kb_chunks (id, doc_id, label, title, year, heading, page, url, content, hash)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       on conflict (id) do update set doc_id=$2, label=$3, title=$4, year=$5, heading=$6, page=$7, url=$8, content=$9, hash=$10`,
      [r.id, r.docId, r.label, r.title, r.year, r.heading, r.page, r.url, r.content, r.hash],
    );
    if (h === undefined) added++; else updated++;
  }
  const keep = new Set(rows.map((r) => r.id));
  const stale = existing.filter((e) => !keep.has(e.id)).map((e) => e.id);
  for (const id of stale) await db.query('delete from kb_chunks where id = $1', [id]);
  return { total: rows.length, added, updated, unchanged, removed: stale.length };
}
