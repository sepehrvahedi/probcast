import { API_BASE, type FixtureState } from "./config";
import { ApiError, OfflineError } from "./errors";
import { fixtureGet } from "./fixtures";
import type { Problem } from "./types";

export type Params = Record<string, string | number | undefined>;

function query(params: Params): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params))
    if (v !== undefined && v !== "") qs.set(k, String(v));
  const s = qs.toString();
  return s ? `?${s}` : "";
}

/** URL of an API resource (also used for links such as the tear-sheet PNG). */
export function apiUrl(path: string, params: Params = {}): string {
  return `${API_BASE ?? ""}/api/v1${path}${query(params)}`;
}

/**
 * GET an API resource. Reads src/fixtures when VITE_API_BASE is unset, the engine otherwise.
 * Errors: ApiError (RFC 9457 problem), OfflineError (engine unreachable).
 * Read-only by design: the R1.0 UI has no write path, and freeze/reveal never have one (D-047).
 */
export async function apiGet<T>(path: string, params: Params = {}, fx?: FixtureState): Promise<T> {
  if (API_BASE === null) return fixtureGet<T>(path, params, fx);
  let res: Response;
  try {
    res = await fetch(apiUrl(path, params), { headers: { Accept: "application/json" } });
  } catch {
    throw new OfflineError(`Can't reach the ProbCast engine at ${API_BASE}.`);
  }
  if (!res.ok) {
    let problem: Problem;
    try {
      problem = (await res.json()) as Problem;
    } catch {
      problem = {
        type: "about:blank",
        title: res.statusText || "Request failed",
        status: res.status,
      };
    }
    throw new ApiError({ ...problem, status: problem.status ?? res.status });
  }
  return (await res.json()) as T;
}
