import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Agent, AgoraClient, Area, DeepgramSTT, ExpiresIn, MiniMaxTTS, MurfTTS, OpenAI } from 'agora-agents';
import type { AgentResponse } from '@/types/conversation';
import { DEFAULT_AGENT_UID } from '@/lib/agora';
import { buildSystemPrompt, FAILURE_MESSAGE, GREETING } from '@/lib/prompt';
import { TOOL_NAMES } from '@/lib/tools';
import { getDb, hasDatabase } from '@/lib/db/client';
import { firstAsha, getAsha } from '@/lib/db/repo';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Agora-managed LLMs (no vendor key needed): https://docs.agora.io/en/ai/build/managed-mode.md
const MANAGED_LLMS = ['gpt-4o-mini', 'gpt-4.1-mini', 'gpt-5-nano', 'gpt-5-mini'] as const;

const Body = z.object({
  requester_id: z.string().min(1).max(40),
  channel_name: z.string().min(1).max(120),
  asha_id: z.string().uuid().optional(),
});

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export async function POST(request: NextRequest) {
  try {
    const parsed = Body.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'requester_id and channel_name are required' }, { status: 400 });
    }
    const { requester_id, channel_name, asha_id } = parsed.data;

    // Which ASHA is calling. Used for the greeting context and so tool calls act on her mothers only.
    let ashaId: string | undefined;
    let ashaName: string | undefined;
    if (hasDatabase()) {
      const db = getDb();
      const asha = (asha_id ? await getAsha(db, asha_id) : null) ?? (await firstAsha(db));
      ashaId = asha?.id;
      ashaName = asha?.name;
    }

    const baseUrl = process.env.PUBLIC_BASE_URL ?? `https://${request.headers.get('host')}`;
    const llmModel: (typeof MANAGED_LLMS)[number] =
      MANAGED_LLMS.find((m) => m === process.env.LLM_MODEL) ?? 'gpt-4o-mini';
    const languages = (process.env.ASR_LANGUAGES ?? 'hi-IN,kn-IN,en-IN').split(',').map((s) => s.trim()).filter(Boolean);
    const murfKey = process.env.MURF_API_KEY;
    const murfVoice = process.env.MURF_VOICE_ID;
    const useMurf = Boolean(murfKey && murfVoice);
    if (!useMurf) console.warn('[invite-agent] MURF_API_KEY / MURF_VOICE_ID not set: falling back to the managed MiniMax voice');

    const client = new AgoraClient({
      area: Area.AP, // routes API calls through Asia-Pacific
      appId: requireEnv('NEXT_PUBLIC_AGORA_APP_ID'),
      appCertificate: requireEnv('NEXT_AGORA_APP_CERTIFICATE'),
    });

    const agent = new Agent({
      client,
      instructions: buildSystemPrompt({ ashaName }),
      greeting: GREETING,
      failureMessage: FAILURE_MESSAGE,
      maxHistory: 16,
      // Several languages in one session: the speech recogniser follows whichever the ASHA speaks. VAD because semantic end-of-speech is English/Chinese only.
      turnDetection: {
        language: languages as never,
        config: { end_of_speech: { mode: 'vad', vad_config: { silence_duration_ms: 640 } } },
      },
      advancedFeatures: { enable_rtm: true },
      parameters: { data_channel: 'rtm', enable_error_message: true, enable_metrics: true },
    })
      .withTools(true) // advanced_features.enable_tools: required for mcp_servers
      // Managed speech recognition: no apiKey, so the SDK picks the Agora preset deepgram_nova_3.
      .withStt(new DeepgramSTT({ model: 'nova-3', language: 'multi' }))
      // Managed LLM: no apiKey and no url, so the SDK picks the Agora preset for this model.
      .withLlm(
        new OpenAI({
          model: llmModel,
          greetingMessage: GREETING,
          failureMessage: FAILURE_MESSAGE,
          maxHistory: 16,
          mcpServers: [
            {
              name: 'asha',
              endpoint: `${baseUrl}/api/mcp`,
              transport: 'streamable_http',
              headers: {
                Authorization: `Bearer ${requireEnv('MCP_SHARED_SECRET')}`,
                'X-Asha-Id': ashaId ?? '',
                'X-Session': channel_name,
              },
              allowed_tools: TOOL_NAMES, // must match the server's tool names exactly
              timeout_ms: 9000,
            },
          ],
        }),
      )
      .withTts(
        useMurf
          ? new MurfTTS({
              key: murfKey!,
              voiceId: murfVoice!,
              locale: 'hi-IN',
              model: 'falcon-2.1',
              sampleRate: 24000,
              baseUrl: process.env.MURF_WS_URL ?? 'wss://global.api.murf.ai/v1/speech/stream-input',
            })
          : new MiniMaxTTS({ model: 'speech_2_6_turbo', voiceId: 'English_captivating_female1' }),
      );

    const session = agent.createSession({
      channel: channel_name,
      agentUid: String(DEFAULT_AGENT_UID),
      remoteUids: [requester_id], // only this user's audio is processed
      idleTimeout: 60,
      expiresIn: ExpiresIn.hours(1),
      debug: false,
    });

    const agentId = await session.start();
    return NextResponse.json({
      agent_id: agentId,
      create_ts: Math.floor(Date.now() / 1000),
      state: 'RUNNING',
      tts: useMurf ? 'murf' : 'fallback',
    } as AgentResponse & { tts: string });
  } catch (error) {
    console.error('Error starting conversation:', error);
    const e = error as { message?: string; statusCode?: number; body?: unknown };
    return NextResponse.json(
      { error: e.message ?? 'Failed to start conversation', status: e.statusCode, detail: e.body },
      { status: 500 },
    );
  }
}
