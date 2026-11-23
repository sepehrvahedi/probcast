/**
 * Modular ECharts import (§6.1): only the charts and components R1 uses, canvas renderer.
 * This module is imported by chart components only, so it lands in route chunks, never the shell.
 */
import { BarChart, CustomChart, LineChart, ScatterChart } from "echarts/charts";
import {
  AriaComponent,
  DataZoomComponent,
  GraphicComponent,
  GridComponent,
  LegendComponent,
  MarkAreaComponent,
  MarkLineComponent,
  TooltipComponent,
} from "echarts/components";
import * as echarts from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";
import { echartsTheme } from "./tokens";

echarts.use([
  LineChart,
  BarChart,
  ScatterChart,
  CustomChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
  MarkLineComponent,
  MarkAreaComponent,
  GraphicComponent,
  AriaComponent,
  CanvasRenderer,
]);

echarts.registerTheme("probcast-dark", echartsTheme("dark"));
echarts.registerTheme("probcast-light", echartsTheme("light"));

export { echarts };
