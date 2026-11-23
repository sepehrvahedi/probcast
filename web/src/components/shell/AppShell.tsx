import { Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { FlaskConicalIcon, MonitorIcon, WifiOffIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { API_BASE, FIXTURE_MODE, FIXTURE_STATES } from "@/api/config";
import { useFx, useHealth, useStatus } from "@/api/queries";
import { HORIZONS } from "@/api/types";
import { ProvenanceProvider } from "@/components/common/provenance";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { COMMAND_PALETTE } from "@/features";
import { ERRORS } from "@/lib/copy";
import { useSetHorizon } from "@/lib/horizon";
import { useHotkeys } from "@/lib/hotkeys";
import { CommandPalette } from "./CommandPalette";
import { Rail } from "./Rail";
import { ShortcutSheet } from "./ShortcutSheet";
import { StatusBar } from "./StatusBar";
import { TopBar } from "./TopBar";

function useWidth(): number {
  const [w, setW] = useState(() => (typeof window === "undefined" ? 1440 : window.innerWidth));
  useEffect(() => {
    const on = () => setW(window.innerWidth);
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  return w;
}

function OfflineBanner() {
  const health = useHealth();
  const status = useStatus();
  if (!health.isError && !status.isError) return null;
  const host = API_BASE ? API_BASE.replace(/^https?:\/\//, "") : "127.0.0.1:8000";
  const cached = status.dataUpdatedAt
    ? new Date(status.dataUpdatedAt).toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;
  return (
    <div
      role="alert"
      className="flex items-center gap-3 border-o-danger/50 border-b bg-o-surface px-6 py-2 text-sm"
    >
      <WifiOffIcon className="size-4 text-o-danger" aria-hidden="true" />
      <span className="font-medium text-o-text">✕ {ERRORS.offline(host)}</span>
      <span className="text-o-text-2">
        {cached ? ERRORS.offlineBody(cached) : "Start it with `just serve`. No cached data yet."}
      </span>
      <button
        type="button"
        className="ml-auto rounded-md border border-o-border px-2 py-0.5 text-o-text-2 text-xs hover:bg-accent"
        onClick={() => {
          void health.refetch();
          void status.refetch();
        }}
      >
        Retry
      </button>
    </div>
  );
}

/** Dev aid in fixture mode: switch the `?fx=` state (ux-spec §3.3, §9.2). */
function FixtureMenu() {
  const fx = useFx() ?? "sealed";
  const navigate = useNavigate();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="inline-flex h-6 items-center gap-1 rounded-xs border border-o-border border-dashed px-1.5 text-2xs text-o-text-3 hover:text-o-text-2"
        aria-label="Fixture data state"
      >
        <FlaskConicalIcon className="size-3" aria-hidden="true" />
        Fixtures · {fx}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="right">
        <DropdownMenuLabel>Fixture state (?fx=)</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={fx}
          onValueChange={(v) =>
            void navigate({
              to: ".",
              search: ((prev: Record<string, unknown>) => ({
                ...prev,
                fx: v === "sealed" ? undefined : v,
              })) as never,
            })
          }
        >
          {FIXTURE_STATES.map((s) => (
            <DropdownMenuRadioItem key={s} value={s}>
              {s}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <p className="max-w-56 px-2 py-1 text-2xs text-o-text-3">
          Synthetic data, ticker DEMO. Set VITE_API_BASE to use the engine.
        </p>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** App shell (§3.4, §4.1): top bar, rail, content, status bar, drawer host, toasts. */
export function AppShell() {
  const width = useWidth();
  const [railPref, setRailPref] = useState<boolean | null>(null);
  const collapsed = railPref ?? width < 1440;
  const [help, setHelp] = useState(false);
  const [cmd, setCmd] = useState(false);
  const navigate = useNavigate();
  const setH = useSetHorizon();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset the manual rail choice when crossing the breakpoint
  useEffect(() => {
    setRailPref(null);
  }, [width < 1440]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll the content to the top on every route change
  useEffect(() => {
    document.getElementById("main")?.scrollTo({ top: 0 });
  }, [pathname]);

  useHotkeys({
    "[": () => setRailPref(!collapsed),
    "?": () => setHelp(true),
    "g h": () => void navigate({ to: "/" }),
    "g l": () => void navigate({ to: "/leaderboard" }),
    "g m": () => void navigate({ to: "/committee/$tab", params: { tab: "forecast" } }),
    "g a": () => void navigate({ to: "/about/$page", params: { page: "look-ahead" } }),
    ...Object.fromEntries(HORIZONS.map((h, i) => [String(i + 1), () => setH(h)])),
  });

  useEffect(() => {
    if (!COMMAND_PALETTE) return;
    const on = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCmd((v) => !v);
      }
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, []);

  return (
    <TooltipProvider delayDuration={300} skipDelayDuration={100}>
      <ProvenanceProvider>
        <a
          href="#main"
          className="sr-only z-90 rounded-md bg-primary px-3 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
        >
          Skip to content
        </a>
        <div className="flex h-screen min-h-0 flex-col bg-o-canvas">
          <TopBar onHelp={() => setHelp(true)} onCommand={() => setCmd(true)} />
          <div className="flex min-h-0 flex-1">
            <Rail
              collapsed={collapsed}
              onToggle={() => setRailPref(!collapsed)}
              extra={FIXTURE_MODE ? <FixtureMenu /> : null}
            />
            <div className="flex min-w-0 flex-1 flex-col">
              <OfflineBanner />
              {width < 1280 ? (
                <div
                  role="status"
                  className="flex items-center gap-2 border-o-border-subtle border-b bg-o-surface px-6 py-1.5 text-o-text-2 text-xs"
                >
                  <MonitorIcon className="size-3.5" aria-hidden="true" />
                  ProbCast is designed for screens 1280 px and wider.
                </div>
              ) : null}
              <main id="main" tabIndex={-1} className="min-h-0 flex-1 overflow-y-auto outline-none">
                <div className="mx-auto w-full max-w-[1600px] px-6 pt-5 pb-10">
                  <Outlet />
                </div>
              </main>
            </div>
          </div>
          <StatusBar compact={width < 1440} />
        </div>
        <ShortcutSheet open={help} onOpenChange={setHelp} />
        {COMMAND_PALETTE ? <CommandPalette open={cmd} onOpenChange={setCmd} /> : null}
        <Toaster />
      </ProvenanceProvider>
    </TooltipProvider>
  );
}
