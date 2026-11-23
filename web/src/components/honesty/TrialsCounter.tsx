import type { Trials } from "@/api/types";
import { GlossaryTerm } from "@/components/common/GlossaryTerm";
import { cn } from "@/lib/utils";

/** TrialsCounter (UXR1-23): "Trials 3 · family 7 · team 41" with budget states. */
export function TrialsCounter({
  trials,
  budgets = { soft: 20, cap: 30 },
  className,
}: {
  trials: Trials;
  budgets?: { soft: number; cap: number };
  className?: string;
}) {
  const atCap = trials.family.n >= budgets.cap;
  const overSoft = trials.analyzer > budgets.soft;
  return (
    <span
      className={cn(
        "num inline-flex flex-wrap items-center gap-x-1.5 text-o-text-2 text-xs",
        className,
      )}
    >
      <GlossaryTerm term="trial">Trials</GlossaryTerm>
      <span className="text-o-text">{trials.analyzer}</span>
      <span aria-hidden="true">·</span>
      <span>
        family <span className="text-o-text">{trials.family.n}</span>
      </span>
      <span aria-hidden="true">·</span>
      <span>
        team <span className="text-o-text">{trials.team}</span>
      </span>
      {overSoft ? (
        <span className="text-o-warning">⚠ over the soft budget of {budgets.soft}</span>
      ) : null}
      {atCap ? (
        <span className="text-o-danger">✕ family at the grid cap of {budgets.cap}</span>
      ) : null}
    </span>
  );
}
