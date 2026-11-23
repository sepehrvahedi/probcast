import { Link } from "@tanstack/react-router";
import { type ReactNode, useId } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { API_BASE, FIXTURE_MODE } from "@/api/config";
import { useAuthors, useStatus } from "@/api/queries";
import { Hash } from "@/components/common/chips";
import { GlossaryTerm } from "@/components/common/GlossaryTerm";
import { Metric } from "@/components/common/Metric";
import { QueryState } from "@/components/common/QueryState";
import { PageHeader } from "@/components/shell/PageHeader";
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
import aboutData from "@/content/about/data.md?raw";
import { useActingAs } from "@/lib/acting-as";
import * as fmt from "@/lib/fmt";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { type LabSettings, type PolicyRow, useLabSettings } from "./api";
import { HORIZON_OPTIONS } from "./checks";
import { RefChips, Select } from "./ui";

/** The "Notices" and "Third-party software" sections of About › Data and licences (same text). */
export function licenceSections(md: string): string {
  const parts = md.split(/\n(?=## )/);
  return parts.filter((p) => /^## (Notices|Third-party software)/.test(p)).join("\n\n");
}

const TIME_ROWS = new Set(["freeze_at", "reveal_at", "intake_close_at"]);

function policyValue(p: PolicyRow): string {
  if (TIME_ROWS.has(p.id) && typeof p.value === "string") return fmt.dateTimeUK(p.value);
  if (p.id === "anchor_weight" && typeof p.value === "number") return fmt.pct(p.value, 0, false);
  if (p.id === "horizons" && Array.isArray(p.value)) return (p.value as number[]).join(" / ");
  if (p.id === "quantile_grid" && Array.isArray(p.value)) return `${p.value.length} levels`;
  if (p.id === "families" && Array.isArray(p.value)) return `${p.value.length}`;
  if (p.id === "anchor") return `ERP ${fmt.pct((p.value as { erp: number }).erp, 0, false)}`;
  if (p.id === "segments") return "1990 →";
  if (typeof p.value === "boolean") return p.value ? "on" : "off";
  if (p.value == null) return "—";
  return String(p.value);
}

function Choice({
  name,
  value,
  current,
  onChange,
  children,
}: {
  name: string;
  value: string;
  current: string;
  onChange: (v: string) => void;
  children: ReactNode;
}) {
  const on = value === current;
  return (
    <label
      className={cn(
        "flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm",
        on
          ? "border-o-accent bg-o-accent-subtle text-o-text"
          : "border-o-border text-o-text-2 hover:bg-o-hover",
      )}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={on}
        onChange={() => onChange(value)}
        className="accent-(--o-accent)"
      />
      {children}
    </label>
  );
}

function Policies({ s }: { s: LabSettings }) {
  return (
    <Card className="col-span-12">
      <CardHeader>
        <CardTitle>Research policies (read-only)</CardTitle>
      </CardHeader>
      <Table data-testid="policies">
        <TableHeader>
          <TableRow>
            <TableHead>Policy</TableHead>
            <TableHead>Value</TableHead>
            <TableHead>Meaning</TableHead>
            <TableHead>Set in</TableHead>
            <TableHead>Changed by</TableHead>
            <TableHead>Decisions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {s.policies.map((p) => (
            <TableRow key={p.id} data-policy={p.id} className="align-top">
              <TableCell className="text-o-text">{p.label}</TableCell>
              <TableCell>
                <Metric
                  metric={`settings.${p.id}`}
                  prov={{ ...s.provenance, key: p.id, source: p.set_in }}
                  interactive
                  label={p.label}
                  className="text-o-text"
                >
                  {policyValue(p)}
                </Metric>
              </TableCell>
              <TableCell className="max-w-[46ch] whitespace-normal text-o-text-2 text-xs">
                {p.display}
              </TableCell>
              <TableCell className="max-w-[30ch] whitespace-normal font-mono text-2xs text-o-text-2">
                {p.set_in}
              </TableCell>
              <TableCell className="text-o-text-3 text-xs">{p.changed_by}</TableCell>
              <TableCell>
                <RefChips refs={p.refs} paths={s.refs} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <CardFooter>
        Policies are set in files and changed only by the PO. The app has no control to change them;
        the freeze and the reveal are witnessed CLI actions (D-047).
      </CardFooter>
    </Card>
  );
}

function Mde({ s }: { s: LabSettings }) {
  const m = s.mde;
  return (
    <Card className="col-span-12 xl:col-span-6">
      <CardHeader>
        <CardTitle>
          Detectable effect sizes (<GlossaryTerm term="mde">MDE</GlossaryTerm>) for idea cards
        </CardTitle>
      </CardHeader>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Horizon</TableHead>
            <TableHead className="text-right">n_eff</TableHead>
            <TableHead className="text-right">σ_h</TableHead>
            <TableHead className="text-right">MDE (±, log return)</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {m.by_horizon.map((r) => (
            <TableRow key={r.h}>
              <TableCell className="num">
                {HORIZON_OPTIONS.find((o) => o.h === r.h)?.label} · {r.h} s
              </TableCell>
              <TableCell className="num text-right">{fmt.nEff(r.n_eff)}</TableCell>
              <TableCell className="num text-right">{fmt.pct(r.sigma_h, 1, false)}</TableCell>
              <TableCell className="text-right">
                <Metric
                  metric={`settings.mde.${r.h}`}
                  prov={{ ...s.provenance, key: `mde.${r.h}` }}
                  className="text-o-text"
                >
                  ±{fmt.pct(r.mde, 1, false)}
                </Metric>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <CardFooter>
        {m.formula}; α = {m.alpha}, power {m.power}; {m.sample}. {m.reference}. A smaller expected
        effect is likely undetectable on {s.build.ticker} alone (a warning on the card, not a
        block).
      </CardFooter>
    </Card>
  );
}

function Rules({ s }: { s: LabSettings }) {
  const a = s.availability;
  const nSeries = Object.keys(a.series).length;
  return (
    <Card className="col-span-12 xl:col-span-6">
      <CardHeader>
        <CardTitle>Availability rules</CardTitle>
      </CardHeader>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Class</TableHead>
            <TableHead>Rule</TableHead>
            <TableHead>Strict mode</TableHead>
            <TableHead className="text-right">Series</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {a.classes.map((c) => (
            <TableRow key={c.id}>
              <TableCell className="font-mono text-xs">{c.id}</TableCell>
              <TableCell className="font-mono text-o-text-2 text-xs">{c.normal}</TableCell>
              <TableCell className="font-mono text-o-text-2 text-xs">{c.strict}</TableCell>
              <TableCell className="num text-right text-o-text-2">
                {Object.values(a.series).filter((v) => v === c.id).length}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <CardFooter>
        {nSeries} series mapped in {a.source}. An analyzer at origin t sees a row only once it is
        available under its rule.
      </CardFooter>
    </Card>
  );
}

/** Settings (ux-spec §4.14): personal display choices and the research policies, read-only. */
export function SettingsPage() {
  const uid = useId();
  const q = useLabSettings();
  const status = useStatus();
  const authors = useAuthors();
  const { theme, setTheme } = useTheme();
  const { handle, setHandle } = useActingAs();
  const st = status.data;
  return (
    <div>
      <PageHeader title="Settings" breadcrumb="Settings" />
      <div className="grid grid-cols-12 gap-4">
        <Card className="col-span-12 md:col-span-6 xl:col-span-4">
          <CardHeader>
            <CardTitle>Appearance</CardTitle>
          </CardHeader>
          <CardContent>
            <fieldset className="grid grid-cols-2 gap-2">
              <legend className="sr-only">Theme</legend>
              <Choice
                name={`${uid}-theme`}
                value="dark"
                current={theme}
                onChange={(v) => setTheme(v as "dark")}
              >
                Dark (default)
              </Choice>
              <Choice
                name={`${uid}-theme`}
                value="light"
                current={theme}
                onChange={(v) => setTheme(v as "light")}
              >
                Light
              </Choice>
            </fieldset>
            <p className="mt-2 text-2xs text-o-text-3">
              Stored in this browser and applied before first paint, so reloads never flash the
              other theme.
            </p>
          </CardContent>
        </Card>
        <Card className="col-span-12 md:col-span-6 xl:col-span-4">
          <CardHeader>
            <CardTitle>Acting as</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <label htmlFor={`${uid}-handle`} className="text-o-text-2 text-sm">
              Default handle for this browser (same list as the top bar)
            </label>
            <Select
              id={`${uid}-handle`}
              value={handle ?? ""}
              onChange={(e) => setHandle(e.target.value || null)}
            >
              <option value="">Nobody (writes disabled)</option>
              {(authors.data?.items ?? []).map((a) => (
                <option key={a.handle} value={a.handle}>
                  {a.handle} ({a.role})
                </option>
              ))}
            </Select>
            <p className="text-2xs text-o-text-3">
              Attribution, not security: writes record this handle. Handles only, never real names.
            </p>
          </CardContent>
        </Card>
        <Card className="col-span-12 xl:col-span-4">
          <CardHeader>
            <CardTitle>Build</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="num grid grid-cols-[110px_1fr] gap-y-1.5 text-sm" data-testid="build">
              <dt className="text-o-text-3 text-xs">Version</dt>
              <dd>{st?.version ?? q.data?.build.version ?? "—"}</dd>
              <dt className="text-o-text-3 text-xs">Git SHA</dt>
              <dd>{st?.git_sha ? <Hash value={st.git_sha} n={10} /> : "—"}</dd>
              <dt className="text-o-text-3 text-xs">API</dt>
              <dd className="font-mono text-xs">
                {API_BASE ? `${API_BASE}/api/v1` : "none (fixtures)"}
              </dd>
              <dt className="text-o-text-3 text-xs">Data mode</dt>
              <dd>
                {FIXTURE_MODE
                  ? "fixtures"
                  : q.data?.build.data === "fixtures"
                    ? "fixtures (engine)"
                    : "real"}
              </dd>
              <dt className="text-o-text-3 text-xs">Snapshot</dt>
              <dd>
                {st ? (
                  <>
                    <span className="font-mono text-xs">{st.snapshot.id}</span>{" "}
                    <Hash value={st.snapshot.hash} />
                  </>
                ) : (
                  "—"
                )}
              </dd>
            </dl>
          </CardContent>
        </Card>
      </div>
      <div className="mt-4">
        <QueryState
          q={q}
          thing="the research policies"
          skeleton={<Skeleton className="h-96 w-full rounded-lg" />}
        >
          {(s) => (
            <div className="grid grid-cols-12 gap-4">
              <Policies s={s} />
              <Mde s={s} />
              <Rules s={s} />
            </div>
          )}
        </QueryState>
      </div>
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Licences and attributions</CardTitle>
        </CardHeader>
        <CardContent className="prose-o text-sm" data-testid="licences">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{licenceSections(aboutData)}</ReactMarkdown>
          <p>
            <Link to="/about/$page" params={{ page: "data" }}>
              Data and licences (About)
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
