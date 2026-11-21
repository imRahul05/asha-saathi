# 06 Interfaces

> Contracts at repo boundaries: API routes, env vars, runtime events, and shared TypeScript payloads.

## HTTP Route Contracts

### `GET /api/generate-agora-token`

Query params:

- `uid` optional; invalid/zero resolves to random RTM-safe UID.
- `channel` optional; defaults to generated `ai-conversation-<ts>-<rand>`.

Success response:

```json
{ "token": "...", "uid": "1234", "channel": "ai-conversation-..." }
```

Failure response: `{ "error": string, "details"?: string }` with `500`.

### `POST /api/invite-agent`

Body (`ClientStartRequest`):

```json
{ "requester_id": "1234", "channel_name": "ai-conversation-..." }
```

Success (`AgentResponse`):

```json
{ "agent_id": "...", "create_ts": 1710000000, "state": "RUNNING" }
```

Validation failures return `400`; server failures return `500`.

### `POST /api/stop-conversation`

Body (`StopConversationRequest`): `{ "agent_id": "..." }`.

Responses:

- `{ "success": true }`
- `{ "success": true, "state": "already-stopping" }` for idempotent stop state
- `{ "error": string }` on failure

### `POST /api/chat/completions`

Optional SSE proxy path (not default runtime path). Requires `NEXT_LLM_API_KEY` and `NEXT_LLM_URL` when used.

## Event/Data Interfaces

- RTM transcript/state/metrics/errors consumed through `AgoraVoiceAI` event emitter.
- Raw RTM `message` event parsed as fallback for `message.error` and `message.sal_status` payloads.
- `AGENT_METRICS` payloads displayed by `QuickstartPipelineMetrics`.

## Environment Contract

Required:

- `NEXT_PUBLIC_AGORA_APP_ID`
- `NEXT_AGORA_APP_CERTIFICATE`

This is the complete base `.env.local` contract. The optional BYOK route and provider snippets use additional variables only when a developer explicitly enables them.

## Test Coverage for Interfaces

- `scripts/verify-api-contracts.ts` asserts token generation, input validation, env failures, and SSE framing cases.

## Shared Client-Side Interfaces

From `types/conversation.ts` (high-use):

- `AgoraTokenData`: token bootstrap payload consumed by `LandingPage`.
- `AgoraRenewalTokens`: renewal callback result (`rtcToken`, `rtmToken`).
- `ConversationComponentProps`: runtime dependencies for in-call component.

## Interface Invariants

- Token payload must always include `token`, `uid`, `channel`.
- Invite route requires both `requester_id` and `channel_name`.
- Stop route requires `agent_id`; missing should never be tolerated silently.
- Token route should always return UID as string for downstream compatibility.

## Event Interface Notes

- Metrics stream entries are append-only in component state, capped to recent window.
- Connection issue records carry `source`, `agentUserId`, code/message, timestamp.
- SAL and signaling fallback payloads are parsed defensively because message schema can vary.

## Errors the browser must handle

- `401 SESSION_EXPIRED` (token and agent routes): the signed-in account no longer exists. `401 SIGN_IN_REQUIRED`: no valid cookie. Both send the user to `/login?expired=1`.

## Automatic alert with a countdown (HIGH and URGENT)

- After a HIGH or URGENT visit is saved the screen (`AlertBar`) counts down 10 s with Cancel and Send now, then calls `POST /api/alerts/send` (draft + send, once-only). The agent does NOT draft or send for these visits; it tells her the doctor will be alerted in 10 seconds unless she says stop or taps Cancel.
- Stop: the agent calls tool `holdAlert` (no input; works on the latest visit of the call; expires any unsent draft; refuses with `already_sent` if sent), or the Cancel tap calls `POST /api/alerts/hold {visitId}` (same tool). The snapshot visit carries `alertHeld` and `doctor` (the doctor's name before any alert exists).
- A spoken yes or send now, or her own request for an alert (any risk level), still uses `draftAlert` then `sendAlert`. Watch and normal visits are never auto-sent.

## Faster visit save and typed messages

- `recordVisit` takes either `beneficiaryId` or the mother's `name` (and optional `village`), so a spoken visit report is saved in ONE tool call (no `findBeneficiary` first). Several matches: error `AMBIGUOUS` with the candidates in the hint; none: `NOT_FOUND`; nothing is saved in either case. Measured live: first sound of the reply 4.7 s after she stops speaking (was 6.8 s).
- The `/api/mcp` route trusts the `X-Asha-Id` header (set by our own start route behind the shared secret) without a database lookup.
- The call screen has a typed-message box (`ai.chat` of the Agora client toolkit, text type, interrupting). It appears in the conversation like speech.
- The start button first asks for the microphone, so the agent is not started (and does not greet) while the browser permission box is open; a refusal shows a clear message. If the browser blocks sound, a banner with a button turns it on.

## Alerts from the screen

- `POST /api/alerts/send` body `{ visitId }` (session required): the ASHA's own tap on "Send now" / "Try again". It runs `draftAlert` then `sendAlert` (same tools as the voice agent: at most once, logged as events, only her own visits) and answers `{ ok, status, provider }`. The result card's `AlertBar` shows draft / failed / sent plus "Talk to the doctor".
- `sendAlert` takes an optional token: without it, the latest open draft of the signed-in ASHA is sent.
- With `NOTIFIER` unset the app only logs alerts; the bar says "Test mode: no real message was sent". `pnpm setup:local` sets `NOTIFIER=multi` when Telegram or Twilio credentials exist.

## Guideline search

- Tool `searchGuidelines({ query })` (8th MCP tool). `query` is 3 to 200 characters of English keywords. Returns `{ found: true, rules, passages: [{ source, page, text }] }` or `{ found: false, hint }`. Passages come from `kb_chunks` (verbatim official quotes). A passage must match at least two content words of the query, so off-topic questions return nothing.
- `pnpm kb:verify` (quotes vs official PDFs), `pnpm kb:check` (retrieval questions, embedded Postgres), `pnpm kb:ingest` (idempotent load).

## Correcting a visit

- Tool `amendLastVisit({ bpSys?, bpDia?, hb?, gestationWeeks?, symptoms?, notes? })` (9th MCP tool). At least one field; only named fields change (`symptoms` replaces the list). It targets only the latest visit of the current call (`ctx.sessionId`) and the signed-in ASHA, else `NO_VISIT_IN_CALL`. BP must stay complete and ordered after merging (`BP_INCOMPLETE`, `BP_ORDER`).
- The risk is recomputed by `assessAnc` on the merged values (`rules_version` follows the engine); the model never sets it. Result: `{ visitId, corrected, vitals, previousRiskLevel, riskChanged, risk, alert, nextStep }`.
- `alert`: `already_sent` (a sent alert is never resent; the agent says the doctor has the old values and offers a new alert only if `riskChanged`), `draft_cancelled` (unsent draft or failed alert is expired so the old message cannot be sent; `draftAlert` builds a fresh one), or `none`.

## Doctor call routes

- `GET /api/call/link?visit=<id>` (session required): returns signed `asha` and `doctor` call URLs for one of the signed-in ASHA's visits.
- `POST /api/call/join` body `{ t }` (no session; the signed link is the credential): returns `{ appId, channel, uid, token, role, summary }`. Channel is `call-<visitId>`; UIDs are fixed per role (doctor 7001, asha 7002). `401 LINK_INVALID` for bad or expired links.
- `POST /api/call/event` body `{ t, type: 'joined'|'left' }` (no session; the signed link is the credential): logs one `events` row (`type` 'call', `name` 'doctorCall', `input` `{ role, event, visitId }`) under the visit's `session_id`, so the call shows in the visit timeline. `401 LINK_INVALID` for bad links; the same role+event for the same visit within 10 seconds is ignored (`{ ok, duplicate: true }`). `CallRoom` sends it with `sendBeacon` (fetch keepalive fallback) after join and on leave/`pagehide`, never blocking the call. No schema change.
- `SnapshotVisit.call`: `{ doctorJoinedAt, lastEventAt }` derived from `doctorCall` events of the visit's session; `AlertBar` shows `doctorJoined(doctor)` once `doctorJoinedAt` is set.
- `/call/[t]` page: audio-only RTC in Communication mode (`mode: 'rtc'`), mute, leave.
- `POST /api/invite-agent` also takes `language` (one of `lib/languages.ts` codes) and optional `voice` (a Murf voice id from `lib/voices.ts` for that language; anything else falls back to the language default).
- `GET /api/session/state?since=<cursor>` and `/api/dashboard?since=` return `{ unchanged: true, cursor }` when nothing changed.

## Backward Compatibility Guidance

- If route response shape changes, update both client consumers and contract tests in same change.
- If adding fields, keep existing fields stable to avoid quickstart consumer breakage.
- Reflect interface changes in README and L1 docs to keep sample copyable.

## Related Deep Dives

- [conversation_lifecycle.md](L2/conversation_lifecycle.md) — How route contracts are used in sequence.
- [transcript_pipeline.md](L2/transcript_pipeline.md) — Event-level contract mapping.

## Schedule

- `Snapshot.schedule: SnapshotScheduleItem[]` (session state and dashboard): this ASHA's pending follow-ups that are overdue or due in the next 60 days, earliest first (then by name), at most 50. Each item is `{ id, dueDate (YYYY-MM-DD), beneficiary: { name, village }, reason, status: 'overdue' | 'today' | 'upcoming' }`. `status` is computed against today's date in Asia/Kolkata (`lib/dates.ts`). Data comes from `upcomingFollowUps` in `lib/db/repo.ts` (strictly scoped to the ASHA). Follow-up due dates are also computed in Asia/Kolkata (`insertFollowUp`).
- Polling: creating a follow-up goes through `executeTool`, which logs an event, so the `?since=` cursor moves and the schedule is rebuilt. A date rollover alone does not move the cursor.
- Tool `upcomingVisits({ days? })` (11th MCP tool; `days` 1 to 30, default 7). Returns `{ count, visits: [{ name, village, dueDate, when: 'overdue' | 'today' | 'tomorrow' | 'in N days', reason }], hint }`; the hint tells the model to read at most the next 5 aloud and say how many more. `todaySummary` stays for "aaj ka kaam".
