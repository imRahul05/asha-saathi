import { AgoraClient, Agent, Area, SarvamSTT, CustomLLM, MurfTTS } from 'agora-agents';
const client = new AgoraClient({ area: Area.AP, appId: '0'.repeat(32), appCertificate: '0'.repeat(32) });
const build = (lang) => new Agent({ client, turnDetection: { language: lang, config: { end_of_speech: { mode: 'vad' } } } })
  .withStt(new SarvamSTT({ apiKey: 'K', language: 'unknown' }))
  .withLlm(new CustomLLM({ apiKey: 'S', model: 'm', url: 'https://x.app/api/chat/completions' }))
  .withTts(new MurfTTS({ key: 'M', voiceId: 'v', locale: 'hi-IN', model: 'falcon-2.1' }))
  .toProperties({ channel: 'c', agentUid: '1', remoteUids: ['2'], token: 'T' });
for (const l of [['hi-IN','ta-IN','te-IN','kn-IN','bn-IN','gu-IN','en-IN'], 'mr-IN', 'ml-IN', 'pa-IN', 'or-IN']) {
  try { const p = build(l); console.log('OK  ', JSON.stringify(l), '→ turn_detection.language =', p.turn_detection.language, '| asr.params.language =', p.asr.params.language); }
  catch (e) { console.log('FAIL', JSON.stringify(l), '→', e.message.slice(0, 90)); }
}
