# ASHA Saathi

A voice assistant for ASHA health workers in India. After a home visit the ASHA talks to it in Hindi, Kannada or English. It records the visit, flags danger signs with fixed clinical rules, and alerts the doctor on WhatsApp after she says yes.

Built for **Build with Agora, Bengaluru (Track 5: Voice AI for Bharat)** on Agora Conversational AI, Murf Falcon text-to-speech, Next.js and Neon Postgres.

## How an ASHA uses it

1. Open the app and tap the orange orb. No sign-up.
2. Say who you visited and what you found: *"Sunita ji ke ghar gayi thi, saat mahine, BP 150 by 100, pairon mein sujan."*
3. Saathi finds the mother, saves the visit and says the risk level and the main reason out loud.
4. For high risk it asks *"Doctor ko alert bhejoon?"* Say *haan* and one WhatsApp message goes to the doctor. Saying it twice never sends two.
5. Saathi books the follow-up visit. `Aaj ka kaam batao` lists what is left today.

The screen shows the same thing the voice says: the saved visit, risk, the rule behind it, the alert and the follow-up. `/dashboard` is a read-only projector view of the live activity.

## How it works

```
Browser (mic + speaker) ── Agora RTC ──> Agora Conversational AI
                                          ├─ speech recognition (Deepgram, Agora-managed)
                                          ├─ language model     (gpt-4o-mini, Agora-managed)
                                          └─ voice              (Murf Falcon, our key)
                                              │  the model calls our tools over MCP
                                              ▼
                  Vercel (this app) /api/mcp ── tools ── Neon Postgres
                       │                          └── risk rules (lib/rules/anc.v1.ts)
                       └── /api/session/state, /api/dashboard  → screens read live data
```

Why it is built this way:

- **The AI never decides risk.** `recordVisit` runs a deterministic, unit-tested rules function. The model only listens, speaks and calls tools. It cannot change a risk level.
- **Two-step alerts.** `draftAlert` prepares the message and sends nothing. `sendAlert` needs the confirmation token, works once (atomic database claim), expires after 10 minutes and can be retried if delivery fails.
- **Every number is validated.** Tool inputs are checked with zod, so a speech-recognition slip like BP 999 is rejected instead of saved.
- **Everything is observable.** Each tool call is stored with its timing and shown in the dashboard timeline.
- **Tools never throw.** A failure becomes a plain message the agent can say.

## Evidence and honest limits

Rule thresholds come from the official documents we hold. See `knowledge/RULES_EVIDENCE.md` for the verbatim quotes and page numbers (ICMR STW, NHM CHO booklet, PMSMA).

- **Cited** (quoted from ICMR STW page 1): BP above 140/90, Hb below 7, age under 19 or over 35, parity above 4, and the danger signs bleeding, convulsion, severe headache, blurred vision, reduced baby movement, fever, persistent vomiting, breathlessness and leaking fluid.
- **Not in those documents, so shown without a source** (`pending` in `lib/rules/anc.v1.ts`): the 160/110 severe-BP level, anaemia below 11, and swelling of face or hands. The app never shows a citation for these.
- **Product decisions a clinician should review:** the ICMR criterion is two BP readings 6 hours apart; we flag a single reading of 140/90 or more as high and tell the ASHA to repeat it after 6 hours. We treat 140 or 90 as the cut-off (the source writes "greater than"). Which danger signs are "urgent" rather than "high" is our mapping.
- Saathi gives **decision support and referral, never a diagnosis**. Guideline Q&A (advice for the family) is not built yet, so it declines to give medical advice from memory.

## Data and privacy

- Stores: ASHAs, registered mothers (name, village, age, parity, last period), visits, alerts, follow-ups and tool-call events, all in your Neon database.
- No login yet. The demo uses one seeded ASHA. A call's data is reachable only through its random channel name.
- `/dashboard` shows real patient data. **Set `DASHBOARD_KEY` in production** and open `/dashboard?key=...`.
- Use made-up data in demos. Do not seed real patients without proper consent and access control.

## Run it

Requirements: Node 22+, pnpm, an Agora project, a Murf API key, a Neon database.

```bash
pnpm install
cp env.local.example .env.local       # fill in the values (see the comments in that file)
pnpm db:migrate                       # create the tables (safe to repeat)
pnpm db:seed                          # one ASHA and six registered mothers (set SEED_DOCTOR_PHONE first)
pnpm dev                              # http://localhost:3000  (landing)  /app  (the voice app)
```

Agora cannot call `localhost`, so the voice agent needs a public `PUBLIC_BASE_URL` (a tunnel such as `cloudflared tunnel --url http://localhost:3000`, or your Vercel URL).

Deploy: `vercel deploy --prod`, with the same variables set in Vercel (Production and Preview) and Deployment Protection off for the production URL.

### Checks

```bash
pnpm test            # 69 tests: rules, tools + database (embedded Postgres), MCP over JSON-RPC, snapshots
pnpm typecheck
pnpm verify:mcp https://<your-app> $MCP_SHARED_SECRET           # read-only check of a running server
pnpm verify:mcp https://<your-app> $MCP_SHARED_SECRET --write   # also records a visit and sends one alert (creates data)
```

## Repo map

| Path | What it is |
|---|---|
| `lib/rules/anc.v1.ts` | the risk rules (pure, tested) with cited or pending evidence per rule |
| `lib/tools/` | the 7 tools the agent can call, and the registry both the server and the agent share |
| `app/api/mcp/route.ts` | the MCP tool server Agora's model calls (Bearer secret, scoped to one ASHA and one call) |
| `app/api/invite-agent/route.ts` | starts the voice agent (managed speech + model, Murf voice, our tools) |
| `lib/db/`, `db/schema.sql` | database client (Neon or local Postgres), repository, schema |
| `lib/snapshot.ts`, `app/api/session/state`, `app/api/dashboard` | what the screens read |
| `components/landing/`, `components/asha/` | landing page, voice screen, result and dashboard screens |
| `knowledge/` | verbatim guideline text with page numbers, and the rules evidence table |
| `ARCHITECTURE.md`, `IMPLEMENTATION_PLAN.md` | design and plan |

## Not built yet

Guideline Q&A with citations (RAG), real WhatsApp delivery (`NOTIFIER=twilio` is implemented but untested without credentials), an admin screen to register mothers (use `pnpm db:seed` or SQL for now), login and roles, and the call transcript on the dashboard.
