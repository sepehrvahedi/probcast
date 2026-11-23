import { useRouterState } from "@tanstack/react-router";

/** The plain-language pages (Forecast, Ideas, How it works) use a quieter shell. */
export function isSimplePath(p: string): boolean {
  return (
    p === "/" ||
    p.startsWith("/ideas") ||
    p.startsWith("/how-it-works") ||
    p.startsWith("/rankings")
  );
}

export function useSimpleMode(): boolean {
  return isSimplePath(useRouterState({ select: (s) => s.location.pathname }));
}
