# ASHA Saathi: Implementation Plan

> Read `ARCHITECTURE.md` first. Tasks marked **[LOCAL P-xx]** need your keys, phone or browser. Paste the matching prompt from `LOCAL_AGENT_PROMPTS.md` into your local coding agent; it will run the commands and report back.
> Tasks marked **[CLAUDE]** I can write here, in the cloud workspace. I'll push code to a GitHub repo you create, or send you the files.
>
> **Revision 2 (20 Nov 2026), Option A:** Agora's managed LLM + managed Deepgram run the conversation, Murf is TTS, and **our Vercel app is only the MCP tool server**, the DB and the dashboard. The AI Gateway and the custom-LLM route are off the critical path (fallback = Option B, ARCHITECTURE §8.1). Sources: https://docs.agora.io/en/ai/build/managed-mode.md · https://docs.agora.io/en/ai/build/tools/mcp-tools.md · https://docs.agora.io/en/ai/models/tts/murf.md · https://docs.agora.io/en/ai/reference/pricing.md
>
> Timeline: **Thu 19 Nov evening → Fri 20 Nov → Sat 21 Nov demo** (Polaris, Bengaluru, 8:30 AM).
> **Rule:** at the end of every phase it's deployed and demo-able. Overrunning means cutting scope (see the cut list), not slipping.

---

## Phase 0: Accounts + "it speaks Hindi" (Thu, ~2 h) **[GO / NO-GO]**

| # | Task | Who |
|---|---|---|
| 0.1 | Register for the hackathon (closes **Fri 20 Nov 10:45 PM**). Post the organiser question about the healthcare form option. | You |
| 0.2 | Create accounts, all no-card: **Agora** (project + App Certificate + enable **Signaling/RTM**), **Murf** API key, **Vercel**, **Twilio** trial + "Try WhatsApp", **Neon** (via `vercel install neon`). **No LLM account and no AI Gateway key are needed**: the LLM is Agora-managed ([source](https://docs.agora.io/en/ai/build/managed-mode.md)). Deepgram/Sarvam keys only if P-05 needs them. | You |
| 0.3 | Create a GitHub repo from the Agora template, run it, deploy to Vercel, turn off Deployment Protection | **[LOCAL P-01]** |
| 0.4 | Switch TTS to Murf Hindi; list Hindi Falcon voices; pick one | **[LOCAL P-02]** |
| 0.5 | **Spike:** managed LLM calls our MCP tool; Murf speaks the reply; check the Console usage. Code is already on branch `spike/managed-mcp` (`/api/mcp`, `/api/spike-agent`). The text-injected half **passed on 20 Nov** (ARCHITECTURE §8.2). You run the voice half. | **[LOCAL P-04]** |
| 0.6 | ASR A/B: Deepgram-managed `multi` vs ARES `hi-IN` (vs Sarvam if needed) | **[LOCAL P-05]** |
| 0.7 | Pick the **managed** LLM: compare gpt-4o-mini / gpt-4.1-mini / gpt-5-nano / gpt-5-mini on Hindi quality, tool-call accuracy and time to reply | **[LOCAL P-06]** |

**GO when:** you speak Hinglish, Agora's managed LLM calls *our* `/api/mcp` tool (visible in the Vercel logs), the reply comes back in a Murf Hindi voice, and the transcripts show in the UI.
**NO-GO fallback (LLM/tools):** if managed LLM + MCP fails on a real call, retry once with HTTP tools (`llm.tools`, [source](https://docs.agora.io/en/ai/platform/build/tools/custom-tools.md)); if that fails too, switch to **Option B** (ARCHITECTURE §8.1).
**NO-GO fallback (ASR):** if no ASR handles Hinglish acceptably, use `turnDetection.language: 'en-IN'` + Deepgram `en` with Romanised Hinglish input. Murf still replies in Hindi. Ask a mentor on Discord first.

---

## Agent-minute budget (300 minutes, the whole test + demo budget)

The Conversational AI agent has **"First 300 minutes free", then $0.10/min** ([source](https://docs.agora.io/en/ai/reference/pricing.md), [pricing page](https://www.agora.io/en/pricing/)). The dashboard's "10,000 free minutes" are **RTC** minutes (the audio channel), **not** agent minutes. Managed ASR/LLM add **$0** on top of the agent-minute fee per the same doc (🧪 confirm in Console, P-04).

| Use | Calls × min | Minutes |
|---|---|---|
| Phase 0 spikes (P-02, P-04, P-05, P-05b) | ~12 × 3 | ~36 |
| Phase 2–4 voice tests (P-09, P-11) | ~15 × 3 | ~45 |
| Language / region tests (P-03, kn-IN) | ~8 × 3 | ~24 |
| Rehearsal (P-13), 3 full runs + 1 backup video | 4 × 4 | ~16 |
| Demo day (judges, retries) | ~10 × 3 | ~30 |
| **Reserve** | | **≥ 149** |

Rules: keep every test call under 3 minutes; stop the agent the moment a test ends (`/api/stop-conversation`); use text-injected `think()` tests where no microphone is needed; check Console usage after each phase; **never let an agent sit idle** (`idleTimeout` small).

---

## Phase 1: Core skeleton (Thu night, ~2.5 h) **[CLAUDE]** → you pull and deploy

These files go into the template repo:

```
lib/config.ts            zod env schema, fail-fast with readable errors (LLM_MODEL, MCP_SHARED_SECRET, MURF_*; no Gateway key)
lib/schemas.ts           VisitInput, Risk, Beneficiary, Alert, ToolResult, Event (zod)
lib/prompt.ts            versioned system prompt (Hindi rules, 1–2 sentences, Devanagari, ₹/digits, grounding rule)
lib/voice/asr.ts         ASR adapter (verified builder shapes)
lib/db/client.ts, repo.ts  neon client, zod-parsed queries, logEvent()
db/schema.sql, db/seed.ts  tables from ARCHITECTURE §10, 1 ASHA, 6 beneficiaries (Hindi names, your demo phone)
app/api/mcp/route.ts    MCP tool server per ARCHITECTURE §8 (Bearer auth, zod, logging); promoted from the spike
app/api/invite-agent/route.ts       builder chain per ARCHITECTURE §9 (.withTools + managed STT/LLM + Murf + mcpServers)
scripts/verify-mcp.mjs   JSON-RPC contract test for /api/mcp (401 without secret, tools/list, tools/call, zod rejection)
```

**Done when:** `pnpm typecheck && pnpm verify:api` pass, and `node scripts/verify-mcp.mjs $URL $MCP_SHARED_SECRET` prints the tool list and a valid `tools/call` result, and shows 401 for a wrong secret. **[LOCAL P-07]** runs these against your deployment.

---

## Phase 2: Tools + rules (Fri morning, ~3 h)

| Task | Who |
|---|---|
| `lib/tools/define.ts` (MCP pattern in ARCHITECTURE §7), the registry (`TOOL_NAMES`), and all 8 tools registered on `/api/mcp` | **[CLAUDE]** |
| `lib/rules/anc.v1.ts` + table-driven unit tests (`pnpm test:rules`) | **[CLAUDE]** writes code; thresholds only from cited sources |
| Extract exact danger-sign/threshold text **with page numbers** from the official PDFs into `knowledge/*.md` | **[LOCAL P-08]** (needs PDF reading on your machine) |
| MCP contract tests: `tools/list`, `tools/call` per tool, zod rejection, 401 (no model needed) | **[CLAUDE]** |
| Voice test: *"Sunita ji, 7 mahine, BP 150/100, pairon mein sujan"* → visit row + HIGH risk | **[LOCAL P-09]** |

**Done when:** that sentence creates the correct visit, the agent states the risk and reasons in Hindi, and the `events` table shows `findBeneficiary → recordVisit`.

---

## Phase 3: RAG (Fri midday, ~2 h)

| Task | Who |
|---|---|
| `scripts/kb-ingest.ts` (chunk → hash → `embedMany` → upsert) and `lib/rag/retrieve.ts` (vector + keyword, rank fusion, 1.5 s timeout) | **[CLAUDE]** |
| Enable pgvector, pick an embedding model (optional, AI Gateway free tier; keyword-only is fine), set `EMBEDDING_DIM`, run the ingest | **[LOCAL P-10]** |
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
- **[LOCAL P-13]** Full rehearsal: 3 end-to-end runs, check quotas (Agora agent-minutes of the 300, Murf chars, Twilio msgs; Gateway $ only if embeddings are used), and record a 90 s backup video.

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
- [ ] Agora agent-minutes left ≥ 40 (see the budget above).
- [ ] Twilio sandbox rejoined on both phones.
- [ ] `reset` + `warmup` run.
- [ ] Hotspot ready.
- [ ] Backup video on the desktop.
- [ ] Charger.

---

## Cut list (drop from the top first)

1. `@ui-sdk/react` polish
2. `amendLastVisit`
3. Vector search + the AI Gateway embeddings (keep keyword-only RAG, which still cites sources)
4. `todaySummary`
5. **Never cut:** Hindi voice in/out via Agora + Murf, `recordVisit` + the rules engine, one cited RAG answer, one confirmed WhatsApp alert, the live dashboard card.
