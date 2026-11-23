import type { ECharts } from "echarts/core";
import { useEffect, useRef } from "react";
import { useTheme } from "@/lib/theme";
import type { Option } from "./builders/common";
import { echarts } from "./echarts";

type Handlers = Record<string, (params: unknown, chart: ECharts) => void>;

const reducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * One wrapper for every chart (§6.1): init with the registered theme, ResizeObserver → resize,
 * dispose on unmount, setOption(notMerge) on data change. Theme switches dispose and re-init.
 */
export function useEChart(option: Option, opts: { onEvents?: Handlers; ariaLabel: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ECharts | null>(null);
  const handlers = useRef(opts.onEvents);
  handlers.current = opts.onEvents;
  const { theme } = useTheme();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const chart = echarts.init(el, `probcast-${theme}`, { renderer: "canvas" });
    chartRef.current = chart;
    const names = Object.keys(handlers.current ?? {});
    for (const n of names) {
      chart.on(n, (p: unknown) => handlers.current?.[n]?.(p, chart));
    }
    const ro = new ResizeObserver(() => chart.resize());
    ro.observe(el);
    return () => {
      ro.disconnect();
      chart.dispose();
      chartRef.current = null;
    };
  }, [theme]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: re-apply the option after a theme re-init
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const o = {
      ...option,
      aria: { enabled: true, label: { description: opts.ariaLabel } },
      ...(reducedMotion() ? { animation: false } : {}),
    };
    chart.setOption(o as Parameters<ECharts["setOption"]>[0], { notMerge: true });
  }, [option, opts.ariaLabel, theme]);

  return { ref, chart: chartRef };
}
