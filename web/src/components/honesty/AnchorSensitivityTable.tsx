import type { AnchorRow, AnchorVariant, Provenance } from "@/api/types";
import { Metric } from "@/components/common/Metric";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ANCHOR_CAPTION } from "@/lib/copy";
import * as fmt from "@/lib/fmt";
import { withKey } from "@/lib/prov";
import { cn } from "@/lib/utils";
import { YardstickLabel } from "./status-chips";

const ORDER: AnchorVariant[] = ["capm_erp4", "capm_erp5", "capm_erp6", "shrink50", "hist_drift"];
const LABEL: Record<Exclude<AnchorVariant, "hist_drift">, string> = {
  capm_erp4: "CAPM, ERP 4%",
  capm_erp5: "CAPM, ERP 5% · headline",
  capm_erp6: "CAPM, ERP 6%",
  shrink50: "50% shrink to hist_drift",
};

/** AnchorSensitivityTable (UXR1-26): five rows in a fixed order; headline marked. */
export function AnchorSensitivityTable({
  rows,
  target,
  ticker,
  prov,
  variant = "compact",
}: {
  rows: AnchorRow[];
  target: string;
  ticker: string;
  prov: Provenance;
  variant?: "compact" | "full";
}) {
  const byVariant = new Map(rows.map((r) => [r.variant, r]));
  const head = byVariant.get("capm_erp5");
  return (
    <div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Location anchor</TableHead>
            <TableHead className="text-right">Median</TableHead>
            <TableHead className="text-right">80% range</TableHead>
            {variant === "full" ? <TableHead className="text-right">95% range</TableHead> : null}
            <TableHead className="text-right">P(higher)</TableHead>
            {variant === "full" ? (
              <TableHead className="text-right">Δ median vs headline</TableHead>
            ) : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {ORDER.map((v) => {
            const r = byVariant.get(v);
            if (!r) return null;
            const p = withKey(prov, `anchor_sensitivity.${v}`);
            return (
              <TableRow key={v} className={cn(r.is_headline && "bg-o-accent-subtle/50")}>
                <TableCell className="text-o-text">
                  {v === "hist_drift" ? (
                    <YardstickLabel ticker={ticker} />
                  ) : (
                    <span className="inline-flex items-center gap-1.5">
                      {LABEL[v]}
                      {r.is_headline ? (
                        <span className="text-o-accent">
                          <span aria-hidden="true">●</span>
                          <span className="sr-only">headline row</span>
                        </span>
                      ) : null}
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <Metric
                    metric={`anchor.${v}.median`}
                    prov={p}
                    interactive
                    label={`Median under ${v}`}
                  >
                    {fmt.price(r.median, 0)}
                  </Metric>
                </TableCell>
                <TableCell className="text-right text-o-text-2">
                  <Metric metric={`anchor.${v}.interval80`} prov={p}>
                    {fmt.priceOutward(r.interval80.lo, "lo")}–
                    {fmt.priceOutward(r.interval80.hi, "hi")}
                  </Metric>
                </TableCell>
                {variant === "full" ? (
                  <TableCell className="text-right text-o-text-2">
                    <Metric metric={`anchor.${v}.interval95`} prov={p}>
                      {fmt.priceOutward(r.interval95.lo, "lo")}–
                      {fmt.priceOutward(r.interval95.hi, "hi")}
                    </Metric>
                  </TableCell>
                ) : null}
                <TableCell className="text-right">
                  <Metric metric={`anchor.${v}.p_up`} prov={p}>
                    {fmt.prob(r.p_up)}
                  </Metric>
                </TableCell>
                {variant === "full" ? (
                  <TableCell className="text-right text-o-text-2">
                    <Metric metric={`anchor.${v}.delta`} prov={p}>
                      {head ? (r.is_headline ? "—" : fmt.pct(r.median / head.median - 1)) : "—"}
                    </Metric>
                  </TableCell>
                ) : null}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <p className="mt-2 px-4 text-o-text-3 text-xs leading-4">
        {variant === "full"
          ? ANCHOR_CAPTION(ticker, fmt.date(target))
          : "The anchor is a modelling assumption. Headline row marked ●."}
      </p>
    </div>
  );
}
