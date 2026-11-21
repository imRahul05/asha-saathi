import { describe, expect, it } from 'vitest';
import { loadKnowledge, rowsForDoc } from './ingest';

describe('knowledge loader', () => {
  it('loads every guideline file and ignores notes such as README.md', () => {
    const docs = loadKnowledge();
    expect(docs.length).toBeGreaterThanOrEqual(6);
    expect(docs.every((d) => d.sourceUrl.startsWith('https://') && d.chunks.length > 0)).toBe(true);
  });

  it('turns every quote into a row with a page and a source', () => {
    const rows = loadKnowledge().flatMap(rowsForDoc);
    expect(rows.length).toBeGreaterThan(40);
    expect(rows.every((r) => r.page && r.url && r.content.length > 0)).toBe(true);
  });
});
