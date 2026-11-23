import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from "react";
import type { Provenance } from "@/api/types";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import * as fmt from "@/lib/fmt";
import { serialiseProv } from "@/lib/prov";
import { CopyButton } from "./CopyButton";

interface Ctx {
  open: (p: Provenance, label?: string) => void;
}
const ProvCtx = createContext<Ctx>({ open: () => {} });

export function useProvenance(): Ctx {
  return useContext(ProvCtx);
}

const KIND_LABEL: Record<string, string> = {
  observation: "Observation",
  series: "Series",
  filing: "Filing",
  event: "Event",
  run: "Run",
  committee: "Committee",
  forecast: "Forecast object",
  figure: "Report figure",
  ledger: "Ledger key",
  snapshot: "Snapshot",
  dataset: "Dataset",
};

function Row({ k, v, mono }: { k: string; v: ReactNode; mono?: boolean }) {
  if (v == null || v === "") return null;
  return (
    <div className="grid grid-cols-[132px_1fr] gap-3 border-o-border-subtle border-b py-2 last:border-0">
      <dt className="text-o-text-3 text-xs">{k}</dt>
      <dd className={mono ? "break-all font-mono text-o-text text-xs" : "text-o-text text-sm"}>
        {v}
      </dd>
    </div>
  );
}

/** Provenance drawer host (UX-C05): one right drawer for the whole app. */
export function ProvenanceProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ p: Provenance; label?: string } | null>(null);
  const open = useCallback(
    (p: Provenance, label?: string) => setState({ p, ...(label ? { label } : {}) }),
    [],
  );
  const value = useMemo(() => ({ open }), [open]);
  const p = state?.p;
  return (
    <ProvCtx.Provider value={value}>
      {children}
      <Sheet open={!!state} onOpenChange={(o) => !o && setState(null)}>
        {p ? (
          <SheetContent
            kicker={`Provenance · ${KIND_LABEL[p.kind] ?? p.kind}`}
            title={state?.label ?? p.id}
          >
            <dl>
              <Row k="Kind" v={KIND_LABEL[p.kind] ?? p.kind} />
              <Row k="ID" v={p.id} mono />
              <Row k="Metric key" v={p.key} mono />
              <Row k="Source" v={p.source} />
              <Row
                k="Snapshot"
                v={
                  p.snapshot
                    ? `${p.snapshot}${p.snapshot_hash ? ` (${fmt.hash(p.snapshot_hash)})` : ""}`
                    : undefined
                }
              />
              <Row
                k="Available at"
                v={
                  p.available_at
                    ? `${fmt.dateTimeET(p.available_at)} · ${fmt.timeUK(p.available_at)}`
                    : undefined
                }
              />
              <Row k="Availability rule" v={p.rule} />
              <Row k="Licence" v={p.licence} />
              <Row k="URL" v={p.url} mono />
              <Row k="data-provenance" v={serialiseProv(p)} mono />
            </dl>
            <div className="mt-4 flex flex-wrap gap-2">
              <CopyButton value={serialiseProv(p)} label="provenance key" variant="outline" />
              {p.snapshot_hash ? (
                <CopyButton value={p.snapshot_hash} label="snapshot hash" variant="outline" />
              ) : null}
            </div>
            <p className="mt-6 text-o-text-3 text-xs">
              Derived numbers link to the run or committee version that produced them. Citations can
              be copied only once a teammate has opened the source (Report studio, R1.1).
            </p>
          </SheetContent>
        ) : null}
      </Sheet>
    </ProvCtx.Provider>
  );
}
