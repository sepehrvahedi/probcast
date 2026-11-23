import { type AnyRoute, createRoute, lazyRouteComponent } from "@tanstack/react-router";
import { validateLabSearch, validateRunSearch } from "./search";

/**
 * R1.1 'lab' slice routes: Idea lab (list, new card, detail), the run-launcher deep link and
 * Settings. Pages are lazy chunks. The Committee "Ask" lives in routes/committee.tsx.
 */
export function routes(root: AnyRoute): AnyRoute[] {
  return [
    createRoute({
      getParentRoute: () => root,
      path: "/lab",
      validateSearch: validateLabSearch,
      component: lazyRouteComponent(() => import("./IdeaLabPage"), "IdeaLabPage"),
    }),
    createRoute({
      getParentRoute: () => root,
      path: "/lab/new",
      component: lazyRouteComponent(() => import("./IdeaFormPage"), "IdeaFormPage"),
    }),
    createRoute({
      getParentRoute: () => root,
      path: "/lab/run",
      validateSearch: validateRunSearch,
      component: lazyRouteComponent(() => import("./RunLauncherPage"), "RunLauncherPage"),
    }),
    createRoute({
      getParentRoute: () => root,
      path: "/lab/$icId",
      component: lazyRouteComponent(() => import("./IdeaDetailPage"), "IdeaDetailPage"),
    }),
    createRoute({
      getParentRoute: () => root,
      path: "/settings",
      component: lazyRouteComponent(() => import("./SettingsPage"), "SettingsPage"),
    }),
  ];
}
