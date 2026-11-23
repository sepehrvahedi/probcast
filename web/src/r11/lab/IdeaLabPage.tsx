import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { LayoutGridIcon, ListIcon, PlusIcon } from "lucide-react";
import { useMemo } from "react";
import { useAuthors } from "@/api/queries";
import { AuthorChip, Hash } from "@/components/common/chips";
import { EmptyState } from "@/components/common/EmptyState";
import { Metric } from "@/components/common/Metric";
import { QueryState } from "@/components/common/QueryState";
import { PageHeader } from "@/components/shell/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/misc";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import * as fmt from "@/lib/fmt";
import { cn } from "@/lib/utils";
import { type IdeaRecord, useIdeas } from "./api";
import { HORIZON_OPTIONS, LIFECYCLE, statusLabel } from "./checks";
import { RunLauncherButton } from "./RunLauncher";
import type { LabSearch } from "./search";
import { StatusBadge } from "./ui";

function hzList(hs: number[]): string {
  return hs.map((h) => HORIZON_OPTIONS.find((o) => o.h === h)?.label ?? `${h}s`).join(" ");
}

function Board({ items, slots }: { items: IdeaRecord[]; slots: Record<string, number> }) {
  return (
    <div
      className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5 2xl:grid-cols-9"
      data-testid="idea-board"
    >
      {LIFECYCLE.map((col) => {
        const cards = items.filter((i) => i.status === col.id);
        return (
          <section key={col.id} aria-label={`${col.label}: ${cards.length}`} className="min-w-0">
            <div className="mb-1.5 flex items-baseline justify-between gap-2 px-0.5">
              <h3 className="overline">{col.label}</h3>
              <span className="num text-o-text-3 text-xs">{cards.length}</span>
            </div>
            <div
              className={cn(
                "min-h-20 space-y-1.5 rounded-lg border border-o-border-subtle bg-o-sunken p-1.5",
                col.terminal && "border-dashed",
              )}
            >
              {cards.map((c) => (
                <Link
                  key={c.id}
                  to="/lab/$icId"
                  params={{ icId: c.id }}
                  className="block rounded-md border border-o-border-subtle bg-o-surface px-2 py-1.5 hover:bg-o-hover"
                >
                  <span className="font-mono text-2xs text-o-text-3">{c.id}</span>
                  <span className="block truncate text-o-text text-sm">{c.title}</span>
                  <span className="mt-0.5 flex items-center justify-between gap-2">
                    <AuthorChip handle={c.author} slot={slots[c.author]} />
                    <span className="num text-2xs text-o-text-3">{hzList(c.horizons)}</span>
                  </span>
                </Link>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

/** Idea lab list (ux-spec §4.11): registered cards and where each is in its lifecycle. */
export function IdeaLabPage() {
  const q = useIdeas();
  const authors = useAuthors();
  const search = useSearch({ strict: false }) as LabSearch;
  const navigate = useNavigate();
  const view = search.view ?? "list";
  const slots = useMemo(
    () => Object.fromEntries((authors.data?.items ?? []).map((a) => [a.handle, a.slot])),
    [authors.data],
  );
  const set = (patch: Partial<LabSearch>) =>
    void navigate({ to: "/lab", search: (s: Record<string, unknown>) => ({ ...s, ...patch }) });

  return (
    <div>
      <PageHeader
        title="Idea lab"
        breadcrumb="Idea lab"
        chips={
          <span>Pre-registration: each card is hashed and timestamped before any backtest.</span>
        }
        actions={
          <>
            <RunLauncherButton />
            <Button asChild size="sm">
              <Link to="/lab/new">
                <PlusIcon /> New card
              </Link>
            </Button>
          </>
        }
      />
      <QueryState
        q={q}
        thing="the idea cards"
        skeleton={
          <div className="space-y-2">
            <Skeleton className="h-8 w-80" />
            <Skeleton className="h-64 w-full rounded-lg" />
          </div>
        }
      >
        {(d) => {
          const items = d.items;
          if (!items.length) {
            return (
              <Card>
                <EmptyState
                  title="No idea cards registered yet"
                  body="Enter a teammate's card acting as its author. Registration hashes and timestamps it before any backtest."
                  action={
                    <Button asChild size="sm">
                      <Link to="/lab/new">
                        <PlusIcon /> New card
                      </Link>
                    </Button>
                  }
                />
              </Card>
            );
          }
          const shown = search.status ? items.filter((i) => i.status === search.status) : items;
          const counts = LIFECYCLE.map((l) => ({
            ...l,
            n: items.filter((i) => i.status === l.id).length,
          }));
          return (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <ToggleGroup
                  type="single"
                  value={view}
                  onValueChange={(v) => v && set({ view: v as "board" | "list" })}
                  aria-label="View"
                >
                  <ToggleGroupItem value="list" aria-label="List">
                    <ListIcon className="size-3.5" /> <span className="ml-1">List</span>
                  </ToggleGroupItem>
                  <ToggleGroupItem value="board" aria-label="Board">
                    <LayoutGridIcon className="size-3.5" /> <span className="ml-1">Board</span>
                  </ToggleGroupItem>
                </ToggleGroup>
                <fieldset className="flex flex-wrap items-center gap-1">
                  <legend className="sr-only">Filter by status</legend>
                  <Button
                    size="sm"
                    variant={search.status ? "ghost" : "secondary"}
                    onClick={() => set({ status: undefined })}
                    aria-pressed={!search.status}
                  >
                    All <span className="num text-o-text-3">{items.length}</span>
                  </Button>
                  {counts
                    .filter((c) => c.n > 0)
                    .map((c) => (
                      <Button
                        key={c.id}
                        size="sm"
                        variant={search.status === c.id ? "secondary" : "ghost"}
                        onClick={() => set({ status: search.status === c.id ? undefined : c.id })}
                        aria-pressed={search.status === c.id}
                      >
                        {c.label} <span className="num text-o-text-3">{c.n}</span>
                      </Button>
                    ))}
                </fieldset>
              </div>
              {view === "board" ? (
                <Board items={shown} slots={slots} />
              ) : (
                <Card className="overflow-hidden">
                  <CardHeader>
                    <CardTitle>Registered cards</CardTitle>
                  </CardHeader>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>Title</TableHead>
                        <TableHead>Handle</TableHead>
                        <TableHead>Section</TableHead>
                        <TableHead>Horizons</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Registered (UK) · hash</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {shown.map((i) => (
                        <TableRow key={i.id} className="hover:bg-o-hover">
                          <TableCell>
                            <Link
                              to="/lab/$icId"
                              params={{ icId: i.id }}
                              className="font-mono text-o-accent text-xs hover:underline"
                            >
                              {i.id}
                            </Link>
                          </TableCell>
                          <TableCell className="max-w-[28ch] truncate">
                            <Link
                              to="/lab/$icId"
                              params={{ icId: i.id }}
                              className="text-o-text hover:underline"
                              tabIndex={-1}
                            >
                              {i.title}
                            </Link>
                          </TableCell>
                          <TableCell>
                            <AuthorChip handle={i.author} slot={slots[i.author]} />
                          </TableCell>
                          <TableCell className="text-o-text-2 capitalize">
                            {i.report_section}
                          </TableCell>
                          <TableCell className="num text-o-text-2">{hzList(i.horizons)}</TableCell>
                          <TableCell>
                            <StatusBadge status={i.status} />
                          </TableCell>
                          <TableCell className="text-o-text-2 text-xs">
                            <Metric
                              metric="idea.registered_at"
                              prov={{ ...d.provenance, key: i.id }}
                              className="mr-2"
                            >
                              {fmt.dateTimeUK(i.ts)}
                            </Metric>
                            <Hash value={i.hash} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <CardFooter>
                    Source: registry/ideas.jsonl (hash-chained). Status after registration is set by
                    the PO at triage ({statusLabel("triaged")} → … → committee, descriptive only,
                    parked or rejected).
                  </CardFooter>
                </Card>
              )}
              {d.fixture ? (
                <p className="text-2xs text-o-text-3">Synthetic fixture cards (ticker DEMO).</p>
              ) : null}
            </div>
          );
        }}
      </QueryState>
      <Card className="mt-4">
        <CardContent className="text-o-text-2 text-xs">
          Cards are entered by the PO acting as their author. Content is immutable after
          registration; an amendment is a new card and counts as a new trial.
        </CardContent>
      </Card>
    </div>
  );
}
