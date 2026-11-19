# Local Agent Prompts

Paste these one at a time into your local coding agent (Claude Code, Cursor, etc.), running **in the project repo on your machine**. Each one is self-contained: what to do, how to know it passed, and what to report back. Paste the report back to me and I'll adjust the code or plan.

**Paste this preamble first, once per session:**

> You are working in a Next.js 16 repo based on `AgoraIO-Conversational-AI/agent-quickstart-nextjs`, for a hackathon voice agent called ASHA Saathi. Read `ARCHITECTURE.md` and `IMPLEMENTATION_PLAN.md` in the repo root first. Rules:
> 1. Never commit secrets. Keys go only in `.env.local` (gitignored) and Vercel env vars.
> 2. Do not "assume it works". Run the command and paste the real output.
> 3. If a step fails twice, stop and report the exact error. Don't improvise a workaround that changes the architecture.
> 4. End with a report in the format each task asks for.

---

## P-01: Scaffold, run, deploy

> 1. Clone `https://github.com/AgoraIO-Conversational-AI/agent-quickstart-nextjs` into `asha-saathi`, then push it to my new GitHub repo `<REPO_URL>`. Node must be ≥ 22 (check with `node -v`). Use pnpm.
> 2. `cp env.local.example .env.local` and fill in `NEXT_PUBLIC_AGORA_APP_ID` and `NEXT_AGORA_APP_CERTIFICATE` (I'll paste them).
> 3. Run `pnpm install && pnpm run doctor && pnpm dev`. Open http://localhost:3000, start a conversation and say "hello". Confirm the default English agent answers and the transcript shows.
> 4. Run `vercel link`, add the same env vars in Vercel (Production + Preview), then `vercel deploy --prod`.
> 5. In Vercel → Project → Settings → Deployment Protection, **disable protection** for production. Agora's servers must reach our API without logging in.
> 6. Run `vercel install neon` (free plan) and `vercel env pull .env.local`.
>
> **Pass:** the default agent works on localhost **and** on the production URL, and `DATABASE_URL` is in `.env.local`.
> **Report:** production URL, `node -v`, `pnpm -v`, the output of `pnpm run doctor`, and a screenshot of a working call.

## P-02: Murf Hindi voice through Agora

> 1. List Falcon 2.1 voices from Murf: `curl -s "https://global.api.murf.ai/v1/speech/voices?model=falcon-2.1" -H "api-key: $MURF_API_KEY" | jq '[.[] | select((.supportedLocales // .locale // "" | tostring) | test("hi-IN|hi-LATN"))] | .[:20]'`. If that URL returns 404, retry with host `api.murf.ai`. If the jq filter doesn't match the response shape, print the first 2 objects raw and adapt the filter.
> 2. Report the exact `voiceId` strings that support `hi-IN`. Test 2 female voices directly: `curl -X POST https://global.api.murf.ai/v1/speech/stream -H "api-key: $MURF_API_KEY" -H "Content-Type: application/json" -d '{"text":"नमस्ते दीदी! सुनीता जी का BP 150/100 है, यह high risk है।","voiceId":"<ID>","model":"falcon-2.1","locale":"hi-IN","format":"MP3","sampleRate":24000}' -o test_<ID>.mp3`, then play them.
> 3. In `app/api/invite-agent/route.ts`, replace `MiniMaxTTS` with `new MurfTTS({ key: process.env.MURF_API_KEY!, voiceId: process.env.MURF_VOICE_ID!, locale: 'hi-IN', model: 'falcon-2.1', sampleRate: 24000, baseUrl: 'wss://global.api.murf.ai/v1/speech/stream-input' })`, imported from `agora-agents`. Change the greeting to `नमस्ते दीदी! किसके घर visit हुई?`.
> 4. Start a call and confirm the greeting is spoken in Hindi.
>
> **Pass:** the agent greets in a natural Hindi Murf voice.
> **Report:** the voice IDs found, which one you chose, any Agora error from the UI's connection-issues panel, and whether the ₹ amount and "BP 150/100" were read correctly.

## P-03: API region latency

> Start 3 calls with `Area.US` and 3 with `Area.AP` in `AgoraClient` (only that line changes). Read the per-stage latency from the template's metrics panel (`QuickstartPipelineMetrics`).
>
> **Pass:** there's a clear winner.
> **Report:** a table of the area against ASR/LLM/TTS/total ms, one row per call.

## P-04: Custom LLM wiring + auth header discovery

> 1. Generate a secret with `openssl rand -hex 24` and store it as `LLM_SHARED_SECRET` (local + Vercel).
> 2. In `app/api/chat/completions/route.ts`, temporarily log `request.headers` at the top. **Redact** any value longer than 8 characters to its first 4 characters followed by `…`.
> 3. In `invite-agent`, replace the `OpenAI` LLM with `new CustomLLM({ apiKey: process.env.LLM_SHARED_SECRET!, model: 'asha-agent', url: process.env.PUBLIC_BASE_URL + '/api/chat/completions', greetingMessage: 'नमस्ते दीदी! किसके घर visit हुई?', failureMessage: 'माफ़ कीजिए, फिर से बोलिए।', maxHistory: 16 })`. Set the route's model through AI Gateway for now: `import { gateway } from '@ai-sdk/gateway'`, with `model: gateway(process.env.LLM_MODEL!)`.
> 4. Deploy to prod, make one call, and read the Vercel function logs.
>
> **Pass:** the agent answers through our route (visible in the logs).
> **Report:** **which header carried the secret** (e.g. `authorization: Bear…`), the full list of header *names* Agora sent, and the top-level JSON keys of the request body (e.g. `model, messages, stream, …`). Then remove the header logging.

## P-05: ASR A/B for Hinglish

> 1. Add the ASR adapter `lib/voice/asr.ts` exactly as in ARCHITECTURE §9, plus `turnDetection.language: 'hi-IN'`. Default is Deepgram **Agora-managed** (empty `DEEPGRAM_API_KEY`), per the track. Support a `?asr=` query override on `/api/invite-agent` for testing.
> 2. For each of `deepgram` (no key, managed, `DEEPGRAM_LANGUAGE=multi`), `ares`, and, only if both are poor, `sarvam` (needs a key): read these sentences aloud and copy the final transcript from the UI:
>    1. "Sunita ji ke ghar gayi thi, saat mahine ki pregnant hain"
>    2. "BP ek sau pachaas by sau hai, pairon mein sujan hai"
>    3. "Hemoglobin saat point paanch aaya"
>    4. "Haan, doctor ko alert bhej do"
>    5. "Teen din baad follow-up rakh do"
>    6. "Anaemia mein kya khilana chahiye"
> 3. If Deepgram managed fails to start, or Agora rejects `language: 'multi'`, try `language: 'hi'` and report the exact error.
> 4. Check Agora Console → Usage/Billing for whether managed Deepgram minutes are charged separately or come out of the free minutes.
>
> **Pass:** one provider gets the numbers (150/100, 7.5) and the names right on at least 5 of 6 sentences.
> **Report:** a table of provider × sentence → transcript, the winner, and the billing finding.

## P-05b: Second language (Kannada) + Agora language limits

> 1. Using `lib/voice/languages.ts` (ARCHITECTURE §9.1), start a session with `language=kn-IN`: `turnDetection.language: 'kn-IN'`, Deepgram managed `multi` (then Sarvam `kn-IN`), and a Murf Kannada voice (find its ID the same way as P-02, with locale `kn-IN`).
> 2. Speak 3 Kannada sentences (have a Kannada speaker help, or use Google Translate audio): a visit report with BP 150/100, "yes, send it", "follow-up in 3 days". Record the transcripts.
> 3. Make one **raw REST** join call (bypassing the SDK's check) with `turn_detection.language: "mr-IN"` to see whether the Agora *API* accepts Marathi. Use the `agora-agents` request body printed by `agent.toProperties()` with the language edited, sent with `fetch` to the join endpoint. Use the auth the SDK uses; if that's unclear, report it and stop.
>
> **Pass:** the Kannada session greets, understands the BP numbers, and replies in Kannada.
> **Report:** Kannada transcripts per ASR, the Murf `kn-IN` voice ID used, and the exact Agora response for `mr-IN`.

## P-06: Choose the LLM (free tier, Hindi, latency)

> 1. Open https://vercel.com/ai-gateway/models?freeTier=true and list the free-tier **language** models and **embedding** models (IDs exactly as shown).
> 2. Write `scripts/llm-bench.mjs`. For each of up to 4 free language models:
>    - `streamText` with our system prompt (`lib/prompt.ts` once it exists; otherwise "Reply in Devanagari Hindi, max 2 sentences") and the user message *"Sunita ji ka BP 150/100 hai, 7 mahine, kya karna chahiye?"*;
>    - also one tool-calling test: a `recordVisit` tool with a zod schema, to check the model calls it with correct numbers.
>    - Measure time-to-first-token and total time over 3 runs.
> 3. Check that the Gateway dashboard still shows $0 of purchased credit.
>
> **Pass:** at least one model returns correct Devanagari, calls the tool with `bp_sys: 150, bp_dia: 100, gestation_weeks: ~28`, and has a TTFT under ~1 s.
> **Report:** a table of model → TTFT, total, Hindi quality (1–5), tool-call correct (y/n). Recommend `LLM_MODEL` and 2 `LLM_FALLBACKS`. List the free embedding model IDs with their dimensions.

## P-07: Contract checks after I deliver Phase 1 code

> Pull the latest code. Run `pnpm install && pnpm typecheck && pnpm lint && pnpm verify:api && pnpm build`. Deploy. Then run `node scripts/verify-sse.mjs https://<prod>/api/chat/completions $LLM_SHARED_SECRET`, and also run it once with a wrong secret.
>
> **Pass:** all commands are green, SSE prints Hindi chunks ending in `[DONE]`, and the wrong secret returns 401.
> **Report:** the full output of any failing command.

## P-08: Extract guideline text with page numbers (RAG corpus + rules)

> Download and read these PDFs:
> - ICMR STW antenatal: https://www.icmr.gov.in/icmrobject/uploads/STWs/1725952342_obg_antenatal_management.pdf
> - NHM CHO Booklet Maternal Health: https://nhm.gov.in/New_Update-2022-23/MH/GUIDELINES-%20MH/CHO_Booklet_%20Maternal_Health-English.pdf
> - PMSMA guidelines: https://nhm.gov.in/images/pdf/programmes/maternal-health/guidelines/Pradhan_Mantri_Surakshit_Matritva_Abhiyan.pdf
> - Plus any official MoHFW/NHM ASHA module page on **danger signs during pregnancy** you can find (give the URL).
>
> Create `knowledge/<id>.md` per source with front-matter (`id, title, source_url, publisher, lang`). Copy the **verbatim** sections on: high-risk criteria, BP thresholds, haemoglobin/anaemia, danger signs, counselling/nutrition advice and referral. Put a `Page: N` line under each heading.
>
> Then make `knowledge/RULES_EVIDENCE.md`: a table of rule → threshold → exact quote → source id → page. Only include rules that you found quoted.
>
> **Pass:** every rule in the table has a verbatim quote and a page number.
> **Report:** the table and the list of files created. Flag anything ambiguous, e.g. "BP > 140/90 on 2 occasions": should a single reading be 'high' or 'watch + recheck'? I'll decide the rule wording from your quotes.

## P-09: Voice test of tools + rules

> With the Phase 2 code deployed and `pnpm db:seed` run, make a call and say: *"Sunita ji ke ghar gayi, saat mahine, BP 150 by 100, pairon mein sujan hai."*
>
> **Pass:**
> - a `visits` row with `bp_sys=150, bp_dia=100, gestation_weeks≈28, risk_level='high'`;
> - the agent speaks the risk + reason in Hindi;
> - the `events` table shows `findBeneficiary` then `recordVisit`.
>
> **Report:** the SQL output of `select * from visits order by visited_at desc limit 1;` and `select name, ok, ms from events order by id desc limit 10;`, plus what the agent said.

## P-10: pgvector + ingest + RAG eval

> 1. In the Neon SQL editor, run `create extension if not exists vector; create extension if not exists pg_trgm;`.
> 2. Set `EMBEDDING_MODEL` (from P-06) and `EMBEDDING_DIM`. Run `pnpm db:migrate && pnpm kb:ingest`, then run it again to prove idempotency (the second run should say 0 embedded).
> 3. Run `pnpm test:rag`.
>
> **Pass:** ingest succeeds, the second run skips everything, and at least 6 of 8 eval questions retrieve the expected source in the top 3.
> **Report:** the ingest logs from both runs, the eval table, and which retrieval path was used (vector or keyword).

## P-11: Twilio WhatsApp sandbox

> 1. In the Twilio Console, go to Messaging → Try it out → Send a WhatsApp message. On **my phone** and the **"doctor" phone**, send `join <code>` to +1 415 523 8886.
> 2. Set the `TWILIO_*` env vars and `NOTIFIER=twilio`, then deploy.
> 3. In a call: report the Sunita visit → agent asks to send → say "haan bhej do" → then say "haan" again.
>
> **Pass:** **exactly one** WhatsApp arrives on the doctor phone in Hindi, and the second "haan" doesn't send another.
> **Report:** a screenshot of the WhatsApp message, plus `select status, idempotency_key, provider_id from alerts order by created_at desc limit 3;`.

## P-12: UI check

> Open the production URL on (a) my Android phone in Chrome and (b) a 1920×1080 desktop window. Run the Sunita flow.
>
> **Pass:**
> - the risk card appears within ~2 s of the agent speaking;
> - the timeline shows tool calls;
> - nothing overflows;
> - Devanagari renders correctly.
>
> **Report:** screenshots of both, plus a list of visual issues.

## P-13: Rehearsal + quota check (Fri night)

> 1. Run `/api/admin/reset`, then `node scripts/warmup.mjs`.
> 2. Run the full 3-minute demo script (IMPLEMENTATION_PLAN Phase 7) 3 times and time each run.
> 3. Record quotas used and remaining: Agora minutes, Murf characters, AI Gateway $ (must be $0 purchased), Twilio messages, Neon storage.
> 4. Record a 90 s screen video of the best run with audio.
>
> **Report:** the 3 run times, any failures (with the timestamp and the Vercel log line), and the quota table.
