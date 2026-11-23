import { type AnyRoute, createRoute, lazyRouteComponent, redirect } from "@tanstack/react-router";

/**
 * R1.1 'report' slice routes: Report studio (`/report/:tab`, ux-spec §4.8) and the Analyzer
 * library (`/analyzers`, `/analyzers/$id`, §4.10). Pages are lazy chunks.
 */
export function routes(root: AnyRoute): AnyRoute[] {
  const reportIndex = createRoute({
    getParentRoute: () => root,
    path: "/report",
    beforeLoad: () => {
      throw redirect({ to: "/report/$tab" as never, params: { tab: "figures" } as never });
    },
  });
  const report = createRoute({
    getParentRoute: () => root,
    path: "/report/$tab",
    component: lazyRouteComponent(() => import("./ReportStudio"), "ReportStudioPage"),
  });
  const library = createRoute({
    getParentRoute: () => root,
    path: "/analyzers",
    component: lazyRouteComponent(() => import("./AnalyzerLibrary"), "AnalyzerLibraryPage"),
  });
  const detail = createRoute({
    getParentRoute: () => root,
    path: "/analyzers/$id",
    component: lazyRouteComponent(() => import("./AnalyzerDetail"), "AnalyzerDetailPage"),
  });
  return [reportIndex, report, library, detail];
}
