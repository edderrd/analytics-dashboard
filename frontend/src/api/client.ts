import {
  ApiError,
  type AccountComparison,
  type AccountDetail,
  type AccountSummary,
  type LocationComparisonResponse,
} from './types';

/**
 * The API is served same-origin under `/api`; Vite proxies it in dev/preview
 * and nginx proxies it in the container. Overridable for local debugging.
 */
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '/api';

async function request<T>(path: string, signal?: AbortSignal): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      signal,
      headers: { Accept: 'application/json' },
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiError('Could not reach the analytics API. Is the backend running?', 0);
  }

  if (!response.ok) {
    let detail = response.statusText;
    try {
      const body: unknown = await response.json();
      if (body && typeof body === 'object' && 'message' in body) {
        const message = (body as { message: unknown }).message;
        if (Array.isArray(message)) detail = message.join(', ');
        else if (typeof message === 'string') detail = message;
      }
    } catch {
      // Non-JSON error body; the status text is enough.
    }
    throw new ApiError(detail || 'Request failed', response.status);
  }

  return (await response.json()) as T;
}

/** Options shared by the comparison endpoints. */
export interface ComparisonQuery {
  asOf?: string;
  eventTypes?: string[];
  locations?: string[];
}

function toQueryString(query: ComparisonQuery = {}): string {
  const params = new URLSearchParams();
  if (query.asOf) params.set('asOf', query.asOf);
  if (query.eventTypes?.length) params.set('eventTypes', query.eventTypes.join(','));
  if (query.locations?.length) params.set('locations', query.locations.join(','));
  const serialised = params.toString();
  return serialised ? `?${serialised}` : '';
}

export const api = {
  listAccounts: (signal?: AbortSignal) => request<AccountSummary[]>('/accounts', signal),

  getAccount: (id: number, signal?: AbortSignal) =>
    request<AccountDetail>(`/accounts/${id}`, signal),

  getComparison: (id: number, query?: ComparisonQuery, signal?: AbortSignal) =>
    request<AccountComparison>(`/accounts/${id}/comparison${toQueryString(query)}`, signal),

  getLocationComparisons: (id: number, query?: ComparisonQuery, signal?: AbortSignal) =>
    request<LocationComparisonResponse>(
      `/accounts/${id}/comparison/locations${toQueryString(query)}`,
      signal,
    ),
};