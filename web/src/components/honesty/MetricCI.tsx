import type { Interval } from "@/api/types";
import * as fmt from "@/lib/fmt";

/**
 * MetricCI (UX-C12): 120 × 16 px SVG micro-graphic. Filled point if the CI excludes the
 * reference (0), hollow otherwise; a text equivalent is always visible next to it.
 */
export function MetricCI({
  est,
  ci,
  domain = [-0.15, 0.15],
  width = 120,
  muted = false,
}: {
  est: number;
  ci: Interval;
  domain?: [number, number];
  width?: number;
  muted?: boolean;
}) {
  const [d0, d1] = domain;
  const x = (v: number) => 4 + ((Math.min(d1, Math.max(d0, v)) - d0) / (d1 - d0)) * (width - 8);
  const excludes = ci.lo > 0 || ci.hi < 0;
  const stroke = muted ? "var(--o-text-disabled)" : "var(--o-text-2)";
  return (
    <svg
      width={width}
      height={16}
      viewBox={`0 0 ${width} 16`}
      role="img"
      aria-label={`${fmt.pct(est)}, 90% CI ${fmt.ci(ci.lo, ci.hi)}`}
      className="shrink-0"
    >
      <line
        x1={x(0)}
        x2={x(0)}
        y1={1}
        y2={15}
        stroke="var(--o-border-input)"
        strokeDasharray="2 2"
      />
      <line x1={x(ci.lo)} x2={x(ci.hi)} y1={8} y2={8} stroke={stroke} strokeWidth={1.5} />
      <line x1={x(ci.lo)} x2={x(ci.lo)} y1={5} y2={11} stroke={stroke} strokeWidth={1.5} />
      <line x1={x(ci.hi)} x2={x(ci.hi)} y1={5} y2={11} stroke={stroke} strokeWidth={1.5} />
      <circle
        cx={x(est)}
        cy={8}
        r={3.5}
        fill={excludes && !muted ? "var(--o-text)" : "var(--o-surface)"}
        stroke={muted ? "var(--o-text-disabled)" : "var(--o-text)"}
        strokeWidth={1.5}
      />
    </svg>
  );
}
