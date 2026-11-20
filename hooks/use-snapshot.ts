'use client';

import { useEffect, useRef, useState } from 'react';
import type { Snapshot } from '@/lib/snapshot-types';

/**
 * Polls a snapshot endpoint (per-call state or the dashboard feed).
 * - Sends ?since=<cursor>, so the server answers with a tiny "unchanged" when nothing happened.
 * - Backs off while the call is quiet (2s, then 4s, then 6s) and snaps back to 2s as soon as something changes.
 * - Pauses while the tab is hidden, never has two requests in flight, and aborts the request on unmount.
 * - Keeps the last good data on a transient failure and reports a short error code for the UI.
 */
export function useSnapshot(url: string | null, baseMs = 2000) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cursor = useRef<number | null>(null);

  useEffect(() => {
    if (!url) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | undefined;
    let quietPolls = 0;
    cursor.current = null;

    const delay = () => (quietPolls >= 15 ? baseMs * 3 : quietPolls >= 5 ? baseMs * 2 : baseMs);

    const tick = async () => {
      if (stopped) return;
      if (document.visibilityState === 'hidden') {
        timer = setTimeout(tick, baseMs * 2);
        return;
      }
      controller = new AbortController();
      try {
        const sep = url.includes('?') ? '&' : '?';
        const res = await fetch(cursor.current == null ? url : `${url}${sep}since=${cursor.current}`, { cache: 'no-store', signal: controller.signal });
        const body = await res.json().catch(() => ({}));
        if (stopped) return;
        if (res.ok) {
          if (body.unchanged) {
            quietPolls++;
          } else {
            quietPolls = 0;
            cursor.current = typeof body.cursor === 'number' ? body.cursor : null;
            setSnapshot(body as Snapshot);
          }
          setError(null);
        } else {
          setError(typeof body?.error === 'string' ? body.error : `HTTP_${res.status}`);
          if (res.status === 401) { stopped = true; return; } // signed out: more polling cannot help, the screen shows a sign-in prompt
        }
      } catch (e) {
        if (!stopped && (e as Error).name !== 'AbortError') setError('NETWORK');
      }
      if (!stopped) timer = setTimeout(tick, delay());
    };
    tick();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      controller?.abort(); // an in-flight poll is cancelled on purpose when the call screen goes away
    };
  }, [url, baseMs]);

  return { snapshot, error };
}
