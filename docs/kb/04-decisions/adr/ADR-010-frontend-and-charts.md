# ADR-010: Front-end stack and charting

- **Status:** Accepted (2026-11-17)
- **Deciders:** Lead (the coding agent) on behalf of the product owner; PO confirmation recorded in `decision-log.md`
- **Sources:** A6 §11; A7 ARC-ADR-02/03; R1b DQ-B-11

## Context
The UI must look pro (D-010) and be buildable quickly by agents. A6 and A7 proposed Lightweight Charts + ECharts; R1b recommended ECharts-only in R1.

## Options considered
(a) Vite + React 19 + TS + TanStack + Tailwind 4 + shadcn/ui; ECharts 6 for all charts. (b) Same, plus Lightweight Charts for price. (c) Next.js.

## Decision
**(a)** for R1, with matplotlib server-side for report-quality figures (the UI previews the same PNG/SVG). Lightweight Charts is an optional R2 upgrade for the price pane.

## Consequences
One chart library and one theme to style; fewer integration risks. ECharts handles 11k+ points with `large` mode/LTTB.
