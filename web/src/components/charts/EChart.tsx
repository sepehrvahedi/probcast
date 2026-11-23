import type { ECharts } from "echarts/core";
import type { Option } from "./builders/common";
import { useEChart } from "./useEChart";

export function EChart({
  option,
  height,
  ariaLabel,
  onEvents,
  className,
}: {
  option: Option;
  height: number;
  ariaLabel: string;
  onEvents?: Record<string, (params: unknown, chart: ECharts) => void>;
  className?: string;
}) {
  const { ref } = useEChart(option, { ariaLabel, ...(onEvents ? { onEvents } : {}) });
  return <div ref={ref} style={{ height }} className={className ?? "w-full"} />;
}
