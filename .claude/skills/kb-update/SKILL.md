---
name: kb-update
description: Add or refresh official guideline quotes in the ASHA Saathi knowledge base (knowledge/*.md), prove each quote against its source PDF, and load it into the database. Use when asked to update the knowledge base, add a government document, or check that guideline text is still correct.
---

# Update the ASHA Saathi knowledge base

The voice agent may only give health advice from `knowledge/*.md` (see `knowledge/README.md` for the quote rules). Follow these steps in order and stop if one fails.

1. **Allowlist.** Take documents only from official domains: `nhm.gov.in`, `mohfw.gov.in`, `icmr.gov.in`, `nhsrcindia.org`, `pmsma.mohfw.gov.in`, `hbnc-hbyc.mohfw.gov.in`. Never use blogs, slides or mirrored copies. Confirm the PDF opens and is the real document (year, publisher on the first pages).
2. **Read, then select.** Download to `.cache/`, extract text per page (`unpdf`, as in `scripts/kb-verify.ts`), and pick short passages that answer ASHA counselling questions. Quote verbatim, one idea per line, with the PDF page number. Skip treatment doses and drug names.
3. **Check for conflicts.** If an older source gives a different number from a newer one, keep only the newest for numbers and say so in the file's `Note:`.
4. **Write** `knowledge/<id>.md` with front-matter (`id`, `label`, `title`, `source_url`, `publisher`, `year`) and `## heading` / `Page: N` / `> • quote` blocks. Use the same headings as the other files.
5. **Prove it.** `pnpm kb:verify` must pass (every quote found on its cited page). Fix or remove any quote that fails; never loosen the check.
6. **Retrieval.** Add 1 to 3 questions for the new content to `scripts/kb-check.ts`, then `pnpm kb:check` must pass, including the refusal cases.
7. **Show the diff to the user and wait for approval** before loading. Then `pnpm kb:ingest` (needs `DATABASE_URL`; idempotent).
8. Update `knowledge/README.md` (file table) and mention the change in the PR. No deploy is needed for content-only changes.
