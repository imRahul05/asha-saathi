// Proves: AI SDK v6 tool loop + zod + OpenAI-style SSE output, using a mock model (no network)
import { streamText, tool, stepCountIs } from 'ai';
import { MockLanguageModelV3, simulateReadableStream } from 'ai/test';
import { z } from 'zod';
let call = 0;
const model = new MockLanguageModelV3({
  doStream: async () => {
    call++;
    const chunks = call === 1
      ? [{ type: 'stream-start', warnings: [] },
         { type: 'tool-call', toolCallId: 't1', toolName: 'assessRisk', input: JSON.stringify({ systolic: 150, diastolic: 100, weeks: 28, symptoms: ['swelling'] }) },
         { type: 'finish', finishReason: { unified: 'tool-calls', raw: undefined }, usage: { inputTokens: { total: 1 }, outputTokens: { total: 1 } } }]
      : [{ type: 'stream-start', warnings: [] },
         { type: 'text-start', id: 'a' }, { type: 'text-delta', id: 'a', delta: 'यह high risk है। ' }, { type: 'text-delta', id: 'a', delta: 'डॉक्टर को alert भेजूँ?' }, { type: 'text-end', id: 'a' },
         { type: 'finish', finishReason: { unified: 'stop', raw: undefined }, usage: { inputTokens: { total: 1 }, outputTokens: { total: 1 } } }];
    return { stream: simulateReadableStream({ chunks }) };
  },
});
const assessRisk = tool({
  description: 'Deterministic ANC danger-sign check',
  inputSchema: z.object({ systolic: z.number().int().min(60).max(260), diastolic: z.number().int().min(30).max(160), weeks: z.number().int().min(1).max(45), symptoms: z.array(z.string()) }),
  outputSchema: z.object({ level: z.enum(['normal', 'watch', 'high']), reasons: z.array(z.string()) }),
  execute: async (i) => ({ level: i.systolic >= 140 || i.diastolic >= 90 ? 'high' : 'normal', reasons: ['BP ≥ 140/90'] }),
});
const r = streamText({ model, messages: [{ role: 'user', content: 'BP 150/100, 7 mahine' }], tools: { assessRisk }, stopWhen: stepCountIs(4),
  onStepFinish: (s) => console.error('[step]', s.toolCalls.map(t => t.toolName), s.toolResults.map(t => JSON.stringify(t.output))) });
let out = '';
for await (const t of r.textStream) out += `data: ${JSON.stringify({ object: 'chat.completion.chunk', choices: [{ index: 0, delta: { content: t }, finish_reason: null }] })}\n\n`;
out += 'data: [DONE]\n\n';
process.stdout.write(out);
