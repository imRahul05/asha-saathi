# ASHA Saathi: remaining work, as separate prompts

State on 20 Nov 2026 (the day before the demo). The core is built and live: voice agent with managed ASR + LLM and a Murf voice, 7 MCP tools, cited risk rules, Neon database, demo sign-in with a usage guard, live screens and a projector dashboard. 84 tests pass.

| # | Task | Plan phase | Who | Needs from you | Touches (ownership) |
|---|---|---|---|---|---|
| A | Guideline Q&A with citations (RAG) | 3 | agent | nothing | `lib/rag/`, `scripts/kb-ingest.ts`, `lib/tools/search-guidelines.ts`, `knowledge/`, schema (append only) |
| B | Real WhatsApp alerts (Twilio) + retry | 4 | agent | Twilio account, the doctor's phone | `lib/notify/`, `app/api/alerts/`, `components/asha/AlertSent.tsx` |
| C | Admin screen: register mothers, set the doctor's phone | new | agent | nothing | `app/admin/`, `app/api/admin/`, new functions at the end of `lib/db/repo.ts` |
| D | Hardening + QA: amend a visit, reset/warmup, language tests, latency | 6 | agent + you (voice calls) | a phone/mic for 3-minute calls | `lib/tools/amend-visit.ts`, `scripts/`, `docs/QA_LOG.md`, prompt wording |
| E | Real accounts with Neon Auth (optional) | new | agent | your go-ahead, Neon project access | `lib/auth/`, `app/login/`, `components/asha/LoginCard.tsx` |
| F | Pitch: script, slides, backup video | 7 | you (+ an agent for text) | your recording | `docs/PITCH.md` |

Do A, B, C in parallel. D after A/B land (it tunes the prompt and tests the whole flow). E only if you decide you want it. Each branch from `main`, one PR per task, small commits.

---

## Shared context (paste this first in every task)

> You are working on ASHA Saathi, a Next.js 16 + TypeScript voice assistant for ASHA health workers, deployed on Vercel at https://asha-saathi-mocha.vercel.app. Repo: `imRahul05/asha-saathi`. Read `README.md`, `ARCHITECTURE.md` (sections 7, 8, 9) and `knowledge/RULES_EVIDENCE.md` first.
>
> How it works: Agora's managed LLM talks to our MCP tool server (`app/api/mcp/route.ts`), which runs tools from `lib/tools/` against a Neon Postgres database through `lib/db/repo.ts`. Risk is decided by `lib/rules/anc.v1.ts` (never by the model). Screens read live data from `lib/snapshot.ts` via `/api/session/state` and `/api/dashboard`. Sign-in is a signed cookie (`lib/auth/`); every route that costs money or shows data requires it.
>
> Rules:
> 1. Never commit secrets. Keys live only in `.env.local` (gitignored) and Vercel env vars. Never print a secret value.
> 2. Run before every commit: `pnpm exec tsc --noEmit`, `pnpm test`, `pnpm lint`. Run `pnpm build` before a PR. All must be clean.
> 3. Database code is tested against embedded Postgres (`lib/db/test-db.ts`), so you do not need Neon for tests. Do not run destructive SQL on the real Neon database. `pnpm db:migrate` is safe (idempotent); `db:seed --reset` is not.
> 4. The Agora free allowance is 300 agent-minutes in total. Do NOT start voice agents unless the task says so, and then keep each call under 3 minutes and stop it immediately (`POST /api/stop-conversation`).
> 5. Stay inside the files your task owns. If you must change a shared file (`lib/tools/index.ts`, `lib/prompt.ts`, `db/schema.sql`), make a small additive change and say so in the PR.
> 6. Clinical content: never invent medical facts, thresholds or advice. Anything clinical must come from `knowledge/` with its page number, or be shown as "pending evidence".
> 7. Git: branch from `main`, descriptive commit messages, no AI attribution lines or co-author trailers in commits or PR text. Do not push to `main` and do not merge.
> 8. If a step fails twice, stop and report the exact error instead of changing the architecture.
>
> End with a report: what changed (files), how you verified it (commands and real output), what is still open.

---

## Task A: Guideline Q&A with citations (RAG)

> Goal: the ASHA can ask "what should I tell the family about high BP?" or "anaemia mein kya khilayein?" and Saathi answers ONLY from the official guideline text in `knowledge/*.md`, saying where it came from. Today the prompt makes it decline medical advice because there is no retrieval.
>
> Build:
> 1. `db/schema.sql` (append only): table `kb_chunks(id text primary key, doc_id text, title text, heading text, page text, url text, content text, tsv tsvector generated always as (to_tsvector('english', content)) stored, embedding vector(N) null, model text, hash text)` plus a GIN index on `tsv`. Make the vector part optional: wrap `create extension vector` so the migration still succeeds if it is unavailable, and keep keyword search working without it.
> 2. `scripts/kb-ingest.ts` (`pnpm kb:ingest`): chunk each `knowledge/<id>.md` by `##` heading (about 600-900 characters, keep `Page: N` and the source URL from the front-matter), compute a content hash, upsert only new or changed chunks. Re-running must report 0 changed. Embeddings are optional: if `EMBEDDING_MODEL` and an AI Gateway key are set, embed; otherwise skip embeddings and rely on keyword search. Do not make the app depend on embeddings.
> 3. `lib/rag/retrieve.ts`: `retrieve(db, query)` returns the top 3 chunks (at most 1,800 characters in total) as `{text, title, page, url}`. Use Postgres full-text rank (`ts_rank`) with an ANDed-then-ORed `websearch_to_tsquery`; if embeddings exist, fuse the two rankings (reciprocal rank fusion). The model passes the query in ENGLISH (the corpus is English), so the tool description must say so.
> 4. `lib/tools/search-guidelines.ts`: tool `searchGuidelines({query: string (English), topic?: enum})` returning `{chunks:[{text,title,page,url}], hint}`. If nothing relevant is found it returns an empty list and a hint to say "I don't have this information, ask the Medical Officer" in the ASHA's language. Register it in `lib/tools/index.ts` (one line) so the MCP route and the agent's `allowed_tools` pick it up.
> 5. `lib/prompt.ts`: replace ONLY the paragraph that says guidelines are not loaded. New rule: health advice may be given only from `searchGuidelines` results, in one or two short sentences, naming the source (for example "ICMR guideline"); if the tool returns nothing, say you do not have it and refer to the Medical Officer.
> 6. Citations on screen: extend the snapshot so the saved visit panel can show a source chip for an answer. Keep it small; use the existing chip style in `components/asha/RiskResult.tsx`.
> 7. Tests: `lib/rag/retrieve.test.ts` with 8 questions (Hindi-translated-to-English queries) and the expected `doc_id`/heading in the top 3, run on embedded Postgres after ingesting `knowledge/`. Target at least 6 of 8. Include a test that an off-topic query returns nothing.
>
> Out of scope: changing the risk rules, the dashboard, WhatsApp, new clinical text. If `knowledge/` has too little counselling/nutrition text for the questions, say so in your report instead of writing advice yourself.
>
> Done when: `pnpm kb:ingest` twice (second run: 0 changed), `pnpm test` green, and `pnpm verify:mcp` lists 8 tools.

---

## Task B: Real WhatsApp alerts (Twilio) + retry

> Goal: when the ASHA says yes, exactly one real WhatsApp message arrives on the doctor's phone, and a failed send can be retried from the screen. `lib/notify/index.ts` already has a Twilio notifier (REST, no SDK) that has never been run with real credentials.
>
> Setup (the human does this, ask them): a Twilio trial account, Messaging > Try it out > Send a WhatsApp message, then the doctor's phone sends `join <code>` to the sandbox number. Env vars: `NOTIFIER=twilio`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM` (default `whatsapp:+14155238886`). The doctor's number lives in `ashas.doctor_phone` in E.164 (+91...).
>
> Build and verify:
> 1. Run the notifier once for real with a one-off script `scripts/send-test-alert.ts <phone>` (prints Twilio's message SID or the exact error, never the token). Confirm the message arrives. Fix `twilioNotifier` if it does not (trial accounts only deliver to joined numbers; handle the 63015/63016 style errors with a clear message).
> 2. Delivery status: store Twilio's initial status from the response. Add `app/api/alerts/[id]/retry/route.ts` (POST, signed-in ASHA only, only for an alert of her own with status `failed`) that re-claims and re-sends through the same atomic path as `sendAlert`. Reuse the repository functions; do not duplicate the claim logic.
> 3. Screen: in `components/asha/AlertSent.tsx`, when the status is `failed` show a "Retry" button that calls the route and refreshes; keep the existing visuals.
> 4. Tests (embedded Postgres, fake notifier): retry only works on `failed`, only for the owner, sends once even if clicked twice.
> 5. Hindi message: keep the template English text, and add a one-line Hindi summary at the top built from fixed templates in `lib/alerts/message.ts` (no model involved). Update the existing message tests.
>
> Out of scope: the voice prompt, other tools, Neon schema changes beyond an optional `provider_status` column (additive).
>
> Done when: a real WhatsApp message arrived once, a second "haan" sent nothing, a forced failure shows Retry and the retry delivers. Include a screenshot or the Twilio SID in the report.

---

## Task C: Admin screen (register mothers, set the doctor's phone)

> Goal: today mothers are only created by `pnpm db:seed`. A real health centre needs a screen to register them, and to set which doctor's phone gets alerts. Build a small admin area for the template ASHA (the non-demo one) that demo copies are cloned from.
>
> Build:
> 1. Access: `/admin` protected by an `ADMIN_KEY` env var (same pattern as `DASHBOARD_KEY` in `app/api/dashboard/route.ts`: timing-safe compare, key in the URL query then kept in memory). Fail closed if `ADMIN_KEY` is unset in production. Do NOT use the demo session for this.
> 2. API under `app/api/admin/`: list/create/update/delete mothers of the template ASHA (name, aliases for Hindi/Kannada spellings, village, phone, age, parity, last menstrual period), and read/update the template ASHA's `doctor_name` and `doctor_phone`. Validate every input with zod in `lib/schemas.ts` (age 10-60, parity 0-20, LMP not in the future and not older than 44 weeks, phone in E.164). Add the repository functions at the END of `lib/db/repo.ts`.
> 3. UI: `app/admin/page.tsx` with a mobile-first table/list, an add/edit form (Base UI primitives from `@base-ui/react`; there are wrappers in `components/ui/`), and a clear empty state. Use the existing colour tokens (`asha-*` in `tailwind.config.ts`). Show the mother's current weeks of pregnancy computed from LMP.
> 4. Editing the template does not change existing demo copies; say that in the UI help text.
> 5. Tests: repository functions and the validation (embedded Postgres), including that a mother of another ASHA cannot be edited through the template routes.
>
> Out of scope: login for ASHAs, per-ASHA admin, deleting visit history.
>
> Done when: you can add a mother in the browser, then a new demo sign-in contains her, and `findBeneficiary` finds her by her Hindi alias. Include a screenshot at 390px and 1440px.

---

## Task D: Hardening and QA

> Goal: make the end-to-end voice flow reliable and prove it. You need the human for the real calls: ask them to do each 3-minute call, then read the evidence from the database and Vercel logs (`vercel logs --since 10m --query "[mcp]"`).
>
> Build:
> 1. `lib/tools/amend-visit.ts`: tool `amendLastVisit({visitId, bpSys?, bpDia?, hb?, symptoms?})` so the ASHA can say "no, it was 140 by 90". It must re-run `assessAnc`, update the same visit row, refuse visits older than 30 minutes or not owned by the ASHA, log the change in `events`, and tell the agent the new risk. Register it in `lib/tools/index.ts`. Tests first.
> 2. `scripts/warmup.ts` (`pnpm warmup <base-url>`): wakes the database and the MCP route (`tools/list`, `todaySummary`) and prints timings. Add a demo reset that deletes ALL demo ASHAs and the usage-guard rows (not the template), behind `pnpm demo:reset` with a typed confirmation.
> 3. Voice QA log `docs/QA_LOG.md`. With the human, run these calls and record the transcript, which tools ran, the risk level and any problem: (a) the demo sentence "Sunita ji ke ghar gayi thi, saat mahine, BP ek sau pachaas by sau, pairon mein sujan" (expect a HIGH visit for Sunita Devi, 28 weeks); (b) the same in Kannada, then in English; (c) switching language in the middle of one call; (d) an ambiguous name ("Sunita" matches two mothers: the agent must ask which); (e) a wrong number the speech recogniser mishears; (f) "haan" said twice (one alert only); (g) "aaj ka kaam batao". For each failure find the cause (prompt wording, tool description, or speech recognition) and fix the smallest thing, keeping `lib/prompt.ts` edits minimal and coordinated with Task A.
> 4. Language test (plan P-05/P-05b): for Hindi, Kannada and English record whether Deepgram `multi` transcribed names and numbers correctly and whether the reply language followed. If one language fails, report the exact transcripts; do not change vendors without asking.
> 5. Latency: from the browser's metrics (`enable_metrics`) or logs note speech-end-to-first-audio over 5 turns. Report the median and the slowest turn.
> 6. Security pass: confirm every route that costs money or exposes data requires the session or a key (`/api/chat/completions` is an unused template route and should be removed or gated), and that no secret appears in client bundles.
>
> Done when: `docs/QA_LOG.md` has the 7 calls with pass/fail, every fail has a fix or a documented limitation, and the tests are green.

---

## Task E (optional): Real accounts with Neon Auth

> Only start this when the human says to. It changes their Neon project: it enables Neon's managed Better Auth and writes environment variables.
>
> Goal: real sign-up and sign-in next to the existing one-tap demo, without breaking the demo path. Follow Neon's own skill (https://neon.com/docs/ai/skills/neon-auth/SKILL.md) and the steps the human has: `neon init -y --project-id <their project id> --branch production --services postgres,auth`, then `neon deploy`. Do not print secrets.
>
> Design constraints:
> - The demo button stays the default and fastest path. Real sign-in is a second, smaller option on `/login`.
> - Map an authenticated user to an `ashas` row (add a nullable `user_id` column, additive migration). A new user gets a fresh ASHA (empty registry), not a copy of the template.
> - Keep our own signed session cookie as the thing every route checks (`lib/auth/session.ts`, `mode: 'user'`), created after Neon Auth verifies the user. Do not scatter a second auth system through the routes.
> - ASHAs share phones and often have no email. Before building, check whether Neon Auth supports phone OTP; if not, say so and propose a health-centre-issued code instead, rather than shipping email-only as "the" answer.
> - Tests for the mapping and for the cookie; then prove it with a real test user (sign up, then read the current user back).

---

## Task F: Pitch (mostly you)

> The 3-minute script is in `IMPLEMENTATION_PLAN.md` (Phase 7). Things to prepare: a 90-second backup screen recording with audio of the best run; the one-sentence safety line ("the AI never decides who is high risk; written rules do, and every alert needs a spoken yes"); an honest limits slide (BP single-reading decision and the three rules without a source; see README "Evidence and honest limits"); the architecture diagram from `README.md`; and a rehearsal with the usage limits reset (`pnpm demo:reset` after Task D). Quote no statistic unless you can name its source.
