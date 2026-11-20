import type { Db } from '@/lib/db/client';

export type Passage = { text: string; label: string; year: string | null; heading: string; page: string; url: string };

// Words that appear in almost every passage, or in every question, and so say nothing about what is being asked.
const STOP = new Set(
  ('a an the and or of to in on at for with from by is are was were be been being it its this that these those what when where which who how why can could should would will may might must do does did done have has had not no yes ' +
    'tell say give take get make about as if so than then there their them they she her he his him we our you your i me my ' +
    'pregnant pregnancy woman women mother mothers lady asha anm please advice advise need needs needed during also very much many more some any what').split(' '),
);
const SHORT_OK = new Set(['bp', 'hb', 'ifa', 'mo', 'tt', 'anc', 'jsy', 'phc', 'fru', 'pih', 'iv', 'fh']);

export function queryTerms(query: string): string[] {
  const words = query.toLowerCase().normalize('NFKD').replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const w of words) {
    if (STOP.has(w) || (w.length < 3 && !SHORT_OK.has(w)) || seen.has(w)) continue;
    seen.add(w);
    out.push(w);
    if (out.length >= 12) break;
  }
  return out;
}

// Spelling variants and near-synonyms between how people ask and how the official documents write (UK and US spellings, abbreviations).
const SYNONYMS: string[][] = [
  ['anemia', 'anaemia', 'anemic', 'anaemic'],
  ['hemoglobin', 'haemoglobin', 'hb'],
  ['edema', 'oedema', 'swelling', 'swollen'],
  ['hemorrhage', 'haemorrhage', 'bleeding', 'bleed'],
  ['fits', 'convulsions', 'eclampsia', 'seizure', 'seizures'],
  ['ifa', 'iron', 'folic'],
  ['tablet', 'tablets', 'pill', 'pills'],
  ['food', 'foods', 'diet', 'eat', 'eating', 'nutrition'],
  ['hospital', 'facility', 'phc', 'fru'],
];
const GROUP = new Map<string, string[]>();
for (const g of SYNONYMS) for (const w of g) GROUP.set(w, g);

const MAX_PASSAGES = 3;
const MAX_CHARS = 1800;

/**
 * Keyword retrieval over the verified guideline quotes (Postgres full-text search, no embeddings).
 * A passage is returned only if it matches at least two of the question's content words (or the only one, for one-word questions):
 * an off-topic question therefore returns nothing instead of a weak match the model might stretch into an answer.
 */
export async function retrieve(db: Db, query: string): Promise<Passage[]> {
  const terms = queryTerms(query);
  if (terms.length === 0) return [];
  const need = Math.min(2, terms.length);
  // Each question word becomes an OR-group of its spellings, e.g. "anemia | anaemia | anemic | anaemic".
  const groups = terms.map((t) => (GROUP.get(t) ?? [t]).join(' | '));
  const rows = await db.query<{ content: string; label: string; year: string | null; heading: string; page: string; url: string; hits: number | string; rank: number | string }>(
    `select content, label, year, heading, page, url,
            (select count(*) from unnest($1::text[]) t where tsv @@ to_tsquery('english', t)) as hits,
            ts_rank_cd(tsv, to_tsquery('english', $2)) as rank
       from kb_chunks
      where tsv @@ to_tsquery('english', $2)
      order by hits desc, rank desc, id
      limit 8`,
    [groups, groups.join(' | ')],
  );
  const out: Passage[] = [];
  let chars = 0;
  for (const r of rows) {
    if (Number(r.hits) < need) continue;
    if (out.length >= MAX_PASSAGES || chars + r.content.length > MAX_CHARS) break;
    out.push({ text: r.content, label: r.label, year: r.year, heading: r.heading, page: r.page, url: r.url });
    chars += r.content.length;
  }
  return out;
}
