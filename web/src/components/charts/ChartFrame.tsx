import { ClipboardCopyIcon, TableIcon } from "lucide-react";
import type * as React from "react";
import { type ReactNode, useId, useState } from "react";
import { toast } from "sonner";
import { FIXTURE_MODE } from "@/api/config";
import { PanelBoundary } from "@/components/common/ErrorBoundary";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardHeader, CardTitle } from "@/components/ui/card";
import { Kbd } from "@/components/ui/misc";
import { Tip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { TableView } from "./builders/common";

function toTsv(t: TableView): string {
  return [t.columns.join("\t"), ...t.rows.map((r) => r.join("\t"))].join("\n");
}

/**
 * ChartFrame (UX-C15): title, subtitle, toolbar (View as table · Copy data), source line,
 * `role="figure"` with the summary in aria-describedby, and the ILLUSTRATIVE watermark in
 * fixture mode. `V` toggles the table when the frame has focus.
 */
export function ChartFrame({
  title,
  subtitle,
  chips,
  sourceLine,
  summary,
  table,
  toolbar,
  readout,
  children,
  className,
  bodyClassName,
  height,
  onKeyDown,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  chips?: ReactNode;
  sourceLine: ReactNode;
  summary: string;
  table?: TableView;
  toolbar?: ReactNode;
  readout?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  height?: number;
  onKeyDown?: (e: React.KeyboardEvent<HTMLElement>) => void;
}) {
  const [asTable, setAsTable] = useState(false);
  const id = useId();
  const copy = async () => {
    if (!table) return;
    try {
      await navigator.clipboard.writeText(toTsv(table));
      toast("Copied data (TSV)");
    } catch {
      toast("Could not copy data");
    }
  };
  return (
    <Card className={className}>
      <CardHeader>
        <div className="min-w-0">
          <CardTitle>{title}</CardTitle>
          {subtitle ? <div className="truncate text-o-text-3 text-xs">{subtitle}</div> : null}
        </div>
        <CardAction>
          {chips}
          {toolbar}
          {table ? (
            <>
              <Tip
                content={
                  <span>
                    View as table <Kbd>V</Kbd>
                  </span>
                }
              >
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-pressed={asTable}
                  aria-label="View as table"
                  onClick={() => setAsTable((v) => !v)}
                  className={cn(asTable && "bg-o-selected text-o-text")}
                >
                  <TableIcon />
                </Button>
              </Tip>
              <Tip content="Copy data (TSV)">
                <Button variant="ghost" size="icon-sm" aria-label="Copy data as TSV" onClick={copy}>
                  <ClipboardCopyIcon />
                </Button>
              </Tip>
            </>
          ) : null}
        </CardAction>
      </CardHeader>
      {readout ? (
        <div className="border-o-border-subtle border-b px-4 py-1.5">{readout}</div>
      ) : null}
      <figure
        aria-label={typeof title === "string" ? title : undefined}
        aria-describedby={`${id}-summary`}
        aria-roledescription="interactive chart"
        // biome-ignore lint/a11y/noNoninteractiveTabindex: the chart is focusable for its keyboard model (V, arrows; ux-spec §6.1)
        tabIndex={0}
        onKeyDown={(e) => {
          if ((e.key === "v" || e.key === "V") && !e.metaKey && !e.ctrlKey && table) {
            e.preventDefault();
            setAsTable((v) => !v);
            return;
          }
          onKeyDown?.(e);
        }}
        className={cn("relative m-0 min-w-0 px-2 pt-2", bodyClassName)}
      >
        <p id={`${id}-summary`} className="sr-only">
          {summary}
        </p>
        {asTable && table ? (
          <div
            className="max-h-[420px] overflow-auto px-2 pb-2"
            style={height ? { minHeight: height } : undefined}
          >
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-o-surface">
                <tr>
                  {table.columns.map((c) => (
                    <th
                      key={c}
                      className="border-o-border border-b px-2 py-1.5 text-left font-medium text-o-text-3"
                    >
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows.map((r, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: rows are positional
                  <tr key={i} className="border-o-border-subtle border-b">
                    {r.map((v, j) => (
                      // biome-ignore lint/suspicious/noArrayIndexKey: columns are positional
                      <td key={j} className="num px-2 py-1 text-o-text-2">
                        {v}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="fade-in relative">
            <PanelBoundary
              thing={typeof title === "string" ? `the chart "${title}"` : "this chart"}
            >
              {children}
            </PanelBoundary>
            {FIXTURE_MODE ? (
              <div className="illustrative-watermark" aria-hidden="true">
                <span>ILLUSTRATIVE</span>
              </div>
            ) : null}
          </div>
        )}
      </figure>
      <figcaption className="px-4 pt-1 pb-3 text-2xs text-o-text-3 leading-[0.875rem]">
        {sourceLine}
      </figcaption>
    </Card>
  );
}
