/**
 * The one data-state hook. Every screen uses it, so every screen has the same
 * five states and none of them can be a blank page:
 *
 *   loading  — nothing to show yet (skeleton, never a spinner island)
 *   ready    — live data
 *   cached   — data from the device, explicitly marked as not live
 *   empty    — a real, fetched emptiness ("nothing published yet")
 *   error    — a failure with a reason and a Retry that can actually work
 *
 * Serving cache while revalidating is deliberate: on a flaky train connection the
 * reader still gets the story, and the offline marker tells them its age.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, type ApiFailure } from "../api/client";
import { readCache, writeCache } from "../api/cache";

export type ResourceStatus = "loading" | "ready" | "cached" | "empty" | "error";

export interface Resource<T> {
  data: T | null;
  status: ResourceStatus;
  /** Why the content is not live, when it is not. */
  failure: ApiFailure | null;
  /** Epoch ms of the content being shown, so a screen can say "saved 2h ago". */
  servedAt: number | null;
  refreshing: boolean;
  reload: () => void;
}

interface Options<T> {
  /** Cache key. Omit to disable offline serving for this resource. */
  cacheKey?: string;
  /** Refuse to show data older than this (feeds: minutes; stories: days). */
  maxAgeMs?: number;
  /** Set false to defer the request until a dependency is ready. */
  enabled?: boolean;
  /** Treat `null`/empty arrays as a first-class empty state, not an error. */
  isEmpty?: (value: T) => boolean;
}

export function useResource<T>(
  load: () => Promise<T>,
  options: Options<T> = {}
): Resource<T> {
  const { cacheKey, maxAgeMs, enabled = true, isEmpty } = options;
  const [data, setData] = useState<T | null>(null);
  const [status, setStatus] = useState<ResourceStatus>("loading");
  const [failure, setFailure] = useState<ApiFailure | null>(null);
  const [servedAt, setServedAt] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [nonce, setNonce] = useState(0);
  const loadRef = useRef(load);

  // The loader changes identity every render (closures over screen state), but
  // re-fetching on every render would be a loop — the current loader is read
  // through a ref inside the effect below.
  useEffect(() => {
    loadRef.current = load;
  });

  const reload = useCallback(() => setNonce((value) => value + 1), []);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    void (async () => {
      // 1. Serve the device copy immediately, if we are allowed to.
      let servedCached = false;
      if (cacheKey) {
        const cached = await readCache<T>(cacheKey);
        const fresh = cached && Date.now() - cached.storedAt <= (maxAgeMs ?? Infinity);
        if (cached && fresh && !cancelled) {
          setData(cached.value);
          setServedAt(cached.storedAt);
          setStatus("cached");
          servedCached = true;
        }
      }

      // 2. Ask the server regardless — a cached feed is not a live feed.
      if (!cancelled && servedCached) setRefreshing(true);
      try {
        const value = await loadRef.current();
        if (cancelled) return;
        setData(value);
        setServedAt(Date.now());
        setFailure(null);
        setStatus(isEmpty?.(value) ? "empty" : "ready");
        if (cacheKey) await writeCache(cacheKey, value);
      } catch (error) {
        if (cancelled) return;
        const apiFailure =
          error instanceof ApiError ? error.failure : ("server" as const);
        setFailure(apiFailure);
        // Cached content stays on screen, now explicitly marked, rather than
        // being replaced by an error that throws away what the reader can read.
        setStatus((current) =>
          current === "cached" ? "cached" : "error"
        );
      } finally {
        if (!cancelled) setRefreshing(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // `nonce` is the manual reload; `enabled` gates deferred reads. The loader
    // itself is read through a ref so screens do not re-fetch on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey, maxAgeMs, enabled, nonce]);

  return { data, status, failure, servedAt, refreshing, reload };
}