import { useCallback, useEffect, useRef, useState } from 'react';

export type AsyncState<T> =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'success'; data: T };

export type AsyncResult<T> = AsyncState<T> & {
  /** A request is in flight while previous data is still shown. */
  isRefreshing: boolean;
  reload: () => void;
};

/**
 * Minimal data-fetching hook: loading / error / success, with abort on unmount
 * and a `reload` for retry buttons.
 *
 * While re-fetching (e.g. the location filter changing) the previous data stays
 * on screen instead of flipping back to a skeleton. Without that, the location
 * picker — whose options come from the response — unmounted and remounted on
 * every filter change, so it visibly flashed away and lost focus mid-interaction
 * (AC-5.4, AC-5.8).
 *
 * Deliberately not a state library: the surface needed here is one request at a
 * time with a retry, and this keeps the data flow visible (AC-5.5).
 */
export function useAsync<T>(
  fetcher: (signal: AbortSignal) => Promise<T>,
  deps: readonly unknown[],
): AsyncResult<T> {
  const [state, setState] = useState<AsyncState<T>>({ kind: 'loading' });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const lastData = useRef<{ value: T } | null>(null);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    // Keep showing the previous result while the new one loads.
    if (lastData.current) setIsRefreshing(true);
    else setState({ kind: 'loading' });

    fetcherRef
      .current(controller.signal)
      .then((data) => {
        if (!active) return;
        lastData.current = { value: data };
        setState({ kind: 'success', data });
      })
      .catch((error: unknown) => {
        if (!active) return;
        if (error instanceof DOMException && error.name === 'AbortError') return;
        lastData.current = null;
        setState({
          kind: 'error',
          message: error instanceof Error ? error.message : 'Something went wrong',
        });
      })
      .finally(() => {
        if (active) setIsRefreshing(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  return { ...state, isRefreshing, reload };
}