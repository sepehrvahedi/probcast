import type { FinalForecast } from "@/api/types";
import { Badge } from "@/components/ui/badge";
import { CAVEATS } from "@/lib/copy";
import * as fmt from "@/lib/fmt";

/** Status chip in the page subtitle: working vs frozen vs baseline (UX-M01). */
export function ForecastStatusChip({ f }: { f: FinalForecast }) {
  if (f.status === "frozen" && f.freeze)
    return (
      <Badge variant="neutral" className="font-mono">
        Committee forecast v{f.freeze.version} · {fmt.hash(f.freeze.forecast_hash)}
      </Badge>
    );
  if (f.status === "baseline_only")
    return <Badge variant="neutral">Baseline committee (forecast floor)</Badge>;
  return <Badge variant="accent">{CAVEATS.workingChip}</Badge>;
}
