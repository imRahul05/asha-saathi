// Keeps every RTM message from the moment the browser logs in, so the caption reader (AgoraVoiceAI)
// can catch up on what it missed.
//
// Why: AgoraVoiceAI only listens for RTM messages after it is started, which happens after the call screen has
// mounted, the audio call has joined and the toolkit has initialised. Saathi can start talking before that, and
// a message nobody is listening for is simply lost: she is heard, but her words never appear. The same happens
// when the toolkit is restarted mid-call (the caption watchdog does that).

type RtmLike = {
  addEventListener: (name: 'message', listener: (event: unknown) => void) => void;
  removeEventListener: (name: 'message', listener: (event: unknown) => void) => void;
};

export type RtmBuffer = {
  /** Raw RTM message events, oldest first. */
  events: unknown[];
  stop: () => void;
};

export function startRtmBuffer(rtm: RtmLike, max = 2000): RtmBuffer {
  const events: unknown[] = [];
  const onMessage = (event: unknown) => {
    events.push(event);
    if (events.length > max) events.splice(0, events.length - max);
  };
  rtm.addEventListener('message', onMessage);
  return { events, stop: () => rtm.removeEventListener('message', onMessage) };
}

type ReplayTarget = { _handleRtmMessage?: (event: unknown) => void };

/** Feeds the buffered messages, in order, to a freshly started caption reader. Returns how many were replayed. */
export function replayBufferedMessages(ai: unknown, events: unknown[] | undefined): number {
  const handler = (ai as ReplayTarget)?._handleRtmMessage;
  if (!events?.length || typeof handler !== 'function') return 0;
  let n = 0;
  for (const event of [...events]) {
    try {
      handler.call(ai, event);
      n += 1;
    } catch {
      /* one bad message must not stop the rest */
    }
  }
  return n;
}
