// SPIKE: managed gpt-4o-mini + managed Deepgram nova-3 + Murf Falcon hi-IN + MCP tools on our Vercel app.
// POST { requester_id, channel_name, think?: string }  -> starts agent; optional `think` injects text as a user turn.
import { NextRequest, NextResponse } from 'next/server';
import { Agent, AgoraClient, Area, DeepgramSTT, ExpiresIn, MiniMaxTTS, MurfTTS, OpenAI } from 'agora-agents';
import { DEFAULT_AGENT_UID } from '@/lib/agora';

export const runtime = 'nodejs';
export const maxDuration = 60;

const PROMPT = `तुम आशा दीदी की मदद करने वाली voice assistant हो। हमेशा हिंदी (देवनागरी) में, 1-2 छोटे वाक्यों में जवाब दो।
जब भी यूज़र BP (ब्लड प्रेशर) बताए या उसे save करने को कहे, तुरंत echoVisit tool call करो: bp_sys = ऊपर वाला number, bp_dia = नीचे वाला number (integers).
"एक सौ पचास बाय एक सौ" का मतलब bp_sys=150, bp_dia=100। tool का जवाब आने के बाद हिंदी में बताओ कि BP save हो गया।`;
const GREETING = 'नमस्ते दीदी! किसके घर visit हुई?';

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

export async function POST(request: NextRequest) {
  try {
    const { requester_id, channel_name, think } = (await request.json()) as {
      requester_id?: string;
      channel_name?: string;
      think?: string;
    };
    if (!requester_id || !channel_name) {
      return NextResponse.json({ error: 'requester_id and channel_name required' }, { status: 400 });
    }

    const baseUrl = process.env.PUBLIC_BASE_URL ?? `https://${request.headers.get('host')}`;
    const murfKey = process.env.MURF_API_KEY;
    const murfVoice = process.env.MURF_VOICE_ID;
    const useMurf = Boolean(murfKey && murfVoice);

    const client = new AgoraClient({
      area: Area.AP,
      appId: env('NEXT_PUBLIC_AGORA_APP_ID'),
      appCertificate: env('NEXT_AGORA_APP_CERTIFICATE'),
    });

    const agent = new Agent({
      client,
      instructions: PROMPT,
      greeting: GREETING,
      failureMessage: 'माफ़ कीजिए, फिर से बोलिए।',
      maxHistory: 16,
      turnDetection: {
        language: 'hi-IN',
        config: { end_of_speech: { mode: 'vad', vad_config: { silence_duration_ms: 640 } } },
      },
      advancedFeatures: { enable_rtm: true },
      parameters: { data_channel: 'rtm', enable_error_message: true, enable_metrics: true },
    })
      .withTools(true) // => advanced_features.enable_tools = true
      // Managed ASR: no apiKey => SDK infers preset deepgram_nova_3
      .withStt(new DeepgramSTT({ model: 'nova-3', language: 'multi' }))
      // Managed LLM: no apiKey/url + known model => SDK infers preset openai_gpt_4o_mini
      .withLlm(
        new OpenAI({
          model: 'gpt-4o-mini',
          greetingMessage: GREETING,
          failureMessage: 'माफ़ कीजिए, फिर से बोलिए।',
          maxHistory: 16,
          mcpServers: [
            {
              name: 'asha',
              endpoint: `${baseUrl}/api/mcp`,
              transport: 'streamable_http',
              headers: { Authorization: `Bearer ${env('MCP_SHARED_SECRET')}` },
              allowed_tools: ['echoVisit'],
              timeout_ms: 8000,
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
              baseUrl: 'wss://global.api.murf.ai/v1/speech/stream-input',
            })
          : new MiniMaxTTS({ model: 'speech_2_6_turbo', voiceId: 'English_captivating_female1' }),
      );

    const session = agent.createSession({
      channel: channel_name,
      agentUid: String(DEFAULT_AGENT_UID),
      remoteUids: [requester_id],
      idleTimeout: 120,
      expiresIn: ExpiresIn.hours(1),
      debug: false,
    });
    const agentId = await session.start();

    let thinkResult: unknown;
    if (think) {
      await new Promise((r) => setTimeout(r, Number(process.env.SPIKE_THINK_DELAY_MS ?? 1500)));
      thinkResult = await session
        .think(think, {
          on_listening_action: 'interrupt',
          on_thinking_action: 'interrupt',
          on_speaking_action: 'interrupt',
        })
        .catch((e: unknown) => `think error: ${String(e)}`);
    }
    let history: unknown;
    if (think) {
      await new Promise((r) => setTimeout(r, 6000));
      history = await session.getHistory().catch((e: unknown) => `history error: ${String(e)}`);
      await session.stop().catch(() => undefined); // keep the spike short: saves agent-minutes
    }
    return NextResponse.json({
      agent_id: agentId,
      create_ts: Math.floor(Date.now() / 1000),
      state: 'RUNNING',
      tts: useMurf ? 'murf' : 'minimax-managed-FALLBACK',
      mcp_endpoint: `${baseUrl}/api/mcp`,
      thinkResult,
      history,
    });
  } catch (e) {
    console.error('[spike-agent] error', e);
    const anyE = e as { message?: string; body?: unknown; statusCode?: number };
    return NextResponse.json(
      { error: anyE.message ?? 'failed', status: anyE.statusCode, body: anyE.body },
      { status: 500 },
    );
  }
}
