'use client';

import { useCallback, useEffect, useState } from 'react';
import type { AshaOverview } from '@/lib/overview-types';

interface OverviewErrorBody {
  error?: string;
}

export interface UseAshaOverviewResult {
  overview: AshaOverview | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
}

/** Fetches the pre-call ASHA workspace overview (/api/asha/overview) with manual refresh support. */
export function useAshaOverview(): UseAshaOverviewResult {
  const [overview, setOverview] = useState<AshaOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  const refresh = useCallback(() => {
    setReloadTick((tick) => tick + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    async function load() {
      try {
        const res = await fetch('/api/asha/overview', {
          cache: 'no-store',
          signal: controller.signal,
        });
        if (cancelled) return;

        if (res.status === 401) {
          setError('SESSION_EXPIRED');
          setIsLoading(false);
          return;
        }
        if (res.status === 403) {
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
        setOverview(data);
        setError(null);
        setIsLoading(false);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof Error && err.name === 'AbortError') return;
        setError('NETWORK');
        setIsLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [reloadTick]);

  return { overview, isLoading, error, refresh };
}
