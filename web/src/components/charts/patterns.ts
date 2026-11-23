import { useMemo } from "react";
import { useTheme } from "@/lib/theme";
import type { Patterns } from "./builders/common";
import { chartTokens } from "./tokens";

function tile(color: string, angle: 45 | 135): HTMLCanvasElement | undefined {
  if (typeof document === "undefined") return undefined;
  const c = document.createElement("canvas");
  c.width = 6;
  c.height = 6;
  const g = c.getContext("2d");
  if (!g) return undefined;
  g.strokeStyle = color;
  g.lineWidth = 1;
  g.beginPath();
  if (angle === 45) {
    g.moveTo(0, 6);
    g.lineTo(6, 0);
    g.moveTo(-1, 1);
    g.lineTo(1, -1);
    g.moveTo(5, 7);
    g.lineTo(7, 5);
  } else {
    g.moveTo(0, 0);
    g.lineTo(6, 6);
    g.moveTo(5, -1);
    g.lineTo(7, 1);
    g.moveTo(-1, 5);
    g.lineTo(1, 7);
  }
  g.stroke();
  return c;
}

/** Hatch tiles for holdout (45°) and insufficient-evidence (135°) regions (§2.3, §6.1). */
export function usePatterns(): Patterns {
  const { theme } = useTheme();
  return useMemo(() => {
    const t = chartTokens(theme);
    const holdout = tile(t.hatch, 45);
    const insufficient = tile(t.textDisabled, 135);
    return { ...(holdout ? { holdout } : {}), ...(insufficient ? { insufficient } : {}) };
  }, [theme]);
}
