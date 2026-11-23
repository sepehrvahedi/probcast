import type { Problem } from "./types";

/** An RFC 9457 problem returned by the engine (or simulated by the fixture harness). */
export class ApiError extends Error {
  readonly problem: Problem;
  constructor(problem: Problem) {
    super(problem.title);
    this.name = "ApiError";
    this.problem = problem;
  }
  get status(): number {
    return this.problem.status;
  }
}

/** The engine could not be reached at all (network error, not a problem response). */
export class OfflineError extends Error {
  constructor(message = "Can't reach the ProbCast engine.") {
    super(message);
    this.name = "OfflineError";
  }
}

export function isNotFound(e: unknown): boolean {
  return e instanceof ApiError && e.status === 404;
}
