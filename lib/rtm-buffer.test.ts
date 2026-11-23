import { describe, expect, it } from 'vitest';
import { AgoraVoiceAI } from 'agora-agent-client-toolkit';
import { replayBufferedMessages, startRtmBuffer } from './rtm-buffer';

function fakeRtm() {
  const listeners = new Set<(e: unknown) => void>();
  return {
    addEventListener: (_: 'message', l: (e: unknown) => void) => listeners.add(l),
    removeEventListener: (_: 'message', l: (e: unknown) => void) => listeners.delete(l),
    emit: (e: unknown) => listeners.forEach((l) => l(e)),
    count: () => listeners.size,
  };
}

describe('rtm buffer', () => {
  it('records messages from the start and stops on request', () => {
    const rtm = fakeRtm();
    const buf = startRtmBuffer(rtm);
    rtm.emit({ message: 'a' });
    rtm.emit({ message: 'b' });
    expect(buf.events).toHaveLength(2);
    buf.stop();
    rtm.emit({ message: 'c' });
    expect(buf.events).toHaveLength(2);
    expect(rtm.count()).toBe(0);
  });

  it('keeps only the newest messages when the limit is reached', () => {
    const rtm = fakeRtm();
    const buf = startRtmBuffer(rtm, 3);
    for (let i = 1; i <= 5; i++) rtm.emit({ i });
    expect(buf.events).toEqual([{ i: 3 }, { i: 4 }, { i: 5 }]);
  });

  it('replays in order, survives one bad message, and does nothing without a handler', () => {
    const seen: unknown[] = [];
    const ai = {
      _handleRtmMessage(e: { i: number }) {
        if (e.i === 2) throw new Error('bad');
        seen.push(e.i);
      },
    };
    expect(replayBufferedMessages(ai, [{ i: 1 }, { i: 2 }, { i: 3 }])).toBe(2);
    expect(seen).toEqual([1, 3]);
    expect(replayBufferedMessages({}, [{ i: 1 }])).toBe(0);
    expect(replayBufferedMessages(ai, undefined)).toBe(0);
  });

  it('the installed toolkit still has the handler the replay relies on (fails loudly if an upgrade removes it)', () => {
    expect(typeof (AgoraVoiceAI.prototype as unknown as ReplayCheck)._handleRtmMessage).toBe('function');
  });
});

type ReplayCheck = { _handleRtmMessage?: unknown };
