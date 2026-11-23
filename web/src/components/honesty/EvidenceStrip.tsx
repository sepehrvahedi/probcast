import type { GradeFlag, GradeLetter, HoldoutState, Horizon, Trials } from "@/api/types";
import { GlossaryTerm } from "@/components/common/GlossaryTerm";
import * as fmt from "@/lib/fmt";
import { cn } from "@/lib/utils";
import { GradeBadge, type GradeInputs } from "./GradeBadge";

export interface EvidenceStripProps {
  grade: GradeLetter;
  flag?: GradeFlag | undefined;
  h: Horizon;
  nEff: number;
  trials: number | Trials;
  mde: { value: number; unit: "%" };
  tilt?: { value: number; unit: "pp/yr" } | undefined;
  holdout?: HoldoutState;
  inputs?: GradeInputs;
  layout?: "inline" | "stacked";
  className?: string;
}

/**
 * EvidenceStrip (UXR1-22): mandatory companion of every skill value (UXR1-04). Grade, n_eff,
 * trials and MDE are required by type, so a skill value cannot be rendered without them.
 */
export function EvidenceStrip({
  grade,
  flag,
  h,
  nEff,
  trials,
  mde,
  tilt,
  inputs,
  layout = "inline",
  className,
}: EvidenceStripProps) {
  const t = typeof trials === "number" ? trials : trials.analyzer;
  const sep = (
    <span aria-hidden="true" className="text-o-text-disabled">
      ·
    </span>
  );
  return (
    <span
      data-evidence-strip=""
      className={cn(
        "num inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-o-text-2 text-xs",
        layout === "stacked" && "flex-col items-start",
        className,
      )}
    >
      <GradeBadge
        grade={grade}
        flag={flag}
        h={h}
        variant="compact"
        {...(inputs ? { inputs } : {})}
      />
      {sep}
      <span>
        <GlossaryTerm term="n-eff">n_eff</GlossaryTerm> ≈ {Math.round(nEff)}
      </span>
      {sep}
      <span>
        <GlossaryTerm term="trial">trials</GlossaryTerm> {t}
      </span>
      {sep}
      <span>
        <GlossaryTerm term="mde">MDE</GlossaryTerm> {fmt.mde(mde.value)}
      </span>
      {tilt ? (
        <>
          {sep}
          <span>
            <GlossaryTerm term="location-tilt">tilt</GlossaryTerm> vs CAPM {fmt.tilt(tilt.value)}
          </span>
        </>
      ) : null}
    </span>
  );
}

/**
 * EvidenceStrip in table layout: the same four required fields as cells (grade, n_eff, trials,
 * MDE), for dense tables such as the leaderboard where each field has its own sortable column.
 */
export function EvidenceCells({
  grade,
  flag,
  h,
  nEff,
  trials,
  mde,
  greyed = false,
}: Omit<EvidenceStripProps, "layout" | "className" | "tilt" | "holdout" | "inputs"> & {
  greyed?: boolean;
}) {
  const t = typeof trials === "number" ? trials : trials.analyzer;
  return (
    <>
      <td data-evidence-strip="" className="whitespace-nowrap px-1.5 py-1 align-middle">
        <GradeBadge grade={grade} flag={flag} h={h} variant="compact" inputs={{ nEff }} />
      </td>
      <td
        className={cn(
          "num whitespace-nowrap px-1.5 py-1 text-right align-middle",
          greyed ? "text-o-text-3" : "text-o-text-2",
        )}
      >
        {Math.round(nEff)}
      </td>
      <td className="num whitespace-nowrap px-1.5 py-1 text-right align-middle text-o-text-2">
        {t}
      </td>
      <td className="num whitespace-nowrap px-1.5 py-1 text-right align-middle text-o-text-2">
        {fmt.mde(mde.value)}
      </td>
    </>
  );
}
