import {
  createRootRoute,
  createRoute,
  createRouter,
  lazyRouteComponent,
  redirect,
  retainSearchParams,
} from "@tanstack/react-router";
import { z } from "zod";
import { HORIZONS, type Horizon } from "@/api/types";
import { StateNotice } from "@/components/common/StateNotice";
import { AppShell } from "@/components/shell/AppShell";
import { Skeleton } from "@/components/ui/misc";
import { buildR11Routes } from "@/r11/routes";
import { NotFoundPage } from "@/routes/not-found";

/**
 * URL state (§3.3): `h` is global (sessions; default 252), `fx` selects a fixture state.
 * Invalid params fall back to defaults with a console warning, never an error page.
 */
const horizon = z
  .union(HORIZONS.map((h) => z.literal(h)) as unknown as [z.ZodLiteral<5>, z.ZodLiteral<21>])
  .optional();

export interface RootSearch {
  h?: Horizon;
  fx?: string;
  /** Chosen stock on the simple pages (D-097), e.g. `?t=MSFT`. */
  t?: string;
}

function validateRoot(search: Record<string, unknown>): RootSearch {
  const out: RootSearch = {};
  if (search.h !== undefined) {
    const parsed = horizon.safeParse(Number(search.h));
    if (parsed.success && parsed.data !== undefined) out.h = parsed.data as Horizon;
    else console.warn(`[ProbCast] ignoring invalid ?h=${String(search.h)}`);
  }
  if (typeof search.fx === "string" && search.fx) out.fx = search.fx;
  if (typeof search.t === "string" && /^[A-Z][A-Z0-9.-]{0,9}$/.test(search.t.toUpperCase()))
    out.t = search.t.toUpperCase();
  return out;
}

export const rootRoute = createRootRoute({
  validateSearch: validateRoot,
  search: { middlewares: [retainSearchParams(["h", "fx", "t"])] },
  component: AppShell,
  notFoundComponent: NotFoundPage,
});

const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: lazyRouteComponent(() => import("@/studio/ForecastPage"), "ForecastPage"),
});

/** The R1.0 committee home (mission control), kept under Advanced. */
const classicRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/classic",
  component: lazyRouteComponent(() => import("@/routes/home"), "HomePage"),
});

const ideasRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/ideas",
  component: lazyRouteComponent(() => import("@/studio/IdeasPage"), "IdeasPage"),
});

const rankingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/rankings",
  component: lazyRouteComponent(() => import("@/studio/RankingsPage"), "RankingsPage"),
});

const howRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/how-it-works",
  component: lazyRouteComponent(() => import("@/studio/HowItWorksPage"), "HowItWorksPage"),
});

export const ideaRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/ideas/$id",
  component: lazyRouteComponent(() => import("@/studio/IdeaPage"), "IdeaPage"),
});

export const RUN_TABS = ["overview", "calibration", "scores", "robustness", "manifest"] as const;
export type RunTab = (typeof RUN_TABS)[number];

const runIndexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/runs/$runId",
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/runs/$runId/$tab", params: { runId: params.runId, tab: "overview" } });
  },
});

export const runRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/runs/$runId/$tab",
  component: lazyRouteComponent(() => import("@/routes/run"), "RunPage"),
});

const committeeIndexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/committee",
  beforeLoad: () => {
    throw redirect({ to: "/committee/$tab", params: { tab: "forecast" } });
  },
});

export const committeeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/committee/$tab",
  component: lazyRouteComponent(() => import("@/routes/committee"), "CommitteePage"),
});

export interface LeaderboardSearch {
  family?: string;
  author?: string;
  grade?: string;
  section?: string;
}

export const leaderboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/leaderboard",
  validateSearch: (s: Record<string, unknown>): LeaderboardSearch => {
    const out: LeaderboardSearch = {};
    for (const k of ["family", "author", "grade", "section"] as const) {
      if (typeof s[k] === "string" && s[k]) out[k] = s[k] as string;
    }
    return out;
  },
  component: lazyRouteComponent(() => import("@/routes/leaderboard"), "LeaderboardPage"),
});

const aboutIndexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/about",
  beforeLoad: () => {
    throw redirect({ to: "/about/$page", params: { page: "look-ahead" } });
  },
});

export const aboutRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/about/$page",
  component: lazyRouteComponent(() => import("@/routes/about"), "AboutPage"),
});

const routeTree = rootRoute.addChildren([
  homeRoute,
  classicRoute,
  ideasRoute,
  ideaRoute,
  rankingsRoute,
  howRoute,
  runIndexRoute,
  runRoute,
  committeeIndexRoute,
  committeeRoute,
  leaderboardRoute,
  aboutIndexRoute,
  aboutRoute,
  ...buildR11Routes(rootRoute),
]);

export const router = createRouter({
  routeTree,
  defaultErrorComponent: ({ error }) => (
    <StateNotice
      kind="error"
      title="Something went wrong loading this page."
      body="Other pages keep working. Reload, or go back."
      details={String((error as Error)?.stack ?? error)}
    />
  ),
  defaultPreload: "intent",
  defaultPendingMs: 300,
  defaultPendingComponent: () => (
    <div aria-busy="true" className="space-y-3">
      <Skeleton className="h-6 w-72" />
      <Skeleton className="h-4 w-[520px]" />
      <div className="grid grid-cols-12 gap-4 pt-4">
        <Skeleton className="col-span-8 h-[380px] rounded-lg" />
        <Skeleton className="col-span-4 h-[380px] rounded-lg" />
      </div>
    </div>
  ),
  defaultPreloadStaleTime: 0,
  scrollRestoration: true,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
