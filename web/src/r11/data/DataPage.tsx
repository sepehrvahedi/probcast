import { Link, useParams } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import { StateNotice } from "@/components/common/StateNotice";
import { PageHeader } from "@/components/shell/PageHeader";
import { Skeleton } from "@/components/ui/misc";
import { Tip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { DATA_TABS, type DataTab } from "./routes";

const PriceTab = lazy(() => import("./PriceTab").then((m) => ({ default: m.PriceTab })));
const FundamentalsTab = lazy(() =>
  import("./FundamentalsTab").then((m) => ({ default: m.FundamentalsTab })),
);
const MacroTab = lazy(() => import("./MacroTab").then((m) => ({ default: m.MacroTab })));
const PeersTab = lazy(() => import("./PeersTab").then((m) => ({ default: m.PeersTab })));
const CatalogTab = lazy(() => import("./CatalogTab").then((m) => ({ default: m.CatalogTab })));

function TabSkeleton() {
  return (
    <div aria-busy="true" className="space-y-3">
      <Skeleton className="h-8 w-[520px]" />
      <Skeleton className="h-[380px] w-full rounded-lg" />
    </div>
  );
}

/** Data explorer (ux-spec §4.7, §4.9): Price & events · Fundamentals · Macro · Peers · Catalog. */
export function DataPage() {
  const { tab } = useParams({ strict: false }) as { tab?: string };
  const active = (DATA_TABS.find((t) => t.id === tab)?.id ?? null) as DataTab | null;
  return (
    <div>
      <PageHeader
        title="Data"
        breadcrumb="Data explorer"
        chips={
          <Tip content="The holdout seals scores, not data: prices and filings after 2021 stay visible.">
            <span className="cursor-help">· ⓘ data after 2021 is visible</span>
          </Tip>
        }
      />
      <nav
        aria-label="Data tabs"
        className="mb-4 flex h-10 items-end gap-5 border-o-border-subtle border-b"
      >
        {DATA_TABS.map((t) => (
          <Link
            key={t.id}
            to={"/data/$tab" as never}
            params={{ tab: t.id } as never}
            search={((prev: Record<string, unknown>) => ({ fx: prev.fx, h: prev.h })) as never}
            aria-current={t.id === active ? "page" : undefined}
            className={cn(
              "relative -mb-px inline-flex h-10 items-center whitespace-nowrap border-transparent border-b-2 font-medium text-o-text-3 text-sm transition-colors hover:text-o-text-2",
              t.id === active && "border-o-accent text-o-text",
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      <Suspense fallback={<TabSkeleton />}>
        {active === "price" ? (
          <PriceTab />
        ) : active === "fundamentals" ? (
          <FundamentalsTab />
        ) : active === "macro" ? (
          <MacroTab />
        ) : active === "peers" ? (
          <PeersTab />
        ) : active === "catalog" ? (
          <CatalogTab />
        ) : (
          <StateNotice
            kind="info"
            title={`No data tab "${tab}"`}
            body="Choose Price & events, Fundamentals, Macro, Peers or Catalog."
          />
        )}
      </Suspense>
    </div>
  );
}
