'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { AshaOverview } from '@/lib/overview-types';
import {
  clearOfflineCache,
  readCachedAshaOverview,
  writeCachedAshaOverview,
} from '@/lib/offline-cache';

interface OverviewErrorBody {
  error?: string;
}

export interface UseAshaOverviewResult {
  overview: AshaOverview | null;
  isLoading: boolean;
  error: string | null;
  /** True when showing cached IndexedDB data because the network is unavailable. */
  isOffline: boolean;
  /** ISO timestamp of when the cached snapshot was saved (set when serving cached data offline). */
  cachedAt: string | null;
  refresh: () => void;
}

/**
 * Fetches the pre-call ASHA workspace overview (/api/asha/overview) with IndexedDB
 * stale-while-revalidate caching and automatic refresh when connectivity returns.
 */
export function useAshaOverview(): UseAshaOverviewResult {
  const [overview, setOverview] = useState<AshaOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [cachedAt, setCachedAt] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  const hasDataRef = useRef(false);

  const refresh = useCallback(() => {
    setReloadTick((tick) => tick + 1);
  }, []);

  // Automatically refresh as soon as the browser regains connectivity.
  useEffect(() => {
    const handleOnline = () => {
      setReloadTick((tick) => tick + 1);
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let networkResolved = false;
    const controller = new AbortController();

    async function hydrateFromCache() {
      const cached = await readCachedAshaOverview();
      if (cancelled || networkResolved || !cached) return;
      hasDataRef.current = true;
      setOverview(cached.data);
      setCachedAt(cached.cachedAt);
      setIsLoading(false);
    }

    async function loadFromNetwork() {
      try {
        const res = await fetch('/api/asha/overview', {
          cache: 'no-store',
          signal: controller.signal,
        });
        if (cancelled) return;
        networkResolved = true;

        if (res.status === 401) {
          void clearOfflineCache();
          hasDataRef.current = false;
          setOverview(null);
          setIsOffline(false);
          setCachedAt(null);
          setError('SESSION_EXPIRED');
          setIsLoading(false);
          return;
        }
        if (res.status === 403) {
          void clearOfflineCache();
          hasDataRef.current = false;
          setOverview(null);
          setIsOffline(false);
          setCachedAt(null);
          setError('FORBIDDEN');
          setIsLoading(false);
          return;
        }

        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as OverviewErrorBody;
          if (cancelled) return;
          setError(typeof body.error === 'string' ? body.error : `HTTP_${res.status}`);
          setIsLoading(false);
          return;
        }

        const data = (await res.json()) as AshaOverview;
        if (cancelled) return;
        hasDataRef.current = true;
        setOverview(data);
        setError(null);
        setIsOffline(false);
        setCachedAt(null);
        setIsLoading(false);
        void writeCachedAshaOverview(data);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof Error && err.name === 'AbortError') return;
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

    void hydrateFromCache();
    void loadFromNetwork();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [reloadTick]);

  return { overview, isLoading, error, isOffline, cachedAt, refresh };
}
