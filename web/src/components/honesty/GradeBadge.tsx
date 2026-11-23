import type { GradeFlag, GradeLetter, Horizon, Interval } from "@/api/types";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { INSUFFICIENT } from "@/lib/copy";
import * as fmt from "@/lib/fmt";
import { cn } from "@/lib/utils";
import { GRADE_GLYPH, GRADE_WORD } from "./verdict";

const RULES: Record<GradeLetter, string> = {
  A: "n_eff ≥ 100; CRPSS 90% CI excludes 0; HLN-DM p < 0.05; BH q < 0.10; holdout CRPSS > 0 if revealed; 80% coverage within ±10 pp.",
  B: "n_eff ≥ 40; HLN-DM p < 0.10; holdout not significantly negative; coverage within ±10 pp.",
  C: "n_eff ≥ 20; CRPSS point estimate > 0; coverage within ±15 pp.",
  D: "Anything else.",
};

export interface GradeInputs {
  nEff: number;
  crpssCi?: Interval;
  dmP?: number | null;
  bhQ?: number | null;
  cov80?: number;
}

/**
 * GradeBadge (UX-C11): monochrome glyph + letter + "… evidence" in text-2, never green or red,
 * so evidence cannot be read as "stock up / stock down" (§2.3).
 */
export function GradeBadge({
  grade,
  flag,
  h,
  inputs,
  variant = "full",
  className,
}: {
  grade: GradeLetter;
  flag?: GradeFlag | undefined;
  h: Horizon;
  inputs?: GradeInputs;
  variant?: "full" | "compact" | "glyph";
  className?: string;
}) {
  const worse = flag === "worse_than_anchor";
  const label = `${grade} · ${GRADE_WORD[grade]}${worse ? " · worse than the CAPM anchor" : ""} at ${fmt.hLabel(h)}`;
  const text =
    variant === "glyph" ? (
      <>
        {worse ? "⊘" : GRADE_GLYPH[grade]}
        <span className="sr-only">{label}</span>
      </>
    ) : variant === "compact" ? (
      <>
        <span aria-hidden="true">{worse ? "⊘" : GRADE_GLYPH[grade]}</span> {grade}
      </>
    ) : (
      <>
        <span aria-hidden="true">{GRADE_GLYPH[grade]}</span> {grade} ·{" "}
        {worse ? "⊘ Worse than the CAPM anchor" : GRADE_WORD[grade]}
      </>
    );
  return (
    <Popover>
      <PopoverTrigger
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        aria-label={`Evidence grade ${label}. Show the rule`}
        className={cn(
          "num inline-flex shrink-0 cursor-help items-center gap-1 whitespace-nowrap rounded-xs text-o-text-2 hover:text-o-text",
          className,
        )}
      >
        {text}
      </PopoverTrigger>
      <PopoverContent className="w-96 text-xs leading-[1.125rem]">
        <div className="mb-1 font-semibold text-o-text text-sm">
          {GRADE_GLYPH[grade]} {grade} · {GRADE_WORD[grade]} at {fmt.horizon(h)}
        </div>
        {worse ? (
          <p className="mb-1.5 text-o-text-2">
            ⊘ The CRPSS 90% CI lies wholly below 0: worse than the CAPM anchor.
          </p>
        ) : null}
        <p className="text-o-text-2">
          <span className="text-o-text-3">Rule: </span>
          {RULES[grade]}
        </p>
        {grade === "D" ? <p className="mt-1.5 text-o-text-2">{INSUFFICIENT.gradeD}</p> : null}
        {inputs ? (
          <dl className="num mt-2 grid grid-cols-2 gap-x-3 gap-y-0.5 rounded-md bg-o-sunken p-2 text-o-text-2">
            <dt className="text-o-text-3">n_eff</dt>
            <dd>≈ {Math.round(inputs.nEff)}</dd>
            {inputs.crpssCi ? (
              <>
                <dt className="text-o-text-3">CRPSS 90% CI</dt>
                <dd>{fmt.ci(inputs.crpssCi.lo, inputs.crpssCi.hi)}</dd>
              </>
            ) : null}
            <dt className="text-o-text-3">HLN-DM</dt>
            <dd>{inputs.dmP == null ? "not reported (n_eff < 20)" : fmt.pValue(inputs.dmP)}</dd>
            <dt className="text-o-text-3">BH q</dt>
            <dd>{inputs.bhQ == null ? "—" : inputs.bhQ.toFixed(2)}</dd>
            {inputs.cov80 != null ? (
              <>
                <dt className="text-o-text-3">80% coverage</dt>
                <dd>{Math.round(inputs.cov80 * 100)}%</dd>
              </>
            ) : null}
          </dl>
        ) : null}
        <p className="mt-2 text-o-text-3">
          Most analyzers grade C or D at 12 months on one stock; that is the honest state of the
          evidence.
        </p>
      </PopoverContent>
    </Popover>
  );
}
