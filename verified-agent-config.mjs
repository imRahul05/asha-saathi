import { AgoraClient, Agent, Area, DeepgramSTT, AresSTT, SarvamSTT, CustomLLM, MurfTTS } from 'agora-agents';
const client = new AgoraClient({ area: Area.AP, appId: '0'.repeat(32), appCertificate: '0'.repeat(32) });
const stts = {
  deepgram_managed: new DeepgramSTT({ model: 'nova-3', language: 'multi' }),
  deepgram_byok: new DeepgramSTT({ apiKey: 'DG_KEY', model: 'nova-3', language: 'multi' }),
  ares: new AresSTT({ keywords: ['ASHA', 'Sunita'] }),
  sarvam: new SarvamSTT({ apiKey: 'SV_KEY', language: 'hi-IN' }),
};
for (const [name, stt] of Object.entries(stts)) {
  const agent = new Agent({ client, turnDetection: { language: 'hi-IN', config: { end_of_speech: { mode: 'vad', vad_config: { silence_duration_ms: 640 } } } },
    advancedFeatures: { enable_rtm: true }, parameters: { data_channel: 'rtm', enable_error_message: true, enable_metrics: true } })
    .withStt(stt)
    .withLlm(new CustomLLM({ apiKey: 'SHARED', model: 'asha-agent', url: 'https://example.vercel.app/api/chat/completions',
       systemMessages: [{ role: 'system', content: 'x' }], greetingMessage: 'नमस्ते', failureMessage: 'माफ़ कीजिए', maxHistory: 16 }))
    .withTts(new MurfTTS({ key: 'MURF', voiceId: 'Namrita', locale: 'hi-IN', model: 'falcon-2.1', sampleRate: 24000, baseUrl: 'wss://global.api.murf.ai/v1/speech/stream-input' }));
  try {
    const p = agent.toProperties({ channel: 'c', agentUid: '1001', remoteUids: ['42'], token: 'T' });
    console.log(`\n=== ${name} ===\n` + JSON.stringify({ asr: p.asr, llm: p.llm, tts: p.tts, turn_detection: p.turn_detection }, null, 1));
  } catch (e) { console.log(name, 'ERROR', e.message); }
}
