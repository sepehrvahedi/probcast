# Coursework alignment — how ProbCast earns marks

> **Scope note (D-069):** writing the report is out of scope for now. This document only describes how the platform's *outputs* map to the marking criteria, so the evidence is ready when the report phase starts.

> The platform is not graded; **the 2,000-word report is**. ProbCast exists to make that report measurably better on every marking criterion — and to be a memorable demo and portfolio piece. This document is the contract between the platform and the grade. Every R1 requirement must trace to a row here or to a vision theme.

## 1. Marking criteria → what ProbCast contributes

| Criterion (weight) | What examiners reward | ProbCast contribution | Requirement hooks |
|---|---|---|---|
| Understanding of class concepts (20%) | Correct use of CAPM/beta, valuation (DCF/DDM/multiples), EMH, risk/return, FX exposure of multinationals, macro transmission, payout policy | Every analyzer is tagged with the course concept it demonstrates; "Concept cards" explain the theory in one paragraph with a textbook citation; report studio can list concepts used | Analyzer metadata `concepts[]`; methodology pages |
| Data analysis (20%) | Real data, correct calculations, critical interpretation, uncertainty acknowledged | PIT backtests, scored against baselines with confidence intervals; ratios computed from SEC filings; peer comparison; honest "insufficient evidence" flags | Backtest lab, scoring, data hub |
| Structure & organisation (15%) | Logical flow mirroring the brief's 6 sections | Report studio organises figures/tables by the brief's six sections; one-page "evidence map" per section | Report studio sections |
| Clarity & conciseness (15%) | Precise, non-repetitive prose within 1,800–2,200 words | Figures carry the detail so prose can be short; word-budget tracker per section (counts only — never writes prose) | Word budget helper (R1 optional) |
| Citations & references (15%) | Credible primary sources, consistent style, complete bibliography | Every series/event/fact stores provenance (source, URL, access date); one-click Harvard-style bibliography for everything used in exported figures | Provenance model, citation export |
| Figures (15%) | Clear, high-quality, relevant, captioned, sourced | Publication-quality export (PNG/SVG/PDF, 300 dpi), numbered, captioned, "Source: …" line, consistent style, colour-blind safe | Figure export |

## 2. Report section → evidence ProbCast should produce

| Report section (words) | Questions to answer | Candidate figures/tables from ProbCast |
|---|---|---|
| 1. Introduction (400) | What is Apple, how does it make money, how has the stock behaved? | F1: AAPL price (log scale) 2007–2026 with annotated key events. T1: company snapshot (market cap, segments, FY2026 headline numbers) |
| 2. Macroeconomic analysis (400) | How do rates, USD, China, consumer cycle, tariffs affect AAPL? | F2: rolling sensitivity (beta) of AAPL returns to USD index and 10y yield changes. F3: revenue by geography vs. USD index. Macro analyzer backtest scores |
| 3. Sector/industry (400) | How does AAPL compare with peers and its sector? | F4: total return vs. XLK/QQQ/peers (indexed). T2: peer valuation & profitability multiples table. Relative-strength analyzer results |
| 4. Fundamental analysis (400) | Ratios from balance sheet & income statement; quality; valuation | F5: margin & return ratios over time (gross, operating, ROE, ROIC). T3: ratio table (liquidity, leverage, profitability, efficiency) with filing citations. F6: DCF / reverse-DCF implied growth |
| 5. Future performance (400) | What do the team's methods predict, how reliable were they historically? | F7: analyzer scorecard vs. baselines (skill score with CIs). F8: committee weights & contributions. **F9: 12-month fan chart** with bear/base/bull. T4: scenario table with probabilities |
| 6. Conclusion (200) | The call: 12-month price prediction with uncertainty | Single headline: median target, 80% interval, P(price > today) — from the committee forecast object, with methodology citation |

Target: **8–10 figures + 3–4 tables**, each referenced in text, numbered, captioned and sourced. Captions do not count toward the word limit.

## 3. Academic-integrity guardrails (built into the product)

1. **No generated prose** (D-007). ProbCast outputs numbers, charts, tables, citations and methodology notes; teammates write the analysis.
2. **Provenance on everything** — any number on screen can be traced to its source and as-of date.
3. **Honesty by default** — results show baselines, confidence intervals, the number of ideas tried (multiple-testing awareness) and "insufficient evidence" warnings. A finance examiner should see *critical examination* built in.
4. **Hindsight labels are never predictive inputs** — curated event "importance" scores are for display only.
5. **Locked holdout** — the most recent period is reserved for a final out-of-sample check so the team cannot unknowingly tune to it.
6. **Disclaimer** — educational research tool, not investment advice.

## 4. Key dates (canonical schedule: `08-roadmap/roadmap.md` §3)

| Date (2026, UK) | Milestone |
|---|---|
| Wed 18 Nov | Build starts; scope frozen at end of day |
| Fri 20 Nov 18:00 | PB-0 evidence floor in the team folder; wave-1 idea cards due |
| Wed 25 Nov 12:00 | **R1.0**: evidence engine + core UI on snapshot `r1-dev` (24 Nov close) |
| Sat 28 Nov 18:00 | **R1.1**: full pro UI; idea intake closes 23:59 |
| Mon 30 Nov 23:59 | `final` snapshot (30 Nov close) → **committee freeze; final forecast computed and hashed** |
| Tue 1 Dec 12:00 | **Witnessed holdout reveal** (scores only; the forecast is already fixed) |
| Thu 3 Dec 16:00 | Team submits (deadline Fri 4 Dec 16:00) |
| Dec – Jan | R2 showcase |

**Plan B:** the report never depends on the UI. PB-0 (Fri 20) and the CP-B forecast floor (Mon 23) guarantee the descriptive evidence and a baseline 12-month prediction. The full evidence pack is built by the CLI.
