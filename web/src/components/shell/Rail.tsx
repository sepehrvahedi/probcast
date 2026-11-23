import { Link, useRouterState } from "@tanstack/react-router";
import {
  BarChart3Icon,
  BookOpenIcon,
  CalendarRangeIcon,
  CircleHelpIcon,
  DatabaseIcon,
  FlaskConicalIcon,
  FunctionSquareIcon,
  HouseIcon,
  LayoutDashboardIcon,
  LightbulbIcon,
  type LucideIcon,
  NotebookPenIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  ScaleIcon,
  SettingsIcon,
  TrophyIcon,
} from "lucide-react";
import type * as React from "react";
import { Kbd } from "@/components/ui/misc";
import { Tip } from "@/components/ui/tooltip";
import { ROUTES, type RouteFeature } from "@/features";
import { cn } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = {
  home: HouseIcon,
  ideas: LightbulbIcon,
  rankings: TrophyIcon,
  how: CircleHelpIcon,
  classic: LayoutDashboardIcon,
  data: DatabaseIcon,
  events: CalendarRangeIcon,
  lab: NotebookPenIcon,
  analyzers: FunctionSquareIcon,
  leaderboard: BarChart3Icon,
  committee: ScaleIcon,
  report: FlaskConicalIcon,
  settings: SettingsIcon,
  about: BookOpenIcon,
};

const MATCH: Record<string, (p: string) => boolean> = {
  home: (p) => p === "/",
  ideas: (p) => p.startsWith("/ideas"),
  how: (p) => p.startsWith("/how-it-works"),
  rankings: (p) => p.startsWith("/rankings"),
  classic: (p) => p.startsWith("/classic") || p.startsWith("/runs"),
  leaderboard: (p) => p.startsWith("/leaderboard"),
  committee: (p) => p.startsWith("/committee"),
  about: (p) => p.startsWith("/about"),
};

function Item({ r, collapsed, active }: { r: RouteFeature; collapsed: boolean; active: boolean }) {
  const Icon = ICONS[r.id] ?? HouseIcon;
  const inner = (
    <Link
      to={r.path}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex h-9 items-center gap-3 rounded-md px-2.5 text-o-text-2 text-sm transition-colors duration-(--o-motion-fast) hover:bg-accent hover:text-o-text",
        active && "bg-o-selected text-o-text",
        collapsed && "justify-center px-0",
      )}
    >
      {active ? (
        <span
          aria-hidden="true"
          className="absolute top-1.5 bottom-1.5 left-0 w-0.5 rounded-full bg-o-accent"
        />
      ) : null}
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      {collapsed ? (
        <span className="sr-only">{r.label}</span>
      ) : (
        <span className="truncate">{r.label}</span>
      )}
    </Link>
  );
  return collapsed ? (
    <Tip content={r.label} side="right">
      {inner}
    </Tip>
  ) : (
    inner
  );
}

/** Left rail (§3.4): 220 / 56 px; only enabled routes (UXR1-07); `[` toggles. */
export function Rail({
  collapsed,
  onToggle,
  extra,
}: {
  collapsed: boolean;
  onToggle: () => void;
  extra?: React.ReactNode;
}) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const enabled = ROUTES.filter((r) => r.enabled);
  const top = enabled.filter((r) => (r.group ?? "main") === "main");
  const advanced = enabled.filter((r) => r.group === "advanced");
  const bottom = enabled.filter((r) => r.group === "bottom");
  const isActive = (r: RouteFeature) =>
    MATCH[r.id] ? (MATCH[r.id] as (p: string) => boolean)(path) : path.startsWith(r.path);
  return (
    <nav
      aria-label="Main"
      className={cn(
        "z-20 flex shrink-0 flex-col border-o-border-subtle border-r bg-sidebar py-3 transition-[width] duration-(--o-motion-base) ease-standard",
        collapsed ? "w-14 px-2" : "w-[220px] px-3",
      )}
    >
      <ul className="space-y-0.5">
        {top.map((r) => (
          <li key={r.id}>
            <Item r={r} collapsed={collapsed} active={isActive(r)} />
          </li>
        ))}
      </ul>
      {advanced.length ? (
        <details className="group mt-4" open={advanced.some(isActive) || undefined}>
          <summary
            className={cn(
              "flex h-7 cursor-pointer list-none items-center rounded-md px-2.5 text-2xs text-o-text-3 uppercase tracking-wider hover:text-o-text-2",
              collapsed && "justify-center px-0",
            )}
          >
            {collapsed ? "···" : "Advanced tools"}
          </summary>
          <ul className="mt-0.5 space-y-0.5">
            {advanced.map((r) => (
              <li key={r.id}>
                <Item r={r} collapsed={collapsed} active={isActive(r)} />
              </li>
            ))}
          </ul>
        </details>
      ) : null}
      <div className="mt-auto space-y-0.5">
        {extra && !collapsed ? <div className="mb-2 px-1">{extra}</div> : null}
        <ul className="space-y-0.5">
          {bottom.map((r) => (
            <li key={r.id}>
              <Item r={r} collapsed={collapsed} active={isActive(r)} />
            </li>
          ))}
        </ul>
        <Tip
          content={
            <span>
              {collapsed ? "Expand" : "Collapse"} rail <Kbd>[</Kbd>
            </span>
          }
          side="right"
        >
          <button
            type="button"
            onClick={onToggle}
            aria-label={collapsed ? "Expand the navigation rail" : "Collapse the navigation rail"}
            className={cn(
              "mt-2 flex h-8 w-full items-center gap-3 rounded-md px-2.5 text-o-text-3 text-xs hover:bg-accent hover:text-o-text-2",
              collapsed && "justify-center px-0",
            )}
          >
            {collapsed ? (
              <PanelLeftOpenIcon className="size-4" />
            ) : (
              <PanelLeftCloseIcon className="size-4" />
            )}
            {collapsed ? null : <span>Collapse</span>}
          </button>
        </Tip>
      </div>
    </nav>
  );
}
