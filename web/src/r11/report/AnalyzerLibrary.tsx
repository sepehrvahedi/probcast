import { useNavigate } from "@tanstack/react-router";
import { ChevronDownIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { HORIZONS, type Horizon } from "@/api/types";
import { AnalyzerChip, AuthorChip } from "@/components/common/chips";
import { EmptyState } from "@/components/common/EmptyState";
import { QueryState } from "@/components/common/QueryState";
import { GradeBadge, LeakTestedBadge } from "@/components/honesty";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card, CardFooter } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/misc";
import { InfoButton, Tip } from "@/components/ui/tooltip";
import * as fmt from "@/lib/fmt";
import { cn } from "@/lib/utils";
import { type AnalyzerLibrary, type LibraryRow, useLibrary } from "./api";
import { AnalyzerStatusChip } from "./ui";

/** GradeRow: five GradeBadges (1W…12M); `—` for horizons the analyzer does not declare. */
export function GradeRow({ row }: { row: Pick<LibraryRow, "grades" | "horizons"> }) {
  return (
    <span className="inline-flex items-center gap-2" data-grade-row="">
      {HORIZONS.map((h) => {
        const g = row.grades[String(h)];
        if (!row.horizons.includes(h)) {
          return (
            <Tip key={h} content={`Horizon ${fmt.hLabel(h)} not declared`}>
              <InfoButton
                className="num w-7 text-center text-o-text-3 text-xs"
                aria-label={`${fmt.hLabel(h)}: horizon not declared`}
              >
                —
              </InfoButton>
            </Tip>
          );
        }
        if (!g) {
          return (
            <Tip key={h} content={`${fmt.hLabel(h)}: not scored on this snapshot yet`}>
              <InfoButton
                className="num w-7 text-center text-o-text-3 text-xs"
                aria-label={`${fmt.hLabel(h)}: not scored yet`}
              >
                ·
              </InfoButton>
            </Tip>
          );
        }
        return (
          <span key={h} className="w-7 text-center">
            <GradeBadge grade={g.grade} flag={g.flag} h={h as Horizon} variant="compact" />
          </span>
        );
      })}
    </span>
  );
}

function Filter({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string | undefined;
  options: string[];
  onChange: (v: string | undefined) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-o-border bg-o-surface px-2.5 text-sm hover:bg-accent"
        aria-label={`${label} filter`}
      >
        <span className="text-o-text-3">{label}</span>
        <span className="text-o-text">{value ?? "All"}</span>
        <ChevronDownIcon className="size-3.5 text-o-text-3" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuLabel>{label}</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={value ?? "__all"}
          onValueChange={(v) => onChange(v === "__all" ? undefined : v)}
        >
          <DropdownMenuRadioItem value="__all">All</DropdownMenuRadioItem>
          {options.map((o) => (
            <DropdownMenuRadioItem key={o} value={o}>
              {o}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const TH =
  "sticky top-0 z-10 h-8 whitespace-nowrap bg-o-surface px-2 text-left align-middle font-medium text-o-text-3 text-xs";

export function LibraryTable({ d, onOpen }: { d: AnalyzerLibrary; onOpen: (id: string) => void }) {
  const [f, setF] = useState<Record<string, string | undefined>>({});
  const uniq = (g: (r: LibraryRow) => string) => [...new Set(d.items.map(g))].sort();
  const rows = useMemo(
    () =>
      d.items.filter(
        (r) =>
          (!f.family || r.family === f.family) &&
          (!f.category || r.category === f.category) &&
          (!f.section || r.report_section === f.section) &&
          (!f.author || r.author === f.author) &&
          (!f.status || r.status === f.status),
      ),
    [d.items, f],
  );
  const set = (k: string) => (v: string | undefined) => setF((p) => ({ ...p, [k]: v }));
  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Filter
          label="Family"
          value={f.family}
          options={uniq((r) => r.family)}
          onChange={set("family")}
        />
        <Filter
          label="Category"
          value={f.category}
          options={uniq((r) => r.category)}
          onChange={set("category")}
        />
        <Filter
          label="Section"
          value={f.section}
          options={uniq((r) => r.report_section)}
          onChange={set("section")}
        />
        <Filter
          label="Author"
          value={f.author}
          options={uniq((r) => r.author)}
          onChange={set("author")}
        />
        <Filter
          label="Status"
          value={f.status}
          options={uniq((r) => r.status)}
          onChange={set("status")}
        />
        <span className="ml-auto num text-o-text-3 text-xs">
          {rows.length} of {d.items.length} analyzers
        </span>
      </div>
      <Card className="overflow-hidden">
        <div className="max-h-[calc(100vh-260px)] overflow-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-o-border border-b">
                <th className={cn(TH, "pl-4")}>Analyzer</th>
                <th className={TH}>Family</th>
                <th className={TH}>Section</th>
                <th className={TH}>Calibrator</th>
                <th className={TH}>
                  <span className="inline-flex gap-2">
                    {HORIZONS.map((h) => (
                      <span key={h} className="w-7 text-center">
                        {fmt.hLabel(h)}
                      </span>
                    ))}
                  </span>
                  <span className="sr-only"> grade per horizon vs CAPM</span>
                </th>
                <th className={TH}>Leak tests</th>
                <th className={TH}>Status</th>
                <th className={TH}>Prior</th>
                <th className={cn(TH, "pr-4")}>Author</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-o-text-3">
                    No analyzers match these filters.
                  </td>
                </tr>
              ) : null}
              {rows.map((r) => (
                <tr
                  key={r.id}
                  tabIndex={0}
                  onClick={() => onOpen(r.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") onOpen(r.id);
                  }}
                  aria-label={`${r.name}: open detail`}
                  className="h-10 cursor-pointer border-o-border-subtle border-b outline-none hover:bg-o-hover focus-visible:bg-o-selected"
                >
                  <td className="py-1 pr-2 pl-4">
                    <AnalyzerChip name={r.name} slot={r.slot} />
                    <div className="font-mono text-2xs text-o-text-3">
                      {r.id} · {r.version}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-2 font-mono text-o-text-2 text-xs">
                    {r.family}
                  </td>
                  <td className="whitespace-nowrap px-2 text-o-text-2 text-xs">
                    {r.report_section}
                  </td>
                  <td className="whitespace-nowrap px-2 font-mono text-o-text-2 text-xs">
                    {r.calibrator}
                  </td>
                  <td className="whitespace-nowrap px-2">
                    <GradeRow row={r} />
                  </td>
                  <td className="whitespace-nowrap px-2">
                    <LeakTestedBadge status={r.leak.status} tests={r.leak.tests} variant="badge" />
                  </td>
                  <td className="whitespace-nowrap px-2">
                    <AnalyzerStatusChip status={r.status} />
                  </td>
                  <td className="whitespace-nowrap px-2 text-o-text-3 text-xs">
                    {r.literature_prior ?? "—"}
                  </td>
                  <td className="whitespace-nowrap pr-4 pl-2">
                    <AuthorChip handle={r.author} slot={r.slot} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <CardFooter>
          Grades are evidence grades of each analyzer's standard run against the CAPM anchor on the
          pre-holdout segment (— horizon not declared; · not scored yet). Enter or click opens the
          detail.
        </CardFooter>
      </Card>
    </>
  );
}

export function AnalyzerLibraryPage() {
  const q = useLibrary();
  const navigate = useNavigate();
  return (
    <div>
      <PageHeader
        title="Analyzers"
        chips={<span>· Every analyzer's claim, timing, leak tests and evidence by horizon.</span>}
      />
      <QueryState
        q={q}
        thing="the analyzer library"
        skeleton={
          <Card className="space-y-2 p-4">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </Card>
        }
      >
        {(d) =>
          d.items.length === 0 ? (
            <Card>
              <EmptyState
                title="No analyzers registered"
                body="Analyzers appear here once a plugin registers with @analyzer."
              />
            </Card>
          ) : (
            <LibraryTable
              d={d}
              onOpen={(id) =>
                void navigate({
                  to: "/analyzers/$id" as never,
                  params: { id } as never,
                  search: ((prev: Record<string, unknown>) => prev) as never,
                })
              }
            />
          )
        }
      </QueryState>
    </div>
  );
}
