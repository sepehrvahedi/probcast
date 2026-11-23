import type { HoldoutState } from "./types";

/**
 * UXR1-02 rule 3 (defence in depth). The API never sends holdout metrics while sealed, but if a
 * payload nevertheless contains any object tagged `sample: "holdout"`, the UI refuses to render
 * it: the query fails with an IntegrityError and the panel shows the integrity block.
 */
export class IntegrityError extends Error {
  readonly paths: string[];
  constructor(paths: string[]) {
    super("Integrity check: holdout scores received while sealed. Not displayed.");
    this.name = "IntegrityError";
    this.paths = paths;
  }
}

/** Every JSON path whose object carries `sample: "holdout"`. */
export function findHoldoutPaths(value: unknown, path = "$", out: string[] = []): string[] {
  if (Array.isArray(value)) {
    value.forEach((v, i) => {
      findHoldoutPaths(v, `${path}[${i}]`, out);
    });
  } else if (value !== null && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (obj.sample === "holdout") out.push(path);
    for (const [k, v] of Object.entries(obj)) {
      if (v !== null && typeof v === "object") findHoldoutPaths(v, `${path}.${k}`, out);
    }
  }
  return out;
}

/** Throws IntegrityError when the holdout is sealed (or unknown) and the payload leaks it. */
export function assertNoSealedHoldout<T>(payload: T, holdout: HoldoutState | null | undefined): T {
  const sealed = !holdout || holdout.state === "sealed";
  if (!sealed) return payload;
  const paths = findHoldoutPaths(payload);
  if (paths.length > 0) {
    console.error("[ProbCast] Holdout metrics received while sealed; not displayed.", paths);
    throw new IntegrityError(paths);
  }
  return payload;
}
