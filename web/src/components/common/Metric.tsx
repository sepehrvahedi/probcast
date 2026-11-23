import type * as React from "react";
import type { Provenance, Sample } from "@/api/types";
import { serialiseProv } from "@/lib/prov";
import { cn } from "@/lib/utils";
import { useProvenance } from "./provenance";

/**
 * Every rendered number goes through Metric (UX-P01): it carries `data-metric` and a non-empty
 * `data-provenance`, and `data-segment` when the value has an outcome-date sample. Interactive
 * metrics are focusable; click or `I` opens the provenance drawer.
 */
export function Metric({
  metric,
  prov,
  provKey,
  segment,
  kind,
  interactive = false,
  label,
  className,
  children,
  ...rest
}: {
  metric: string;
  prov: Provenance | null | undefined;
  provKey?: string;
  segment?: Sample;
  kind?: "skill" | "forecast" | "probability";
  interactive?: boolean;
  label?: string;
  className?: string;
  children: React.ReactNode;
} & Omit<React.HTMLAttributes<HTMLSpanElement>, "children">) {
  const { open } = useProvenance();
  const p = serialiseProv(prov, provKey);
  const common = {
    "data-metric": metric,
    "data-provenance": p,
    ...(segment ? { "data-segment": segment } : {}),
    ...(kind ? { "data-kind": kind } : {}),
  };
  if (!interactive || !prov) {
    return (
      <span className={cn("num", className)} {...common} {...rest}>
        {children}
      </span>
    );
  }
  const target = { ...prov, ...(provKey ? { key: provKey } : {}) };
  return (
    // biome-ignore lint/a11y/useSemanticElements: an inline value, not a button visually; role + key handling provided
    <span
      role="button"
      tabIndex={0}
      title={`Source: ${prov.source ?? `${prov.kind} ${prov.id}`}${prov.snapshot ? ` · snapshot ${prov.snapshot}` : ""} · I or click for provenance`}
      className={cn(
        "num cursor-help rounded-xs decoration-o-text-3/60 decoration-dotted underline-offset-4 hover:underline focus-visible:underline",
        className,
      )}
      onClick={(e) => {
        e.stopPropagation();
        open(target, label);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === "i" || e.key === "I") {
          e.preventDefault();
          e.stopPropagation();
          open(target, label);
        }
      }}
      {...common}
      {...rest}
    >
      {children}
    </span>
  );
}
