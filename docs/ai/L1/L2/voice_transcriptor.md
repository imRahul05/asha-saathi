# Visit Scribe (voice transcriptor)

Status: server pipeline only (feature branch `feat/voice-transcriptor`). The phone recorder, offline queue and check screen are later PRs. Design page: the "Visit Scribe" artifact shared with the team.

The ASHA records a real home visit. The audio becomes text, a language model fills in the visit details with a quote for each, code checks those quotes against the transcript, and the ASHA confirms before anything is saved.

## Flow

1. `POST /api/scribe` `{clientId, language, mime}` starts a recording. The same `clientId` returns the same recording (safe retries).
2. `PUT /api/scribe/{id}/chunk?index=N` (raw bytes, at most 4 MB, index 0 to 599) stores one piece. Repeating an index replaces it.
3. `POST /api/scribe/{id}/process` `{chunkCount}` joins the pieces, transcribes (`lib/scribe/stt-murf.ts`), extracts (`lib/scribe/extract.ts`), checks (`lib/scribe/verify.ts`), looks up the mother, stores the result and deletes the audio. Safe to call again.
4. `GET /api/scribe/{id}` returns status, transcript, checked fields, candidate mothers.
5. `POST /api/scribe/{id}/confirm` saves the visit through the `recordVisit` tool (same rules, duplicate protection and event log as the voice call). Saves once.
6. `DELETE /api/scribe/{id}` discards the recording and its text.

Errors are `{error, message, retryable}` with a stable code (see `lib/scribe/http.ts`). `MISSING_CHUNKS` (409) means send those pieces again.

## Safety checks (lib/scribe/verify.ts)

The model is not trusted. Code checks, in this order: the quote is in the transcript word for word; a number in the quote equals the value (or the value is flagged as converted or spoken in words); denied (`absent`) and past (`historical`) things are removed so they cannot start an alert; a value from `other` or `unsure` speakers is flagged; blood pressure needs both numbers with the top higher; values outside `visitShape` ranges are removed. Dropped values are kept with a reason.

## Swappable parts

`SpeechToText` and `Extractor` interfaces in `lib/scribe/types.ts`. The pipeline (`lib/scribe/pipeline.ts`) takes them as arguments, so tests run with fakes and a vendor can change without touching the checks, rules or UI. Murf rejects WebM and MP4; the recording format is decided after the speech bake-off.

## Data and cost

Tables `visit_scribes` and `scribe_chunks` (audio as base64 text, deleted after a successful transcription). Recordings are scoped to one ASHA. Processing is limited by `guardScribe` in `lib/guard.ts` (`agent_starts` rows of kind `scribe`).

## Env

`MURF_API_KEY` (and optional `MURF_STT_URL`), `SCRIBE_LLM_API_KEY` or `OPENAI_API_KEY`, optional `SCRIBE_LLM_BASE_URL`, `SCRIBE_LLM_MODEL`, `SCRIBE_PER_ASHA_HOUR`, `SCRIBE_PER_IP_HOUR`, `SCRIBE_PER_DAY`.

## Coupled files

`lib/scribe/*`, `lib/db/scribe-repo.ts`, `app/api/scribe/**`, `db/schema.sql` (scribe tables, `agent_starts.kind`), `lib/guard.ts`.
