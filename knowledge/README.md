# Knowledge base

What Saathi may say about health comes only from here: verbatim quotes from official Government of India documents. Nothing in these files is written by us.

| File | Source | Used for |
|---|---|---|
| `mcp-card.md` | MoHFW/MWCD Mother and Child Protection card | Danger signs for families, basic care, birth preparedness |
| `anc-sab-2010.md` | MoHFW antenatal care guidelines for ANMs (2010, older) | Counselling: diet, rest, iron-tablet side effects, danger signs, anaemia grading. No dosing |
| `amb-2026.md` | Anemia Mukt Bharat guidelines (2026, newest) | Iron-tablet dosing, severe anaemia referral |
| `icmr-anc-stw.md`, `nhm-cho-mh.md`, `pmsma.md` | ICMR, NHM, PMSMA | Risk criteria, referral, counselling |
| `RULES_EVIDENCE.md` | Evidence behind the risk rules | Not indexed for the agent |

## Rules for a quote

1. It is copied word for word from the PDF page it cites (`Page: N` is the PDF page number).
2. If two sources disagree, keep the newest for numbers (doses, durations) and use older ones only for non-numeric counselling.
3. Treatment doses (therapeutic iron, IV iron, drugs) are clinician decisions: do not add them.
4. Say what is NOT in a source ("NOT FOUND") instead of filling the gap.

## Updating

```bash
# 1. edit or add knowledge/<id>.md (front-matter: id, label, title, source_url, publisher, year)
pnpm kb:verify    # downloads each PDF and proves every quote is on its cited page. Must pass.
pnpm kb:check     # retrieval questions on embedded Postgres. Must pass; add a question for anything new.
pnpm kb:ingest    # loads into the database (idempotent: a second run reports 0 changed)
```

No deploy is needed: the agent reads the database during the call. If an official PDF changes or moves, `kb:verify` fails and shows which quote no longer matches.
