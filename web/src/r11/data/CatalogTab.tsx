import { useNavigate, useSearch } from "@tanstack/react-router";
import { CopyButton } from "@/components/common/CopyButton";
import { Metric } from "@/components/common/Metric";
import { QueryState } from "@/components/common/QueryState";
import { Card, CardAction, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/misc";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tip } from "@/components/ui/tooltip";
import * as fmt from "@/lib/fmt";
import { type CatalogPayload, useCatalog } from "./api";
import { toTsv } from "./format";
import type { DataSearch } from "./routes";
import { LicenceBadge } from "./ui";

const KINDS = [
  { id: "all", label: "All" },
  { id: "price", label: "Prices" },
  { id: "macro", label: "Macro" },
  { id: "fundamentals", label: "Filings" },
  { id: "events", label: "Events" },
] as const;

function Catalog({
  c,
  kind,
  onKind,
}: {
  c: CatalogPayload;
  kind: string;
  onKind: (k: string) => void;
}) {
  const items = c.items.filter((i) => kind === "all" || i.kind === kind);
  const tsv = toTsv(
    [
      "ID",
      "Name",
      "Kind",
      "Source",
      "Licence",
      "Frequency",
      "From",
      "To",
      "Rows",
      "Rule",
      "Strict rule",
      "PIT grade",
      "Vintages",
      "Last available",
    ],
    items.map((i) => [
      i.id,
      i.name,
      i.kind,
      i.source,
      i.licence,
      i.frequency,
      i.coverage?.from,
      i.coverage?.to,
      i.coverage?.rows,
      i.rule,
      i.strict_rule,
      i.pit_grade,
      i.vintages ? "yes" : "no",
      i.last_available_at,
    ]),
  );
  return (
    <Card>
      <CardHeader>
        <div className="min-w-0">
          <CardTitle>Dataset catalog · {items.length} series</CardTitle>
          <div className="truncate text-o-text-3 text-xs">
            One availability rule per series (contract §6); licence classes L0–L4
          </div>
        </div>
        <CardAction>
          <ToggleGroup
            type="single"
            value={kind}
            onValueChange={(v) => v && onKind(v)}
            aria-label="Kind"
          >
            {KINDS.map((k) => (
              <ToggleGroupItem key={k.id} value={k.id}>
                {k.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <CopyButton value={tsv} label="catalog (TSV)" iconOnly />
        </CardAction>
      </CardHeader>
      <div className="max-h-[680px] overflow-auto">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-o-surface">
            <tr className="border-o-border border-b text-o-text-3 text-xs">
              <th className="h-8 pl-4 text-left font-medium">Series</th>
              <th className="h-8 px-2 text-left font-medium">Source</th>
              <th className="h-8 px-2 text-left font-medium">Licence</th>
              <th className="h-8 px-2 text-left font-medium">Freq.</th>
              <th className="h-8 px-2 text-left font-medium">Coverage</th>
              <th className="h-8 px-2 text-right font-medium">Rows</th>
              <th className="h-8 px-2 text-left font-medium">Availability rule</th>
              <th className="h-8 px-2 text-left font-medium">PIT</th>
              <th className="h-8 pr-4 text-left font-medium">Last available</th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr
                key={i.id}
                className="h-9 border-o-border-subtle border-b align-top hover:bg-o-hover"
              >
                <td className="max-w-80 py-1.5 pl-4">
                  <div className="truncate text-o-text" title={i.name}>
                    {i.name}
                  </div>
                  <div className="font-mono text-2xs text-o-text-3">
                    {i.id}
                    {i.vintages ? " · vintages" : ""}
                    {i.published_weekly ? " · published weekly (H.10)" : ""}
                  </div>
                </td>
                <td className="max-w-64 px-2 py-1.5 text-o-text-2 text-xs">
                  <span className="line-clamp-2" title={i.source ?? ""}>
                    {i.source ?? "—"}
                  </span>
                </td>
                <td className="px-2 py-1.5">
                  <LicenceBadge licence={i.licence} note={i.licence_note} />
                </td>
                <td className="px-2 py-1.5 font-mono text-o-text-2 text-xs">
                  {i.frequency ?? "—"}
                </td>
                <td className="num whitespace-nowrap px-2 py-1.5 text-o-text-2 text-xs">
                  {i.coverage ? `${fmt.date(i.coverage.from)} – ${fmt.date(i.coverage.to)}` : "—"}
                </td>
                <td className="px-2 py-1.5 text-right text-xs">
                  {i.coverage ? (
                    <Metric
                      metric={`catalog.${i.id}.rows`}
                      prov={{
                        ...c.provenance,
                        kind: "series",
                        id: i.id,
                        ...(i.rule ? { rule: i.rule } : {}),
                        licence: i.licence,
                      }}
                      interactive
                    >
                      {fmt.int(i.coverage.rows)}
                    </Metric>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-2 py-1.5 text-xs">
                  <Tip content={`Strict (true publication lag): ${i.strict_rule ?? "same"}`}>
                    <span className="cursor-help font-mono text-o-text-2">{i.rule ?? "—"}</span>
                  </Tip>
                </td>
                <td className="px-2 py-1.5 text-o-text-2 text-xs">{i.pit_grade ?? "—"}</td>
                <td className="num whitespace-nowrap py-1.5 pr-4 text-o-text-2 text-xs">
                  {i.last_available_at ? fmt.dateTimeET(i.last_available_at) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <CardFooter>
        {c.notice ? `${c.notice} ` : ""}L2–L4 data stays on this laptop and out of git. PIT grade: A
        = true vintages or acceptance times; B = market-observable or assumed lag.
      </CardFooter>
    </Card>
  );
}

/** Data › Catalog (ux-spec §4.9): name, source, licence badge, frequency, coverage, rule. */
export function CatalogTab() {
  const search = useSearch({ strict: false }) as DataSearch;
  const navigate = useNavigate();
  const q = useCatalog();
  const kind = search.kind ?? "all";
  return (
    <QueryState
      q={q}
      thing="the dataset catalog"
      skeleton={<Skeleton className="h-[480px] w-full rounded-lg" />}
    >
      {(c) => (
        <Catalog
          c={c}
          kind={kind}
          onKind={(k) =>
            void navigate({
              to: "/data/$tab" as never,
              params: { tab: "catalog" } as never,
              search: ((prev: Record<string, unknown>) => ({
                ...prev,
                kind: k === "all" ? undefined : k,
              })) as never,
              replace: true,
            })
          }
        />
      )}
    </QueryState>
  );
}
