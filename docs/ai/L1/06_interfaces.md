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

## Alerts from the screen

- `POST /api/alerts/send` body `{ visitId }` (session required): the ASHA's own tap on "Send now" / "Try again". It runs `draftAlert` then `sendAlert` (same tools as the voice agent: at most once, logged as events, only her own visits) and answers `{ ok, status, provider }`. The result card's `AlertBar` shows draft / failed / sent plus "Talk to the doctor".
- `sendAlert` takes an optional token: without it, the latest open draft of the signed-in ASHA is sent.
- With `NOTIFIER` unset the app only logs alerts; the bar says "Test mode: no real message was sent". `pnpm setup:local` sets `NOTIFIER=multi` when Telegram or Twilio credentials exist.

## Guideline search

- Tool `searchGuidelines({ query })` (8th MCP tool). `query` is 3 to 200 characters of English keywords. Returns `{ found: true, rules, passages: [{ source, page, text }] }` or `{ found: false, hint }`. Passages come from `kb_chunks` (verbatim official quotes). A passage must match at least two content words of the query, so off-topic questions return nothing.
- `pnpm kb:verify` (quotes vs official PDFs), `pnpm kb:check` (retrieval questions, embedded Postgres), `pnpm kb:ingest` (idempotent load).

## Doctor call routes

- `GET /api/call/link?visit=<id>` (session required): returns signed `asha` and `doctor` call URLs for one of the signed-in ASHA's visits.
- `POST /api/call/join` body `{ t }` (no session; the signed link is the credential): returns `{ appId, channel, uid, token, role, summary }`. Channel is `call-<visitId>`; UIDs are fixed per role (doctor 7001, asha 7002). `401 LINK_INVALID` for bad or expired links.
- `POST /api/call/event` body `{ t, type: 'joined'|'left' }` (no session; the signed link is the credential): logs one `events` row (`type` 'call', `name` 'doctorCall', `input` `{ role, event, visitId }`) under the visit's `session_id`, so the call shows in the visit timeline. `401 LINK_INVALID` for bad links; the same role+event for the same visit within 10 seconds is ignored (`{ ok, duplicate: true }`). `CallRoom` sends it with `sendBeacon` (fetch keepalive fallback) after join and on leave/`pagehide`, never blocking the call. No schema change.
- `SnapshotVisit.call`: `{ doctorJoinedAt, lastEventAt }` derived from `doctorCall` events of the visit's session; `AlertBar` shows `doctorJoined(doctor)` once `doctorJoinedAt` is set.
- `/call/[t]` page: audio-only RTC in Communication mode (`mode: 'rtc'`), mute, leave.
- `POST /api/invite-agent` also takes `language` (one of `lib/languages.ts` codes).
- `GET /api/session/state?since=<cursor>` and `/api/dashboard?since=` return `{ unchanged: true, cursor }` when nothing changed.

## Backward Compatibility Guidance

- If route response shape changes, update both client consumers and contract tests in same change.
- If adding fields, keep existing fields stable to avoid quickstart consumer breakage.
- Reflect interface changes in README and L1 docs to keep sample copyable.

## Related Deep Dives

- [conversation_lifecycle.md](L2/conversation_lifecycle.md) — How route contracts are used in sequence.
- [transcript_pipeline.md](L2/transcript_pipeline.md) — Event-level contract mapping.
