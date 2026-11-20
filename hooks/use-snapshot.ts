'use client';

import { useEffect, useRef, useState } from 'react';
import type { Snapshot } from '@/lib/snapshot-types';

/**
 * Polls a snapshot endpoint (per-call state or the dashboard feed). Pauses while the tab is hidden,
 * keeps the last good data on a transient failure, and reports a short error code for the UI.
 */
export function useSnapshot(url: string | null, intervalMs = 1500) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    if (!url) return;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const tick = async () => {
      if (!alive.current) return;
      if (document.visibilityState === 'hidden') {
        timer = setTimeout(tick, intervalMs * 2);
        return;
      }
      try {
        const res = await fetch(url, { cache: 'no-store' });
        const body = await res.json().catch(() => ({}));
        if (!alive.current) return;
        if (res.ok) {
          setSnapshot(body as Snapshot);
          setError(null);
        } else {
          setError(typeof body?.error === 'string' ? body.error : `HTTP_${res.status}`);
        }
      } catch {
        if (alive.current) setError('NETWORK');
      }
      timer = setTimeout(tick, intervalMs);
    };
    tick();
    return () => {
      alive.current = false;
      if (timer) clearTimeout(timer);
    };
  }, [url, intervalMs]);

  return { snapshot, error };
}
