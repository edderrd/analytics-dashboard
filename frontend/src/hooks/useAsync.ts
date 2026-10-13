import { useCallback, useEffect, useRef, useState } from 'react';

export type AsyncState<T> =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'success'; data: T };

/**
 * Minimal data-fetching hook: loading / error / success, with abort on unmount
 * and a `reload` for retry buttons.
 *
 * Deliberately not a state library — the surface needed here is one request at
 * a time with a retry, and this keeps the data flow visible (AC-5.4, AC-5.5).
 */
export function useAsync<T>(
  fetcher: (signal: AbortSignal) => Promise<T>,
  deps: readonly unknown[],
): AsyncState<T> & { reload: () => void } {
  const [state, setState] = useState<AsyncState<T>>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setState({ kind: 'loading' });

    fetcherRef
      .current(controller.signal)
      .then((data) => {
        if (active) setState({ kind: 'success', data });
      })
      .catch((error: unknown) => {
        if (!active) return;
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setState({
          kind: 'error',
          message: error instanceof Error ? error.message : 'Something went wrong',
        });
      });

    return () => {
      active = false;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, attempt]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  return { ...state, reload };
}