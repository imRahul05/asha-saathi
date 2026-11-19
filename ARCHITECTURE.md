# ASHA Saathi: Architecture

> *Working name. Rename freely.*
> A Hindi/Hinglish **voice copilot for ASHA workers**. After a home visit, the ASHA speaks naturally. The agent turns that into a structured visit record, flags high-risk pregnancies with **deterministic, cited rules**, explains why using **RAG over official guidelines**, alerts the health-centre doctor on WhatsApp (after the ASHA confirms), and schedules the follow-up visit.
>
> Hackathon: Build with Agora BLR, **Track 5, "Voice AI for Bharat"**. Last verified **19 Nov 2026**.

**Verification legend.** Every technical claim carries one of these tags:
- ✅ **VERIFIED-CODE**: I ran it, or read it in the installed package source / cloned repo.
- ✅ **VERIFIED-DOC**: read in the official docs today.
- 🧪 **LOCAL-TEST**: needs your API keys, phone or browser. There's an exact prompt for it in `LOCAL_AGENT_PROMPTS.md`, with pass/fail criteria. Nothing here is "assumed". Anything that isn't verified is a named test.

---

## 1. What the judges will see (problem → value)

ASHA workers do home visits and then fill in paper registers. High-risk signs (high blood pressure, severe anaemia, bleeding) can be missed or reported late.

**ASHA Saathi:**
1. **Initiate:** the ASHA taps one button and speaks Hindi/Hinglish.
2. **Understand:** speech → structured visit (BP, Hb, weeks, symptoms), plus the right beneficiary.
3. **Assist:** rules engine → risk level and reasons. RAG → *why* and *what to advise*, with source citations.
4. **Execute:** saves the visit, drafts the doctor alert, sends it on WhatsApp **after a spoken "haan"** (yes), and books the follow-up.
5. **Confirm & Follow Up:** spoken confirmation in Hindi (Murf Falcon). The dashboard updates live. A follow-up reminder is queued.

**Safety position (say this in the pitch):** the AI **never decides** risk. A versioned rules engine does, citing ICMR / NHM guidance. The LLM only extracts data, explains and communicates. The output is *decision support plus referral*, never a diagnosis.

---

## 2. Design principles: what makes it not brittle

| # | Principle | How it is enforced |
|---|---|---|
| P1 | **Contracts first** | One `lib/schemas.ts` with zod schemas, used by tools, DB row parsing, API bodies and UI events. A change in one place gives compile errors everywhere it matters. |
| P2 | **Everything swappable by config** | ASR, LLM model, fallback models, embedding model, TTS voice, notifier and feature flags all come from **zod-validated env** (`lib/config.ts`). It fails fast at boot with a readable error. No vendor name is hard-coded in business logic. |
| P3 | **Deterministic where it matters** | Risk = pure TypeScript rules (`lib/rules/anc.v1.ts`) with unit tests. The LLM cannot override them. |
| P4 | **Tools never throw** | Each tool returns `{ ok: true, data } \| { ok: false, code, messageHi }`, so the model can always say something sensible. |
| P5 | **Side effects are two-phase and idempotent** | `draftAlert` → (ASHA confirms by voice) → `sendAlert(token)`. The idempotency key is unique in the DB, so Agora retries or a double "haan" can never send twice. |
| P6 | **Graceful degradation** | RAG down → keyword search. Embeddings down → keyword only. Primary LLM down → fallback model list. WhatsApp down → alert shown as "pending" in the dashboard plus a console notifier. ASR bad → switch provider by env. |
| P7 | **Observable** | Every turn and tool call is written to an `events` table (turn, tool, input, output, ms, ok). The dashboard timeline reads it, which also shows judges the agentic behaviour. |
| P8 | **Stateless functions** | All state is in Postgres. Any Vercel instance can serve any turn. |
| P9 | **Model-agnostic** | The AI SDK with **AI Gateway string model IDs**. Changing the model is an env change. Prompts don't rely on one vendor's quirks. |

---

## 3. Stack, with verification status

| Layer | Choice | Status |
|---|---|---|
| App | **One Next.js 16 App Router app on Vercel**, started from **`AgoraIO-Conversational-AI/agent-quickstart-nextjs`** (commit `24374411`, 19 Oct 2026) | ✅ VERIFIED-CODE: cloned. It already has `/api/generate-agora-token`, `/api/invite-agent`, `/api/stop-conversation`, **`/api/chat/completions` (custom LLM, AI SDK streaming SSE)**, a transcript UI and `vercel.json`. |
| Agent control | **`agora-agents` SDK v2.15.0** (`Agent`, `AgoraClient`, `.withStt/.withLlm/.withTts`) | ✅ VERIFIED-CODE: `AgoraClient` builds REST auth plus RTC/RTM tokens from **App ID + App Certificate**, so no Customer ID/Secret is needed (package README). |
| TTS (mandatory) | `new MurfTTS({ key, voiceId, locale:'hi-IN', model:'falcon-2.1', sampleRate:24000, baseUrl:'wss://global.api.murf.ai/v1/speech/stream-input' })` | ✅ VERIFIED-CODE: the class exists and serializes to `vendor:"murf"`, `params.base_url`, `voiceId`, `locale`, `model`, `sample_rate`. 🧪 The voice actually speaking Hindi through Agora is a local test (Hindi Falcon voices are listed in Murf's voice library). |
| ASR | **Adapter** over SDK classes: `DeepgramSTT` (nova-3, `language:'multi'`) / `AresSTT` / `SarvamSTT`. Agora interaction language is set by `turnDetection.language:'hi-IN'`. | ✅ VERIFIED-CODE: all 4 configs (Deepgram managed, Deepgram BYOK, ARES, Sarvam) build without validation errors. `hi-IN` is in the SDK's `AsrLanguage` enum. **Deepgram nova-3 is an Agora-managed preset**, so it works without our own Deepgram key. 🧪 Hinglish accuracy and managed-preset billing are local tests. |
| LLM loop | **AI SDK v6** (`ai@6.0.333`) `streamText` + `tool({inputSchema, outputSchema, execute})` + `stopWhen: stepCountIs(n)` | ✅ VERIFIED-CODE: a mock-model run produced tool call → zod-validated result → Hindi text → OpenAI SSE chunks → `[DONE]`. |
| Model access | **Vercel AI Gateway** (`@ai-sdk/gateway`), with string IDs and a fallback list via `providerOptions.gateway.models` | ✅ VERIFIED-CODE: `models`/`order`/`only` options exist in the gateway types. ✅ VERIFIED-DOC: $5/month free credit on free-tier models. 🧪 Which free-tier model has the best Hindi and latency is a local test. |
| Validation | **zod 4** | ✅ VERIFIED-CODE |
| DB + vectors | **Neon Postgres** (Vercel Marketplace) + **pgvector** | ✅ VERIFIED-DOC: pgvector is on every Neon plan, including Free. |
| Embeddings | AI Gateway `embed`/`embedMany` with `EMBEDDING_MODEL` from env | ✅ VERIFIED-CODE: `embed`, `embedMany`, `cosineSimilarity` and `gateway.embeddingModel()` exist. 🧪 Free-tier eligibility of the embedding model is a local test, with a keyword fallback so RAG never blocks the demo. |
| Notifier | `Notifier` interface → **Twilio WhatsApp Sandbox** \| `console` | ✅ VERIFIED-DOC: trial needs no card and includes 100 WhatsApp messages. 🧪 Real send to your phone is a local test. |
| UI | Template's Tailwind + shadcn components + Agora `agora-agent-uikit` visualizer | ✅ VERIFIED-CODE (in the template) |
| UI, optional | **Vercel UI SDK** `@ui-sdk/react` | ✅ VERIFIED-CODE: on npm as `0.1.0-beta.12`, **first published 12 Nov 2026**. A one-week-old beta, so it is **not on the critical path**. Use it only for a polish component if time allows. |
| Not used | `@json-render/*` (generative UI) | Verified to exist (v0.23.2). **Skipped on purpose.** Our UI is fed by typed events into fixed components, which is more predictable than LLM-generated layouts for a medical demo. |

---

## 4. System diagram

```mermaid
flowchart LR
  subgraph B["Browser: ASHA's phone / laptop (Next.js page)"]
    MIC[Mic + speaker<br/>agora-rtc-react]
    TR[Live transcript<br/>agent-client-toolkit via RTM]
    DASH["Dashboard: visits, risk cards,<br/>alerts, agent timeline<br/>SWR poll /api/events"]
  end

  subgraph V["Vercel: one Next.js app"]
    TOK["/api/generate-agora-token"]
    INV["/api/invite-agent<br/>agora-agents builder<br/>+ ASR adapter"]
    LLM["/api/chat/completions<br/>custom LLM: auth, sanitize,<br/>AI SDK streamText + tools,<br/>OpenAI SSE out"]
    EVT["/api/events, /api/visits"]
    subgraph CORE["lib/ (domain core)"]
      CFG[config.ts<br/>zod env]
      SCH[schemas.ts<br/>zod contracts]
      TOOLS["tools/*<br/>registry"]
      RULES[rules/anc.v1.ts<br/>deterministic risk]
      RAG[rag/retrieve.ts<br/>vector + keyword]
      NOTIF["notify/*<br/>twilio, console"]
      REPO[db/repo.ts]
    end
  end

  subgraph A["Agora Conversational AI Engine (cloud)"]
    RTC((RTC channel))
    ASR[ASR adapter target<br/>Deepgram nova-3 multi<br/>ARES / Sarvam hi-IN]
    TTS[Murf Falcon 2.1<br/>hi-IN voice]
  end

  GW[Vercel AI Gateway<br/>chat + embedding models<br/>fallback list]
  DB[(Neon Postgres + pgvector)]
  WA[Twilio WhatsApp Sandbox]
  DOC[Doctor's phone]

  MIC <--> RTC
  B --> TOK
  B --> INV --> A
  RTC --> ASR -->|text turn| LLM
  LLM -->|SSE text| TTS --> RTC
  A -. RTM transcript / state .-> TR
  LLM --> TOOLS
  TOOLS --> RULES
  TOOLS --> RAG --> DB
  TOOLS --> REPO --> DB
  TOOLS --> NOTIF --> WA --> DOC
  LLM <--> GW
  RAG <--> GW
  DASH --> EVT --> DB
```

## 5. One turn, end to end

```mermaid
sequenceDiagram
  autonumber
  participant ASHA
  participant AG as Agora (ASR → … → Murf TTS)
  participant R as /api/chat/completions
  participant T as Tools
  participant DB as Neon
  participant UI as Dashboard

  ASHA->>AG: "Sunita ji ke ghar gayi, 7 mahine, BP 150/100, pairon mein sujan"
  AG->>R: POST OpenAI chat.completions (stream=true, history, api_key)
  R->>R: auth check, zod-sanitize messages, load config
  R->>T: findBeneficiary("Sunita")
  T->>DB: alias / trigram match → 1 match
  R->>T: recordVisit({beneficiaryId, weeks:28, bp:150/100, symptoms:[oedema]})
  T->>T: rules.anc.v1 → HIGH (BP ≥ 140/90) [ICMR STW]
  T->>DB: insert visit + event
  R->>T: searchGuidelines("hypertension in pregnancy referral advice")
  T->>DB: pgvector top-k (fallback: keyword)
  R->>T: draftAlert(visitId) → returns preview + confirm token (NOT sent)
  R-->>AG: SSE "सुनीता जी का BP 150/100 है, यह high risk है। डॉक्टर को alert भेजूँ?"
  AG-->>ASHA: Murf Falcon speaks Hindi
  UI->>DB: poll /api/events → red risk card + timeline appear
  ASHA->>AG: "haan bhej do"
  AG->>R: next turn
  R->>T: sendAlert(token) (idempotent) → Twilio WhatsApp
  R->>T: scheduleFollowUp(beneficiaryId, inDays:3)
  R-->>AG: SSE "Alert भेज दिया। 3 दिन बाद follow-up visit तय है।"
```

---

## 6. RAG: what, where, why

**Purpose.** RAG answers *"why is this risky and what should I tell the family?"* and free questions like *"anaemia mein kya khilayein?"* (what should she eat for anaemia?). It only uses **official text**, and returns **citations** that the UI shows as source chips.

**RAG does NOT:**
- decide risk (the rules engine does: P3);
- fetch patient history (that's a structured SQL lookup, `getBeneficiaryHistory`).

That split is what keeps answers grounded and safe.

### 6.1 Corpus (curated, small, official)

We hand-curate Markdown files in `knowledge/`, copying the relevant sections from the PDFs. That's faster and more reliable than PDF parsing, and judges can audit it. Each file has front-matter:

```md
---
id: icmr-anc-stw
title: ICMR Standard Treatment Workflow – Antenatal management
source_url: https://www.icmr.gov.in/icmrobject/uploads/STWs/1725952342_obg_antenatal_management.pdf
publisher: ICMR
lang: en
---
## High-risk criteria
...
```

Candidate sources:
- ✅ **ICMR STW, antenatal management.** It lists high-risk criteria: age > 35 or < 19, parity > 4, Hb < 7 g%, BP > 140/90 on 2 occasions 6 h apart, APH. https://www.icmr.gov.in/icmrobject/uploads/STWs/1725952342_obg_antenatal_management.pdf
- ✅ **NHM CHO Booklet, Maternal Health** (testing, high-risk identification, referral). https://nhm.gov.in/New_Update-2022-23/MH/GUIDELINES-%20MH/CHO_Booklet_%20Maternal_Health-English.pdf
- ✅ **PMSMA guidelines** (ASHA's role in high-risk pregnancy mobilisation). https://nhm.gov.in/images/pdf/programmes/maternal-health/guidelines/Pradhan_Mantri_Surakshit_Matritva_Abhiyan.pdf

🧪 The local agent opens each PDF and copies the exact sections into `knowledge/*.md` with page numbers (prompt P-08). **No clinical sentence goes in without a page reference.**

### 6.2 Ingestion (offline script, idempotent)

```mermaid
flowchart LR
  MD["knowledge/*.md<br/>front-matter + sections"] --> CH[chunk by heading<br/>~600–900 chars, 1-sentence overlap]
  CH --> H["content_hash = sha256 of text + EMBEDDING_MODEL"]
  H -->|new or changed only| EM[embedMany via AI Gateway<br/>EMBEDDING_MODEL from env]
  EM --> UP[("kb_chunks upsert<br/>id, doc_id, title, heading, page, url,<br/>content, tsv, embedding vector DIM, model, hash")]
  H -->|unchanged| SKIP[skip]
```

- `pnpm kb:ingest` is safe to re-run, because the hash skips unchanged chunks.
- Changing the embedding model changes the hash, so everything re-embeds automatically. The `model` column prevents mixing vectors from different models.
- `EMBEDDING_DIM` is validated against the first returned vector. On a mismatch it fails loudly with "update EMBEDDING_DIM / migrate column".

### 6.3 Retrieval (runtime, inside the `searchGuidelines` tool)

```mermaid
flowchart LR
  Q[LLM calls searchGuidelines<br/>query in ENGLISH + topic enum] --> E{"embedding ok?"}
  E -->|yes| V["pgvector cosine top-8<br/>WHERE model = current"]
  E -->|no / timeout 1.5s| K["Postgres full-text ts_rank top-8"]
  V --> M[merge with keyword hits<br/>reciprocal-rank fusion]
  K --> M
  M --> F[top-3 chunks, ≤ 1,800 chars total]
  F --> OUT["{ ok, chunks:[{text, title, page, url}] }"]
```

- **Cross-lingual:** the ASHA speaks Hindi and the docs are English. The tool's zod schema forces `query` to be English, so the LLM translates the query itself. No extra translation service needed.
- **Grounding rule** in the system prompt: health advice may only come from `searchGuidelines` results. If nothing relevant comes back, say *"यह जानकारी मेरे पास नहीं है, MO से पूछें।"* ("I don't have this information, ask the Medical Officer.")
- **Hybrid search** means RAG still works if the embedding quota runs out.

---

## 7. Tool layer (agentic core)

Every tool lives in `lib/tools/<name>.ts` and is registered in `lib/tools/index.ts`:

```ts
// lib/tools/define.ts: the one pattern every tool follows
import { tool } from 'ai';
import { z } from 'zod';
import { logEvent } from '@/lib/db/repo';

export type ToolResult<T> = { ok: true; data: T } | { ok: false; code: string; messageHi: string };

export function defineTool<I extends z.ZodTypeAny, O extends z.ZodTypeAny>(def: {
  name: string; description: string; input: I; output: O;
  sideEffect?: boolean; timeoutMs?: number;
  run: (input: z.infer<I>, ctx: { turnId: string; signal: AbortSignal }) => Promise<z.infer<O>>;
}) {
  return (ctx: { turnId: string }) => tool({
    description: def.description,
    inputSchema: def.input,                       // model output validated by zod
    execute: async (input): Promise<ToolResult<z.infer<O>>> => {
      const t0 = Date.now();
      const signal = AbortSignal.timeout(def.timeoutMs ?? 4000);
      try {
        const data = def.output.parse(await def.run(input, { ...ctx, signal })); // our output validated too
        await logEvent({ turnId: ctx.turnId, type: 'tool', name: def.name, input, output: data, ok: true, ms: Date.now() - t0 });
        return { ok: true, data };
      } catch (e) {
        await logEvent({ turnId: ctx.turnId, type: 'tool', name: def.name, input, error: String(e), ok: false, ms: Date.now() - t0 });
        return { ok: false, code: 'TOOL_FAILED', messageHi: 'यह काम अभी नहीं हो पाया।' };
      }
    },
  });
}
```

| Tool | Side effect | Input (zod) → output | Notes |
|---|---|---|---|
| `findBeneficiary` | – | `{ name, village? }` → `{ matches:[{id,name,village,weeks}] }` | Uses alias + `pg_trgm` similarity. With more than one match, the agent asks which. |
| `getBeneficiaryHistory` | – | `{ beneficiaryId }` → last 3 visits | Structured context, not RAG. |
| `recordVisit` | writes DB | `VisitInput` (BP, Hb?, weeks, symptoms enum[], notes) → `{ visitId, risk:{level, reasons[], rulesVersion, citations[]} }` | **Calls the rules engine internally.** The model can't skip it or fake the result. |
| `searchGuidelines` | – | `{ query (English), topic: enum }` → `{ chunks[] }` | RAG (§6) |
| `draftAlert` | writes draft | `{ visitId }` → `{ token, previewHi, to }` | Phase 1 of 2. Nothing is sent. |
| `sendAlert` | **external** | `{ token }` → `{ status, providerId }` | Phase 2. Unique `idempotency_key`. Only valid after a draft exists and less than 10 min have passed. |
| `scheduleFollowUp` | writes DB | `{ beneficiaryId, inDays (1–30), reason }` → `{ followUpId, dueDate }` | |
| `todaySummary` | – | `{}` → counts + pending follow-ups | "Aaj ka kaam?" ("What's on today?") |

**Why two-phase instead of AI SDK `needsApproval`:**
- ✅ VERIFIED-CODE: `needsApproval` exists in v6.
- But every voice turn is a *separate HTTP request from Agora*. A DB-stored draft token works across turns and instances, and survives interruptions.

**Rules engine** (`lib/rules/anc.v1.ts`) is a pure function and unit-tested:

```ts
export const RULES_VERSION = 'anc.v1';
export function assessAnc(v: VisitInput, b: Beneficiary): Risk {
  // Each rule cites its source; thresholds only from verified sources (§6.1).
  // e.g. BP ≥ 140/90 → 'high', reason 'BP_HIGH', cite icmr-anc-stw
  //      Hb < 7 → 'high', 'HB_SEVERE_ANAEMIA'
  //      age < 19 or > 35, parity > 4 → 'watch' risk factors
  //      reported bleeding (APH) → 'urgent'
}
```

🧪 The local agent adds any further danger signs (severe headache, blurred vision, convulsions, reduced foetal movement) **only after quoting them from an official PDF page** (prompt P-08).

---

## 8. Custom LLM route: hardening the template's `/api/chat/completions`

✅ VERIFIED-CODE: the template route pins the model, uses `@ai-sdk/openai` with `NEXT_LLM_URL`, streams `textStream` as OpenAI SSE, and **does not check auth and has no tools**. We change it as follows:

1. **Auth.** Agora sends `llm.api_key`, but ✅ VERIFIED-DOC says *which header* is undocumented. Accept `Authorization: Bearer <secret>` **or** `api-key: <secret>`, log which one arrived (secret redacted). 🧪 Prompt P-04 confirms it.
2. **Sanitize input.** zod-parse the body. Keep only `system/user/assistant` messages with string content. Flatten content arrays to text and drop the rest. Agora's own system message is replaced by ours (versioned in `lib/prompt.ts`).
3. **Model.** `streamText({ model: config.LLM_MODEL, providerOptions: { gateway: { models: config.LLM_FALLBACKS } }, maxRetries: 1, abortSignal: request.signal, ... })`.
4. **Tools.** `tools: buildTools({ turnId })`, `stopWhen: stepCountIs(6)`.
5. **Output.** Stream text deltas only, as OpenAI chunks, then `[DONE]`. This is the existing template code, kept as is.
6. **Latency.** Agora's built-in `fillerWords` option (✅ VERIFIED-CODE in `AgentOptions`) covers silence while tools run. The system prompt keeps replies to 1–2 sentences.
7. **Failure.** Any thrown error → stream one Hindi apology chunk + `[DONE]`. Agora's `failureMessage` is the last resort.
8. `export const runtime = 'nodejs'; export const maxDuration = 60;`

## 9. Agent start route (`/api/invite-agent`)

Uses the verified builder chain (see `verified-agent-config.mjs`):

```ts
const agent = new Agent({
  client: new AgoraClient({ area: Area.AP, appId, appCertificate }),   // area = API routing only
  turnDetection: { language: 'hi-IN', config: { end_of_speech: { mode: 'vad', vad_config: { silence_duration_ms: 640 } } } },
  advancedFeatures: { enable_rtm: true },
  parameters: { data_channel: 'rtm', enable_error_message: true, enable_metrics: true },
})
  .withStt(buildStt(config))                         // lib/voice/asr.ts adapter
  .withLlm(new CustomLLM({ apiKey: config.LLM_SHARED_SECRET, model: 'asha-agent',
      url: `${config.PUBLIC_BASE_URL}/api/chat/completions`,
      greetingMessage: 'नमस्ते दीदी! किसके घर visit हुई?', failureMessage: 'माफ़ कीजिए, फिर से बोलिए।', maxHistory: 16 }))
  .withTts(new MurfTTS({ key: config.MURF_API_KEY, voiceId: config.MURF_VOICE_ID, locale: 'hi-IN',
      model: 'falcon-2.1', sampleRate: 24000, baseUrl: config.MURF_WS_URL }));
```

- Semantic end-of-speech is English/Chinese only. ✅ VERIFIED-CODE: the SDK throws for other languages, so we use VAD.
- `Area.AP` routes API calls through Asia-Pacific. 🧪 Prompt P-03 measures latency against `Area.US`.

```ts
// lib/voice/asr.ts
export function buildStt(c: Config) {
  switch (c.ASR_PROVIDER) {
    case 'deepgram': return c.DEEPGRAM_API_KEY
      ? new DeepgramSTT({ apiKey: c.DEEPGRAM_API_KEY, model: 'nova-3', language: c.DEEPGRAM_LANGUAGE })  // BYOK
      : new DeepgramSTT({ model: 'nova-3', language: c.DEEPGRAM_LANGUAGE });                            // Agora-managed
    case 'ares':   return new AresSTT({ keywords: c.ASR_KEYWORDS });   // language comes from turnDetection
    case 'sarvam': return new SarvamSTT({ apiKey: c.SARVAM_API_KEY!, language: 'hi-IN' });
  }
}
```

---

## 9.1 Languages: one config table, no per-language code

The whole product is **voice-only**. The ASHA taps Start/Stop, and everything else is speech. The screen only displays information.

Each ASHA has a `language` in her profile. One table in `lib/voice/languages.ts` maps it to every vendor setting, so **adding a language = adding a row**:

```ts
export const LANGUAGES = {
  'hi-IN': { turn: 'hi-IN', deepgram: 'multi', sarvam: 'hi-IN', murfLocale: 'hi-IN', murfVoice: env.MURF_VOICE_HI, greeting: 'नमस्ते दीदी! किसके घर visit हुई?' },
  'kn-IN': { turn: 'kn-IN', deepgram: 'multi', sarvam: 'kn-IN', murfLocale: 'kn-IN', murfVoice: env.MURF_VOICE_KN, greeting: '<Kannada greeting, written & checked in P-02>' },
  // ta-IN, te-IN, bn-IN, gu-IN: same shape
} as const;
```

| Layer | Indian-language support | Status |
|---|---|---|
| **Agora interaction language** (`turnDetection.language`) | The SDK accepts `hi-IN, ta-IN, te-IN, kn-IN, bn-IN, gu-IN, en-IN`, including **as a list in one session**. It **rejects `mr-IN, ml-IN, pa-IN, or-IN`** ("Invalid turnDetection.language"). | ✅ VERIFIED-CODE (`lang-test.mjs`). 🧪 Whether the *API* also rejects them is tested in P-05b. |
| **ASR: Deepgram, Agora-managed** (default; no Deepgram account) | Nova-3 multilingual lists hi, bn, ta, te, mr, kn, gu, en-IN. Monolingual adds ml, pa, as, ur. No Odia. | ✅ VERIFIED-DOC. 🧪 Streaming quality per language and managed billing are tested in P-05. |
| **ASR: Sarvam Saaras v3** (comparison / backup) | 22 Indian languages + English, auto-detect with `unknown`, code-mixed audio | ✅ VERIFIED-DOC; ₹100 free credit |
| **ASR: ARES** (Agora's own) | follows `turnDetection.language` | 🧪 P-05 |
| **LLM** | The prompt says: reply in the session language, Devanagari/native script, digits for numbers | 🧪 P-06 checks Kannada too |
| **TTS: Murf Falcon 2.1** | Voice-library locales: hi, bn, ta, te, mr, kn, gu, ml, or, pa, as, en-IN | ✅ VERIFIED-DOC. Voice + locale are **fixed at agent start**, so language = per session. Mid-call switching via Agora `custom_metadata.tts_params` is a stretch goal only. |
| **Rules engine / RAG** | Language-independent (numbers + English corpus; the LLM translates queries) | ✅ by design |

**Demo:** run the visit in Hindi, then switch the profile to **Kannada** (supported by Agora, Deepgram, Sarvam and Murf) and repeat it.

---

## 10. Data model (Neon)

```sql
create extension if not exists vector;  create extension if not exists pg_trgm;
create table ashas        (id uuid pk, name text, phone text, phc_name text, doctor_phone text);
create table beneficiaries(id uuid pk, asha_id uuid, name text, aliases text[], village text, phone text,
                           age int, parity int, lmp date, created_at timestamptz default now());
create table visits       (id uuid pk, beneficiary_id uuid, visited_at timestamptz, gestation_weeks int,
                           bp_sys int, bp_dia int, hb numeric(4,1), symptoms text[], notes text, transcript text,
                           risk_level text check (risk_level in ('normal','watch','high','urgent')),
                           risk_reasons jsonb, rules_version text);
create table alerts       (id uuid pk, visit_id uuid, to_phone text, preview text, status text check (status in ('draft','sent','failed')),
                           confirm_token text unique, idempotency_key text unique, provider_id text, created_at timestamptz, sent_at timestamptz);
create table followups    (id uuid pk, beneficiary_id uuid, due_date date, reason text, status text default 'pending');
create table kb_chunks    (id text pk, doc_id text, title text, heading text, page text, url text, content text,
                           tsv tsvector generated always as (to_tsvector('english', content)) stored,
                           embedding vector(1536) /* = EMBEDDING_DIM */, model text, hash text);
create table events       (id bigserial pk, turn_id text, type text, name text, payload jsonb, ok boolean, ms int,
                           created_at timestamptz default now());
```

All reads go through `db/repo.ts`, and each row is parsed with the matching zod schema (P1).

## 11. Config (`lib/config.ts`, zod-validated)

```
# Agora (mandatory)
NEXT_PUBLIC_AGORA_APP_ID=            NEXT_AGORA_APP_CERTIFICATE=
# Murf (mandatory)
MURF_API_KEY=   MURF_VOICE_ID=       MURF_WS_URL=wss://global.api.murf.ai/v1/speech/stream-input
# ASR adapter
ASR_PROVIDER=deepgram|ares|sarvam    DEEPGRAM_LANGUAGE=multi   DEEPGRAM_API_KEY=(optional; empty = Agora-managed)   SARVAM_API_KEY=(optional)
# LLM (model-agnostic)
AI_GATEWAY_API_KEY=   LLM_MODEL=<free-tier id>   LLM_FALLBACKS=<id1>,<id2>   LLM_SHARED_SECRET=<random 32+ chars>
# RAG
EMBEDDING_MODEL=<id>  EMBEDDING_DIM=<n>  RAG_ENABLED=true
# Data + notify
DATABASE_URL=         NOTIFIER=twilio|console   TWILIO_ACCOUNT_SID=  TWILIO_AUTH_TOKEN=  TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
PUBLIC_BASE_URL=https://<app>.vercel.app
```

## 12. Free-tier budget (₹0)

| Service | Free allowance | Our use |
|---|---|---|
| Agora | 300 min | ~60 test calls |
| Murf | 100k chars | short replies, ~1k turns |
| Deepgram | Agora-managed preset, or $200 BYOK credit | 🧪 confirm managed billing in P-05 |
| AI Gateway | $5/month on free-tier models | **never buy credits**, which ends the free tier |
| Twilio | 100 WhatsApp msgs, 30 days | demo sends only |
| Neon | 1 GB, pgvector | fine |
| Vercel Hobby | free | fine |

## 13. Failure-mode table

| Failure | Detection | Behaviour |
|---|---|---|
| Hinglish ASR poor | P-05 A/B | change `ASR_PROVIDER`, add `ASR_KEYWORDS` (beneficiary + village names) |
| LLM provider down or slow | gateway error / timeout | fallback model list, then a Hindi apology chunk |
| Model sends malformed tool args | zod `inputSchema` | ✅ VERIFIED-CODE: the AI SDK emits a `tool-error` part (`AI_InvalidToolInputError`) back to the model and the loop continues to the next step (tested with a mock model, BP=999) |
| Embeddings quota/timeout | 1.5 s timeout | keyword-only retrieval |
| WhatsApp fails | Twilio error | alert `status='failed'`, dashboard shows a "Retry" button, agent says so |
| Duplicate "haan" / Agora retry | unique `idempotency_key` | second send becomes a no-op returning the same status |
| Neon cold start (5 min idle) | first query slow | warm-up script before the demo |
| User interrupts mid-turn | `request.signal` aborts | DB writes are per-tool and atomic; drafts are never auto-sent |
| Template upgrade breaks something | `pnpm verify` (template script) + our tests | pin versions in lockfile |

## 14. Sources

- Agora quickstart repo: https://github.com/AgoraIO-Conversational-AI/agent-quickstart-nextjs
- Agora custom-LLM server samples: https://github.com/AgoraIO-Community/Conversational-AI-Server-Sample
- `agora-agents` npm v2.15.0 (classes read from the package): https://www.npmjs.com/package/agora-agents
- Agora custom LLM doc: https://docs.agora.io/en/ai/platform/build/custom-model-integration/custom-llm.md
- Agora Murf TTS: https://docs.agora.io/en/ai/models/tts/murf.md · Murf voices: https://murf.ai/api/docs/voices-styles/voice-library
- Deepgram code-switching: https://developers.deepgram.com/docs/multilingual-code-switching
- AI Gateway pricing: https://vercel.com/docs/ai-gateway/usage-and-pricing
- Neon pgvector: https://neon.com/docs/extensions/pgvector
- Twilio trial: https://www.twilio.com/docs/messaging/guides/how-to-work-with-your-twilio-free-trial-account-us-only
- ICMR antenatal STW: https://www.icmr.gov.in/icmrobject/uploads/STWs/1725952342_obg_antenatal_management.pdf
- Vercel UI SDK (beta): https://github.com/vercel-labs/ui · npm `@ui-sdk/react`
