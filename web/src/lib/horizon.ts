import { useNavigate, useSearch } from "@tanstack/react-router";
import { useCallback } from "react";
import type { Horizon } from "@/api/types";

/** The active horizon from `?h=` (sessions; default 252, ux-spec §3.3). */
export function useHorizon(): Horizon {
  const search = useSearch({ strict: false }) as { h?: Horizon };
  return search.h ?? 252;
}

/** Writes `?h=` on the current route; filters and other params are kept. */
export function useSetHorizon(): (h: Horizon) => void {
  const navigate = useNavigate();
  return useCallback(
    (h: Horizon) => {
      void navigate({
        to: ".",
        search: ((prev: Record<string, unknown>) => ({ ...prev, h })) as never,
        replace: true,
      });
    },
    [navigate],
  );
}
