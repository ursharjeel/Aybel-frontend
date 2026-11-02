import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api';
import type { ID } from '../domain/types';

export interface Query<T> {
  data: T | undefined;
  error: Error | null;
  loading: boolean;
  refetch: () => void;
}

/**
 * Minimal data hook. Refetches when `key` changes and when the API reports a
 * change for `customerId` (mock bus or server push). Keeps previous data while
 * refetching so charts update in place instead of flashing.
 */
export function useQuery<T>(customerId: ID, key: string, fetcher: () => Promise<T>, opts: { live?: boolean } = {}): Query<T> {
  const [data, setData] = useState<T>();
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);
  const fetchRef = useRef(fetcher);
  fetchRef.current = fetcher;
  const gen = useRef(0);
  const scope = useRef('');

  const run = useCallback(() => {
    const g = ++gen.current;
    setLoading(true);
    fetchRef
      .current()
      .then((d) => {
        if (g !== gen.current) return;
        setData(d);
        setError(null);
      })
      .catch((e: Error) => g === gen.current && setError(e))
      .finally(() => g === gen.current && setLoading(false));
  }, []);

  useEffect(() => {
    // Different customer => drop old data immediately so tenants never mix on screen.
    const s = customerId + '|' + key;
    if (!scope.current.startsWith(customerId + '|')) setData(undefined);
    scope.current = s;
    run();
  }, [customerId, key, run]);

  useEffect(() => {
    if (opts.live === false) return;
    let t: ReturnType<typeof setTimeout> | undefined;
    const off = api.onChange((c) => {
      if (c !== customerId) return;
      clearTimeout(t);
      t = setTimeout(run, 120);
    });
    return () => {
      clearTimeout(t);
      off();
    };
  }, [customerId, run, opts.live]);

  return { data, error, loading, refetch: run };
}
