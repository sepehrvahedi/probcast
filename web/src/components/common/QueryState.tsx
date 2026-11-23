import type { UseQueryResult } from "@tanstack/react-query";
import { type ReactNode, useEffect, useState } from "react";
import { ApiError, OfflineError } from "@/api/errors";
import { IntegrityError } from "@/api/guards";
import { Button } from "@/components/ui/button";
import { HOLDOUT } from "@/lib/copy";
import { StateNotice } from "./StateNotice";

/** True only once `loading` has lasted ≥ 300 ms (UX-M01: no flash for quick loads). */
export function useDelayed(loading: boolean, ms = 300): boolean {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (!loading) {
      setShow(false);
      return;
    }
    const t = window.setTimeout(() => setShow(true), ms);
    return () => window.clearTimeout(t);
  }, [loading, ms]);
  return show;
}

/** The inline error treatment for one panel; the rest of the page keeps working. */
export function QueryError({
  error,
  thing,
  onRetry,
}: {
  error: unknown;
  thing: string;
  onRetry?: () => void;
}) {
  if (error instanceof IntegrityError) {
    return (
      <StateNotice
        kind="blocked"
        title={HOLDOUT.integrity}
        body="The holdout is sealed until the witnessed reveal; the payload carried holdout-tagged values, so nothing from it is shown."
        details={error.paths.join("\n")}
      />
    );
  }
  if (error instanceof OfflineError) {
    return (
      <StateNotice
        kind="offline"
        title={error.message}
        body="Start the engine with `just serve`, then retry."
        actions={
          onRetry ? (
            <Button size="sm" variant="outline" onClick={onRetry}>
              Retry
            </Button>
          ) : null
        }
      />
    );
  }
  const p = error instanceof ApiError ? error.problem : null;
  return (
    <StateNotice
      kind="error"
      title={`Something went wrong loading ${thing}.`}
      body={
        p
          ? `${p.title}${p.id ? ` · Error ID ${p.id}` : ""}`
          : String((error as Error)?.message ?? error)
      }
      details={p ? JSON.stringify(p, null, 2) : undefined}
      actions={
        onRetry ? (
          <Button size="sm" variant="outline" onClick={onRetry}>
            Retry
          </Button>
        ) : null
      }
    />
  );
}

/**
 * Renders loading (skeleton after 300 ms), error and data for one query.
 * `skeleton` must match the layout; `notFound` handles 404s with an empty state.
 */
export function QueryState<T>({
  q,
  thing,
  skeleton,
  notFound,
  children,
}: {
  q: UseQueryResult<T>;
  thing: string;
  skeleton: ReactNode;
  notFound?: ReactNode;
  children: (data: T) => ReactNode;
}) {
  const slow = useDelayed(q.isPending);
  if (q.isPending) return slow ? <div aria-busy="true">{skeleton}</div> : null;
  if (q.isError) {
    if (notFound && q.error instanceof ApiError && q.error.status === 404) return <>{notFound}</>;
    return <QueryError error={q.error} thing={thing} onRetry={() => q.refetch()} />;
  }
  return <>{children(q.data)}</>;
}
