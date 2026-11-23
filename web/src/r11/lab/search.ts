/** URL state for the lab routes (kept out of the lazy page chunks). */
const STATUSES = [
  "registered",
  "triaged",
  "implementing",
  "leak_tested",
  "evaluated",
  "committee",
  "descriptive_only",
  "parked",
  "rejected",
];

export interface LabSearch {
  view?: "board" | "list";
  status?: string;
}

export function validateLabSearch(s: Record<string, unknown>): LabSearch {
  const out: LabSearch = {};
  if (s.view === "board" || s.view === "list") out.view = s.view;
  if (typeof s.status === "string" && STATUSES.includes(s.status)) out.status = s.status;
  return out;
}

export interface RunSearch {
  analyzer?: string;
}

export function validateRunSearch(s: Record<string, unknown>): RunSearch {
  return typeof s.analyzer === "string" && /^[a-z][a-z0-9_.]*$/.test(s.analyzer)
    ? { analyzer: s.analyzer }
    : {};
}
