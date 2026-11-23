import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { act, render } from "@testing-library/react";
import type { ReactNode } from "react";
import { ProvenanceProvider } from "@/components/common/provenance";
import { TooltipProvider } from "@/components/ui/tooltip";

/** Renders a component inside the providers the app gives it (router, query, tooltips, drawer). */
export async function renderApp(ui: ReactNode) {
  const root = createRootRoute({
    component: () => (
      <TooltipProvider>
        <ProvenanceProvider>{ui}</ProvenanceProvider>
      </TooltipProvider>
    ),
  });
  const about = createRoute({ getParentRoute: () => root, path: "/about/$page" });
  const runs = createRoute({ getParentRoute: () => root, path: "/runs/$runId/$tab" });
  const router = createRouter({
    routeTree: root.addChildren([about, runs]),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let out!: ReturnType<typeof render>;
  await act(async () => {
    out = render(
      <QueryClientProvider client={client}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );
    await router.load();
  });
  return out;
}
