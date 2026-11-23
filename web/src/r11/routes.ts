/**
 * R1.1 route registry. Each slice (data, report, lab) exports `routes(root)` from its own
 * folder so parallel work never edits router.tsx. Flags in src/features.ts enable the rail items.
 */
import type { AnyRoute } from "@tanstack/react-router";
import { routes as dataRoutes } from "./data/routes";
import { routes as labRoutes } from "./lab/routes";
import { routes as reportRoutes } from "./report/routes";

export function buildR11Routes(root: AnyRoute): AnyRoute[] {
  return [...dataRoutes(root), ...reportRoutes(root), ...labRoutes(root)];
}
