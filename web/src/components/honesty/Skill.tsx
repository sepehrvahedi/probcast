import type { HoldoutState, Horizon, SkillValue } from "@/api/types";
import { Metric } from "@/components/common/Metric";
import { InfoButton, Tip } from "@/components/ui/tooltip";
import { INSUFFICIENT } from "@/lib/copy";
import * as fmt from "@/lib/fmt";
import { cn } from "@/lib/utils";
import { EvidenceStrip } from "./EvidenceStrip";
import { MetricCI } from "./MetricCI";

export type SkillDisplay = "hidden" | "greyed" | "normal";

/** QNT-122 display rule: n_eff < 10 hides the value, 10–19 greys it and drops p-values. */
export function skillDisplay(nEff: number): SkillDisplay {
  if (nEff < 10) return "hidden";
  if (nEff < 20) return "greyed";
  return "normal";
}

/** The skill number itself with its CI, honouring the insufficient-evidence rule. */
export function SkillNumber({
  v,
  metric,
  showCi = true,
  size = "sm",
  label,
}: {
  v: SkillValue;
  metric: string;
  showCi?: boolean;
  size?: "sm" | "xl";
  label?: string;
}) {
  const mode = skillDisplay(v.n_eff);
  if (mode === "hidden") {
    return (
      <Tip content={INSUFFICIENT.hidden(String(Math.round(v.n_eff)))}>
        <InfoButton
          data-kind="skill"
          data-metric={metric}
          data-provenance={`${v.provenance.kind}:${v.provenance.id}#${v.provenance.key ?? metric}`}
          data-segment={v.sample}
          className={cn("num cursor-help text-o-text-3", size === "xl" ? "text-xl" : "")}
        >
          —
        </InfoButton>
      </Tip>
    );
  }
  const greyed = mode === "greyed";
  const body = (
    <Metric
      metric={metric}
      prov={v.provenance}
      segment={v.sample}
      kind="skill"
      interactive
      {...(label ? { label } : {})}
      className={cn(
        size === "xl" ? "font-semibold text-xl" : "",
        greyed ? "text-o-text-3" : "text-o-text",
      )}
    >
      {fmt.pct(v.est)}
      {showCi ? (
        <span
          className={cn("ml-1 font-normal text-o-text-3", size === "xl" ? "text-sm" : "text-xs")}
        >
          {fmt.ci(v.ci.lo, v.ci.hi)}
        </span>
      ) : null}
    </Metric>
  );
  if (!greyed) return body;
  return (
    <span className="inline-flex items-center gap-1.5">
      {body}
      <Tip content={INSUFFICIENT.greyed(String(Math.round(v.n_eff)))}>
        <InfoButton className="hatch-insufficient cursor-help rounded-xs border border-o-border px-1 text-2xs text-o-text-3">
          insufficient evidence
        </InfoButton>
      </Tip>
    </span>
  );
}

/**
 * A skill value and its EvidenceStrip, always together (UXR1-04). This is the only component
 * screens use to show CRPSS, so the strip cannot be forgotten.
 */
export function Skill({
  v,
  h,
  metric,
  tilt,
  holdout,
  layout = "row",
  showBar = false,
  size = "sm",
}: {
  v: SkillValue;
  h: Horizon;
  metric: string;
  tilt?: { value: number; unit: "pp/yr" } | undefined;
  holdout?: HoldoutState;
  layout?: "row" | "stack";
  showBar?: boolean;
  size?: "sm" | "xl";
}) {
  const mode = skillDisplay(v.n_eff);
  return (
    <span
      className={cn(
        "inline-flex min-w-0",
        layout === "row" ? "flex-wrap items-center gap-x-3 gap-y-1" : "flex-col items-start gap-1",
      )}
    >
      <span className="inline-flex items-center gap-2">
        <SkillNumber v={v} metric={metric} size={size} />
        {showBar && mode !== "hidden" ? (
          <MetricCI est={v.est} ci={v.ci} muted={mode === "greyed"} />
        ) : null}
      </span>
      <EvidenceStrip
        grade={v.grade}
        flag={v.flag}
        h={h}
        nEff={v.n_eff}
        trials={v.trials}
        mde={{ value: v.mde, unit: "%" }}
        tilt={tilt}
        {...(holdout ? { holdout } : {})}
        inputs={{
          nEff: v.n_eff,
          crpssCi: v.ci,
          dmP: mode === "normal" ? (v.dm_p ?? null) : null,
          bhQ: mode === "normal" ? (v.bh_q ?? null) : null,
        }}
      />
    </span>
  );
}
