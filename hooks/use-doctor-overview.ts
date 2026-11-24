'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { DoctorOverview } from '@/lib/overview-types';

type DoctorOverviewUnchanged = { unchanged: true; cursor: number };
type DoctorOverviewError = { error: string };
type DoctorOverviewPayload = DoctorOverview | DoctorOverviewUnchanged | DoctorOverviewError;

function isUnchangedPayload(body: DoctorOverviewPayload): body is DoctorOverviewUnchanged {
  return 'unchanged' in body && body.unchanged === true;
}

function isErrorPayload(body: DoctorOverviewPayload): body is DoctorOverviewError {
  return 'error' in body && typeof body.error === 'string';
}

export interface UseDoctorOverviewResult {
  overview: DoctorOverview | null;
  error: string | null;
  isLoading: boolean;
  refresh: () => void;
}

/**
 * Polls `/api/doctor/overview` with `?since=<cursor>` change detection and optional `?key=...`.
 * - Backs off while quiet (baseMs -> 2x -> 3x) and snaps back to baseMs on changes.
 * - Pauses while the tab is hidden, prevents overlapping requests, and aborts on unmount.
 * - Stops polling on 401/403 so the UI can show a sign-in prompt cleanly.
 */
export function useDoctorOverview(dashboardKey: string | null = null, baseMs = 2500): UseDoctorOverviewResult {
  const [overview, setOverview] = useState<DoctorOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const cursorRef = useRef<number | null>(null);
  const triggerRefreshRef = useRef<(() => void) | null>(null);

  const baseUrl = dashboardKey
    ? `/api/doctor/overview?key=${encodeURIComponent(dashboardKey)}`
    : '/api/doctor/overview';

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | undefined;
    let quietPolls = 0;
    cursorRef.current = null;

    const nextDelay = (): number => (quietPolls >= 15 ? baseMs * 3 : quietPolls >= 5 ? baseMs * 2 : baseMs);

    const tick = async (): Promise<void> => {
      if (stopped) return;
      if (document.visibilityState === 'hidden') {
        timer = setTimeout(() => {
          void tick();
        }, baseMs * 2);
        return;
      }

      const activeController = new AbortController();
      controller = activeController;

      try {
        const sep = baseUrl.includes('?') ? '&' : '?';
        const requestUrl = cursorRef.current == null ? baseUrl : `${baseUrl}${sep}since=${cursorRef.current}`;
        const res = await fetch(requestUrl, { cache: 'no-store', signal: activeController.signal });
        const body = (await res.json().catch((): DoctorOverviewError => ({ error: `HTTP_${res.status}` }))) as DoctorOverviewPayload;

        if (stopped || activeController.signal.aborted) return;

        if (res.ok) {
          if (isUnchangedPayload(body)) {
            quietPolls += 1;
          } else if (!isErrorPayload(body)) {
            quietPolls = 0;
            cursorRef.current = typeof body.cursor === 'number' ? body.cursor : null;
            setOverview(body);
          }
          setError(null);
          setIsLoading(false);
        } else {
          setError(isErrorPayload(body) ? body.error : `HTTP_${res.status}`);
          setIsLoading(false);
          if (res.status === 401 || res.status === 403) {
            stopped = true;
            return;
          }
        }
      } catch {
        if (!stopped && !activeController.signal.aborted) {
          setError('NETWORK');
          setIsLoading(false);
        }
      }

      if (!stopped) {
        timer = setTimeout(() => {
          void tick();
        }, nextDelay());
      }
    };

    triggerRefreshRef.current = () => {
      if (stopped) return;
      if (timer) clearTimeout(timer);
      controller?.abort();
      cursorRef.current = null;
      quietPolls = 0;
      void tick();
    };

    void tick();

    return () => {
      stopped = true;
      triggerRefreshRef.current = null;
      if (timer) clearTimeout(timer);
      controller?.abort();
    };
  }, [baseUrl, baseMs]);

  const refresh = useCallback(() => {
    triggerRefreshRef.current?.();
  }, []);

  return { overview, error, isLoading, refresh };
}
