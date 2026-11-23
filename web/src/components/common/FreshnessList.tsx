import type { FreshnessItem } from "@/api/types";
import * as fmt from "@/lib/fmt";
import { cn } from "@/lib/utils";
import { Metric } from "./Metric";

const GLYPH = { fresh: "●", expected_lag: "◐", stale: "⚠" } as const;
const LABEL = { fresh: "fresh", expected_lag: "within expected lag", stale: "stale" } as const;

/** FreshnessList (UX-C17): ● fresh · ◐ expected lag · ⚠ stale. */
export function FreshnessList({ items }: { items: FreshnessItem[] }) {
  return (
    <ul className="divide-y divide-o-border-subtle">
      {items.map((f) => (
        <li key={f.dataset} className="flex items-start gap-2.5 px-4 py-2">
          <span
            className={cn(
              "mt-px w-3 shrink-0 text-center text-xs",
              f.state === "stale" ? "text-o-warning" : "text-o-text-2",
            )}
          >
            <span aria-hidden="true">{GLYPH[f.state]}</span>
            <span className="sr-only">{LABEL[f.state]}</span>
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-baseline justify-between gap-2">
              <span className="text-o-text text-sm">{f.label}</span>
              <Metric
                metric={`freshness.${f.dataset}`}
                prov={f.provenance}
                interactive
                label={`${f.label} freshness`}
                className="whitespace-nowrap text-o-text-2 text-xs"
              >
                {f.dataset === "prices"
                  ? `${fmt.dateShort(f.last_available_at.slice(0, 10))} ${fmt.timeET(f.last_available_at)}`
                  : fmt.dateShort(f.last_available_at.slice(0, 10))}
              </Metric>
            </span>
            <span className="block truncate text-o-text-3 text-xs">
              {f.detail}
              {f.state === "stale" ? " · stale" : ""}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}
