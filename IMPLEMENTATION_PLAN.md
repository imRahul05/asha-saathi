# ASHA Saathi: Implementation Plan

> Read `ARCHITECTURE.md` first. Tasks marked **[LOCAL P-xx]** need your keys, phone or browser. Paste the matching prompt from `LOCAL_AGENT_PROMPTS.md` into your local coding agent; it will run the commands and report back.
> Tasks marked **[CLAUDE]** I can write here, in the cloud workspace. I'll push code to a GitHub repo you create, or send you the files.
>
> Timeline: **Thu 19 Nov evening → Fri 20 Nov → Sat 21 Nov demo** (Polaris, Bengaluru, 8:30 AM).
> **Rule:** at the end of every phase it's deployed and demo-able. Overrunning means cutting scope (see the cut list), not slipping.

---

## Phase 0: Accounts + "it speaks Hindi" (Thu, ~2 h) **[GO / NO-GO]**

| # | Task | Who |
|---|---|---|
| 0.1 | Register for the hackathon (closes **Fri 20 Nov 10:45 PM**). Post the organiser question about the healthcare form option. | You |
| 0.2 | Create accounts, all no-card: **Agora** (project + App Certificate + enable **Signaling/RTM**), **Murf** API key, **Vercel** + AI Gateway key (set a $5 budget), **Twilio** trial + "Try WhatsApp", **Neon** (via `vercel install neon`). Deepgram/Sarvam keys only if P-05 needs them. | You |
| 0.3 | Create a GitHub repo from the Agora template, run it, deploy to Vercel, turn off Deployment Protection | **[LOCAL P-01]** |
| 0.4 | Switch TTS to Murf Hindi; list Hindi Falcon voices; pick one | **[LOCAL P-02]** |
| 0.5 | Point the agent at the custom LLM route; log the auth header Agora sends | **[LOCAL P-04]** |
| 0.6 | ASR A/B: Deepgram-managed `multi` vs ARES `hi-IN` (vs Sarvam if needed) | **[LOCAL P-05]** |
| 0.7 | Pick the LLM: list free-tier Gateway models, measure Hindi quality + time-to-first-token | **[LOCAL P-06]** |

**GO when:** you speak Hinglish, the reply comes back in a Murf Hindi voice, it's routed through *our* `/api/chat/completions`, and the transcripts show in the UI.
**NO-GO fallback:** if no ASR handles Hinglish acceptably, use `turnDetection.language: 'en-IN'` + Deepgram `en` with Romanised Hinglish input. Murf still replies in Hindi. Ask a mentor on Discord first.

---

## Phase 1: Core skeleton (Thu night, ~2.5 h) **[CLAUDE]** → you pull and deploy

These files go into the template repo:

```
lib/config.ts            zod env schema, fail-fast with readable errors
lib/schemas.ts           VisitInput, Risk, Beneficiary, Alert, ToolResult, Event (zod)
lib/prompt.ts            versioned system prompt (Hindi rules, 1–2 sentences, Devanagari, ₹/digits, grounding rule)
lib/voice/asr.ts         ASR adapter (verified builder shapes)
lib/llm/model.ts         gateway model + fallbacks from env
lib/db/client.ts, repo.ts  neon client, zod-parsed queries, logEvent()
db/schema.sql, db/seed.ts  tables from ARCHITECTURE §10, 1 ASHA, 6 beneficiaries (Hindi names, your demo phone)
app/api/chat/completions/route.ts   hardened per ARCHITECTURE §8 (auth, sanitize, tools, fallbacks)
app/api/invite-agent/route.ts       builder chain per ARCHITECTURE §9
scripts/verify-sse.mjs   curl-like contract test for the LLM route
```

**Done when:** `pnpm typecheck && pnpm verify:api` pass, and `node scripts/verify-sse.mjs $URL` prints Hindi SSE chunks. **[LOCAL P-07]** runs these against your deployment.

---

## Phase 2: Tools + rules (Fri morning, ~3 h)

| Task | Who |
|---|---|
| `lib/tools/define.ts` (pattern in ARCHITECTURE §7), the registry, and all 8 tools | **[CLAUDE]** |
| `lib/rules/anc.v1.ts` + table-driven unit tests (`pnpm test:rules`) | **[CLAUDE]** writes code; thresholds only from cited sources |
| Extract exact danger-sign/threshold text **with page numbers** from the official PDFs into `knowledge/*.md` | **[LOCAL P-08]** (needs PDF reading on your machine) |
| Mock-model tool-loop tests (the same technique I verified: `MockLanguageModelV3`) | **[CLAUDE]** |
| Voice test: *"Sunita ji, 7 mahine, BP 150/100, pairon mein sujan"* → visit row + HIGH risk | **[LOCAL P-09]** |

**Done when:** that sentence creates the correct visit, the agent states the risk and reasons in Hindi, and the `events` table shows `findBeneficiary → recordVisit`.

---

## Phase 3: RAG (Fri midday, ~2 h)

| Task | Who |
|---|---|
| `scripts/kb-ingest.ts` (chunk → hash → `embedMany` → upsert) and `lib/rag/retrieve.ts` (vector + keyword, rank fusion, 1.5 s timeout) | **[CLAUDE]** |
| Enable pgvector, confirm the embedding model is usable on the free tier, set `EMBEDDING_DIM`, run the ingest | **[LOCAL P-10]** |
| Eval: 8 Hindi questions → expected source chunk in the top 3 (`pnpm test:rag`) | **[CLAUDE]** writes it, **[LOCAL P-10]** runs it |

**Done when:** *"BP high hai toh family ko kya batayein?"* ("BP is high, what should I tell the family?") gives a grounded Hindi answer, and the dashboard shows the citation chip.

---

## Phase 4: Execute + follow-up (Fri afternoon, ~2 h)

| Task | Who |
|---|---|
| `lib/notify/{types,twilio,console}.ts`, `draftAlert`/`sendAlert` two-phase with idempotency, `scheduleFollowUp` | **[CLAUDE]** |
| Join the Twilio sandbox from your phone (and the "doctor" phone); test a real send | **[LOCAL P-11]** |

**Done when:** you say "haan bhej do" ("yes, send it"), exactly one WhatsApp arrives with the Hindi alert, a repeated "haan" sends nothing new, and the follow-up appears on the dashboard.

---

## Phase 5: Dashboard UI (Fri evening, ~2.5 h)

**[CLAUDE]** builds the screens on the template's Tailwind/shadcn components:

- **Left:** the agent orb (`agora-agent-uikit`), the live transcript, start/stop.
- **Right, top:** a **visit card** (beneficiary, weeks, BP/Hb, risk badge with colour by level), plus reasons and citation chips.
- **Right, middle:** an **agent timeline** from `events` (tool name, ✓/✗, ms). This visibly shows tool calling to the judges.
- **Right, bottom:** alerts (draft/sent/failed + retry) and today's follow-ups.
- Data via SWR polling of `/api/events?since=` every 1 s.
- Mobile-first, a Devanagari font (Noto Sans Devanagari), large touch targets.
- Optional, only if time allows: one `@ui-sdk/react` behaviour (beta) for polish.

**[LOCAL P-12]** opens it on your phone and a projector-size window, then reports layout issues with screenshots.

---

## Phase 6: Harden + rehearse (Fri night, ~2 h)

- **[CLAUDE]** Handle ambiguous names (*"Sunita Devi ya Sunita Kumari?"*). Add a correction tool (`amendLastVisit`). Add `/api/admin/reset` (reseed) and `scripts/warmup.mjs`.
- **[LOCAL P-13]** Full rehearsal: 3 end-to-end runs, check quotas (Agora min, Murf chars, Gateway $, Twilio msgs), and record a 90 s backup video.

---

## Phase 7: Pitch (Sat morning)

**3-minute demo script:**
1. **Problem, 20 s:** ASHA workers, paper registers, late detection of high-risk pregnancies. Quote figures only from a verified source.
2. **Visit report:** speak the Sunita sentence. The red card appears and the agent explains the risk.
3. **Ask a question:** *"Family ko kya salah dun?"* ("What should I advise the family?"). A grounded answer with a citation chip.
4. **Execute:** *"Haan, doctor ko bhej do."* ("Yes, send it to the doctor.") The judge holds the doctor phone and it buzzes.
5. **Follow up:** *"Aaj ka kaam batao."* ("Tell me today's work.") The summary includes the new follow-up.
6. **Architecture, 30 s:**
   - the diagram;
   - "rules decide, AI explains";
   - ASR, LLM and embeddings are swappable by config;
   - runs on free tiers.

**Before stage:**
- [ ] Twilio sandbox rejoined on both phones.
- [ ] `reset` + `warmup` run.
- [ ] Hotspot ready.
- [ ] Backup video on the desktop.
- [ ] Charger.

---

## Cut list (drop from the top first)

1. `@ui-sdk/react` polish
2. `amendLastVisit`
3. Vector search (keep keyword-only RAG, which still cites sources)
4. `todaySummary`
5. **Never cut:** Hindi voice in/out via Agora + Murf, `recordVisit` + the rules engine, one cited RAG answer, one confirmed WhatsApp alert, the live dashboard card.
