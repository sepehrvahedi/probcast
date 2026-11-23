import type { Provenance } from "@/api/types";

/** `kind:id#key`, the `data-provenance` serialisation (ux-spec §5.2). */
export function serialiseProv(p: Provenance | null | undefined, key?: string): string {
  if (!p) return "";
  const k = key ?? p.key;
  return `${p.kind}:${p.id}${k ? `#${k}` : ""}`;
}

/** Same provenance with a more specific metric key. */
export function withKey(p: Provenance, key: string): Provenance {
  return { ...p, key };
}
