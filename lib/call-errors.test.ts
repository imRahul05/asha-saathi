import { describe, expect, it } from 'vitest';
import { activeBlockingIssue, classifyIssue, moduleOf, type RawIssue } from './call-errors';

const agent = (message: string, code: string | number = 1000, timestamp = 1000): RawIssue => ({ source: 'agent', code, message, timestamp });

describe('call errors', () => {
  it('reads the module from the message', () => {
    expect(moduleOf('asr: Connection timeout after 10 seconds')).toBe('asr');
    expect(moduleOf('LLM: 401 unauthorized')).toBe('llm');
    expect(moduleOf('tts: voice failed')).toBe('tts');
    expect(moduleOf('something else')).toBeNull();
  });

  it('an ASR timeout is blocking and worth one automatic retry (it used to be hidden as a harmless "timeout" warning)', () => {
    expect(classifyIssue(agent('asr: Connection timeout after 10 seconds'))).toEqual({ kind: 'asr', blocking: true, autoRetry: true });
  });

  it('model and voice errors block but are not retried automatically; rate limits and caption problems do not block', () => {
    expect(classifyIssue(agent('llm: 500 server error'))).toMatchObject({ kind: 'llm', blocking: true, autoRetry: false });
    expect(classifyIssue(agent('tts: voice failed'))).toMatchObject({ kind: 'tts', blocking: true, autoRetry: false });
    expect(classifyIssue(agent('llm: rate limit', 429))).toMatchObject({ blocking: false });
    expect(classifyIssue({ source: 'rtm', code: 5, message: 'captions broke', timestamp: 1 })).toMatchObject({ kind: 'captions', blocking: false });
  });

  it('an old blocking issue clears once the conversation has worked again', () => {
    const issues = [agent('asr: Connection timeout after 10 seconds', 1000, 5000)];
    expect(activeBlockingIssue(issues, null)?.message).toMatch(/asr/);
    expect(activeBlockingIssue(issues, 5200)).not.toBeNull(); // activity within 1.5 s of the error does not count as recovery
    expect(activeBlockingIssue(issues, 9000)).toBeNull();
  });
});
