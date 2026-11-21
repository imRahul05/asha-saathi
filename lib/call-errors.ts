// Turns the raw errors reported during a call into something the screen can act on.
// The Agora engine reports agent errors as "<module>: <message>" with module asr (speech recognition), llm (the model) or tts (the voice).

export type RawIssue = { source: 'rtm' | 'agent' | 'rtm-signaling'; code: string | number; message: string; timestamp: number };

export type IssueKind = 'asr' | 'llm' | 'tts' | 'agent' | 'captions' | 'other';

export type ClassifiedIssue = {
  kind: IssueKind;
  /** The call cannot work properly until this is fixed (she is not heard, or not answered, or not spoken to). */
  blocking: boolean;
  /** A fresh start of the call usually fixes it, so it is worth one automatic retry. */
  autoRetry: boolean;
};

export function moduleOf(message: string): IssueKind | null {
  const m = /^\s*(asr|llm|tts)\b/i.exec(message);
  return m ? (m[1].toLowerCase() as IssueKind) : null;
}

export function classifyIssue(issue: RawIssue): ClassifiedIssue {
  if (issue.source !== 'agent') {
    // RTM (live captions) problems never stop the call itself.
    return { kind: 'captions', blocking: false, autoRetry: false };
  }
  const kind = moduleOf(issue.message) ?? 'agent';
  const msg = issue.message.toLowerCase();
  // A rate limit from the model provider passes by itself: do not alarm anyone.
  const rateLimited = String(issue.code) === '429' || msg.includes('rate limit');
  if (rateLimited) return { kind, blocking: false, autoRetry: false };
  if (kind === 'asr') return { kind, blocking: true, autoRetry: true }; // she cannot be heard: a new start usually reconnects
  if (kind === 'llm') return { kind, blocking: true, autoRetry: false };
  if (kind === 'tts') return { kind, blocking: true, autoRetry: false }; // she can still read the replies
  return { kind: 'agent', blocking: true, autoRetry: false };
}

/** Newest blocking issue that no later activity has cleared. `lastActivityAt` is the time (ms) of the latest transcript line. */
export function activeBlockingIssue<T extends RawIssue>(issues: T[], lastActivityAt: number | null): T | null {
  for (const i of issues) {
    // issues are newest first
    if (!classifyIssue(i).blocking) continue;
    if (lastActivityAt != null && lastActivityAt > i.timestamp + 1500) return null; // the call has worked since: the problem passed
    return i;
  }
  return null;
}
