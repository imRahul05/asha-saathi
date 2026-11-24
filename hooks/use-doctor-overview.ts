'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { DoctorOverview } from '@/lib/overview-types';
import {
  clearOfflineCache,
  readCachedDoctorOverview,
  writeCachedDoctorOverview,
} from '@/lib/offline-cache';

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
  /** True when showing cached IndexedDB data because the network is unavailable. */
  isOffline: boolean;
  /** ISO timestamp of when the cached snapshot was saved (set when serving cached data offline). */
  cachedAt: string | null;
  refresh: () => void;
}

/**
 * Polls `/api/doctor/overview` with `?since=<cursor>` change detection, optional `?key=...`,
 * and IndexedDB stale-while-revalidate caching for instant loads and offline resilience.
 * - Hydrates immediately from IndexedDB while revalidating against the server.
 * - Backs off while quiet (baseMs -> 2x -> 3x) and snaps back on changes or browser `online`.
 * - Pauses while the tab is hidden, prevents overlapping requests, and aborts on unmount.
 * - Clears cached data and stops polling on 401/403 so the UI can prompt sign-in cleanly.
 */
export function useDoctorOverview(dashboardKey: string | null = null, baseMs = 2500): UseDoctorOverviewResult {
  const [overview, setOverview] = useState<DoctorOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isOffline, setIsOffline] = useState<boolean>(false);
  const [cachedAt, setCachedAt] = useState<string | null>(null);
  const cursorRef = useRef<number | null>(null);
  const hasDataRef = useRef<boolean>(false);
  const triggerRefreshRef = useRef<(() => void) | null>(null);

  const baseUrl = dashboardKey
    ? `/api/doctor/overview?key=${encodeURIComponent(dashboardKey)}`
    : '/api/doctor/overview';

  useEffect(() => {
    let stopped = false;
    let networkResolved = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | undefined;
    let quietPolls = 0;
    cursorRef.current = null;

    const nextDelay = (): number => (quietPolls >= 15 ? baseMs * 3 : quietPolls >= 5 ? baseMs * 2 : baseMs);

    const hydrateFromCache = async (): Promise<void> => {
      const cached = await readCachedDoctorOverview();
      if (stopped || networkResolved || !cached) return;
      hasDataRef.current = true;
      setOverview(cached.data);
      setCachedAt(cached.cachedAt);
      setIsLoading(false);
    };

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
        networkResolved = true;

        if (res.ok) {
          if (isUnchangedPayload(body)) {
            quietPolls += 1;
          } else if (!isErrorPayload(body)) {
            quietPolls = 0;
            cursorRef.current = typeof body.cursor === 'number' ? body.cursor : null;
            hasDataRef.current = true;
            setOverview(body);
            void writeCachedDoctorOverview(body);
          }
          setError(null);
          setIsOffline(false);
          setCachedAt(null);
          setIsLoading(false);
        } else {
          setIsLoading(false);
          if (res.status === 401 || res.status === 403) {
            void clearOfflineCache();
            hasDataRef.current = false;
            setOverview(null);
            setIsOffline(false);
            setCachedAt(null);
            setError(isErrorPayload(body) ? body.error : `HTTP_${res.status}`);
            stopped = true;
            return;
          }
          setError(isErrorPayload(body) ? body.error : `HTTP_${res.status}`);
        }
      } catch {
        if (!stopped && !activeController.signal.aborted) {
          networkResolved = true;
          if (hasDataRef.current) {
            setIsOffline(true);
            setError(null);
          } else {
            setError('NETWORK');
          }
          setIsLoading(false);
        }
      }

      if (!stopped) {
        timer = setTimeout(() => {
          void tick();
        }, nextDelay());
      }
    };

    const forceRefresh = () => {
      if (stopped) return;
      if (timer) clearTimeout(timer);
      controller?.abort();
      cursorRef.current = null;
      quietPolls = 0;
      void tick();
    };

    triggerRefreshRef.current = forceRefresh;
    window.addEventListener('online', forceRefresh);

    void hydrateFromCache();
    void tick();

    return () => {
      stopped = true;
      triggerRefreshRef.current = null;
      window.removeEventListener('online', forceRefresh);
      if (timer) clearTimeout(timer);
      controller?.abort();
    };
  }, [baseUrl, baseMs]);

  const refresh = useCallback(() => {
    triggerRefreshRef.current?.();
  }, []);

  return { overview, error, isLoading, isOffline, cachedAt, refresh };
}
