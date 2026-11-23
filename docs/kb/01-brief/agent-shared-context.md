# Shared context for all planning agents

Read this file in full before starting. Then read:
- `docs/kb/01-brief/coursework-brief.md` — what is graded (deadline, report structure, marking scheme, professor's AI warning).
- `docs/kb/01-brief/user-vision.md` — the product owner's original vision, with theme IDs V-01…V-16.

All paths are relative to the repo root: `<repo>/`.

## The situation in one paragraph

A 5-person UCL group must analyse **Apple Inc. (AAPL)** and submit a 2,000-word report with a **12-month price prediction** by **4 Dec 2026 16:00 UK** (today is **17 Nov 2026**). The product owner wants to build a **professional, point-in-time backtesting and probabilistic-forecasting platform** (working codename **"Orchard"**, tentative) in which any teammate's analysis idea — technical, fundamental, macro, event/news-driven, user-supplied data, or natural-language — can be turned into an *analyzer*, backtested over any historical window **without look-ahead**, scored, and then **combined with the other teammates' analyzers into one consensus probabilistic forecast**. The platform feeds the report (figures, statistics, citations) and is also intended as a **public GitHub portfolio project** that should impress a finance professor and recruiters.

## Hard constraints

1. **Timeline.** A usable *Release 1 (coursework release)* must be in teammates' hands by about **25–26 Nov 2026**, leaving ~1 week to backtest ideas and write the report. Anything not essential to that goes to Release 2+.
2. **Who builds it.** The developer is the product owner working with **an AI coding agent**. Assume high implementation velocity for well-specified work, but every feature still costs time. Specify things precisely enough that they can be implemented directly.
3. **LLM features.** In **R1 there is no in-app LLM**. Ideas not covered by built-in tools are submitted (structured "idea card") and implemented as plugins by the coding agent in the dev chat. **R2+** may add an in-app "natural language → analyzer code" feature (an LLM API) with sandboxing and automatic look-ahead checks.
4. **Scope = data + probabilities.** It is an analysis/research tool. No order execution, no brokerage, no personalised investment advice. Must carry an educational disclaimer.
5. **Data.** Prefer free/public sources (e.g. SEC EDGAR, FRED/ALFRED, free price sources). Bloomberg/Refinitiv data may be **imported manually** by teammates but generally **cannot be redistributed** in a public repo — the design must keep licensed data out of git.
6. **Point-in-time integrity is the scientific core.** A backtest at date *t* may only use information that was *publicly available* at *t* (publication lags, filing dates, restatements, data vintages).
7. **Academic integrity.** The professor dislikes generic AI output (overly general, repetitive, unreferenced). The platform must make the team's work **more specific, more evidenced and better referenced** — it must not write the report for them.
8. **Machine.** macOS (Apple Silicon), system Python 3.9 (a newer Python can be installed via `uv`), Node 26, git available. No paid cloud services assumed; free tiers OK.
9. **Privacy.** Never put the user's name, email or other personal details into requests to external services. If an API requires a contact User-Agent (e.g. SEC EDGAR), use a generic placeholder and note it as a configuration item.

## Release vocabulary (use these labels)

- **R0 – Foundations**: data pipeline + point-in-time store + backtest core (internal).
- **R1 – Coursework release**: what teammates use before 4 Dec.
- **R2 – Showcase release**: GitHub/LinkedIn launch, public demo, in-app LLM idea→analyzer.
- **R3 – Future**: everything else.

## Writing conventions for the knowledge base

- Markdown, clear headings, tables where useful. Be **specific**, not generic.
- Give every idea / requirement / risk a stable ID with your prefix (given in your brief), e.g. `PRD-014`.
- **Cite sources** (URL + access date) for factual claims, especially data sources, APIs, licences, academic methods and company facts. Mark anything unverified as `UNVERIFIED`.
- Separate **facts**, **assumptions** and **recommendations** explicitly.
- Write your full output to the file path given in your brief. Do not write outside `docs/kb/` unless your brief says so.
- Do not create code for the platform itself (this is the planning phase), except small illustrative snippets/schemas in markdown, or seed data files when your brief explicitly asks.
- When you finish, reply with a **concise summary (max ~350 words)**: the file(s) you wrote, your top 10 most important ideas/findings, and the open questions/decisions you think the product owner must make.
