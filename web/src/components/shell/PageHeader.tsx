import type { ReactNode } from "react";
import { useStatus } from "@/api/queries";
import { Skeleton } from "@/components/ui/misc";
import * as fmt from "@/lib/fmt";

/**
 * Page header (§3.4, UX-P05): title + subtitle "As of {as-of} · snapshot {id} ({hash})" +
 * page-specific chips; actions right-aligned.
 */
export function PageHeader({
  title,
  breadcrumb,
  chips,
  actions,
  children,
  simple = false,
}: {
  simple?: boolean;
  title: ReactNode;
  breadcrumb?: ReactNode;
  chips?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  const status = useStatus();
  const s = status.data?.snapshot;
  return (
    <div className="mb-5">
      <div className="flex min-h-14 items-start gap-4">
        <div className="min-w-0 flex-1">
          {breadcrumb ? <div className="mb-0.5 text-o-text-3 text-xs">{breadcrumb}</div> : null}
          <h1 className="truncate font-semibold text-lg text-o-text tracking-[-0.01em]">{title}</h1>
          <div
            className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-o-text-3 text-xs"
            data-page-subtitle=""
          >
            {s && simple ? (
              <span className="num">Prices up to {fmt.date(s.asof_close.slice(0, 10))}</span>
            ) : s ? (
              <span className="num">
                As of Latest ({fmt.date(s.asof_close.slice(0, 10))} close) · snapshot{" "}
                <span className="font-mono text-o-text-2">{s.id}</span> (
                <span className="font-mono">{fmt.hash(s.hash)}</span>)
              </span>
            ) : (
              <Skeleton className="h-3.5 w-72" />
            )}
            {chips}
          </div>
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2 pt-1">{actions}</div> : null}
      </div>
      {children}
    </div>
  );
}
