# A6 — UX/UI design for Orchard

| Field | Value |
|---|---|
| Agent | A6, principal product designer (ID prefix `UX-`) |
| Date | 2026-11-17 |
| Status | Ideation draft v1. Input to R1 critique (R1), synthesis (R2) and the lead's ADRs |
| Brief | an internal brief (not published) |
| Read first | `01-brief/agent-shared-context.md`, `01-brief/coursework-brief.md`, `01-brief/user-vision.md` |
| Sibling outputs | A1–A5 and A7 ran in parallel. Where this design depends on their decisions it says so with a `DEP:A2`-style tag (A2 = quant methodology, A3 = data sources, A4 = AAPL dossier and events, A5 = analyzer library and idea cards, A7 = architecture). A2, A3 and A7 landed before this was finished: their holdout, evidence-grade and target definitions are already applied, and the remaining reconciliations are in **§17**. |

**How to read this document**

- **Fact** = verified and cited (URL + access date in §16). **Assumption** = what this design takes as given until someone confirms it. **Recommendation** = my design call. `UNVERIFIED` = not checked against a primary source.
- **Every number in a wireframe is made up for illustration** (prices, probabilities, dates of future filings and so on). The values are realistic in shape but they are not AAPL data. Historical anchors that *are* real are cited where they are used (for example Apple's 2 Jan 2019 letter to investors).
- Wireframes are drawn for a **1440 × 900 px desktop viewport**, the reference size for R1. Box-drawing characters show layout, not exact proportions.
- IDs: `UX-P` principles · `UX-IA` information architecture · `UX-S` screens · `UX-F` flows · `UX-T` tokens · `UX-CH` charts · `UX-C` components · `UX-M` microcopy · `UX-A11Y` accessibility · `UX-STK` stack · `UX-DEMO` demo · `UX-R` release scope · `UX-Q` open questions · `UX-LINT` figure lint rules.

---

## 0. Summary (the ten things that matter most)

1. **The product's personality: "a research terminal with the manners of a scientific paper".** It has Bloomberg's density and keyboard speed, Linear's calm finish, the Bank of England's honesty about uncertainty (fan charts since 1996) and Our World in Data's rule that every chart carries its source. The first impression is a dark canvas with one large probability and its interval, a fan chart, a time-machine control in the top bar, and a source line under everything.
2. **As-of time is a global, URL-encoded control (`?asof=`).** When it is set to the past, the whole app changes its *information set*. Future data is never fetched; it is not merely greyed out. An amber frame and a banner make this mode impossible to miss. The design keeps **four kinds of time** visually separate (as-of, view window, backtest window, horizon), because confusing them is the most likely way users get lost (§3.6).
3. **Every number has a provenance chip.** Clicking it opens a drawer with source, series, period end, `available_at`, vintage, licence and a ready-made Harvard citation. A rendered metric without provenance metadata counts as a test failure.
4. **Uncertainty is always visible.** No point forecast appears without its band. No skill score appears without a CI and `n_eff`. Probabilities are shown as whole percentages with an interval.
5. **Honesty is built in.** Every run opens on a one-sentence **verdict** with an **evidence grade** (Strong / Moderate / Weak / Insufficient / Negative). The run also shows its **pre-registered success criterion** (met or not met), a **trials counter** and a **locked holdout**. A negative result is presented as a respectable outcome.
6. **Report-ready by construction.** Every chart has *Export* and *Add to report*. Export is a separate **print render** (white, 160 mm text width, 300 dpi PNG / SVG / vector PDF) with figure numbering, a caption template, a source line and automatic Harvard references. A **figure lint** checks quality. Orchard writes *what is plotted*; the team writes *what it means*. This responds directly to the professor's warning about AI-written reports.
7. **Colour-blind-safe by default, and the claim was tested.** Up and down are encoded **blue and orange plus ▲▼ glyphs and signs**. Under simulated deuteranopia, a typical green/red pair differs by only ΔE≈8 (nearly indistinguishable). The blue/orange pair differs by ΔE≈106. The six analyzer series colours were tuned so the minimum ΔE is about 18 (17.8–24.7) under all three CVD types while keeping ≥6:1 contrast in dark mode and ≥3.4:1 in light mode (raw Okabe-Ito scores 1.3:1 for yellow on white) (§6.2).
8. **Front-end stack:** React 19 + TypeScript + Vite 8, TanStack Router (typed URL state) and Query, Tailwind 4 with shadcn/ui (Radix base for R1), cmdk, **TradingView Lightweight Charts 5.3 for the price chart only** and **Apache ECharts 6.1 for every analytical chart**, plus CodeMirror 6 for YAML. A7 makes server-side matplotlib the canonical report-figure renderer; §17 reconciles the two. All licences are permissive (MIT, ISC, Apache-2.0, OFL). Lightweight Charts requires a TradingView attribution notice (§11).
9. **Demo: a five-minute professor script built around six "wow" beats.** (1) The time-machine curtain drops on 2 Jan 2019 at 16:00 ET, before Apple's after-close guidance letter (exact release time to be verified by A4). (2) The realised path is revealed over the old fan. (3) The reliability diagram and PIT histogram. (4) A weak result reported honestly. (5) Committee attribution answers "why 61%?". (6) A one-click report figure with caption and Harvard reference. A 60-second LinkedIn storyboard is in §12.
10. **R1 polish budget.** Spend polish on four surfaces: the consensus fan, the time-machine curtain, the run Calibration tab and the report export. Everything else uses stock shadcn components. The no-code block canvas, blind replay, the story editor, PDF export and tablet layouts move to R2 (§13).

---

## 1. Design thesis

**Who it must impress, and in what order.**

| Audience | What they see in 5 seconds | What earns their trust in 5 minutes |
|---|---|---|
| Teammates (5, mixed technical skill) | "I can see where my idea stands." | Submitting an idea card is easy, the run explains itself in one sentence, and their name is on what they contributed. |
| Professor (finance academic) | A probability with an interval, not a price target. | Point-in-time discipline, proper scoring (CRPS, PIT, reliability), baselines, CIs, honest negative results and citations. |
| Recruiter / engineer on GitHub | A polished product, not a Jupyter dump. | Keyboard-first UX, typed URL state, accessibility, a reproducible run manifest, a clean design-token system. |

**Personality.** Precise, sober, transparent and quietly confident. **Not** a neon trading app, not gamified, no "AI predicts!" banners, no confetti.

**Visual signature (what makes Orchard recognisable in a screenshot).**

1. The **iris fan**: nested 50/80/95% bands in one cool violet-blue (the brand accent), with the realised path drawn as an *ink* line.
2. The **amber time frame**: a 2 px amber border around the viewport whenever the as-of date is in the past.
3. **Source lines**: 11 px tertiary text under every chart. They look like a journal's figure notes.
4. **Harvey-ball evidence badges** (● ◐ ◔ ○ ⊘): monochrome, so evidence quality is never confused with "stock up / stock down" colour.

---

## 2. Design principles

Each principle comes with concrete rules a developer can check.

### UX-P01 — Every number has a source

- Every chart has a **source line** in both the UI and the export: `Source: … · Data as of 20 Nov 2026 16:00 ET`.
- Every KPI or scalar value is a **provenance target**. Hovering shows a 1-line popover (source + as-of). Clicking or pressing `I` opens the **Provenance drawer** (UX-C05) with the lineage: dataset → series → observation (`period_end`, `available_at`, `vintage_id`, `ingested_at`, URL, licence) plus a "Copy Harvard citation" button.
- A derived number (skill, P(up), weight) links to the **run or committee snapshot** that produced it (run ID + manifest hash).
- **A number without provenance is a defect.** In development builds it renders with a dashed "unsourced" underline. A Playwright check fails if any `[data-metric]` element has no `data-provenance` attribute.
- *Anti-pattern:* "Source: Yahoo" with no series ID, date or access date.

### UX-P02 — Time is a first-class control

- The **as-of** control is global, always visible in the top bar, stored in the URL (`?asof=2019-01-02T16:00-05:00`) and shared by every screen.
- When as-of is in the past, **future data is not loaded at all**. The API is called with `asof`, and charts draw a "curtain" (UX-C25) at *t*. The UI gains an amber frame and a banner.
- As-of, view window, backtest window and horizon have **different controls, icons and colours** (§3.6). Zooming a chart never changes the as-of.
- Timestamps always carry a time zone: market events in **ET**, with a UK-time tooltip.

### UX-P03 — Uncertainty is always visible

- A forecast is never shown without an interval. Medians appear only inside a fan or next to a range: "Median $246 · 80% $191–$303".
- A metric is never shown without a CI or sample size: "+4.1% [−0.6, +8.8] 90% CI · n_eff 28".
- Probabilities are whole percentages (61%), not "61.37%". Use "<1%" and ">99%" at the extremes. A probability readout always shows its interval when one exists.
- When the evidence is thin, the UI says so before showing the number (UX-M "insufficient evidence" state).

### UX-P04 — Compared to what?

- Every score is relative to a **named baseline**: random walk with drift by default, `DEP:A2`. The leaderboard sorts by **skill vs baseline**, not by raw loss.
- Performance charts always draw the baseline as a **dashed grey "ghost"** series labelled `RW+drift`.
- Hit rates always show the base rate next to them: "58% vs 55% base rate".

### UX-P05 — Honest by default (evidence before opinion)

- Every run opens on a **verdict sentence** and an **evidence grade** (UX-C11) computed by fixed rules (`DEP:A2` thresholds).
- **Pre-registration:** the idea card's success criterion is frozen at submission and shown against the result.
- **Trials counter:** each parameter variant raises the bar (deflation). It is displayed on runs, analyzers and the leaderboard.
- **Holdout lock:** results from the holdout start (≥ 2021-01-01 per A2 QNT-110) are hidden until a logged "final evaluation" freezes the analyzer version; each analyzer family has a small reveal budget (2), and every reveal is shown on later outputs.
- Completing a run is not success. Toasts say "Run completed", never "Success!". There is no celebratory green.
- Events chosen after the fact carry a **"curated (hindsight risk)"** badge. Systematically collected ones (for example every 8-K Item 2.02 earnings release) are badged "systematic".

### UX-P06 — Report-ready by construction

- Every chart and table has **Export** (`E`) and **Add to report** (`R`).
- Export is a **separate print render**, not a screenshot of the dark UI (§7.3).
- Figures added to the report are **frozen** to a data snapshot and run ID. Refreshing them is an explicit action that shows a diff.
- Captions are templated: Orchard drafts **what is plotted** and how uncertainty is drawn. The **interpretive sentence** is left for the student, and the figure lint (UX-LINT-09) flags it until it is written.

### UX-P07 — Fast, keyboard-first, dense but calm

- **⌘K** reaches everything. `G`-prefixed navigation works like Linear's (`G R` goes to runs). Every list can be driven from the keyboard.
- Local interactions respond in **< 100 ms**. Use skeletons, not spinners. Use tabular numerals everywhere numbers align.
- One accent colour. Colour is reserved for data. No gradients, glows or glassmorphism, except a single subtle radial glow behind the consensus hero number in presentation mode.
- Three density modes (§6.6). Tiled panels share 1 px borders, as on a Bloomberg screen.

### UX-P08 — Credit people, not the machine; state probabilities, not advice

- Every analyzer, run, idea card and figure shows its **human author** (avatar + name). The committee credits contributions by author.
- There is no "AI says" framing. R1 has no in-app LLM. In R2, LLM-generated analyzer code is labelled as generated code that a named teammate reviewed and approved.
- Banned UI language: *buy, sell, hold, target price, should, will rise, guaranteed, outperform* (§9.3). Required language: *probability, predictive distribution, evidence, skill relative to baseline*.
- The educational disclaimer is persistent but quiet: it lives in the status bar, the About page, the first-run note and the public demo.

---

## 3. Information architecture

### UX-IA-01 — User-facing object model

These are the nouns the UI uses. They are deliberately few and consistent with the KB vocabulary (`DEP:A7` for storage IDs).

| Object | Meaning (one line) | Display ID format | Home URL |
|---|---|---|---|
| **Dataset** | A source table (prices, EDGAR facts, FRED series, a user upload) | `ds.prices.aapl.daily` | `/data/catalog/:datasetId` |
| **Series** | One time series inside a dataset | `FRED:DGS10`, `EDGAR:AAPL:Revenues` | `/data/series/:seriesId` |
| **Observation** | One value with `period_end`, `available_at`, `vintage` | shown in the Provenance drawer | — |
| **Event** | A dated, sourced occurrence (earnings, product, macro, legal…) | `ev.2019-01-02.guidance-revision` | `/events/:eventId` |
| **Idea card** | A teammate's structured analysis idea | `IC-014` | `/lab/ideas/:ideaId` |
| **Analyzer** (+ version) | Executable method producing probabilistic forecasts | `an.momentum_12_1` · `v3 (7f3a9c)` | `/analyzers/:analyzerId` |
| **Run** | One backtest of one analyzer version under one protocol | `run_20261120_7f3a` | `/runs/:runId` |
| **Committee** (+ snapshot) | Combination of member analyzers into a consensus | `cmt.main` · `cmt.main@2026-11-21` | `/committee` |
| **Figure / Table** | Frozen, numbered report artefact | `Fig 4`, `Tab 2` | `/report/figures/:figId` |
| **Reference** | Harvard citation auto-collected from sources | `ref.fred.dgs10` | `/report/references` |
| **Story** | Ordered list of app views + annotations for presenting | `story.professor-5min` | `/present/:storyId` |
| **Snapshot** | Hash of the data state used by runs and figures | `snap 9c41e2` | status bar → `/data/snapshots/:id` |

### UX-IA-02 — Sitemap

```
/                                   Mission control (home)
├── /data                           Data explorer
│   ├── /data/price                 Price & events (default tab)
│   ├── /data/fundamentals          Statements, ratios, as-reported vs restated
│   ├── /data/macro                 Macro overlays, vintages, rolling betas
│   ├── /data/peers                 Peer comparison
│   ├── /data/catalog               Dataset catalog + coverage map
│   │   └── /data/catalog/:datasetId
│   ├── /data/series/:seriesId      Series detail (all vintages, provenance)
│   └── /data/upload                Upload wizard (user datasets)
├── /events                         Events timeline + list
│   ├── /events/:eventId            Event detail (also opens as drawer)
│   └── /events/study               Event-study builder
├── /replay                         Time machine / replay
├── /lab                            Idea lab (inbox board)
│   ├── /lab/ideas/new              New idea card
│   ├── /lab/ideas/:ideaId          Idea card detail + status history
│   ├── /lab/builder                No-code builder (R1: structured rule form)
│   └── /lab/config                 YAML run-config editor
├── /analyzers                      Analyzer library
│   └── /analyzers/:analyzerId      Analyzer detail (/:tab: overview|performance|parameters|data|versions|code|references)
├── /runs                           Runs index
│   ├── /runs/new                   Run launcher (also a ⌘K dialog)
│   └── /runs/:runId/:tab           Run view (overview|forecasts|calibration|scores|robustness|breakdown|manifest)
├── /leaderboard                    Team leaderboard
├── /compare                        Compare runs/analyzers (?runs=a,b,c)
├── /committee/:tab                 Committee (forecast|members|attribution|scenarios|why|diagnostics)
├── /report/:tab                    Report studio (figures|tables|references|pack)
├── /present/:storyId               Presentation mode (+ /present/:storyId/notes presenter view)
├── /settings/:section              Settings
└── /about/:page                    About, methodology, glossary, data & licences, disclaimer, credits
```

**Global navigation (left rail), in this order:** Home · Data · Events · Time machine · Idea lab · Analyzers · Runs · Leaderboard · Committee · Report · Present. Upload data, Settings and About are pinned to the bottom. The order follows the research workflow: *look → think → build → test → combine → write → show*.

### UX-IA-03 — URL structure and state model

**Rule:** any state you would want to paste into the team chat or put in a presentation story must be in the URL. Path segments identify *objects and tabs*. Search params hold *view state*. TanStack Router's `validateSearch` (zod schemas) keeps search params typed and validated (`DEP:A7`).

| Param | Scope | Type / values | Default | Example |
|---|---|---|---|---|
| `asof` | Global | ISO date or datetime with offset; absent = latest | latest | `asof=2019-01-02T16:00-05:00` |
| `h` | Global | `5d,21d,63d,126d,252d` | `252d` | `h=63d` |
| `from`, `to` | Page (time charts) | ISO dates (view window) | page-specific (5Y) | `from=2017-01-01&to=2019-01-02` |
| `scale` | Price chart | `lin,log` | `log` if window > 10 y | `scale=log` |
| `overlay` | Price chart | csv of overlay IDs | none | `overlay=sma50,sma200,peer:MSFT` |
| `ev` | Price/events | csv of event categories | `E,P,M` | `ev=E,P,M,R,C` |
| `runs` | Compare | csv of run IDs (2–4) | — | `runs=run_…7f3a,run_…b21c` |
| `method` | Committee | `equal,inv_crps,stack,hedge` | `DEP:A2` default | `method=inv_crps` |
| `sel` | Any | selected object (event/point) | — | `sel=ev.2019-01-02.guidance-revision` |
| `present` | Any | `1` = kiosk chrome for stories | — | `present=1` |

Examples:

- `/data/price?asof=2019-01-02T16:00-05:00&from=2016-01-01&to=2019-01-02&overlay=sma200&ev=E,P`
- `/runs/run_20261120_7f3a/calibration?h=252d`
- `/committee/attribution?h=252d`
- `/present/professor-5min?scene=3`

### UX-IA-04 — App shell

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ ◆ Orchard │ AAPL ▾  Apple Inc. · Close 20 Nov  228.02  ▲ +0.84% │ [clock] As of: Latest ▾ │ 1W 1M 3M 6M [12M] │ ⌘K Search… │ ? │ SB ▾ │
├───────────────┬──────────────────────────────────────────────────────────────────────────────────────────────────┤
│ ◆ Home        │ Page title                                         [page-level actions]                          │
│ ▤ Data        │ ─────────────────────────────────────────────────────────────────────────────────────────────────│
│ ⚑ Events      │                                                                                                  │
│ ◷ Time machine│                                                                                                  │
│ ✎ Idea lab    │                     page content: 12-column grid, 24 px gutters (12 px compact)                  │
│ ƒ Analyzers   │                                                                                                  │
│ ▶ Runs        │                                                                                                  │
│ ≡ Leaderboard │                                                                                                  │
│ ⚖ Committee   │                                                                                                  │
│ ❐ Report      │                                                                                                  │
│ ▣ Present     │                                                                                                  │
│               │                                                                                                  │
│ ⤒ Upload data │                                                                                                  │
│ ⚙ Settings    │                                                                                                  │
│ ⓘ About       │                                                                                                  │
├───────────────┴──────────────────────────────────────────────────────────────────────────────────────────────────┤
│ ● snap 9c41e2 · PIT guard on · ▶ 2 runs (63%) · Holdout ≥ 2021-01-01 locked · v0.1.0 (a1b2c3) │ Educational research tool — not investment advice │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

| Region | Spec |
|---|---|
| Top bar | 48 px tall, `bg-surface`, bottom border `border-subtle`. Left to right: logo (24 px) · ticker context (UX-C01) · as-of control (UX-C02) · horizon selector (UX-C03) · search trigger (UX-C04, 280 px wide) · help `?` · identity (UX-C06). In time-machine mode the bar background changes to `tm-bg` and the as-of pill turns amber. |
| Left rail | 220 px expanded / 56 px collapsed (`[` toggles). Items are 32 px tall with 16 px Lucide icons and 13 px labels. The active item has a 2 px accent bar on the left and `bg-selected`. Below 1280 px the rail auto-collapses. |
| Content | Fluid width. Page header is 48 px (title 20/28 600, breadcrumbs, actions on the right). Reading pages (About, methodology) have a 720 px measure. |
| Status bar | 28 px, `bg-canvas`, 11 px text. Left: snapshot, PIT guard, job tray (UX-C07), holdout policy, build. Right: disclaimer link. |
| Right drawer | 420 px, slides over content (Provenance, Event detail, Explanation). `Esc` closes. Focus is trapped. |
| Time-machine frame | When `asof` ≠ latest: a 2 px `tm` inset border around the viewport plus a 32 px banner under the top bar (UX-C24). |

### UX-IA-05 — Global controls

#### UX-C01 Ticker context
- R1 is fixed to **AAPL**. It still renders as a dropdown, disabled, with the tooltip "Multi-ticker analysis arrives in R2". This keeps the information architecture ready for more tickers.
- Shows **last close as of the current as-of** (never "live"): `Close 20 Nov 228.02 ▲ +0.84%`. The change uses the up/down tokens **and** a glyph **and** a sign.
- Click opens a popover: company card (name, exchange, sector, fiscal year end, share-split history with dates), all with sources.

#### UX-C02 As-of / time-machine control
- **Closed, latest:** neutral pill `[clock] As of: Latest`. Hovering shows "Latest data: prices 20 Nov 2026 16:00 ET · EDGAR 31 Oct · FRED 14 Nov".
- **Closed, historical:** amber pill `[clock] As of 2 Jan 2019 · 16:00 ET ✕`. The ✕ returns to latest. The app frame and banner appear.
- **Popover (400 × 460 px):**
  ```
  ┌ Travel to a moment ─────────────────────────────────────┐
  │ Date  [ 2019-01-02        ]   Time [ Close 16:00 ET ▾ ] │
  │        Pre-open 08:00 · Open 09:30 · Close 16:00 ·      │
  │        After close 20:00 · Custom…                      │
  │ ▕▁▁▁▂▂▂▃▃▄▄▅▅▆▆▇▇██▇▇█▏ 1980 ──────────────── 2026      │
  │  (scrubber: log price sparkline + event ticks)          │
  │ Moments                                                 │
  │  · Lehman Brothers bankruptcy — 15 Sep 2008             │
  │  · Revenue guidance letter — 2 Jan 2019 (after close)   │
  │  · COVID-19 market low — 23 Mar 2020                    │
  │  · 4-for-1 split effective — 31 Aug 2020                │
  │  (from events seed, DEP:A4)                             │
  │ [Latest]                              [Travel  ↵]       │
  └─────────────────────────────────────────────────────────┘
  ```
- The date field accepts ISO dates, `-5y`, `last earnings` and event names (fuzzy-matched against events). The time presets exist because many disclosures come **after the close**. Being able to stand at 16:00 or 20:00 on the same day is what makes point-in-time discipline visible.
- Keyboard: `T` opens. `Alt+←/→` moves ±1 trading day. `Alt+Shift+←/→` moves ±1 month. `Esc` in the banner returns to latest. Changes are announced in an `aria-live="polite"` region: "Time machine: as of 2 January 2019, 16:00 Eastern".
- **Behaviour:** setting the as-of re-queries everything with `asof`. Charts animate the curtain (240 ms; instant with reduced motion). Committee and forecast panels show the **forecast made at the nearest origin ≤ t** and label it: "nearest forecast origin: 31 Dec 2018 (monthly origins)" (`DEP:A2/A7`: origins are precomputed or computed on demand).

#### UX-C03 Horizon selector
- A segmented control `1W 1M 3M 6M 12M`, mapped to **5/21/63/126/252 trading days** (`DEP:A2`). The tooltip shows the trading-day count. The default is **12M**, the report's target.
- It changes the horizon of every forecast and score on screen. Charts that are horizon-specific carry a small `12M` chip in their subtitle.

#### UX-C04 Command palette (⌘K / Ctrl+K)
- Built on `cmdk` through the shadcn `Command` component. Dialog is 640 px wide, top offset 15 vh, at most 10 visible rows, with grouped results.
- **Prefixes:** `>` actions, `@` analyzers, `#` runs, `!` events, `/` pages, `?` glossary, and a bare date (`2019-01-02`) means "travel to".
- **Groups and examples:**
  - *Navigate:* Go to Committee (`G M`), Leaderboard (`G L`) …
  - *Actions:* New idea card (`N`), Run analyzer…, Compare selected runs, Export current figure, Add current view to story, Toggle theme, Density: compact / default / comfortable, Copy link to this view.
  - *Time:* Travel to…, Return to latest, Step +1 day / −1 day.
  - *Objects:* analyzers (colour chip, author, best 12M skill), runs (status, analyzer, date), events (date, category glyph), datasets, idea cards, glossary terms (with a one-line definition preview).
- Shows recent items first. Search is fuzzy across name, ID and author. Each row has a type icon, the main label, a secondary label in tertiary text and its shortcut on the right.

#### UX-C06 Identity ("who's working?")
- R1 has no authentication (`DEP:A7` deployment). On first visit a modal shows team member chips (name + colour) and an "Add member" option. The choice is stored locally.
- The avatar is initials in a 24 px circle with a 2 px ring in the author's colour. It is used on every authored object.

#### UX-C07 Job tray
- A status-bar item `▶ 2 runs (63%)` that expands upward into a 360 px panel. Each job shows analyzer chip, stage, progress bar, ETA and cancel.
- On completion it raises a toast with the verdict, in neutral tone: "Run completed · Momentum 12-1 v3 · ◔ Weak evidence (CI includes 0) · View".

#### UX-C08 Status bar
- `● snap 9c41e2` (click opens the snapshot: datasets and ingestion times) · `PIT guard on` (click opens a methodology note) · job tray · `Holdout ≥ 2021-01-01 locked` · build version. On the right: "Educational research tool — not investment advice" (links to About › Disclaimer).

### UX-IA-06 — The four kinds of time (and the fifth that lives inside runs)

This is the most important disambiguation in the product. Users *will* get lost here unless the visual language separates these concepts.

| Concept | Question it answers | Control | Visual signature | Default |
|---|---|---|---|---|
| **As-of** (information set) | "What did the world know?" | Top-bar as-of control | Clock icon, **amber** when historical, amber frame + banner, curtain on charts | Latest |
| **View window** | "Which dates are on the x-axis?" | Chart range presets, navigator brush, `from/to` params | Grey brush handles, range chips `1M 6M YTD 1Y 5Y 10Y Max` | 5Y (page-specific) |
| **Backtest window** | "Over which period was this method evaluated?" | Run config / protocol preset | **Bracket chips** `Eval 1993-01 → 2020-12`, hatched holdout region | Protocol preset (`DEP:A2`) |
| **Horizon** | "How far ahead does the forecast look?" | Top-bar segmented control | `12M` chip in chart subtitles | 12M |
| *Forecast origin* | "When was this particular forecast made?" | Implicit (per point in run charts) | Small ● "origin" marker, tooltip line "made 31 Dec 2018" | — |

**Rules that prevent confusion**

1. Brushing or zooming never changes the as-of. Only the as-of control (or an explicit "Travel to this date" action) does.
2. The run view shows its backtest window in the header and does not react to the global as-of: a run is a historical artefact. A small note makes this explicit: "Runs are not affected by the time machine."
3. On charts, the as-of line is **amber dashed**. A forecast origin is a **solid ink dot**. The holdout boundary is a **hatched region**. Three different marks for three different concepts.
4. The glossary (`?as-of`, `?horizon`) defines each term, with one sentence and a tiny diagram.

### UX-IA-07 — Keyboard map (defaults; single-key shortcuts can be turned off, see UX-A11Y-05)

| Keys | Action | Keys | Action |
|---|---|---|---|
| `⌘K` / `Ctrl K` | Command palette | `T` | Open as-of control |
| `G H` | Home | `Alt ←/→` | As-of ±1 trading day |
| `G D` | Data | `Alt ⇧ ←/→` | As-of ±1 month |
| `G E` | Events | `1`–`5` | Horizon 1W … 12M |
| `G T` | Time machine | `[` | Toggle left rail |
| `G I` | Idea lab | `I` | Provenance of focused value |
| `G A` | Analyzers | `E` | Export focused chart |
| `G R` | Runs | `R` | Add focused chart/table to report |
| `G L` | Leaderboard | `V` | View focused chart as table |
| `G M` | Committee | `F` | Fullscreen focused chart |
| `G P` | Report studio | `0` | Reset chart zoom |
| `G S` | Present | `N` | New idea card |
| `⌘↵` | Run (in config editor / launcher) | `?` | Shortcut sheet |
| `J / K` | Next / previous row in lists | `Esc` | Close drawer / exit time machine (from banner) |

---

## 4. Screen-by-screen specification

Each screen lists: **purpose · primary users · URL · wireframe · components · provenance & uncertainty · interactions · states · R1 cut**. Component IDs (UX-C…) are defined in §8 and chart IDs (UX-CH…) in §7.

### UX-S01 — Mission control (Home)

**Purpose.** A 10-second answer to three questions: *What does the committee currently say about AAPL 12 months out? How good is the evidence? What changed?* **Users:** everyone. It is the professor's first screen. **URL:** `/`.

```
Home                                                          As of Latest · 20 Nov 2026 16:00 ET          [Present ▸]
┌─ Consensus 12-month forecast · cmt.main ───────────────────────────────────────────┐┌─ Committee readout ───────────────┐
│  $ (log)                                                            ░░░ 95%         ││ P(AAPL higher in 12M)             │
│  340 ┤                                                    ░░░░▒▒▒▒▒▒▒▒ 80%          ││                                   │
│  300 ┤                                       ░░░░▒▒▒▒▓▓▓▓▓▓▓▓▓▓▓▓▓▓ 50%             ││   61%   ▕██████████████▍░░░░░░▏   │
│  260 ┤                         ░░▒▒▓▓▓▓█████████████████━━ median $246               ││         interval 54–68%  ⓘ        │
│  220 ┤          ╭──╮  ╭───────●━━━━━━━━━━━━━━━━━━━━━━━━━━━━                          ││                                   │
│  180 ┤   ╭─────╯  ╰─╯        ░▒▓▓▓▓██████████████████                               ││ Median 12M price  $246  (+7.9%)   │
│  140 ┤ ──╯                     ░░▒▒▒▒▓▓▓▓▓▓▓▓▓▓▓▓                                   ││ 80% range     $191 – $303         │
│      └┬──────────┬──────────┬──────┊──────┬──────────┬──────────┬──                 ││ 95% range     $162 – $340         │
│      2024       2025       2026   today  2027-Q1    2027-Q2    Nov 2027             ││                                   │
│  Bands: central 50 / 80 / 95% predictive intervals · ● last close 20 Nov 2026       ││ Evidence  ◐ Moderate  ⓘ           │
│  Source: Orchard committee cmt.main@2026-11-21 (7 analyzers); prices: <vendor>       ││ 7 analyzers · 4 authors           │
│  (2026). Data as of 20 Nov 2026 16:00 ET.                                            ││ [Why 61%? →]   [Open committee →] │
└──────────────────────────────────────────────────────────────────────────────────────┘└───────────────────────────────────┘
┌─ Leaderboard · 12M · CRPS skill vs RW+drift (90% CI) ──────────────────┐┌─ Latest runs ─────────────────────────────┐
│ Rank   Analyzer               Author  Skill            CI     n_eff Cal ││ ● Completed  Fed-model yield gap  AB  2 h │
│ 1 (1–3) ■ Momentum 12-1        SB     +4.1% ├──●───┤ [−0.6,+8.8] 28  ✓  ││ ◔ 63%        GARCH vol regime     CD  now │
│ 2 (1–4) ■ Reverse-DCF gap      AB     +2.7%  ├─●──┤ [−1.9,+7.0] 28  ✓  ││ ✕ Stopped    TSMC revenue lead    EF  1 d │
│ 3 (2–5) ■ USD-index beta       CD     +0.9%   ├●─┤ [−2.2,+3.9] 28  ~  ││ ● Completed  RSI(14) reversal     GH  1 d │
│ 4 (3–6) ■ RSI(14) reversal     GH     −1.8%  ┤●├   [−4.0,+0.5] 28  ✕  ││ [All runs →]                              │
│ —       ┄ RW+drift (baseline)  —       0.0%    ┊                      ││                                           │
│ [Open leaderboard →]          ranks are uncertain: bootstrap intervals ││                                           │
└────────────────────────────────────────────────────────────────────────┘└───────────────────────────────────────────┘
┌─ Since your last visit ───────────────────────┐┌─ Idea pipeline ────────────────┐┌─ Data freshness ──────────────────┐
│ • Committee P(up) 58% → 61% (+3 pp)           ││ Draft 3 · Submitted 2          ││ Prices (daily)  ● 20 Nov 16:00 ET │
│   largest driver: Momentum weight .18 → .22   ││ Implementing 1 · Ready 2       ││ SEC EDGAR       ● 31 Oct (10-K)   │
│ • New event: Q4 FY26 results (illustrative)   ││ Backtested 6 · In committee 7  ││ FRED macro      ◐ CPI Oct, lag 14d│
│ • Run "TSMC revenue lead" stopped: data gap   ││ [Open idea lab →]              ││ Events corpus   ● 182 events      │
│ [Activity log →]                              ││                                ││ User datasets   ○ 1 private (local)│
└───────────────────────────────────────────────┘└────────────────────────────────┘└───────────────────────────────────┘
```

| Component | Spec |
|---|---|
| Consensus hero | UX-CH02 fan chart, compact variant, 8 of 12 columns, 360 px tall. History is the last 3 y on a log scale. The fan starts at the last close. Band labels sit at the right edge. Hovering shows a readout (date · median · 50/80/95% bounds). Click goes to `/committee`. |
| Committee readout | UX-C10 probability readout: 48/52 number, 600 weight, plus a UX-CH24 probability bar with CI whisker and a 50% tick. Then median / 80% / 95% rows (tabular), evidence badge UX-C11, member counts, links. |
| Leaderboard (compact) | UX-C14 data table, top 5 + baseline row. Columns: rank with bootstrap rank interval, analyzer chip (UX-C09), author avatar, skill, UX-C12 MetricCI, `n_eff`, calibration status (✓ / ~ / ✕ with text in the tooltip). |
| Latest runs | Status glyph + label (never colour alone), analyzer name, author, relative time. |
| Since your last visit | Diff of committee readout + audit events since the last visit timestamp (stored locally). R1 shows the last 5 audit-log entries. |
| Idea pipeline | Counts per status. Click opens the filtered board. |
| Data freshness | UX-C17 freshness rows. ● fresh, ◐ expected lag, ○ local/private, ▲ stale (amber). |

- **Provenance & uncertainty:** the hero has a source line. Every readout value has a provenance chip pointing to `cmt.main@snapshot`. The P(up) interval comes from the committee's bootstrap (`DEP:A2`). An info button explains: "Uncertainty about the probability itself, from resampling the backtest."
- **Time machine:** with `asof` in the past, the hero becomes "Consensus as computed at 31 Dec 2018 (nearest origin ≤ 2 Jan 2019)". The realised path is hidden, the leaderboard shows skill *as estimated with data up to t* (`DEP:A2`: PIT committee weights), and freshness shows "as of" values.
- **States:** no committee → empty state (§9). Committee computing → skeleton with progress. Stale prices → amber freshness row plus a page banner.
- **R1 cut:** everything shown, except that "Since your last visit" falls back to the activity log.

### UX-S02 — Data explorer

**Purpose:** browse every piece of AAPL data the platform holds, with its point-in-time provenance. This is the data-analysis backbone for the report's Intro, Macro, Sector and Fundamental sections. **URL:** `/data/:tab`. A right **Provenance panel** (360 px, collapsible with `\`) is present on every tab.

#### Tab: Price & events (`/data/price`)

```
Data ▸ Price & events     Range [1M 6M YTD 1Y 5Y 10Y Max]   Scale [Lin|Log]   Type [Line|Candles|Area]   Adj [Split|Split+div]   [V][E][R][F]
┌───────────────────────────────────────────────────────────────────────────────────────────────┐┌─ Provenance ──────────────────┐
│ AAPL  2 Jan 2019  O 38.72  H 39.71  L 38.56  C 39.48  ▲ +0.1%  Vol 148m  split-adj. (readout)││ Hover or select a value       │
│ Overlays: [SMA 50 ✕] [SMA 200 ✕] [+ Add]           Events: [●E] [▲P] [◆M] [■R] [┼C] [★L] [✚S]  ││                               │
│ 240 ┤                                                                         ╭─╮          ││ Close · 2 Jan 2019            │
│     │                                                           ╭──╮   ╭─────╯ ╰─╮        ││ 39.48 split-adj. · 157.92 raw*│
│ 200 ┤                                        ╭──╮      ╭───────╯  ╰───╯          ╰──      ││ Series  px:AAPL:close         │
│     │                            ╭───────────╯  ╰─────╯     ┄┄┄ SMA 200                   ││ Source  <price vendor>        │
│ 160 ┤               ╭───╮  ╭────╯                                                         ││ Basis   split-adjusted        │
│     │ ╭────────────╯   ╰──╯                                                               ││ Avail.  2 Jan 2019 16:00 ET   │
│ 120 ┤─╯                                                                                   ││ Ingest. 18 Nov 2026 22:10 UTC │
│─────┼──────────────────────────────────────────────────────────────────── Volume ─────────││ Licence  vendor terms ↗       │
│     │ ▂▃▂▅▂▂▃▂▂▇▂▂▃▂▂▂▂▃▂▂▅▂▂▃▂▂▂▂▃▂▂▂▂▂▃▂▂▂▂▃▂▂▂▂▂▂▃▂▂▂▃▂▂▂▂▂▃▂▂▂▃▂▂▂▂▂▂▃▂▂▂▂▃▂▂▂▂▂▂▂▃▂▂▂ ││ [Copy Harvard citation]       │
│─────┼──────────────────────────────────────────────────────────────── Event rail ─────────││ [Open series →]               │
│     │  ●   ●  ▲   ●  ◆   ●   ●  ▲ ■  ●   ●  ▲   ●  ┼  ●   ●  ▲   ●   ●  ▲  ●  ●  ◆   ●   ││                               │
│     └┬────────────┬────────────┬────────────┬────────────┬────────────┬────────────┬────── ││ (*illustrative values)        │
│     2020         2021         2022         2023         2024         2025         2026    ││                               │
│ ▕══════════════════════════════════[▒▒▒▒▒▒▒▒▒ view window ▒▒▒▒▒▒▒▒▒]═════▏ 1980 → 2026      ││                               │
│ Source: <vendor> daily OHLCV, split-adjusted; events: Orchard events corpus (n=182, A4).   ││                               │
│ Data as of 20 Nov 2026 16:00 ET.                                                           ││                               │
└───────────────────────────────────────────────────────────────────────────────────────────────┘└───────────────────────────────┘
┌─ Selected event ──────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ ● Earnings/guidance · 2 Jan 2019, after close · Apple letter to investors revises Q1 FY19 revenue guidance to ~$84bn      │
│ Known at: 2 Jan 2019 after 16:00 ET (time UNVERIFIED, A4) · Source: Apple Inc. (2019) Letter from Tim Cook to Apple investors │
│ Next-session reaction: shown from data · CAR[0,+5] with 95% CI from event study                                           │
│ [Open event →]   [Add to event study]   [Travel to 2 Jan 2019 16:00 ET]   [Travel to 3 Jan 2019 09:30 ET]                  │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

- **Chart:** UX-CH01 (Lightweight Charts). It has panes for price, volume and the event rail (`DEP:A7` decides whether the event rail is a custom pane primitive or a markers series). The y-axis is on the right. The default range is 5Y. Long ranges default to log scale, because a split-adjusted AAPL series runs from cents in the 1980s to hundreds of dollars and a linear axis would flatten 30 years of history into a line along the floor.
- **Readout bar** at the top-left of the plot replaces the floating tooltip for OHLCV, as on TradingView. It never covers data.
- **Overlays:** moving averages, Bollinger bands, peers rebased (the axis switches to % change from the window start, labelled "Rebased: 0% at 2 Jan 2020"), and macro series (open in a *separate pane*, never on a dual axis).
- **Event rail:** glyphs by category (§6.8), sized by importance (8/10/12 px). Hover gives title and date. Click selects the event and fills the "Selected event" strip. A double click opens the drawer. Keyboard: focus the rail and use `←/→` to move between events.
- **Two "travel" buttons** on a selected event (before and after its publication time) are the cheapest way to *show* point-in-time discipline.
- **R1:** everything except candles/area, drawing tools (never planned) and multiple overlay panes (R1 allows one macro pane).

#### Tab: Fundamentals (`/data/fundamentals`)

```
Data ▸ Fundamentals     Statement [Income | Balance | Cash flow | Ratios]   Period [Quarterly | Annual | TTM]
                        View [● As first reported | Latest restated | Diff]                                 [V][E][R]
┌─ P/E (TTM) vs own history ─────────────────────────────────────────────┐┌─ Where are we now? ─────────────────────┐
│ line: P/E TTM; shaded band = 10th–90th pct of trailing 10y P/E         ││ P/E TTM            34.1×  (illustrative) │
│ ticks on x-axis = filing dates (10-Q ┆, 10-K ╎); ◆ = restated values   ││ vs own 10y         88th percentile       │
│                                                                         ││ vs peer median     29.4× (MSFT, GOOGL…)  │
│ Source: SEC EDGAR XBRL company facts (filed dates); prices: <vendor>   ││ Earnings yield − 10Y  −0.8 pp            │
└─────────────────────────────────────────────────────────────────────────┘└──────────────────────────────────────────┘
┌─ Income statement · quarterly ($ m) ─────────────────────────────────────────────────────────────────────────────────┐
│ Line item               Q1 FY25    Q2 FY25    Q3 FY25    Q4 FY25    Q1 FY26  …  Trend      Source                   │
│ Period end              28 Dec     29 Mar     28 Jun     27 Sep     27 Dec                                        │
│ Public from (filed)     31 Jan     2 May      1 Aug      31 Oct     30 Jan      ← availability row (PIT)         │
│ Revenue                  …          …          …          …          …         ▁▃▂▅▇     10-Q ↗ ⓘ               │
│ Gross margin %           …                                                                                         │
│ Operating income         …    ◆ restated in later filing (hover: "first reported X, restated Y in 10-K filed …")   │
│ Diluted EPS              …                                                                                         │
└───────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
(all dates and values illustrative)
```

- **The PIT moment:** each period column carries a **"Public from" row** with the EDGAR `filed` date (and time when known). In time-machine mode, columns whose filing is after the as-of are **absent**, not dimmed.
- **As first reported / Latest restated / Diff:** Diff highlights changed cells with a ◆ and an `accent-subtle` background, and the tooltip shows both values with both filing dates. This shows a professor in one glance that restatement bias was taken seriously (`DEP:A2/A3` for vintage availability).
- Table: UX-C14 with a sticky first column and header, right-aligned tabular numbers, negative values as `−1,234` (U+2212) in `text-primary`. Red is never used for negative accounting numbers, because it would collide with the "down" semantics.
- **R1:** income and balance quarterly/annual, a ratios chart with history band, first-reported vs restated **if A3/A7 deliver vintages in R0**; otherwise the Diff toggle is hidden (R2).

#### Tab: Macro (`/data/macro`)

```
Data ▸ Macro    Series [+ FRED:DGS10 ✕] [+ FRED:DTWEXBGS ✕] [+ FRED:CPIAUCSL ✕] [+ Add series…]
                Vintage [● As known at as-of (ALFRED) | Latest revised]   Transform [Level | Δ | YoY %]
┌─ Small multiples, aligned time axis, linked cursor ───────────────────────────────────────────────┐┌─ Sensitivity ───────────┐
│ AAPL (log)        ───────────────────────────────────────────────────────────────────────        ││ Rolling 36M beta of     │
│ 10Y yield (%)     ───────────────────────────────────────────────────────────────────────        ││ AAPL monthly returns to │
│ Broad USD index   ───────────────────────────────────────────────────────────────────────        ││ Δ USD index             │
│ CPI YoY (%)       ─────────── (step: values appear on release dates, not month end) ──────        ││ line + 90% CI band (CH19)│
└─────────────────────────────────────────────────────────────────────────────────────────────────────┘└─────────────────────────┘
Source: Federal Reserve Bank of St. Louis (2026) FRED/ALFRED; prices: <vendor>. Vintages as of the as-of date.
```

- **No dual y-axes**, ever. Use small multiples with a linked cursor, or rebasing.
- Released-on-date step rendering: macro values appear as a step on their **release date** (ALFRED vintage) rather than at period end. A toggle "plot at period end" exists for teaching, with a warning label "look-ahead view".
- The Sensitivity panel supports the coursework's FX point ("multinationals are affected by exchange rates").
- **R1:** 2–4 series with Level/YoY, vintage toggle only if R0 ingests ALFRED vintages (`DEP:A3`), and a rolling beta to one chosen series.

#### Tab: Peers (`/data/peers`)

- **Peer set** chips (`DEP:A4`, e.g. MSFT, GOOGL, AMZN, META, plus sector ETFs XLK/QQQ as benchmarks). The set is **fixed as of the as-of date**, with a footnote on survivorship (`DEP:A2`).
- Three panels: (1) **rebased performance** lines (AAPL in accent, peers in Series-6, direct labels at line ends); (2) **valuation scatter** UX-CH18 (x = revenue growth, y = EV/EBITDA or P/E, AAPL highlighted, optional regression with CI); (3) **ratio table** with percentile rank of AAPL in the peer set, copy-ready for the report's Sector section.
- **R1:** rebased performance + ratio table. Scatter in R1 if fundamentals for peers are ingested (`DEP:A3`), otherwise R2.

#### Tab: Catalog & coverage (`/data/catalog`)

- Dataset table: name, source, **licence badge** (`Public` / `Licensed · local only` / `User`), frequency, coverage start–end, **PIT method** (`native timestamps` / `vintages` / `default lag +45 d` …), typical publication lag, last update, row count.
- **Coverage map** UX-CH20: Gantt-style bars per series, with publication lag drawn as a lighter extension and gaps hatched. It explains instantly why "TSMC revenue lead" cannot start before 2011.

### UX-S03 — Time machine / replay

**Purpose:** "Back to 2019-01-02: what did we know?" It makes point-in-time discipline tangible and lets humans test their own judgement against the committee. **URL:** `/replay?asof=…`. **Users:** professor demo, teammates.

```
Time machine                                                                         [Return to present  Esc]
┌ Pick a moment ──────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Date [2019-01-02]  Time [Close 16:00 ET ▾]    Moments: Lehman 15 Sep 2008 · Guidance letter 2 Jan 2019 · COVID low…  │
│ 1980 ▕▁▁▁▂▂▂▃▃▃▄▄▅▅▆▅▆▇▇█▇▇█▏ 2026      [ ] Blind mode — hide dates, rebase price to 100 (R2)   [Surprise me] (R2)│
└────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
┌ What was knowable at 2 Jan 2019, 16:00 ET ──────────────────────────────┐┌ Forecast made then (12M) ─────────────────┐
│ price to t (ink) ───────────────────────╮┆░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  ││ Consensus at nearest origin 31 Dec 2018    │
│                                          ╰┆░░░  FUTURE NOT LOADED  ░░░░  ││ P(up 12M)  57%   interval 49–64%           │
│                                           ┆░░░░░░░░░░░░░░░░░░░░░░░░░░░░  ││ Median +6% · 80% [−24%, +33%]             │
│ amber dashed as-of line, label "2 Jan 2019 16:00 ET"                     ││ fan drawn from t into the curtain area     │
└──────────────────────────────────────────────────────────────────────────┘└────────────────────────────────────────────┘
┌ Latest filings known ─────────────┐┌ Events in the 90 days before t ───────┐┌ Macro, as published by t (vintage) ──────┐
│ 10-K FY2018 · filed 5 Nov 2018*    ││ ● 1 Nov 2018  Q4 FY18 results*         ││ Fed funds target 2.25–2.50% *             │
│ Latest quarter: Q4 FY18            ││ ◆ 19 Dec 2018 FOMC decision*           ││ 10Y Treasury 2.66% (31 Dec close)*        │
│ [Open as-reported statements →]    ││ …                                      ││ CPI: Nov 2018 release*                    │
└───────────────────────────────────┘└───────────────────────────────────────┘└──────────────────────────────────────────┘
┌ Your call (optional) ─────────────────────────────────────────────────────────────┐
│ Your P(AAPL higher in 12M):  [ 55 ]%    One-line reason: [                       ] │      [ Reveal what happened ▸ ]
└────────────────────────────────────────────────────────────────────────────────────┘
(* illustrative; A4 to provide verified values)
```

**After "Reveal":** the curtain lifts (240 ms). The realised 12-month path draws over the fan (1,200 ms ease-out, instant with reduced motion). A **scorecard** card appears:

```
┌ Scorecard · origin 31 Dec 2018 → 31 Dec 2019 ─────────────────────────────────────────────────┐
│ Realised 12M price return: shown from data   ·  It landed at the 9xth percentile of the forecast │
│ PIT value 0.9x  → in the upper tail: the committee was too pessimistic here                     │
│ CRPS: committee vs RW+drift baseline vs you (if entered)                                         │
│ Brier on P(up): committee vs you                                                                 │
│ What we couldn't have known: 3 events after t that moved the price (list, with sources)          │
│ [Add this replay to the report]   [Next moment ▸]                                               │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

- **Leak-proof design rule (important):** before the reveal, **nothing after t may be named, counted or hinted at**. That includes "3 events hidden" and "Q1 FY19 10-Q not yet filed", because the count itself leaks information. "What we couldn't have known" appears *only after* the reveal.
- **Presenter variant:** when not in blind mode, the presenter can step the clock (`Alt →`) from 16:00 to 20:00 on 2 Jan 2019. The guidance-letter event then appears on the rail and the forecast panel says "nearest origin unchanged (monthly)". This makes the point that information arrives at a *time*, not on a *date*.
- **Blind mode (R2):** dates hidden, prices rebased to 100, y-axis in %. "Surprise me" picks a random month-end origin from the evaluation window, so a human's judgement can be scored without hindsight recognition. Results feed a "human vs committee" calibration log (R3).
- **R1:** pick a moment, knowable panels (price, filings, events, macro if available), forecast at nearest origin, reveal + scorecard. Without blind mode and without the journal.

### UX-S04 — Events

**Purpose:** a filterable, sourced corpus of what happened to Apple. It drives event markers, event-driven analyzers and event studies. **URL:** `/events`, `/events/:eventId`, `/events/study`.

```
Events     [Timeline | List]   Category ▾  Importance ≥ ●●○○  Collection [Systematic | Curated | All]  Range ▾   Search [china       ]
┌ Swimlanes (brush to zoom; linked to list) ──────────────────────────────────────────────────────────────────────────────────┐
│ Earnings    │ ● ●  ● ●  ● ●  ● ●  ● ●  ● ●  ● ●  ● ●  ● ●  ● ●  ● ●  ● ●  ● ●  ● ●  ● ●                                   │
│ Product     │    ▲         ▲        ▲       ▲      ▲        ▲       ▲       ▲                                               │
│ Macro       │ ◆            ◆◆         ◆               ◆          ◆                                                          │
│ Legal/Reg   │         ■          ■         ■   ■           ■                                                                │
│ Capital     │     ┼ split        ┼ split          ┼ split   buybacks ┆ ┆ ┆ ┆                                                │
│ Leadership  │                ★                          ★                                                                   │
│ Supply chain│                       ✚        ✚                 ✚                                                            │
│ AAPL (log)  │ ▁▁▁▂▂▂▃▃▃▄▄▅▅▆▆▇▇██  context sparkline                                                                      │
└────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
┌ List · 182 events (filtered 37) ────────────────────────────────────────────┐┌ Event detail (drawer, 420 px) ─────────────────┐
│ Date & time (ET)   Cat Title                              Imp   Coll.  React.││ ● Earnings/guidance · Systematic? no → Curated │
│ 2019-01-02 ~16:30  ●   Letter to investors: Q1 FY19 rev…  ●●●●  Cur.  ▼ x% ││ 2 Jan 2019 · after close (time UNVERIFIED)     │
│ 2018-11-01 16:30   ●   Q4 FY18 results                    ●●●○  Sys.  ▼ x% ││                                                 │
│ …                                                                          ││ Summary (2–3 factual sentences, human-written, │
│ Next-day reaction column = sign glyph + %; colour = up/down tokens         ││ cited)                                          │
└────────────────────────────────────────────────────────────────────────────┘│ Known at: timestamp + how we know (source)      │
                                                                               │ Reaction: CH15 mini (−5…+20 d), AR & CAR with CI│
                                                                               │ Sources (Harvard) [Copy]                        │
                                                                               │  Apple Inc. (2019) Letter from Tim Cook to      │
                                                                               │  Apple investors. Available at: … (Accessed …). │
                                                                               │ Used by: ■ Event drift (EF) · run_…             │
                                                                               │ Curation: added 17 Nov 2026 by A4 · ⚠ curated   │
                                                                               │ after the fact (hindsight risk). See note.      │
                                                                               │ [Travel to before] [Travel to after] [+ Study]  │
                                                                               └─────────────────────────────────────────────────┘
```

**Event study (`/events/study`), UX-CH15:**

```
Event study   Event set: [Earnings · Systematic · 2007–2025 ▾] (n = 76)   Window [−5, +20] trading days
              Model [Market model vs QQQ ▾] Estimation window [−250, −30]   Split by [Surprise sign ▾ (if data)]   (DEP:A2)
┌ Mean CAR with 95% CI (band) + individual events (faint) ───────────────────┐┌ Test statistics ─────────────────────┐
│                                                                              ││ CAR[0,+1]   mean x.x%  t = …  p = …  │
│ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┼ day 0 ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  ││ CAR[0,+20]  mean x.x%  BMP p = …     │
│                                                                              ││ n events 76 · overlapping windows 0  │
└──────────────────────────────────────────────────────────────────────────────┘└──────────────────────────────────────┘
┌ Per-event table: date, title, AR(0), CAR[0,+1], CAR[0,+20], t-stat · [copy as table] ─────────────────────────────────┐
```

- **R1:** timeline + list + detail drawer with sources and travel buttons; event-study page with *one* model (market model) and fixed windows, if A2 includes the event-study engine in R1. Otherwise only the per-event reaction mini chart (simple returns, labelled "raw return, not abnormal").

### UX-S05 — Idea lab

**Purpose:** turn any teammate's idea into a runnable analyzer with as little friction and as much rigour as possible. **URL:** `/lab`, `/lab/ideas/new`, `/lab/ideas/:id`, `/lab/builder`, `/lab/config`.

#### Inbox board (`/lab`)

```
Idea lab ▸ Inbox                                           [+ New idea card  N]    View [Board | Table]    Author ▾  Category ▾
┌ Draft (3) ─────────┐┌ Submitted (2) ─────┐┌ Implementing (1) ──┐┌ Ready to run (2) ──┐┌ Backtested (6) ────┐┌ In committee (7) ──┐
│ IC-014             ││ IC-011             ││ IC-009             ││ IC-006             ││ IC-003  ■          ││ IC-001  ■          │
│ China iPhone share ││ Services gross-    ││ TSMC monthly       ││ Fed-model yield    ││ RSI(14) reversal   ││ Momentum 12-1      │
│ proxy              ││ margin trend       ││ revenue lead       ││ gap                ││ skill −1.8%        ││ weight 0.22        │
│ AB · Macro         ││ CD · Fundamental   ││ EF · Sector        ││ AB · Valuation     ││ ◔ Weak             ││ ◐ Moderate         │
│ ⚠ data timing      ││ submitted 2 d ago  ││ commit a1b2c3 ↗    ││ [Run standard ▸]   ││ [Promote…]         ││                    │
│   missing          ││ [Copy brief]       ││                    ││                    ││                    ││                    │
└────────────────────┘└────────────────────┘└────────────────────┘└────────────────────┘└────────────────────┘└────────────────────┘
Parked (2) ▸   Rejected (2) ▸   (each with a stated reason: duplicate, data not public at the time, untestable…)
```

- **Statuses:** Draft → Submitted → Implementing → Ready to run → Backtested → In committee, plus Parked or Rejected, always with a reason. Status changes go through a **status menu** on the card. There is no drag-and-drop in R1, which also satisfies WCAG 2.5.7.
- **"Copy brief" (the R1 bridge to the coding agent):** this copies a Markdown implementation brief made from the idea card plus the A5 acceptance checklist (PIT test, unit tests, baseline comparison, docs). The PO pastes it into the dev chat. Once implemented, the PO sets the status to Ready and attaches the commit hash.
- Cards show the author avatar, category, evidence badge once backtested, and **quality flags** (⚠ data timing missing, ⚠ no success criterion, ⚠ similar to `an.momentum_12_1`).

#### New idea card (`/lab/ideas/new`)

```
New idea card                                                                        [Save draft]  [Submit for implementation]
┌ Form (8 cols) ──────────────────────────────────────────────────────────┐┌ Live preview & checks (4 cols) ─────────────────┐
│ Title*            [ Fed-model yield gap                               ] ││ ┌ IC-0xx · Fed-model yield gap ──────────────┐ │
│ Author*           [ AB ▾ ]   Category* [ Valuation ▾ ]                  ││ │ Valuation · AB · 12M · expected: + when gap │ │
│ Report section    [ 4 Fundamental ▾ ]  Course concepts [DCF][Rates]     ││ │ is high                                      │ │
│ Hypothesis*       If AAPL's earnings yield minus the 10Y Treasury yield ││ └──────────────────────────────────────────────┘ │
│                   is high relative to its own history, forward 12M      ││ Checks (deterministic, not AI)                   │
│                   returns tend to be higher, because …                  ││ ✓ Hypothesis names a variable, direction and    │
│ Rationale*        [ multiline… ]                                        ││   horizon                                        │
│ Data needed*  ┌──────────────────────────────────────────────────────┐  ││ ✓ Each data item says when it becomes public    │
│               │ Series        Source      When public?          Lic. │  ││ ✓ Success criterion set before running          │
│               │ EPS (TTM)     SEC EDGAR   on 10-Q/10-K filed date Pub│  ││ ✓ ≥ 1 reference                                  │
│               │ 10Y yield     FRED DGS10  next business day       Pub│  ││ ⚠ Similar existing analyzer: an.ey_vs_bond (72%)│
│               │ [+ Add data]                                         │  ││   name/tag overlap — check before submitting     │
│               └──────────────────────────────────────────────────────┘  ││ Expressible in no-code builder?  Likely ✓        │
│ Rules / model     [ z-score of gap vs expanding history; … ]            ││ [Build it now in the builder →]                  │
│ Parameters        name · default · range   [+ Add]                      ││                                                  │
│ Horizon(s)*       [ 63d ][ ●252d ]   Expected direction* [ + ▾ ]        ││ Help: "When public?" examples                   │
│ Success criterion* (pre-registered, frozen on submit)                   ││  · 10-Q numbers: the EDGAR filed date, not the   │
│                   [ CRPS skill vs RW+drift > 0 with 90% CI excluding 0 ]││    quarter end                                   │
│                   [ at 12M on the standard protocol                    ]││  · CPI: the BLS release date (~2 weeks after     │
│ References        [ Harvard reference ] [+ Add] (DOI/URL lookup R2)     ││    month end)                                    │
└──────────────────────────────────────────────────────────────────────────┘└──────────────────────────────────────────────────┘
```

- Fields follow the A5 template (`DEP:A5`). Required fields carry `*` plus text ("required"), not colour alone.
- The **"When public?"** column is the single most important field for PIT integrity. It uses a select with common rules (*on filing date · on release date · next business day · same day after close · fixed lag…*) plus free text, and it shows examples inline.
- **Pre-registration:** on submit, the success criterion is frozen with a timestamp. Editing after submission creates a visible amendment ("criterion amended 21 Nov, after run_…") so nobody quietly rewrites the test after seeing results.
- The similarity check is a deterministic name/tag/data overlap score, not an LLM.

#### No-code builder (`/lab/builder`), R1 = structured rule form

```
Builder ▸ "Above 200-day SMA while 10Y yield is falling"               [Validate ✓]  [Preview signal]  [Save as analyzer]
┌ 1 · Inputs ─────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ A = price(AAPL, close, adj=split)                    B = series(FRED:DGS10)   timing: as published (vintage)  ⓘ    │
├ 2 · Transforms ─────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ A1 = sma(A, 200)                                     B1 = change(B, 63 trading days)                                │
├ 3 · Condition → state ──────────────────────────────────────────────────────────────────────────────────────────────┤
│ IF  [A] [>] [A1]   [AND ▾]   [B1] [<] [0]     THEN state = on   ELSE off           [+ condition]  [+ group]          │
├ 4 · Signal → probability (calibration recipe, DEP:A5) ──────────────────────────────────────────────────────────────┤
│ Recipe [Conditional empirical distribution ▾]   history: expanding · min 60 observations per state · horizons ●252d │
├ 5 · Identity ───────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Name · description · author · category · report section · link to idea card [IC-0xx ▾]                              │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
┌ Preview (as of latest) ────────────────────────────────────────────────────┐┌ YAML mirror (read-only; edit in Config) ─────┐
│ price with SMA200; state bands shaded (on = accent-subtle); current: on    ││ analyzer:                                     │
│ P(up 12M | on) 68% (n=318, n_eff 24) · P(up 12M | off) 49% (n=…, n_eff …)  ││   kind: dsl.v1                                │
│ ⚠ in-sample preview, not a backtest. Run the standard protocol to score.  ││   inputs: { A: price(AAPL,close), … }         │
└─────────────────────────────────────────────────────────────────────────────┘└───────────────────────────────────────────────┘
```

- Every block is a row of selects and number inputs, so keyboard and screen-reader support is native. The R2 version is a visual block canvas.
- **Validation** checks types, lookbacks against warm-up, data timing defined, and the minimum observations per state.
- The **preview carries a mandatory warning** ("in-sample, not a backtest") so a teammate does not mistake a pretty chart for evidence.

#### Config editor (`/lab/config`)

```
Run config  [ new_run.yaml ▾ ]                                         Est. trials +12 · est. runtime ~40 s      [Run  ⌘↵]
┌ YAML (CodeMirror 6, JSON-Schema validated) ───────────────────────────────────┐┌ Resolved & checks ─────────────────────┐
│  1 run:                                                                        ││ Protocol: standard walk-forward        │
│  2   analyzer: an.momentum_12_1@v3                                             ││ Eval 1993-01-01 → 2020-12-31           │
│  3   params:                                                                   ││ Holdout 2021-01-01 → today  LOCKED     │
│  4     lookback_months: [9, 12, 15]        ← grid → 3 variants                 ││ Origins: monthly (n = 336)             │
│  5     skip_months: [0, 1]                 ← grid → ×2 = 6                     ││ Horizons: 5d 21d 63d 126d 252d         │
│  6   protocol: standard                                                        ││ Baselines: RW+drift, hist. bootstrap   │
│  7   horizons: [5d, 21d, 63d, 126d, 252d]                                      ││ Seed: 20261120                         │
│  8   seed: 20261120                                                            ││ ⚠ 6 variants: trials counter 6 → 12;   │
│    ~~~~~~~~ inline error: "horizon '300d' not allowed (max 252d)"             ││   deflation applied to leaderboard     │
└────────────────────────────────────────────────────────────────────────────────┘└────────────────────────────────────────┘
```

- Schema-driven autocomplete of analyzer IDs, series IDs and parameter names. Hover documentation comes from the analyzer manifest. Diagnostics are underlined, with an **error list panel** that is keyboard reachable (`DEP:A7` publishes the JSON Schema).
- The **holdout lock is shown read-only**. Unlocking requires the analyzer page's "Final evaluation" action (reveal budget per A2 QNT-110: 2 per analyzer family; every reveal is logged and shown).

### UX-S06 — Analyzer library and detail

**Library (`/analyzers`)**: toggle between card grid and table. Filters: category, report section, course concept, author, origin (built-in / team / plugin), evidence grade, in committee. A card shows the colour chip and name, a one-line hypothesis, author, data badges (`EDGAR`, `FRED`, `Price`, `User`, `Licensed`), horizons, **best 12M skill with a MetricCI micro**, and evidence and committee badges.

**Detail (`/analyzers/:id/:tab`)**

```
Analyzers ▸ Momentum 12-1                         v3 · 7f3a9c · PIT-verified ✓ · In committee        [Run ▸] [Compare] [+ Report]
■ Momentum 12-1 (time-series)   Technical · Report §5 Future performance · Concept: market efficiency (weak form)   SB · 19 Nov 2026
Tabs:  Overview | Performance | Parameters | Data & PIT | Versions | Code | References
┌ Hypothesis & rationale ───────────────────────────────────────────────────┐┌ Latest forecast (as of latest · 12M) ──────────┐
│ The past 12-month return, skipping the most recent month, predicts the    ││ mini fan (CH02 compact) + P(up) 64% [55–72]    │
│ sign of the next 12-month return (time-series momentum).                  ││ Signal now: +18.4% (82nd percentile of own      │
│ How the signal becomes a probability: conditional empirical distribution  ││ history) → leans ▲ up                           │
│ of forward returns given the signal tercile, expanding window (A5 recipe) ││ Explanation payload rendered as a sentence      │
│ References: Jegadeesh & Titman (1993); Moskowitz, Ooi & Pedersen (2012)   ││ (template, not AI)                              │
└────────────────────────────────────────────────────────────────────────────┘└─────────────────────────────────────────────────┘
┌ Skill by horizon (CH08) ─────────────────────────────┐┌ Runs ───────────────────────────────────────────────────────────┐
│ 5d … 252d points with 90% CI whiskers, zero line     ││ run id · protocol · date · 12M skill [CI] · evidence · author   │
└───────────────────────────────────────────────────────┘└──────────────────────────────────────────────────────────────────┘
```

| Tab | Content |
|---|---|
| Overview | Hypothesis, rationale, signal→probability recipe, latest forecast, current reading, references (short form). |
| Performance | CH08 skill by horizon (best standard run), runs table, leaderboard position with rank interval, trials counter for this analyzer. |
| Parameters | Table (name, type, default, range, description, unit). A JSON-Schema-generated form preview (read-only) shows how the parameters look in the run launcher. |
| Data & PIT | Inputs with source, PIT method, publication lag, warm-up length. **PIT test results:** future-poisoning test ✓ (date, data snapshot), import/allow-list scan ✓ (`DEP:A2/A7`). |
| Versions | Vertical timeline v1 → v3: changelog, code hash, author, date, "result change": skill delta vs the previous version. Versions are immutable. Runs are pinned to a version. |
| Code | Read-only syntax-highlighted source (Shiki or CodeMirror read-only), path and commit, "Open on GitHub ↗". |
| References | Full Harvard references with copy buttons. They feed the report bibliography automatically when a figure from this analyzer is pinned. |

### UX-S07 — Run launcher (`/runs/new`, or ⌘K "Run…" as a dialog)

```
Run a backtest                                                               Mode [Form | YAML]
1 Analyzer      [■ Momentum 12-1 · v3 ▾]
2 Protocol      (●) Standard walk-forward — monthly origins, expanding window, eval 1993–2020, holdout locked   (DEP:A2)
                ( ) Custom… (⚠ custom runs cannot be promoted to the committee)
3 Parameters    lookback_months [12]  skip_months [1]        [Grid…] (each extra variant adds to the trials counter)
4 Horizons      [5d][21d][63d][126d][●252d]   (all recommended)
5 Baselines     RW+drift, historical bootstrap (always included)
6 Review        1 variant · trials 6 → 7 · est. ~35 s · snapshot 9c41e2                                [Cancel]  [Run ▸ ⌘↵]
```

- Parameter fields come from the analyzer's JSON Schema (RJSF with the shadcn theme, §11). Each field shows unit, range and the default with a "reset" link.
- **Form and YAML stay in sync.** Switching modes never loses edits (WCAG 3.3.7 redundant entry).

### UX-S08 — Backtest run view (`/runs/:runId/:tab`)

**Purpose:** answer three things — *did the idea work, how sure are we, and could it be overfit?* — and show everything needed to reproduce the run. **Users:** idea author, PO, professor.

#### Header (all tabs)

```
Runs ▸ run_20261120_7f3a      ■ Momentum 12-1 · v3 (7f3a9c) · SB      ● Completed 20 Nov 2026 14:02 · 41 s
[Eval 1993-01 → 2020-12] [Origins monthly · n=336] [Horizon 12M ▾] [Baseline RW+drift] [Holdout ≥ 2021 · locked] [snap 9c41e2]
                                                     [Compare]  [Promote to committee…]  [+ Report ▾]  [Re-run]  [⋯ Export manifest]
Tabs:  Overview | Forecasts | Calibration | Scores | Robustness | Breakdown | Manifest & logs
```

#### Overview tab

```
┌ Verdict ────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ ◔ Weak evidence.  At 12M, CRPS skill vs RW+drift is +4.1% with a 90% CI of [−0.6%, +8.8%], which includes zero.          │
│ Forecasts look calibrated (PIT uniformity p = 0.41, indicative). Pre-registered criterion "skill > 0 with CI excluding 0  │
│ at 12M": NOT MET.  Trials for this analyzer: 7 (deflated skill +2.9%).                                                   │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
┌ CRPS skill ────────┐┌ Log score Δ ────────┐┌ Hit rate (P>50%) ──────┐┌ 80% interval coverage ┐┌ Sample ──────────────────┐
│ +4.1%              ││ +0.03 nats          ││ 58%   vs 55% base rate ││ 77%   (target 80%) ✓  ││ n = 336 origins          │
│ ├──●───┤ [−0.6,+8.8]││ [−0.01, +0.07]     ││ [51%, 65%] binomial    ││ [70%, 83%]            ││ n_eff ≈ 28 (12M overlap) │
└────────────────────┘└─────────────────────┘└────────────────────────┘└───────────────────────┘└──────────────────────────┘
┌ Forecast vs realised · 12M · by target date (CH04) ─────────────────────────────────────────────────────────────────────┐
│ vertical bars = 10–90% interval per origin; inner = 25–75%; tick = median; ● realised inside 80%, ○ outside;             │
│ dashed outline = baseline 10–90%; hatched region ≥ 2021 = holdout (locked)                                              │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
┌ Reliability · P(up) (CH05) ─────────┐┌ PIT histogram (CH06) ────────────────┐┌ Skill by horizon (CH08) ────────────────────┐
│ CORP curve + 90% consistency band   ││ 10 bins · uniform line · 95% band     ││ 5d 21d 63d 126d 252d · CI whiskers · 0 line │
└──────────────────────────────────────┘└──────────────────────────────────────┘└─────────────────────────────────────────────┘
```

- **The verdict is generated by a fixed template from computed fields** (grade, skill, CI, calibration test, criterion, trials). It is reproducible and never LLM-written.
- KPI tiles (UX-C13) always show a CI or base rate. "n_eff ≈ 28 (12M overlap)" is a deliberate honesty cue: 336 monthly origins with 12-month horizons overlap heavily (`DEP:A2` for the n_eff formula).

#### Running state (same URL, live)

```
● Running · 63% · about 14 s left                                                                              [Cancel run]
Validate ✓ ── PIT checks ✓ ── Warm-up ✓ ── Walk-forward ◔ 212 / 336 origins ── Scoring ○ ── Bootstrap CIs ○ ── Done ○
┌ Forecast vs realised (fills left → right as origins complete) ──────────────────────────────────────────────────────────┐
│ ███████████████████████████████████████████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░                                  │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
Provisional metrics (n = 212) shown in tertiary text with "provisional" label · Log tail (mono, last 6 lines) [Expand]
```

- Progress streams over SSE at ≥ 2 Hz (`DEP:A7`). The ribbon filling in is a cheap, honest "wow": the viewer *watches* the walk-forward happen.

#### Other tabs

| Tab | Contents (charts / tables) | Notes |
|---|---|---|
| **Forecasts** | Horizon switcher; CH04 ribbon (per origin); origin picker → CH03 predictive distribution at that origin with the realised outcome marked; table of origins (date, median, q10, q90, realised, PIT, CRPS) with CSV export | Clicking an origin in the ribbon opens its distribution in a side panel. |
| **Calibration** | CH05 reliability (CORP, toggle to 10 equal bins); CH06 PIT histogram; CH07 interval coverage (nominal vs empirical with binomial CIs); sharpness (mean 80% interval width vs baseline over time) | Each chart has a 3-line **"How to read"** popover with tiny glyphs (U-shaped PIT = overconfident, hump = underconfident, slope = bias). Method references are auto-attached (Gneiting et al. 2007; Dimitriadis et al. 2021). |
| **Scores** | Metrics table: CRPS, log score, pinball (avg over quantiles), Brier, hit rate, MAE of median, rank IC. Columns: this run · RW+drift · historical bootstrap · Δ vs best baseline [CI] · Diebold–Mariano p (HAC). CH09 forest plot; CH10 rolling 36M skill. Collapsed "Strategy translation (illustrative)": CH21 equity curve & drawdown, long/flat vs buy-and-hold, cost slider | Metric definitions per `DEP:A2`. Strategy view is labelled "illustrative translation, not a trading recommendation". |
| **Robustness** | Trials counter (this analyzer / team-wide) with deflation explanation; CH11 parameter-sensitivity heatmap (grid runs); PBO via CSCV (logit histogram + PBO value) and Deflated Sharpe (strategy view) `DEP:A2`; **Holdout panel** (locked: "Final evaluation — reveals used 0 of 2" button (A2 QNT-110), with a confirm dialog stating it freezes the version and consumes a reveal); **PIT tests** (future-poisoning ✓) | The heatmap shows plateau (robust) vs spike (fragile) with an annotation. |
| **Breakdown** | Per period: calendar-year heat strip of skill, decade table. Regimes (`DEP:A2` definitions): bull/bear, high/low volatility, rate hiking vs easing, NBER recession vs expansion, pre/post iPhone (2007). Small-multiple bars with CIs and **n per regime** | Regimes with n_eff < 10 render hatched with "insufficient evidence". |
| **Manifest & logs** | Resolved YAML; analyzer code hash; data snapshot hash + dataset list; library versions; seed; machine; duration; PIT checks; warnings; full log (virtualised); **"Reproduce"** copy button (`DEP:A7` CLI, e.g. `orchard run --manifest …`) | Also downloadable as `manifest.json`. |

- **Promote to committee…** opens the **gate checklist** (UX-C20): standard protocol ✓ · PIT tests passed ✓ · n_eff ≥ threshold ✓ · holdout not used for tuning ✓ · pre-registered criterion recorded ✓ (whether or not it was met; promotion is allowed for "Weak" but the grade is shown). A predicted-effect preview reads: "Committee P(up) 61% → 62%; weight ≈ 0.08 (inverse-CRPS)".

### UX-S09 — Leaderboard and Compare

#### Leaderboard (`/leaderboard`)

```
Leaderboard     Horizon [12M]   Score [CRPS skill ▾ | Log score | Brier skill | Hit rate]   vs [RW+drift ▾]   Section [All ▾]   [V][E][R]
┌────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Rank    Analyzer                Author Section   Skill   90% CI (MetricCI)            Calib.  Cover80  n_eff Trials Evidence In cmt.│
│ 1 (1–3) ■ Momentum 12-1         SB     §5        +4.1%   ├────●─────┤                 ✓       77%      28    7      ◔ Weak   ☑      │
│ 2 (1–4) ■ Reverse-DCF gap       AB     §4        +2.7%     ├───●────┤                 ✓       82%      28    3      ◔ Weak   ☑      │
│ 3 (2–5) ■ USD-index beta        CD     §2        +0.9%       ├──●──┤                  ~       71%      28    4      ○ Insuff.☐      │
│ —       ┄ RW+drift (baseline)   —      —          0.0%           ┊                    ✓       79%      28    —      —        —      │
│ 4 (3–6) ■ RSI(14) reversal      GH     §5        −1.8%     ├──●──┤                    ✕       64%      28    9      ⊘ Neg.   ☐      │
│ … rows: sparkline column "rolling skill" (CH22) optional                                                                           │
└────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
Footnote: Ranks come with 90% bootstrap rank intervals. Skill is deflated for the number of trials (DEP:A2). Baselines appear as reference rows.
```

- **Rank intervals** ("2 (1–4)") are the honest way to show a leaderboard built on 28 effective observations. Expect a professor to notice this.
- The baseline is shown as a row, so "above or below the line" reads naturally.
- Filter by report section §1–§6 (coursework structure), so each report section can find its strongest evidence.

#### Compare (`/compare?runs=a,b[,c,d]`)

```
Compare   [■ Momentum 12-1 · run_…7f3a ✕] [■ Reverse-DCF gap · run_…b21c ✕] [+ Add run]     Horizon [12M]
┌ Summary table (rows = metrics; cols = runs; last col = difference [CI], DM test p) ───────────────────────────────────────┐
│ Metric           Momentum 12-1      Reverse-DCF gap     Δ (A − B)        DM p (HAC)                                      │
│ CRPS skill       +4.1% [−0.6,+8.8]  +2.7% [−1.9,+7.0]   +1.4% [−3.9,+6.5]  0.62  → no detectable difference               │
│ Hit rate         58%                55%                  …                                                                │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
┌ Skill by horizon (CH08, dodged) ─────┐┌ Reliability overlay (CH05) ──────────┐┌ Forecast-error correlation (CH23) ────────┐
│                                       ││ one CORP curve per run, own colour   ││ ρ = 0.31 → they carry partly independent  │
│                                       ││                                      ││ information: good committee diversity      │
└───────────────────────────────────────┘└──────────────────────────────────────┘└────────────────────────────────────────────┘
┌ Forecast ribbons, small multiples aligned on one time axis (CH04 × n), linked cursor ───────────────────────────────────────┐
```

- A difference row always has a plain-language reading ("no detectable difference" for p > 0.1). This is a fixed template, chosen to stop teammates over-reading a 1.4 pp gap.
- **R1:** two runs, the summary table, skill by horizon and reliability overlay. Error correlation and up to four runs in R2.

### UX-S10 — Committee / consensus (`/committee/:tab`)

**Purpose:** combine the team's analyzers into one probabilistic 12-month forecast, explain it, and freeze it for the report. **Users:** PO/integrator, professor.

#### Header

```
Committee ▸ cmt.main      7 members · 4 authors · Method [Inverse-CRPS, shrunk to equal ▾] (DEP:A2)   Pool [Linear ▾]
Snapshot: live (as of latest)   [Freeze snapshot for report…]   Frozen: "Report consensus v1" 28 Nov 2026 ▾
Tabs:  Forecast | Members & weights | Attribution | Scenarios | Why | Diagnostics
```

#### Forecast tab

```
┌ AAPL 12-month consensus predictive distribution (CH02 full) ───────────────────────────────────┐┌ Readout ─────────────────────┐
│ $ (log)                                                         member medians at 12M (rug) ┆  ││ P(higher in 12M)  61%         │
│                                                    ░░░░░░░░░░░░░░░░░░░░░░░░░░ 95%      ■ ─┤  ││ interval 54–68%               │
│                                        ░░░░▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒ 80%            ■ ─┤  ││ P(> +10%)   41%               │
│                         ░░▒▒▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ 50%                  ■ ─┤  ││ P(< −20%)   12%               │
│ ───────────────────────●━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ median $246          ■ ─┤  ││ Median  $246 (+7.9%)          │
│ history (ink)               ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓                     ■ ─┤  ││ Mean    +9.6%  Vol 27%        │
│                                ▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒                          ■ ─┤  ││ 80%  $191 – $303              │
│                                     ░░░░░░░░░░░░░░░░░                               ■ ─┤  ││ 95%  $162 – $340              │
│ └──2024──────2025──────2026──┊──────2027-Q1─────2027-Q2────2027-Q3──Nov 2027              ││ Ask: P(price > [$250]) = 47%  │
│ Source: Orchard committee cmt.main (7 analyzers, inverse-CRPS weights); prices <vendor>.  ││ Evidence ◐ Moderate           │
└────────────────────────────────────────────────────────────────────────────────────────────┘└───────────────────────────────┘
┌ Predictive distribution at 12M (CH03) — PDF | CDF toggle; scenario shading; draggable threshold (or type a value) ─────────┐
```

- **Member rug:** each member's 12M median is drawn as a tick in its analyzer colour at the right edge, with a hover label. The audience sees agreement or disagreement at a glance.
- **"Ask" field:** type a price or return threshold and get P(price > X) with an interval. This is the main "probabilities, not advice" interaction and the one teammates will quote in the report's Future-performance section.
- All probabilities state the **event definition** in a tooltip: "AAPL total return (dividends reinvested) from the 20 Nov 2026 close to the close 252 trading days later (≈19 Nov 2027) is above zero" — the target defined in A2 QNT-012. The fan is drawn in price for readability, and its caption says so.

#### Members & weights tab

- Members table: include toggle, analyzer chip, author, current weight, weight sparkline, 12M skill [CI], evidence, "added on". It also has **"Add judgemental view…"**: a teammate enters a dated view (P(up) or a return distribution) with a confidence level and rationale, and it is weighted per `DEP:A2/A5`. It is badged "human view" and never mixed up with backtested members.
- CH12 **weights over time** (100% stacked area, PIT-computed weights at each origin), largest average weight at the bottom.
- Method selector: Equal / Inverse-CRPS / Stacking / Hedge (`DEP:A2` default + "expert mode"). Switching methods recomputes instantly from cached member forecasts. The readout shows "Δ vs current method".

#### Attribution tab

```
┌ Why is P(up) 61%? Contribution waterfall (CH13) ───────────────────────────────────────────────────────────────────────┐
│ Baseline (RW+drift, P(up) 56%) ██████████████████████████████                                                            │
│ ▲ Momentum 12-1          +3.1 pp            ███                                                                           │
│ ▲ Reverse-DCF gap        +1.8 pp               ██                                                                         │
│ ▲ USD-index beta         +0.6 pp                 █                                                                        │
│ ▼ RSI(14) reversal       −0.4 pp                ▌                                                                         │
│ …                                                                                                                        │
│ = Committee              61%      ███████████████████████████████████▌                                                    │
│ Note: exact decomposition for linear pools of P(up): Σ wᵢ·(pᵢ − p_base). For quantiles the decomposition is approximate.│
└──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

- A second waterfall covers the **median 12M return**. Bars use the up/down tokens plus ▲/▼ glyphs plus signed labels.

#### Scenarios tab

```
┌ Scenario table (copy-ready) ──────────────────────────────────────────────────────────────────────────────────────────┐
│ Scenario  Definition (consensus quantiles)  Probability  12M price range   12M return range   What members say          │
│ Bear      below q20                          20%          < $199            < −13%             RSI, valuation: stretched │
│ Base      q20 – q80                          60%          $199 – $289        −13% … +27%       momentum + buybacks       │
│ Bull      above q80                          20%          > $289            > +27%             DCF gap, services margin  │
│ Notes: quantile-defined scenarios have fixed probabilities by construction; custom thresholds below are free.         │
│ Custom: [Price < $180] → 9% [6–13]      [+ add row]                                              [Copy as table ▾]      │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
CH14 stacked probability bar above the table.
```

- Recommendation: offer **two scenario modes**. *Quantile-defined* (probabilities fixed at 20/60/20, ranges vary) suits the report narrative. *Threshold-defined* (ranges fixed, e.g. < −20%, −20…+20%, > +20%, probabilities vary) suits "what is the chance of a crash". The UI labels which mode is in use so nobody presents a fixed 20% as a finding.
- "What members say" is assembled from the members' explanation payloads (fixed templates), never written by an LLM.

#### Why tab

- **Explanation cards** (UX-C19), one per member, sorted by |contribution|:
  ```
  ┌ ■ Momentum 12-1 · SB ──────────────────────────────────────── leans ▲ up · contribution +3.1 pp ┐
  │ Reading now: 12-1 month return +18.4% — 82nd percentile of its own history since 1985.            │
  │ Historically, when the reading was in the top tercile, AAPL rose over the next 12M in 68% of      │
  │ cases (n = 112, n_eff ≈ 10).                                                                       │
  │ Track record: CRPS skill +4.1% [−0.6, +8.8] · weight 0.22 · evidence ◔ Weak                        │
  │ [Open analyzer]  [Open run]                                                                        │
  └────────────────────────────────────────────────────────────────────────────────────────────────────┘
  ```
- Text comes from a template with slots filled by numbers from the analyzer's explanation payload (`DEP:A2/A5` contract).

#### Diagnostics tab

- Committee backtest: consensus vs equal-weight vs best single member vs baseline (CRPS skill with CIs, CH09 forest). A clear statement: "The committee beats the best single member: yes / no / not detectable".
- **Disagreement over time:** dispersion of member P(up) (line + band).
- CH23 error-correlation matrix (diversity).
- **R1:** Forecast, Members & weights (with weights-over-time if A2 computes PIT weights in R1), Attribution (P(up) waterfall), Scenarios, Why. Diagnostics: committee-vs-baseline only.

#### Freezing a snapshot for the report

- "Freeze snapshot…" asks for a name ("Report consensus v1"). It stores the committee config, member versions, weights, data snapshot and forecast. All report figures from the committee **pin to a frozen snapshot**. When the live consensus differs from the frozen one, the report studio shows: "Live consensus differs from 'Report consensus v1' (P(up) 61% vs 59%). Your figures still show v1. [Compare] [Refresh figures]".

### UX-S11 — Report studio (`/report/:tab`)

**Purpose:** turn the platform's evidence into publication-quality figures, tables and Harvard references for the 2,000-word report, **without writing the report**. This screen serves 45% of the marking scheme: Figures 15%, Citations 15% and Structure 15%. **Users:** all teammates.

```
Report studio     Tabs: Figures | Tables | References | Evidence pack                 [Copy bibliography]   [Export all (ZIP)]
┌ Outline (coursework) ────┐┌ Print preview — A4, text width 159 mm, 100% = true size ─────────────┐┌ Export ────────────────────────┐
│ 1 Introduction   ~400 w  ││ ┌──────────────────────────────────────────────────────────────────┐ ││ Format  (●) PNG 300 dpi         │
│   Fig 1 Price & events   ││ │                                                                  │ ││         ( ) SVG  ( ) PDF (R2)   │
│ 2 Macro          ~400 w  ││ │   [chart in print theme: white, Inter 8 pt ticks, 9 pt titles,   │ ││ Width   (●) Full text 159 mm    │
│   Fig 2 Rolling β to USD ││ │    Series-6 light palette, fan in iris tints, source line]       │ ││         ( ) Half 77 mm          │
│   Tab 1 Macro snapshot   ││ │                                                                  │ ││         ( ) Slide 16:9          │
│ 3 Sector         ~400 w  ││ │                                                                  │ ││ Height  [95] mm  Aspect [auto]  │
│   Fig 3 Peers rebased    ││ │                                                                  │ ││ Font    [Inter ▾] Arial · Source│
│ 4 Fundamental    ~400 w  ││ └──────────────────────────────────────────────────────────────────┘ ││         Serif 4                 │
│   Fig 4 P/E vs history   ││ Figure 5: AAPL 12-month consensus predictive distribution, as of      ││ In-image caption     [off]      │
│   Tab 2 Ratios vs peers  ││ 28 November 2026. Shaded bands show the central 50%, 80% and 95%      ││ In-image source line [on]       │
│ 5 Future perf.   ~400 w  ││ predictive intervals; the line shows the median. [Your interpretation ││ Grayscale preview    [off]      │
│   Fig 5 Consensus fan ★  ││ sentence goes here.]                                                   ││ CVD preview   [None ▾]          │
│   Fig 6 Calibration      ││ Source: Authors' calculations in Orchard (committee snapshot "Report  ││─────────────────────────────────│
│   Tab 3 Scenarios        ││ consensus v1") using price data from <vendor> (2026) and SEC EDGAR    ││ Figure lint            8 / 9 ✓  │
│ 6 Conclusion     ~200 w  ││ (2026).                                                                ││ ✓ Axis titles with units        │
│ Unassigned (2)           ││ ────────────────────────────────────────────────────────────────────   ││ ✓ Source line present           │
│                          ││ Caption builder: [What is shown ✓][Uncertainty ✓][Period ✓][Yours ✕] ││ ✓ Text ≥ 7 pt at print size     │
│ Word budgets are the     ││ "Orchard drafts what is plotted. You write what it means."            ││ ✓ ≤ 6 coloured series           │
│ coursework's suggested   ││ Frozen to: snap 9c41e2 · cmt.main@Report consensus v1   [Refresh…]    ││ ✓ Distinguishable under CVD     │
│ split (orientation only) ││                                                                        ││ ✓ Distinguishable in grayscale  │
└──────────────────────────┘└────────────────────────────────────────────────────────────────────────┘│ ✓ No dual y-axes                │
                                                                                                        │ ✓ Uncertainty described         │
                                                                                                        │ ✕ Interpretation sentence (you) │
                                                                                                        │ [Download PNG] [Copy image]     │
                                                                                                        │ [Copy caption] [Copy source]    │
                                                                                                        └─────────────────────────────────┘
```

| Area | Spec |
|---|---|
| Outline | The six coursework sections with their suggested word budgets (orientation only; Orchard does not count or write words). Each section lists pinned figures and tables. Reorder with ↑/↓ buttons or a "Move to section…" menu (no drag needed). **Numbering updates automatically** (Figures and Tables numbered separately, in outline order). |
| Print preview | A white page at true size (zoom 50/100/150%). It renders the **print variant** (§7.3), not a screenshot. The figure number and caption sit below the figure, as in academic convention. Table captions sit **above** tables. |
| Caption builder | Four slots: *What is shown* (auto), *Uncertainty encoding* (auto when bands or CIs are present), *Period / as-of* (auto), *Your interpretation* (empty, required by lint). The auto slots can be edited. Edited slots are marked "edited" so regeneration never overwrites them. |
| Export panel | Format, width preset, height, font, in-image caption/source toggles, grayscale and CVD preview (Machado et al. simulation matrices, as used by the palette validation in §6.2), download/copy actions. File name pattern `fig05_consensus-fan_2026-11-28_cmt-main-v1.png`. |
| Figure lint | Rules UX-LINT-01…10 (§7.3). Failing rules are **warnings, never blockers**: the team decides. |

**Tables tab:** copy-ready tables (metrics, scenario table, ratios vs peers, macro snapshot, event list). Options: decimals, units in the header, a notes line ("Notes: 90% CIs from stationary block bootstrap, 1,000 resamples"). Copy formats: **Word (rich HTML clipboard)**, TSV (Excel), Markdown, LaTeX (`booktabs`), CSV download. Numbering: "Table 2: …" above the table.

**References tab:**

```
References (UCL Harvard / Cite Them Right style)          Collected from 9 pinned items        Copy as [Word ▾ | Text | BibTeX | RIS]
┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Apple Inc. (2019) Letter from Tim Cook to Apple investors. Available at: https://www.apple.com/newsroom/2019/01/letter-  │
│   from-tim-cook-to-apple-investors/ (Accessed: 21 November 2026).                         used by: Fig 1 · in-text (Apple │
│                                                                                            Inc., 2019)  [copy in-text]   │
│ Dimitriadis, T., Gneiting, T. and Jordan, A.I. (2021) 'Stable reliability diagrams for probabilistic classifiers',      │
│   Proceedings of the National Academy of Sciences, 118(8), e2016191118.                    used by: Fig 6 (method)       │
│ Federal Reserve Bank of St. Louis (2026) 10-Year Treasury Constant Maturity Rate [DGS10]. Available at:                 │
│   https://fred.stlouisfed.org/series/DGS10 (Accessed: 21 November 2026).                   used by: Fig 2 · Tab 1        │
│ Gneiting, T., Balabdaoui, F. and Raftery, A.E. (2007) 'Probabilistic forecasts, calibration and sharpness', Journal of  │
│   the Royal Statistical Society: Series B, 69(2), pp. 243–268. doi:10.1111/j.1467-9868.2007.00587.x.  used by: Fig 6    │
│ …                                                                                                                        │
│ Lint: ✓ all have access dates · ⚠ 1 reference lacks a URL/DOI · ✓ no duplicates · ✓ alphabetical                        │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

- **Methods cite themselves:** pinning a calibration figure automatically adds the methodology references the chart relies on. Data sources, events and idea-card references are collected the same way.
- UCL's library guide uses its own Harvard variant based on *Cite Them Right* (UCL Library Services Harvard guide, see §16). The formatter should follow it exactly, with the in-text form "(Author, Year)" and no "ibid".

**Evidence pack tab:** one ZIP containing `figures/` (PNG + SVG), `captions.txt`, `references.txt` + `references.bib` + `references.ris`, `tables/` (CSV + `.html` for Word), `manifest.json` (snapshot hashes, run IDs, committee snapshot) and `README.txt` (how to reproduce, plus the disclaimer). This is the reproducibility appendix a professor can ask for.

- **R1:** Figures (PNG + SVG, full and half width, caption builder, source line, lint rules 01–06), Tables (Word + TSV copy), References (Harvard text + BibTeX), Evidence pack (basic). R2: PDF vector export, grayscale/CVD previews, RIS, slide variant.

### UX-S12 — Presentation / demo mode (`/present/:storyId`)

**Purpose:** a full-screen, guided, *live* walkthrough of the analysis. It is used for the professor demo and to record the LinkedIn video.

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────────────── 1920 × 1080 ┐
│ ORCHARD · AAPL                                                                       Scene 3 / 8 · ●●●○○○○○   04:12  │
│                                                                                                                         │
│   What did we know on 2 January 2019?                         (title 40/48, 600)                                        │
│                                                                                                                         │
│   ┌────────────────────────────────────── live app view in kiosk mode (no rail, no status bar) ─────────────────────┐   │
│   │                                                                                                                  │   │
│   │    price to t ─────────────────────╮┆░░░░░░░░░ FUTURE NOT LOADED ░░░░░░░░                                       │   │
│   │                                     ╰┆░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░                                       │   │
│   │                       ┌──────────────────────────────────────┐                                                  │   │
│   │                       │ ① The letter came after the close.   │  ← callout anchored to [data-anchor="event-rail"] │   │
│   │                       │    At 16:00 ET it does not exist yet.│                                                  │   │
│   │                       └──────────────────────────────────────┘                                                  │   │
│   └──────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                                                         │
│  ← → navigate · Space next · B blank · L laser · N notes window · Esc exit           Educational research tool          │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

- A **Story** is JSON: `scenes[] = { title, url (app state incl. asof/h/tab/sel), annotations[] (anchor id, text, placement, step), notes (markdown), durationHint, actions[] (e.g. "click #reveal at step 2") }`. Because scenes are URLs, the data is real and live. A **snapshot mode** (precomputed JSON, `DEP:A7` static demo build) makes the story work offline.
- Typography switches to the **presentation scale** (base 18 px, KPI 48, hero 64), contrast is raised one step (`text-secondary` → `text-primary`), and the time-machine frame thickens to 4 px.
- **Presenter notes window** (`/present/:id/notes`, synced over `BroadcastChannel`): the current and next scene, notes, a timer, and a scene-duration budget per the demo script (§12).
- Keys: `→`/`Space` go to the next annotation step, then the next scene. `←` goes back. `B` blanks the screen. `L` turns the cursor into a 24 px accent spotlight. `Esc` exits.
- **R1 "lite":** a hard-coded story JSON file, kiosk chrome, scene navigation, annotation callouts and the notes window. **R2:** story editor ("Add current view to story" from ⌘K), step actions, recorded-video export helper.

### UX-S13 — Data upload (`/data/upload`)

**Purpose:** let teammates bring their own data (including Bloomberg/Refinitiv exports) **with point-in-time timing declared and licences respected**. This is V-08 with integrity built in.

```
Upload data    ① File ─── ② Columns ─── ③ Timing ─── ④ Validate ─── ⑤ Licence & citation ─── Save
```

| Step | UI | Key rules |
|---|---|---|
| ① File | Drop zone (CSV, XLSX ≤ 20 MB) + "paste table". Detects delimiter, encoding and header row. | Parse XLSX **server-side** (Python), not with the npm `xlsx` package (see §11). |
| ② Columns | 20-row preview grid. Map *date column*, *value column(s)*, *entity* (optional), *unit*. Type detection with override. | Dates parsed unambiguously; ambiguous `03/04/2019` prompts DD/MM vs MM/DD. |
| ③ Timing | **"When could the public first know each value?"** Options: (a) a column with release timestamps; (b) fixed lag after period end (e.g. +45 calendar days); (c) market data, known at the close on the same day; (d) "I don't know" → conservative default lag (`DEP:A2`, e.g. +90 d) with a permanent ⚠ badge. Time zone selector (default ET for US data). "Values are revised later? Is there a vintage column?" | This step is what keeps uploads from poisoning backtests. Inline examples per data type. |
| ④ Validate | PIT validation report (see wireframe below). | Errors block. Warnings need acknowledgement. |
| ⑤ Licence & citation | Source type: *Public* · *Licensed (e.g. Bloomberg, Refinitiv)* · *Own collection*. Licensed → "Stored in `data/private/`, git-ignored, excluded from public demo builds; figures using it are flagged". Harvard fields: author/organisation, year, title, URL, accessed date. | Licensed data never leaves the machine (`DEP:A7`). |

```
④ Validate — "Bloomberg AAPL analyst EPS consensus (BEst)"           1,284 rows · 2005-01-31 → 2026-10-31
┌───────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ ✕ Errors (must fix)                                                                                            │
│   ✕ 12 rows have "available at" earlier than the period they describe (row 88, 91, …)  [Show rows]             │
│ ⚠ Warnings (acknowledge to continue)                                                                           │
│   ⚠ 3 gaps longer than 2 periods (2009-02 … 2009-05)                                     [Show]  [Acknowledge] │
│   ⚠ 1 value > 6 standard deviations from its rolling median (2013-04-30)                 [Show]  [Acknowledge] │
│   ⚠ No vintage information: later revisions would overwrite history (restatement risk)          [Acknowledge] │
│ ✓ Checks passed: no future dates · no duplicate (date, entity) · monotonic dates · single unit                 │
│ Preview chart: series with flagged points marked ○, gaps hatched                                                │
└───────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

- **R1:** CSV only (XLSX R2), steps ①–⑤, error and warning checks as listed, licence flag, private storage.

### UX-S14 — Settings (`/settings/:section`)

| Section | Contents |
|---|---|
| Profile | Name, initials, author colour (from Series-6 ring options). |
| Appearance | Theme (System / Dark / Light) · density · **up/down scheme** (*Blue–orange, colour-blind safe — default* / *Green–red, traditional*; both always with ▲▼ and signs) with live preview and CVD simulation · number format · date format (`2 Jan 2019` default, ISO option) · time zone display (ET primary, UK secondary) · reduced motion (System / Always / Never) · **single-key shortcuts on/off** (WCAG 2.1.4). |
| Defaults | Default horizon, baseline, protocol preset. Team-locked values are shown read-only with a "locked by PO" note. |
| Data sources | Table: source · status (✓ configured / ✕ missing) · last sync · "Sync now". API keys are **never displayed**, only "configured in `.env`". There is an SEC EDGAR **User-Agent** field with a generic placeholder (shared-context privacy rule) and a note that it is a local configuration item. |
| Team | Members, colours, roles (PO can lock defaults, freeze snapshots and use the holdout). |
| Storage | Cache size, clear cache, location of private data. |
| Licences & attributions | Third-party notices, including the **TradingView Lightweight Charts NOTICE and a link to tradingview.com** (licence requirement, §11), and font licences (OFL). |
| Shortcuts | Full keyboard map, with remapping in R2. |

### UX-S15 — About and methodology (`/about/:page`)

- **Methodology** (Markdown + KaTeX): PIT data model, analyzer contract, protocols, metrics (formulas for CRPS, log score, PIT, Brier decomposition), combination methods, bias catalogue with the platform control for each (`DEP:A2`). Each section ends with references.
- **Glossary**: every term has a definition, a formula where relevant, an example and a citation. The same entries power **GlossaryTerm** tooltips (UX-C21) across the app: dotted underline, hover or `?` for the definition, with "Read more" linking here.
- **Data & licences**, **Disclaimer** (full text, §9.4), **Credits** (team, authors of each analyzer, open-source libraries), **Changelog**, **How to cite Orchard** (CITATION.cff, R2).

### UX-S16 — Runs index (`/runs`)

- Table: status · analyzer chip · version · author · protocol · horizon skill [CI] · evidence · trials · duration · created. Filters: status, author, analyzer, protocol (standard/custom), evidence. Multi-select → "Compare (2–4)". Saved filters as URL params.

---

## 5. Key flows

Notation: `→` step · **[Lost?]** where users could get lost, and the design mitigation.

### UX-F01 — Submit idea → run → review → promote to committee

```
 Teammate                      Orchard                                   PO + the coding agent (R1)
 ────────                      ───────                                   ─────────────────────
 ⌘K "New idea card" ──────────▶ Idea card form + live checks
 fills data timing, criterion   │
 Submit ───────────────────────▶ status: Submitted, criterion frozen
                                 │  expressible in builder? ── yes ──▶ Builder → Save as analyzer ─┐
                                 │                            no                                   │
                                 ▼                                                                 │
                                "Copy brief" ───────────────────────────▶ implement plugin + PIT tests
                                                                          set status Ready + commit ┤
 "Run standard ▸" ◀──────────── status: Ready to run ◀────────────────────────────────────────────┘
        │
        ▼
 Run view: running → verdict → calibration → robustness
        │  iterate params? (trials counter ↑, warning > 20 trials)
        ▼
 "Promote to committee…" → gate checklist → predicted effect → confirm → member added (status: In committee)
```

| Step | What the user does | [Lost?] and mitigation |
|---|---|---|
| 1 | Opens a new idea card (⌘K, `N`, Idea lab button) | — |
| 2 | Fills the card | **"When public?" is unfamiliar** → select with common rules, inline examples, link to glossary `?available_at`. |
| 3 | Sets the success criterion | **Doesn't know what to write** → three presets ("beats RW+drift at 12M with CI excluding 0", "calibrated 80% intervals (coverage 75–85%)", "hit rate above base rate, p < 0.05") plus custom. |
| 4 | Submits | **Doesn't know what happens next** → confirmation panel: "Next: your idea will be implemented as an analyzer. You'll see it in *Ready to run*. Typical turnaround: same day (R1, via the dev chat)." |
| 5 | Waits for implementation (R1) | **No feedback loop** → status changes show in Home "Since your last visit" and on the card, with the commit link. |
| 6 | Runs the standard protocol (one click) | **Custom-protocol temptation** → custom runs are allowed but are marked "cannot be promoted". |
| 7 | Reads results | **Metric overload** → verdict sentence first, KPI tiles second, charts third. "How to read" popovers and glossary tooltips. |
| 8 | Iterates | **Overfitting by tinkering** → trials counter in the launcher review step and run header, deflated skill, a warning at > 20 trials. |
| 9 | Promotes | **Gate failure is confusing** → the checklist shows exactly which requirement failed and offers a one-click fix ("Run standard protocol"). |

### UX-F02 — Build the consensus (PO / integrator)

1. Committee › Members: include analyzers that passed the gates (and optionally human views).
2. Choose the method (default per A2). Watch the readout's "Δ vs current method".
3. Diagnostics: confirm the committee beats the baseline and the best single member is not dominating (weights-over-time chart).
4. Why tab: sanity-check that explanations make economic sense.
5. **Freeze snapshot** "Report consensus v1" (by about 28 Nov). Pin the fan, scenarios and attribution figures to the report.
6. Later changes produce a "live differs from frozen" banner in the report studio.

- **[Lost?] "Which consensus is in the report?"** → frozen snapshots have names. Report figures display their snapshot name. The committee header shows "Frozen: Report consensus v1".
- **[Lost?] Weights look arbitrary** → each member shows weight, skill and contribution, and the method tooltip gives the formula.

### UX-F03 — Produce report figures and references

1. On any chart: `R` (Add to report) → choose a section → toast "Added as Fig 5 (Future performance) · frozen to snap 9c41e2" with an *Open in studio* link.
2. Report studio: check the print preview → caption builder (auto slots + **write your interpretation**) → lint → Download PNG / SVG / Copy image.
3. References tab: Copy as Word → paste into the bibliography. Copy in-text citations as needed.
4. Tables tab: copy the scenario and ratio tables into Word.
5. Before submission: Evidence pack ZIP as a backup and reproducibility appendix.

- **[Lost?] Figure numbers drift when the report is reordered in Word** → the studio numbers figures in outline order and `captions.txt` lists the mapping. The recommendation is to reorder in the studio first.
- **[Lost?] SVG fonts look different in Word** → PNG is the default. The SVG export uses the font stack `Inter, Arial, Helvetica, sans-serif` and the "Arial" font preset guarantees a match.
- **[Lost?] Dark-mode screenshots end up in the report** → the toolbar's camera action always exports the *print* variant. A dark screenshot requires the explicit "Export UI theme (for slides)" option.

### UX-F04 — Replay a historic date (blind in R2)

1. Time machine → pick a moment (preset, date or `Surprise me` in R2).
2. Study what was knowable (filings, events, macro vintages).
3. Optionally enter your own P(up) and one-line reason.
4. **Reveal** → realised path over the fan → scorecard (PIT value, CRPS vs baseline, your Brier vs the committee).
5. "Add replay to report" or "Next moment".

- **[Lost?] Forgetting you are in the past** → amber frame + banner + amber pill. Every page title gets an "(as of 2 Jan 2019)" suffix.
- **[Lost?] Thinking hidden data is missing data** → the curtain says "Future not loaded (time machine)" while a data gap says "No data". They use different patterns: hatched curtain vs a dotted gap.

### UX-F05 — Demo walkthrough (presenter)

1. Present → choose `professor-5min` → presenter notes window on the laptop, main view on the projector.
2. Follow the scenes (§12). The fallback is snapshot mode (offline) if the engine is unreachable, with a recorded video as the final backup.

- **[Lost?] Engine not running in the room** → the story preflight checks the API and cached snapshots and shows "Ready (live)" or "Ready (snapshot)" before starting.

### UX-F06 — Use licensed data safely (Bloomberg CSV → analyzer → figure)

1. Upload → licence = *Licensed (Bloomberg)* → stored in `data/private/` → dataset badge `Licensed · local only`.
2. Analyzer uses it → its runs inherit the badge.
3. A report figure using it gets an automatic source line "…Bloomberg L.P. (2026)…" and a lint note "contains licensed data: fine for coursework, excluded from public builds".
4. The public demo build replaces such runs with "Hidden in public demo (licensed data)".

### UX-F07 — First run for a new teammate

1. Identity picker → a three-card welcome: "Orchard turns ideas into probabilistic forecasts and tests them on the past without peeking." · "Start with an idea card." · "Every number has a source: press `I`."
2. Default landing: Home, with a small dismissible "Getting started" checklist (create idea card · open a run · add a figure to the report). A full product tour is R2.

---

## 6. Visual design system

All colours below were **checked by script** for WCAG 2.x relative-luminance contrast. Colour-vision-deficiency (CVD) separation was screened with the Machado–Oliveira–Fernandes (2009) simulation matrices at full severity and CIE76 ΔE in CIELAB. ΔE76 is a coarse metric, so treat these numbers as a screening result, not proof. Validate the final build with a CVD simulator and real users where possible. The script lives in the session scratchpad. **Recommendation:** add a `tokens.test.ts` in R0 that recomputes contrast for every text/background token pair and fails CI below 4.5:1 (text) or 3:1 (non-text UI).

### 6.1 Colour tokens — UX-T01 (surfaces, text, borders)

| Token | Dark | Light | Use | Contrast check (fact, computed) |
|---|---|---|---|---|
| `bg-canvas` | `#0B0D10` | `#F6F7F9` | App background, status bar | — |
| `bg-surface` | `#111418` | `#FFFFFF` | Panels, top bar, tables | — |
| `bg-raised` | `#171B21` | `#FFFFFF` + shadow | Cards, popovers | — |
| `bg-overlay` | `#1D222A` | `#FFFFFF` + shadow-lg | Dialogs, command palette | — |
| `bg-sunken` | `#08090B` | `#EEF0F3` | Inputs, code, YAML editor | — |
| `bg-hover` | `#1C2129` | `#F0F2F5` | Row/item hover | — |
| `bg-selected` | `#232845` | `#E8E9FB` | Selected row, active nav | — |
| `text-primary` | `#E8EBF0` | `#0F1419` | Body, numbers, realised path ("ink") | 15.5:1 on surface (dark) · 18.5:1 (light) |
| `text-secondary` | `#A9B1BD` | `#46505D` | Labels, secondary values | 8.5:1 · 8.2:1 |
| `text-tertiary` | `#828C9B` | `#626B79` | Captions, source lines, axis ticks | 5.4:1 · 5.4:1 (≥ 4.7 on overlay/sunken) |
| `text-disabled` | `#5A6370` | `#9AA2AE` | Disabled only (exempt) | 3.0:1 · 2.6:1 |
| `border-subtle` | `#232931` | `#E9ECF0` | Panel separators | decorative |
| `border-default` | `#2E3540` | `#D9DDE3` | Cards, table rules | decorative |
| `border-input` | `#606B7A` | `#7E8794` | Input/checkbox boundaries (WCAG 1.4.11) | 3.4:1 · 3.6:1 |
| `accent` (iris) | `#8B93FF` | `#4A50D9` | Links, focus ring, primary buttons, **consensus series** | 6.8:1 · 6.1:1 |
| `accent-hover` | `#A3A9FF` | `#3B41C4` | Hover/pressed | — |
| `on-accent` | `#0B0D10` | `#FFFFFF` | Text on accent buttons | 7.2:1 · 6.1:1 |
| `accent-subtle` | `#1F2340` | `#ECEDFC` | Accent backgrounds (badges, diff cells) | — |
| `focus-ring` | `accent`, 2 px + 2 px offset | same | All focusable elements | 7.2:1 vs canvas · 5.7:1 |

### 6.2 Semantic and data colours — UX-T02

#### Up / down (market direction)

| Scheme | Up | Down | Separation (ΔE76) normal / deuteranopia / protanopia / tritanopia (computed) |
|---|---|---|---|
| **Blue–orange (default, colour-blind safe)** dark | `#5AA9F0` (7.4:1) | `#F28C3A` (7.6:1) | 107 / **106** / 95 / 96 |
| Blue–orange light | `#1764C0` (5.8:1) | `#B4500C` (5.1:1) | 110 / **113** / 100 / 90 |
| Green–red (traditional, opt-in) dark, typical values | `#3FB950` | `#F85149` | 119 / **8** / 32 / 126 |
| Green–red light, typical values | `#1A7F37` | `#CF222E` | 109 / **19** / 19 / 116 |

- **Finding:** with a typical dark-theme green/red pair, simulated deuteranopia leaves ΔE≈8, so the two are nearly the same colour. Bloomberg's own engineering blog reports the same problem: red/green look similar in hue under deuteranopia, and the Terminal offers alternative CVD colour schemes (`PDFU COLORS <GO>`) (Bloomberg, see §16). Orchard therefore defaults to blue/orange and offers green/red as an opt-in.
- **Redundancy rule (both schemes):** direction is never shown by colour alone. Always use the **sign** (+/−, U+2212), a **glyph** (▲ ▼, or ▬ for flat), and for candles **filled vs hollow** bodies (up = hollow, down = filled, TradingView-style).
- Up/down colours appear **only** on signed-number text, candles, return bars and contribution waterfalls. They are never used for analyzer series. Analyzer charts never contain candles.

#### Status

| Token | Dark | Light | Use |
|---|---|---|---|
| `success` | `#4CC38A` | `#16784F` | Validation passed, PIT test passed (always with ✓). **Not** used for "good forecast". |
| `warning` | `#F2B84B` | `#8F5B00` | Stale data, acknowledgeable warnings (with ⚠) |
| `danger` | `#F26464` | `#C42B2B` | Errors, blocked runs, destructive actions (with ✕). **Not** used for price down. |
| `info` | = `accent` | = `accent` | Informational notes |
| `tm` (time machine) | `#E8B04A` (10.0:1 on canvas) | `#8A5A00` (5.5:1) | As-of pill, frame, curtain edge, as-of line |
| `tm-bg` | `rgba(232,176,74,0.08)` | `rgba(138,90,0,0.06)` | Banner and top-bar tint in time-machine mode |

#### Series-6: categorical palette for analyzers (and authors)

Raw Okabe-Ito passes on dark backgrounds but **fails non-text contrast on white**: yellow `#F0E442` is 1.3:1 and orange `#E69F00` is 2.3:1 against `#FFFFFF` (computed). Orchard therefore uses an **Okabe-Ito-inspired set tuned per theme**. Lightness alternates between light and mid tones, because CVD separation comes mostly from lightness and the blue–yellow axis. Two colours are reserved: `accent` for the consensus and `text-primary` ("ink") for realised data. The palette was optimised with those two reserved colours included.

| Slot | Name | Dark | Light | Contrast dark / light |
|---|---|---|---|---|
| 1 | Sky | `#66C6F5` | `#1097BF` | 9.6 / 3.4 |
| 2 | Copper | `#DF971D` | `#8A4208` | 7.5 / 7.3 |
| 3 | Jade | `#3FA585` | `#17604A` | 6.1 / 7.5 |
| 4 | Rose | `#EE66B8` | `#BA1481` | 6.4 / 6.0 |
| 5 | Sand / Ochre | `#F2CF86` | `#A07C00` | 12.4 / 3.9 |
| 6 | Olive / Sage | `#A2A05A` | `#6E8F5E` | 6.8 / 3.6 |

| Palette (6 colours + 2 reserved) | min ΔE normal | deut. | prot. | trit. | min contrast vs bg |
|---|---|---|---|---|---|
| Orchard Series-6 dark | 23.9 | 18.1 | 18.9 | 17.8 | 6.1:1 |
| Orchard Series-6 light | 26.4 | 18.5 | 24.7 | 22.2 | 3.4:1 |
| Okabe-Ito (6, no black) on dark | 33.4 | 16.9 | 20.7 | 16.2 | 4.8:1 |
| Okabe-Ito on white | 33.4 | 16.9 | 20.7 | 16.2 | **1.3:1** ✕ |

**Assignment rules**

1. An analyzer's colour is **stable app-wide**: `slot = registry order` (first six analyzers added to the committee get slots 1–6). Assignments are stored, so colours never reshuffle when filters change.
2. **At most six coloured series per chart.** Further series render as `text-tertiary` context lines that highlight on hover. The legend says "+3 more (grey)".
3. Charts that need more than six identities (the leaderboard, for instance) use tables with chips, not colour.
4. **Redundant encoding:** direct labels at line ends, plus dash patterns for slots beyond the most-used three when printing in grayscale (solid · dash 6-3 · dot 2-2 · dash-dot).
5. **Authors** get a ring colour on their avatar (from the same palette, independent of analyzer slots). In charts, author identity is shown by label, never by colour, to avoid two competing colour codes.

#### Reserved data colours

| Role | Dark | Light | Encoding |
|---|---|---|---|
| Realised / actual ("ink") | `#E8EBF0` | `#0F1419` | Solid 1.5 px line, always topmost |
| Consensus median | `accent #8B93FF` | `#4A50D9` | Solid 2 px |
| Fan 50% band | `#3F4470` (iris 38%) | `#BEC0F1` (36%) | Nested area |
| Fan 80% band | `#2E324F` (24%) | `#D7D8F7` (22%) | Nested area |
| Fan 95% band | `#222638` (14%) | `#E9EAFA` (12%) | Nested area |
| Print fan bands (white bg) | — | `#B3B6EF` / `#D0D2F5` / `#E6E6FA` (L* 76 / 85 / 92) | Steps of 7–9 L* keep the bands distinguishable in grayscale print |
| Baseline ghost | `#8B95A5` dashed 4-3 | `#7A8494` dashed 4-3 | Always labelled "RW+drift" |
| Holdout region | hatch 45°, 1 px `#46505E` every 6 px | hatch `#C4CAD3` | Label "Holdout · locked" |
| Insufficient-data region | hatch 135°, `text-disabled` | same | Label "insufficient data" |
| Chart grid | `#1A1F26` | `#EEF0F3` | Horizontal only |
| Chart axis line | `#2E3540` | `#C4CAD3` | x-axis only |

#### Scales

- **Sequential** (heatmaps of magnitude, density): iris ramp. Dark `#23273B → #3C4069 → #545A97 → #6C73C5 → #8B93FF`. Light `#E4E5F9 → #C0C2F2 → #9B9FEA → #777CE2 → #4A50D9`.
- **Diverging** (skill around zero, correlations): down-colour ↔ neutral ↔ up-colour, so the semantics match "worse ↔ better". Dark `#F28C3A #AE6C38 #6A4B35 #262B33 #375572 #497FB1 #5AA9F0`. Light `#B4500C #C9865A #DDBDA7 #F2F3F5 #A9C3E3 #6094D2 #1764C0`. Cells always carry numeric labels.
- Implementation: derive intermediate steps with CSS `color-mix(in oklch, …)`, which is supported in modern browsers and native in Tailwind 4's OKLCH palette. Hex anchors above are the source of truth.

#### Evidence grades (UX-C11): monochrome Harvey balls

Grades follow **A2 QNT-175**: one badge per analyzer × horizon, letters A–D. The thresholds there are marked `ASSUMPTION` until A2/R2 fix them. The UI shows glyph, letter and word, e.g. `◔ C · Weak`. Wireframes in §4 abbreviate this to the word.

| A2 grade | UI label | Glyph | A2 rule (summary, see QNT-175) |
|---|---|---|---|
| A | Strong | ● | n_eff ≥ 100; CRPSS 90% CI excludes 0; HLN-DM p < 0.05; BH q < 0.10; holdout CRPSS > 0 if revealed; 80% coverage within ±10 pp |
| B | Moderate | ◐ | n_eff ≥ 40; HLN-DM p < 0.10; holdout not significantly negative; coverage within ±10 pp |
| C | Weak | ◔ | n_eff ≥ 20; CRPSS point estimate > 0; coverage within ±15 pp |
| D | None / insufficient | ○ | Anything else |
| (flag) | Worse than baseline | ⊘ | **UX addition:** shown next to D when the CRPSS CI lies entirely below 0, so "no evidence" and "evidence of harm" are not conflated |

A2 expects most analyzers to grade C or D at 252 sessions. The design treats that as the normal case: grade C/D badges are neutral, never alarming, and the grade popover explains it in one sentence (as A2 requires). The glyphs are rendered in `text-secondary`. **Evidence is never colour-coded green or red**, so it cannot be read as "stock goes up".

### 6.3 Typography — UX-T03

| Role | Family | Licence | Notes |
|---|---|---|---|
| UI and data | **Inter** (variable), self-hosted via `@fontsource-variable/inter` | OFL-1.1 | Turn on `font-variant-numeric: tabular-nums` (Inter `tnum`) wherever numbers align, and `slashed-zero` in tables and IDs (Inter supports `zero`, rsms.me) |
| Code, YAML, IDs, hashes, logs | **JetBrains Mono** (variable) via `@fontsource-variable/jetbrains-mono` | OFL-1.1 | 12–13 px; ligatures **off** in YAML and logs |
| Report export (optional serif) | **Source Serif 4** (variable) via `@fontsource-variable/source-serif-4` | OFL-1.1 | Only for exported figures when the report body is serif |
| Export fallback | Arial / Helvetica | system | "Arial" preset for maximum compatibility of SVG in Word |

Fonts are **self-hosted** (no Google Fonts requests): this works offline for demos and sends no third-party requests.

**Type scale** (px size / line height · weight):

| Token | Size / LH | Weight | Use |
|---|---|---|---|
| `text-2xs` | 11 / 14 | 400–500 | Axis ticks, status bar, source lines, overline labels (500, uppercase, +0.04em) |
| `text-xs` | 12 / 16 | 400 | Table cells (compact), captions, tooltips |
| `text-sm` | 13 / 20 | 400 | **Default UI body**, table cells (default) |
| `text-base` | 14 / 22 | 400 | Forms, prose in panels, comfortable density |
| `text-md` | 16 / 24 | 600 | Panel titles |
| `text-lg` | 20 / 28 | 600 | Page titles (−0.01em) |
| `text-xl` | 24 / 32 | 600 | KPI values in tiles |
| `text-2xl` | 32 / 40 | 600 | Readout numbers (P(up) on Home: 48/52 via `text-3xl`) |
| `text-3xl` | 48 / 52 | 600 | Hero probability; presentation KPI |
| `text-4xl` | 64 / 68 | 600 | Presentation hero only |

**Number and date formatting rules (UX-T04)**

| Kind | Rule | Example |
|---|---|---|
| Price | 2 dp, currency symbol, thousands separators | `$228.02`, `$1,234.50` |
| Large money | 1 dp + `bn` / `tn` (UK style) | `$394.3bn`, `$3.41tn` |
| Returns / changes | 1 dp, explicit sign, U+2212 minus | `+7.9%`, `−13.0%` |
| Probabilities | Integer %, `<1%` / `>99%`; interval with en dash | `61% (54–68%)` |
| Percentage-point changes | `pp` | `+3 pp` |
| Rates changes | basis points | `−25 bp` |
| Multiples | 1 dp + `×` | `34.1×` |
| Skill scores | 1 dp % with CI in brackets and level stated | `+4.1% [−0.6, +8.8] 90% CI` |
| p-values | 2 significant figures; floor `< 0.001` | `p = 0.041` |
| Counts | thousands separators; `n` and `n_eff` labelled | `n = 336 · n_eff ≈ 28` |
| Dates (UI) | `D Mon YYYY` (unambiguous for a UK/international team) | `2 Jan 2019` |
| Dates (data, URLs, exports, tables meant for Excel) | ISO 8601 | `2019-01-02` |
| Times | 24-hour + zone, always | `16:00 ET` (tooltip `21:00 UK`) |
| Fiscal periods | Apple fiscal labels with calendar tooltip | `Q1 FY19` (tooltip: "Oct–Dec 2018") |

### 6.4 Spacing, grid and layout — UX-T05

- **4 px base scale:** `0, 2, 4, 6, 8, 12, 16, 20, 24, 32, 40, 48, 64`.
- **Grid:** 12 columns, 24 px gutters (12 px in compact density), 24 px page padding. Panels snap to columns. Common splits are 8+4, 6+6 and 4+4+4.
- **Breakpoints:** `xl ≥ 1440` (reference), `lg 1280–1439` (rail collapsed by default, right drawer overlays), `md 1024–1279` (stack the 4-col side panels below), `< 1024` → read-only responsive layout with the notice "Orchard is designed for desktop; some tools are hidden" (tablet design is R2).
- **Panel anatomy:** header 40 px (title `text-md`, actions on the right as 28 px icon buttons), body padding 16 px, optional footer (source line) 32 px.
- **Tiled vs card layout:** in *compact* density, panels tile with shared 1 px borders and no gaps (terminal feel). In *default* and *comfortable*, panels are cards with 12–16 px gaps.

### 6.5 Density modes — UX-T06

| Token | Compact | Default | Comfortable | Presentation |
|---|---|---|---|---|
| Base font | 12 / 16 | 13 / 20 | 14 / 22 | 18 / 26 |
| Table row height | 28 | 32 | 40 | 48 |
| Control height (button/input) | 28 | 32 | 36 | 44 |
| Panel padding | 12 | 16 | 20 | 24 |
| Grid gutter | 12 (tiled: 0 + 1 px border) | 16 | 24 | 32 |
| Chart tick font | 10 | 11 | 11 | 14 |

Implementation: a `data-density` attribute on `<html>` switches CSS variables. Default density is **Default**. Presentation density is applied automatically in `/present`.

### 6.6 Radius, borders and elevation — UX-T07

| Token | Value | Use |
|---|---|---|
| `radius-xs` | 3 px | Badges, chips, KBD hints |
| `radius-sm` | 5 px | Buttons, inputs, segmented controls |
| `radius-md` | 8 px | Cards, panels |
| `radius-lg` | 12 px | Dialogs, popovers, command palette |
| `radius-full` | 9999 px | Avatars, pills (as-of control) |
| Charts | 0 | Plot areas are square-cornered |

| Elevation | Dark | Light |
|---|---|---|
| e0 canvas | `bg-canvas` | `bg-canvas` |
| e1 surface | `bg-surface` + 1 px `border-subtle`, no shadow | `#FFF` + 1 px `border-default` |
| e2 raised | `bg-raised` + `border-default` + `0 1px 2px rgba(0,0,0,.4)` | `0 1px 2px rgba(16,24,40,.06), 0 1px 3px rgba(16,24,40,.10)` |
| e3 popover | `bg-overlay` + `0 8px 24px rgba(0,0,0,.5)` | `0 8px 24px rgba(16,24,40,.12)` |
| e4 modal | `bg-overlay` + `0 16px 48px rgba(0,0,0,.6)` + scrim `rgba(0,0,0,.6)` | `0 16px 48px rgba(16,24,40,.16)` + scrim `rgba(15,20,25,.4)` |

In dark mode elevation is mostly carried by **lighter surfaces**, not shadows, which read poorly on near-black.

### 6.7 Iconography — UX-T08

- **Lucide** icons (`lucide-react`, ISC): 16 px in UI, 20 px in the rail, 1.5 px stroke, `currentColor`.
- **Domain glyph set** (custom SVGs, 16 px grid, same stroke):

| Concept | Glyph | Notes |
|---|---|---|
| As-of / time machine | clock with a counter-clockwise arrow | Amber when historical |
| Provenance | link-in-seal | Appears on hover next to values |
| PIT-verified | shield with check | Analyzer and run headers |
| Holdout | padlock over hatch | Status bar, run header |
| Evidence | Harvey balls ● ◐ ◔ ○ ⊘ | Monochrome |
| Event categories | ● earnings · ▲ product · ◆ macro · ■ legal/regulatory · ┼ capital action (split, dividend, buyback) · ★ leadership · ✚ supply chain | **Shape-distinct** so they work without colour; category colours appear only in the Events screen legend |
| Direction | ▲ ▼ ▬ | Always paired with a sign |
| Human view | person-with-quote | Judgemental committee members |
| Licensed data | key | Dataset, run and figure badges |

### 6.8 Motion — UX-T09

| Token | Duration | Easing | Use |
|---|---|---|---|
| `motion-fast` | 120 ms | `cubic-bezier(0.2, 0, 0, 1)` | Hover, press, toggles |
| `motion-base` | 180 ms | same | Popovers, tooltips, tab content fade |
| `motion-slow` | 240 ms | same; exit `cubic-bezier(0.4, 0, 1, 1)` | Drawers, the time-machine curtain, panel expand |
| `motion-deliberate` | 600–1200 ms | `cubic-bezier(0.3, 0, 0, 1)` | **Only:** realised-path reveal (replay), presentation scene transitions, presentation hero count-up |

**Rules**

- Never animate data values in normal mode. No ticking counters (they misstate precision and distract). Charts fade in once (150 ms) and do not "grow" bars.
- Animate `opacity` and `transform` only.
- The curtain animation (as-of change) moves a mask, not the data, so readers see time move.
- **Reduced motion** (`prefers-reduced-motion: reduce` or the setting): all durations become 0, except opacity fades ≤ 120 ms. The reveal draws instantly. Skeleton shimmer becomes static.

### 6.9 Token implementation sketch (Tailwind 4 `@theme`, illustrative)

```css
/* tokens.css — illustrative, not final code */
@theme {
  --font-sans: "Inter Variable", Inter, system-ui, sans-serif;
  --font-mono: "JetBrains Mono Variable", ui-monospace, monospace;
  --radius-sm: 5px; --radius-md: 8px; --radius-lg: 12px;
}
:root[data-theme="dark"] {
  --bg-canvas: #0B0D10; --bg-surface: #111418; --bg-raised: #171B21; --bg-overlay: #1D222A;
  --text-primary: #E8EBF0; --text-secondary: #A9B1BD; --text-tertiary: #828C9B;
  --accent: #8B93FF; --up: #5AA9F0; --down: #F28C3A; --tm: #E8B04A;
  --series-1: #66C6F5; --series-2: #DF971D; --series-3: #3FA585;
  --series-4: #EE66B8; --series-5: #F2CF86; --series-6: #A2A05A;
}
:root[data-theme="light"] { /* … light values from §6.1–6.2 … */ }
:root[data-updown="traditional"][data-theme="dark"] { --up: #3FB950; --down: #F85149; }
.num { font-variant-numeric: tabular-nums slashed-zero; }
```

ECharts and Lightweight Charts read the **same CSS variables** at init and on theme change: ECharts 6 supports dynamic theme registration and switching without re-initialising, and Lightweight Charts uses `applyOptions`. This keeps one source of truth.

---

## 7. Chart specification

### 7.1 Chart grammar (applies to every chart) — UX-CH00

**Anatomy (`ChartFrame`, UX-C15):**

```
┌ Title (text-md 600)                                      [⊞ table V] [⤓ export E] [+ report R] [⛶ F] [⟲ 0] ┐
│ Subtitle: measure · unit · horizon chip · as-of (text-xs tertiary)                                          │
│ ┌ readout bar (time charts) ───────────────────────────────────────────────┐                                │
│ │ plot area                                                     direct labels at line ends →  Momentum 12-1 │
│ └──────────────────────────────────────────────────────────────────────────┘                                │
│ Legend (only if direct labels collide)                                                                       │
│ Source: … · Data as of … (text-2xs tertiary)                                                                │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

- The toolbar is visible on hover and focus, with 28 × 28 px targets (WCAG 2.5.8).
- **Axes:** price charts put the y-axis on the **right** (finance convention). Analytical charts put it on the left. Draw 4–6 ticks, horizontal gridlines only, and year separators on long time axes. Units appear in the axis title or subtitle, not on every tick.
- **Log scale** defaults on for price ranges over 10 years, with a visible `Log` chip.
- **Direct labelling** beats legends for ≤ 6 series. Clicking a legend item toggles the series; `Alt`+click isolates it.
- **Crosshair:** a 1 px dashed `text-secondary` line. Time-series charts show values in a **readout bar** (top-left) rather than a floating tooltip, so data is never hidden. Analytical charts use a floating tooltip (`bg-overlay`, e3, 12 px, tabular).
- **Linked cursor:** all time-axis charts on a page share one cursor time through a small store (the "cursor bus", zustand). Lightweight Charts uses `subscribeCrosshairMove` / `setCrosshairPosition`. ECharts uses `dispatchAction({type:'showTip'})` or `echarts.connect` for ECharts-only groups.
- **View window:** range presets, a navigator brush, and `Shift`+drag in the plot to zoom. Double-click resets. The window syncs across a page's time charts and is stored in `from/to`.
- **Annotations:** the as-of line (amber dashed, label at the top), forecast origin (ink dot labelled "origin"), the holdout region (hatched, labelled) and reference lines (dashed, labelled at the right). There are at most five text annotations per chart, with leader lines.
- **Uncertainty:** bands and whiskers always state their level ("90% CI", "80% interval"). No unlabeled error bars.
- **Performance:** with ECharts use `sampling: 'lttb'` above 2k points, `large: true` for scatters above 5k, and canvas renderer on screen with SVG for export. Lightweight Charts handles roughly 11,600 daily AAPL bars (Dec 1980 → 2026) natively.
- **Every chart is defined by a `FigureSpec`** (`{chartType, dataQuery (incl. asof, snapshot), encodings, annotations, title, sourceRefs}`). The same spec renders the UI variant, the "view as table" variant and the **print variant**. This one abstraction makes export, report freezing and presentation stories cheap to build.

### 7.2 Chart catalogue

Library key: **LWC** = Lightweight Charts, **EC** = ECharts.

| ID | Chart | Purpose | Encoding | Interactions | Lib | Print variant |
|---|---|---|---|---|---|---|
| **UX-CH01** | Price & events | Price history with events, overlays, volume | Line (default) / candles (up hollow, down filled) / area; volume pane histogram in `text-tertiary`; event rail pane with shape glyphs; SMA overlays in Series slots 5–6; as-of curtain | Readout bar, crosshair, wheel/drag pan, navigator brush, range presets, log/lin, event select (click/←→), travel buttons | LWC 5 (panes, `createSeriesMarkers`) | Re-rendered in **EC** (SVG): line + ≤ 5 labelled key events with leader lines; no volume unless asked |
| **UX-CH02** | Fan chart (consensus / analyzer) | The 12M predictive distribution over time | History (ink); nested 95/80/50% bands (iris tints); median (accent, 2 px); spot dot at origin; member rug ticks at horizon; optional realised path (ink) in replay/backtest | Hover readout (date, median, all bounds, price ↔ return toggle); band labels at right; log/lin; toggle member medians | EC (stacked `line` areas or custom series band) | White bg; print band tints `#B3B6EF/#D0D2F5/#E6E6FA`; band labels in-plot; median labelled; caption slot "Shaded bands show…" auto |
| **UX-CH03** | Predictive distribution at horizon | Shape of the 12M outcome; threshold probabilities | PDF from quantiles (monotone spline) or CDF; shaded scenario regions; vertical spot line; threshold handle | Drag handle **or** type a value (2.5.7); PDF/CDF toggle; price/return axis | EC | Scenario shading in grayscale-safe tints + labels |
| **UX-CH04** | Forecast vs realised ribbon | Backtest track record per origin | Per origin: 10–90% bar (light), 25–75% (darker), median tick; realised ● inside 80% / ○ outside; baseline interval dashed outline; holdout hatched | Hover origin → values; click → CH03 for that origin; x as target date ↔ origin date toggle | EC (custom series or candlestick-style bars) | Thin bars, monochrome + ink dots; coverage stated in caption |
| **UX-CH05** | Reliability diagram | Calibration of P(up)/exceedance probabilities | CORP isotonic step curve (accent) + 90% consistency band around the diagonal; diagonal reference; inset histogram of forecast probabilities (sharpness); Brier + REL/RES/UNC in corner | Hover region → n; toggle CORP ↔ 10 equal bins; multi-run overlay (Compare) | EC (band computed by engine, `DEP:A2`) | Square aspect (77 × 77 mm half width); method cited automatically |
| **UX-CH06** | PIT histogram | Calibration of full distributions | 10 bins (≥ 100 obs) or 5; uniform line at 1.0; 95% band under uniformity; "how to read" glyph legend (U = overconfident, ∩ = underconfident, slope = bias) | Hover bin → count, expected | EC | Note in caption: "band assumes independence; overlapping 12M windows make it indicative" |
| **UX-CH07** | Interval coverage | Are 50/80/90/95% intervals right-sized? | Nominal (x) vs empirical (y) points + binomial CI whiskers; diagonal | Hover | EC | Same |
| **UX-CH08** | Skill by horizon | Where in time an idea works | Categorical x (5d…252d), point + CI whisker, zero line; dodge ≤ 4 analyzers; n_eff labels under ticks | Hover; click horizon → sets global `h` | EC | Same, monochrome-safe markers (●■▲◆) |
| **UX-CH09** | Forest plot | Metrics/baselines/committee comparisons | Rows = items; point + CI; vertical zero; filled point = CI excludes 0, hollow = includes | Hover | EC | Same |
| **UX-CH10** | Rolling skill | Stability of skill over time | Rolling 36M skill line + CI band; zero line; regime shading optional; holdout hatch | Linked cursor; brush | EC | Same |
| **UX-CH11** | Parameter-sensitivity heatmap | Robust plateau vs fragile spike | Grid param₁ × param₂; diverging skill colours with numeric labels; chosen config outlined (2 px ink) | Hover; click cell → run variant | EC heatmap | Diverging ramp + labels (grayscale-safe via labels) |
| **UX-CH12** | Weights over time | How the committee's trust shifted | 100% stacked area by analyzer colour; ordered by mean weight | Hover → weights list; toggle stacked ↔ lines | EC | ≤ 6 series + "others" grey |
| **UX-CH13** | Attribution waterfall | "Why 61%?" | Baseline bar → contributions (up/down tokens + ▲▼ + signed labels) → total (accent) | Hover → formula detail; click → member card | EC (bar with invisible base stack) | Same with grayscale fills + glyphs |
| **UX-CH14** | Scenario bar | Bear/base/bull probabilities | Single 100% horizontal bar with segment labels (probability + range) | Hover | EC | Same |
| **UX-CH15** | Event-study CAR | Average price reaction to an event class | Mean CAR line + 95% CI band; individual events at 15% opacity; day 0 marker; AR bars mini-pane | Hover event line → highlight + title; legend splits (surprise sign) | EC | Individual lines off by default |
| **UX-CH16** | Event swimlanes | Overview of the event corpus | Lanes by category, shape glyphs, size = importance; context price sparkline | Brush zoom; click → drawer; linked to list | EC (scatter on category axis) | Rarely exported; allowed |
| **UX-CH17** | Ratio vs own history | Valuation in historical context | Ratio line; 10–90th percentile band of trailing 10y; filing-date ticks; ◆ restated points | Hover → value, percentile, filing | EC | Same |
| **UX-CH18** | Peer valuation scatter | AAPL vs peers | x growth, y multiple; AAPL accent + label; peers neutral + labels; optional OLS line + CI | Hover; toggle metrics | EC | Same |
| **UX-CH19** | Rolling beta / correlation | Macro & FX sensitivity | Line + 90% CI band; reference lines 0 and 1 | Linked cursor | EC | Same |
| **UX-CH20** | Data coverage map | What data exists when, with lags | Gantt bars per series; publication lag lighter extension; gaps hatched; vintage markers | Hover; click → series | EC (custom/bar) | Appendix use |
| **UX-CH21** | Equity curve & drawdown | Optional strategy translation | Log equity (strategy vs buy-and-hold) + underwater area pane; cost slider | Linked cursor; slider (with numeric input) | EC | Caption auto-includes "illustrative translation, not a recommendation" |
| **UX-CH22** | Sparkline | Trend in a table cell | 80 × 20, line, last-value dot, no axes | Hover tooltip | Inline SVG (d3-shape) | n/a |
| **UX-CH23** | Error-correlation matrix | Committee diversity | Heatmap, sequential (absolute ρ) with signed labels; clustered order | Hover | EC | Same |
| **UX-CH24** | Probability bar | Compact P(up) with CI | 0–100% track, point, CI whisker, 50% tick | Hover | Inline SVG | n/a |

**What no single library covers (fact + recommendation):**

- **LWC** is canvas-only. It has no SVG export (only `takeScreenshot()` to canvas/PNG), it is time-axis only (no reliability diagrams, histograms or heatmaps), and the TradingView docs say it is not designed to run server-side. It provides the "trading terminal" feel: kinetic pan/zoom, price-scale behaviour, panes (v5) and markers.
- **EC** covers every analytical chart, renders to **SVG** in the browser and **server-side** (`renderToSVGString`, since 5.3), has built-in **ARIA descriptions and decal patterns**, and supports dynamic theme switching (v6). Its financial pan/zoom is serviceable but feels less fluid than LWC.
- Fan bands, the CORP consistency band, and forecast-ribbon bars need **ECharts custom series** or stacked-area tricks. The band *numbers* (quantiles, consistency bands) must come from the engine (`DEP:A2/A7`), not the front-end.
- **Recommendation:** LWC for CH01 only (Data explorer, replay, the Home mini price). EC for everything else **and for every export**, including CH01's print variant. Fallback if R1 time is short: EC-only (candlestick + `dataZoom`). It loses some feel but needs no second theming or cursor-sync path.

### 7.3 Report-quality export variant — UX-CH-PRINT

| Property | Spec |
|---|---|
| Renderer | ECharts `renderer: 'svg'` with the **print theme**, in an off-screen container. PNG = SVG rasterised on canvas at **300 dpi** (scale factor 300/96 = 3.125). SVG = direct. PDF (R2) = `svg2pdf.js` + `jsPDF` with embedded Inter/Source Serif TTF for real vector text. |
| Page geometry | A4 with 2.54 cm margins → **159.2 mm text width**. Presets: **Full** 159 × 95 mm (aspect ~1.67), **Half** 77 × 77 mm (two-up or square diagnostics), **Slide** 1920 × 1080 px (UI-like, light theme). |
| Colours | White `#FFFFFF` background, ink `#1A1A1A`, grid `#E6E6E6`, axis `#B0B0B0`, Series-6 *light*, fan print tints, holdout hatch `#C4CAD3`, up/down light tokens + glyphs. |
| Fonts (at print size) | Tick labels **7.5–8 pt**, axis titles **8.5–9 pt**, direct labels 8 pt, annotations 7.5 pt, source line **7 pt**. Font presets: Inter (default) · Arial · Source Serif 4. |
| In-image title | **Off** by default: academic figures put the title in the caption. On for the Slide preset. |
| Figure number + caption | Off in the image by default (Word captions are better). `Copy caption` gives: `Figure {n}: {Title}. {What is shown}. {Uncertainty encoding}. {Period/as-of}. {Your interpretation}.` |
| Source line | **On** in the image by default: `Source: Authors' calculations in Orchard ({run/committee snapshot}) using data from {short citations}.` The short citations match the References tab entries exactly, so in-text and bibliography stay consistent. |
| Notes line | Optional: `Notes: {method notes, e.g. "90% CIs from stationary block bootstrap, 1,000 resamples; n_eff ≈ 28"}`. |
| Numbering | Figures and tables numbered separately, in outline order. Renumbered on reorder. Exported file names carry the number. |
| Freezing | Every pinned figure stores `{FigureSpec, snapshot hash, run/committee snapshot ID, rendered-at}`. Refreshing is explicit and shows a before/after. |
| Alt text | Exported alongside the figure (`captions.txt`) from the auto summary (§10), for accessible PDFs. |

**Figure lint rules (UX-LINT; warnings, not blockers):**

| ID | Rule | Check |
|---|---|---|
| UX-LINT-01 | Axis titles with units | Spec has `xTitle`/`yTitle` with unit, or a time axis |
| UX-LINT-02 | Source line present | Non-empty `sourceRefs`; every ref resolves to a Reference |
| UX-LINT-03 | Minimum text size | All text ≥ 7 pt at chosen print size |
| UX-LINT-04 | ≤ 6 coloured series | Count of non-grey series |
| UX-LINT-05 | No dual y-axes | Spec has ≤ 1 y-axis per grid |
| UX-LINT-06 | Uncertainty described | If bands/CIs exist, caption has the uncertainty slot |
| UX-LINT-07 | CVD distinguishable (R2) | Min ΔE ≥ 15 between series colours under deut/prot simulation |
| UX-LINT-08 | Grayscale distinguishable (R2) | Min ΔL* ≥ 7 between adjacent filled regions |
| UX-LINT-09 | Interpretation written | "Your interpretation" slot non-empty (the student's job) |
| UX-LINT-10 | Licensed data flagged | If any dataset is `Licensed`: note "fine for coursework; excluded from public builds" |

---

## 8. Component catalogue

Base primitives (Button, Input, Select, Dialog, Popover, Tooltip, Tabs, Table shell, Toast, Sheet/Drawer, Resizable panels, Command) come from **shadcn/ui** (§11) and are themed with the tokens above. The components below are Orchard-specific. Sizes assume Default density.

| ID | Component | Anatomy / spec | States & variants | A11y notes |
|---|---|---|---|---|
| UX-C01 | **TickerContext** | Symbol (600) + name (tertiary) + "Close {date}" + price (tabular) + change (sign, ▲▼, up/down colour) | disabled dropdown (R1); historical (as-of) | Button with `aria-haspopup`; change read as "up 0.84 percent" |
| UX-C02 | **AsOfControl** | 32 px pill (clock icon + label); popover 400 px (§3.5) | latest / historical (amber) / loading | `aria-live` announcement on change; `T` shortcut; date input with format hint |
| UX-C03 | **HorizonSelector** | Segmented 5 items × 40 px | selected / hover / disabled (if horizon not computed) | `role="radiogroup"`; `1–5` shortcuts |
| UX-C04 | **CommandPalette** | cmdk dialog 640 px; groups; row 36 px (icon, label, meta, shortcut) | empty / recent / results / no results | Focus trap; listbox semantics from cmdk |
| UX-C05 | **ProvenanceChip + Drawer** | Chip: 16 px seal icon on hover/focus beside a value. Drawer 420 px: lineage list (dataset → series → observation), key-value grid (source, series ID, period end, available at, vintage, ingested at, licence, URL), citation block + copy, "Used in" list | unsourced (dev: dashed underline); licensed (key badge); derived (run link) | `I` opens for focused value; drawer `role="dialog"` |
| UX-C06 | **AuthorAvatar / IdentityPicker** | 24 px initials circle with 2 px author-colour ring; picker grid of members | current user (accent outline) | Name in `aria-label`; colour never sole identifier |
| UX-C07 | **JobTray** | Status-bar item + 360 px panel; rows: analyzer chip, stage, progress (4 px bar), ETA, cancel | queued / running / completed / stopped / cancelled | Completion announced via polite live region |
| UX-C08 | **StatusBar** | 28 px; items separated by `·` | time-machine variant (amber snapshot label) | `role="contentinfo"` |
| UX-C09 | **AnalyzerChip** | 8 px colour square + name (+ version, optional) + author initials | default / compact (dot only in dense tables) / muted (not in committee) | Colour square is `aria-hidden`; full name always present |
| UX-C10 | **ProbabilityReadout** | Large % (text-3xl) + event definition (tertiary, 1 line) + CH24 bar + interval text | with/without interval; historical; insufficient (greyed + note) | Read as "61 percent, interval 54 to 68 percent, probability that AAPL's 12-month total return is positive" |
| UX-C11 | **EvidenceBadge** | Harvey ball + label + ⓘ popover listing the rule and inputs that set the grade | Strong / Moderate / Weak / Insufficient / Negative | Text label always present |
| UX-C12 | **MetricCI** | Inline 120 × 16 px: zero tick, CI line, point (filled if CI excludes 0, hollow otherwise); value + bracket text beside | horizontal / vertical; with baseline tick | Text equivalent always visible |
| UX-C13 | **KpiTile** | Title (overline), value (text-xl), CI/base-rate line, provenance chip, optional sparkline | provisional (tertiary + "provisional" tag), insufficient (hatch) | Grouped in `role="group"` with heading |
| UX-C14 | **DataTable** | TanStack Table: sticky header & first column, right-aligned tabular numbers, sortable headers (▲▼ + `aria-sort`), column visibility, virtualised > 200 rows, row actions menu, copy-as (Word/TSV/MD/LaTeX) | compact/default/comfortable; empty; loading skeleton rows; error row | Native `<table>` semantics; keyboard row navigation `J/K` |
| UX-C15 | **ChartFrame** | Title, subtitle, toolbar (V/E/R/F/0), plot slot, legend slot, source line; "view as table" swaps plot for DataTable | loading (axis skeleton), empty, error, insufficient-data, time-machine (curtain) | `role="figure"` + `aria-labelledby` title + `aria-describedby` auto summary (§10) |
| UX-C16 | **RunStatus** | Glyph + label: ● Completed · ◔ Running n% · ○ Queued · ✕ Stopped · ⊘ Blocked (PIT) | — | Text label always |
| UX-C17 | **FreshnessIndicator** | Dot glyph + dataset + last available timestamp + expected lag | fresh ● / expected lag ◐ / stale ▲ (amber) / private ○ | Tooltip states rule ("prices stale after 1 trading day") |
| UX-C18 | **ProgressPipeline** | Horizontal stages with ✓ ◔ ○ and labels; current stage detail line; ETA; cancel | running / failed at stage (✕ + message) / done | `role="progressbar"` on current stage with `aria-valuenow` |
| UX-C19 | **ExplanationCard** | Header (analyzer chip, author, lean ▲▼▬, contribution), 2–3 templated sentences, track record line, links | expanded / collapsed | Heading level 3 per card |
| UX-C20 | **GateChecklist** | List of requirements with ✓/✕, reason text, fix action per failing item; footer predicted effect | all pass (confirm enabled) / some fail | Confirm disabled with explanation, not hidden |
| UX-C21 | **GlossaryTerm** | Dotted underline; popover 320 px: definition, formula (KaTeX), "Read more" | — | Popover on focus as well as hover; `Esc` dismisses (WCAG 1.4.13) |
| UX-C22 | **CaptionBuilder** | Four slots with auto/edited state; live text; copy | slot missing (lint) | Labels per slot |
| UX-C23 | **CitationItem** | Formatted Harvard reference (italics where required), "used by" chips, copy in-text / full | missing fields warning | Copy buttons labelled ("Copy reference: Federal Reserve…") |
| UX-C24 | **TimeMachineBanner** | 32 px amber-tinted bar: icon, "Time machine: you are seeing only what was public by {as-of}. Later data is not loaded.", Return (Esc) | — | `role="status"`; does not steal focus |
| UX-C25 | **TimeCurtain** | Chart overlay right of as-of: canvas-coloured 85% mask + 45° hatch + centered label "Future not loaded"; amber dashed as-of line with label | animating / static | Label in DOM for screen readers |
| UX-C26 | **HoldoutBadge / PITBadge / LicensedBadge** | 20 px pill: icon + short label + popover with details | — | Text labels |
| UX-C27 | **IdeaCardTile** | 220 px board card: ID, title (2 lines), author + category, flags, primary action | flags (⚠) / evidence after backtest | Whole card is a link; actions as separate buttons |
| UX-C28 | **EmptyState** | 48 px glyph, title (text-md), 1–2 sentence body, primary CTA, secondary link | page / panel / inline | Heading + text |
| UX-C29 | **Skeleton** | Shape-matched blocks (`bg-hover`), shimmer 1.2 s (disabled under reduced motion) | — | `aria-busy="true"` on container |
| UX-C30 | **StoryCallout** | Numbered bubble (accent border, e3) anchored to `[data-anchor]`, max 280 px, arrow | step reveal | Presentation-only; text duplicated in notes |

---

## 9. States and microcopy

### 9.1 State matrix (UX-M01)

| State | Visual treatment | Where it appears |
|---|---|---|
| **Empty** | EmptyState (glyph, title, body, CTA) | First run; no committee; no runs; empty report; filters with no results |
| **Loading (< 300 ms)** | Nothing (avoid flashes) | All fetches |
| **Loading (≥ 300 ms)** | Skeletons matching the layout; charts show axes frame + skeleton band; numbers show a width-stable `—` | Pages, panels, charts |
| **Long operation** | ProgressPipeline with stages, ETA, cancel, live partial results labelled "provisional" | Backtests, committee recompute, ingestion |
| **Error (recoverable)** | Inline panel: what happened → why → what to do; details collapsible (mono, copy); error ID | Runs, uploads, API failures |
| **Blocked (integrity)** | ⊘ glyph + `danger` border, explicit reason, fix path | PIT violation, gate failure, licensed data in a public build |
| **Stale data** | Amber freshness item + dismissible page banner (once per session per dataset) | Home, data explorer, committee |
| **Insufficient evidence** | Values in `text-tertiary`, 135° hatch on chart regions, ⓘ explanation, evidence ○ | Regimes, small samples, new analyzers |
| **Holdout locked** | Hatched region + padlock badge + explanation | Run charts, leaderboard footnote |
| **Time machine** | Amber frame, banner, pill, curtain | Global |
| **Read-only demo snapshot** | Accent-subtle banner; run/upload buttons disabled with tooltip | Public demo build (`DEP:A7`) |
| **Provisional** | Tertiary text + "provisional (n = 212)" tag | Running backtests |

### 9.2 Copy deck (UX-M02): exact strings for R1

**Empty states**

| Context | Title | Body | CTA |
|---|---|---|---|
| Committee | No committee yet | A committee needs at least two analyzers with completed standard runs. Promote analyzers from their run page. | Browse runs · *How the committee works* |
| Runs | No runs yet | Run a built-in analyzer to see what a backtest looks like. "Momentum 12-1" takes about 30 seconds. | Run Momentum 12-1 |
| Report | Your report basket is empty | Use **Add to report** (R) on any chart or table. Figures are frozen to the data you pinned, so they won't change under you. | Go to Committee |
| Idea lab | Every analyzer starts as an idea card | Describe the idea, the data it needs and when that data became public. Set your success test before you run anything. | New idea card |
| Events (filtered) | No events match these filters | Try a wider date range or fewer categories. | Clear filters |
| Search | Nothing matches "{q}" | Try an analyzer name, a run ID, an event, or a date like 2019-01-02. | — |

**Errors and blocks**

| Context | Message |
|---|---|
| Run stopped (data gap) | **Run stopped at origin 2011-06-30.** The series `TSMC:monthly_revenue` has no value that was public before this date (first available 2011-09-10). Start the evaluation window after September 2011, or choose another input. [Edit config] [View coverage] |
| PIT violation | **Look-ahead detected: run blocked.** When data after each forecast date was scrambled, this analyzer's output on 2015-03-31 changed. It is reading information that was not yet public. [See failing check] [Copy report for implementation] |
| Engine unreachable | **Can't reach the Orchard engine at localhost:8000.** Is it running? Start it with `make dev`. Showing cached results from 21 Nov 14:02. |
| Upload error | **12 rows say the value was public before the period ended.** That is impossible and would leak information into backtests. Fix the "available at" column or choose a publication-lag rule. [Show rows] |
| Gate failure | **Can't promote yet: 1 of 5 requirements is not met.** This run used a custom window. Promotion needs the standard protocol so all committee members are scored the same way. [Run standard protocol] |

**Warnings and notices**

| Context | Message |
|---|---|
| Stale prices | Prices were last updated 3 trading days ago (18 Nov). Forecasts that use prices are as of 18 Nov. [Update now] |
| Insufficient evidence | Not enough independent observations. This regime contains 6 non-overlapping 12-month windows. Numbers are shown for transparency; don't rely on them. |
| Holdout locked | Holdout locked. Results from 1 Jan 2021 onward stay hidden until a final evaluation is submitted. Looking early would turn the holdout into training data. |
| Final evaluation confirm | Run the final holdout evaluation for Momentum 12-1 v3? This freezes v3 and uses 1 of the 2 holdout reveals for this analyzer family. The result is recorded whatever it shows. [Cancel] [Run final evaluation] |
| Time machine banner | Time machine: you are seeing only what was public by **2 Jan 2019, 16:00 ET**. Later data is not loaded. [Return to present] |
| Builder preview | In-sample preview, not a backtest. Run the standard protocol to score this idea. |
| Trials warning | This is the 21st variant of this analyzer. Each extra variant raises the bar: the leaderboard shows skill deflated for 21 trials. |
| Read-only demo | Read-only demo: data frozen 21 Nov 2026. Clone the repository to run your own backtests. |
| Caption hint | Orchard drafts what is plotted. You write what it means. |

**Completion toasts (neutral):** "Run completed · Momentum 12-1 v3 · ◔ Weak evidence · [View]". "Figure added as Fig 5 (Future performance) · frozen to snap 9c41e2 · [Open studio]". "Snapshot 'Report consensus v1' frozen."

### 9.3 Tone of voice (UX-M03)

- **Precise:** numbers with units, levels and sample sizes. "+4.1% [−0.6, +8.8] 90% CI", never "pretty good".
- **Sober:** no exclamation marks, no emoji, no hype words ("powerful", "AI-powered", "magic").
- **Plain:** short sentences, active voice, the user's vocabulary first, with the technical term in a glossary tooltip.
- **Language:** **British English** for UI copy (UCL team; "analyse", "colour"); code identifiers stay US English. Open question UX-Q09.
- **Probability language rules:**
  - ✓ "The committee assigns a 61% probability that AAPL's total return over the next 12 months (20 Nov 2026 → ≈19 Nov 2027, dividends reinvested) is positive."
  - ✓ "The median forecast is $246; there is an 80% probability the price is between $191 and $303."
  - ✕ "AAPL will rise 8%." ✕ "Target price $246." ✕ "Buy." ✕ "The AI predicts…"
  - ✕ "Accuracy 58%" for probabilistic forecasts → ✓ "Hit rate 58% (base rate 55%)" plus calibration and skill.
- **Banned in UI strings** (CI string lint, `DEP:A7` tooling): *buy, sell, hold (as advice), target price, should invest, guaranteed, risk-free, will rise/fall, beat the market, AI predicts, success!*.

### 9.4 Disclaimer placement (UX-M04)

**Text (short):** "Educational research tool — not investment advice."

**Text (full, About › Disclaimer, first-run note, demo landing):** "Orchard is an educational research tool built for a university coursework project. It presents data and probabilistic forecasts; it does not provide investment advice or recommendations to buy or sell any security. Forecasts are uncertain, and the past performance of a method does not guarantee future results. Data may be delayed, revised or incomplete; check sources before relying on any figure."

| Location | Form |
|---|---|
| Status bar (every screen) | Short text, links to full |
| First run (identity picker) | Full text in a note under the picker; no blocking "accept" checkbox (it is the team's own tool) |
| About › Disclaimer | Full |
| Public demo build | Banner on first load + footer |
| Presentation | Title scene footer + final scene |
| Evidence pack README, repo README | Full |
| Report figures | **Not included** (clutter). The report itself is the team's responsibility. |

---

## 10. Accessibility (target WCAG 2.2 AA)

WCAG 2.2 became a W3C Recommendation on 5 Oct 2023 and adds criteria including 2.4.11 Focus Not Obscured (Minimum, AA), 2.5.7 Dragging Movements (AA), 2.5.8 Target Size (Minimum, AA: 24 × 24 CSS px or adequate spacing), 3.2.6 Consistent Help (A), 3.3.7 Redundant Entry (A) and 3.3.8 Accessible Authentication (AA) (W3C, see §16).

| ID | Criterion | How Orchard meets it |
|---|---|---|
| UX-A11Y-01 | 1.1.1 Non-text content | Every chart: `role="figure"`, title, **auto-generated summary** in `aria-describedby`, and **"View as table"** (`V`) with the exact plotted data. Icons are `aria-hidden` when paired with text. |
| UX-A11Y-02 | 1.3.1 Info & relationships | Real `<table>`s with `<th scope>`; landmarks (`header`, `nav`, `main`, `aside`, `contentinfo`); one `h1` per page; logical heading order. |
| UX-A11Y-03 | 1.4.1 Use of colour | Direction = sign + glyph + colour; evidence = Harvey ball + label; events = shapes; status = glyph + text; chart series = direct labels (+ dash patterns in print). |
| UX-A11Y-04 | 1.4.3 / 1.4.11 Contrast | Token table (§6.1) computed: text ≥ 4.5:1 (tertiary 5.4:1), input borders ≥ 3:1, focus ring ≥ 5.7:1, series lines ≥ 3.4:1. CI test recomputes. |
| UX-A11Y-05 | 2.1.1 Keyboard, 2.1.4 Character key shortcuts | Everything reachable by keyboard, including chart exploration and the builder. Single-key shortcuts (`T`, `I`, `R`…) are active only when focus is not in a text field, **and can be turned off** in Settings (2.1.4 requires turn-off, remap, or only-on-focus). |
| UX-A11Y-06 | 2.4.3 / 2.4.7 / 2.4.11 Focus | Visible 2 px accent ring + 2 px offset; focus order follows layout; sticky top/status bars use `scroll-padding` so focused items are never hidden under them. "Skip to content" link. |
| UX-A11Y-07 | 2.5.7 Dragging | Every drag has a non-drag alternative: chart zoom (range presets, `from/to` inputs, keyboard `+/−`); threshold handle (typed value); outline reordering (↑/↓ buttons); kanban (status menu); resizable panels (keyboard arrows via primitives). |
| UX-A11Y-08 | 2.5.8 Target size | Controls ≥ 28 px in Default density (24 px floor in Compact). Event-rail glyphs (8–12 px) are inline chart marks; equivalent access is through the event list and keyboard navigation on the rail (spacing exception plus equivalent control). |
| UX-A11Y-09 | 1.4.13 Content on hover/focus | Tooltips and glossary popovers are dismissible (`Esc`), hoverable and persistent until moved away; also on focus. |
| UX-A11Y-10 | 3.2.6 Consistent help | Help `?` always in the same top-bar position; glossary and methodology links are consistent. |
| UX-A11Y-11 | 3.3.1–3.3.3 Errors | Inline errors next to fields with text, icon and fix suggestion; error summary at the top of long forms (idea card, upload) linking to fields. |
| UX-A11Y-12 | 3.3.7 Redundant entry | Wizard steps and Form↔YAML modes preserve values; idea card → builder pre-fills name, author, category, horizons. |
| UX-A11Y-13 | 4.1.2 Name, role, value | Radix/Base primitives (via shadcn) supply ARIA patterns; custom components follow the WAI-ARIA APG patterns (tabs, radiogroup, dialog, listbox). |
| UX-A11Y-14 | 4.1.3 Status messages | Polite live region for: as-of change, job completion, copy-to-clipboard, figure added. Assertive only for blocking errors. |
| UX-A11Y-15 | 2.3.3 / reduced motion | `prefers-reduced-motion` honoured (§6.8); setting override. |
| UX-A11Y-16 | 1.4.4 / 1.4.10 Resize & reflow | Works at 200% zoom on 1440 px. Complex charts and data tables are exempt from 320 px reflow (they need 2D layout) but remain usable with horizontal scrolling inside their own frame. |

**Chart keyboard model:** `Tab` focuses the chart (`tabindex=0`, `aria-roledescription="interactive chart"`). `←/→` move the cursor one point. `PgUp/PgDn` move one month (daily data) or one year (monthly). `Home/End` go to the first or last point. `Enter` on an event glyph opens its drawer. `V` toggles the table view. The current point is announced through a polite live region, throttled to one announcement per 250 ms, e.g. "2 January 2019. Close 39.48 dollars, up 0.1 percent. Event: letter to investors, after close."

**Auto summary template:** "{Chart type} of {measure} for {subject}, {start} to {end}. {Key stats: last value, min and max with dates}. {Uncertainty statement: e.g. 'Shaded bands show 50, 80 and 95 percent predictive intervals; at 12 months the 80 percent interval is $191 to $303.'} Source: {short source}." ECharts' built-in `aria` option can generate a description, but Orchard supplies its own summary because the built-in text is generic.

**Testing:** `@axe-core/playwright` in CI on every route (light + dark, all densities); a manual VoiceOver (macOS) pass on Home, Run view and Report studio before the demo; keyboard-only walkthrough of flows F01–F03; CVD simulation pass on the chart gallery.

---

## 11. Recommended front-end stack

Versions are the `latest` npm dist-tags as of 17 Nov 2026 (`npm view`, accessed 2026-11-17). Pin exact versions in R0. Architecture choices (SPA vs SSR, API, deployment) are `DEP:A7`. This section states what the **design** needs.

| Layer | Recommendation | Version · licence | Why this design needs it |
|---|---|---|---|
| Framework | **React** + TypeScript | 19.3.1 · MIT | Ecosystem for every component below; the agent's strongest stack |
| Build | **Vite** (SPA) | 8.3.8 · MIT | Fast dev loop; static build doubles as the **demo snapshot** site |
| Routing + URL state | **TanStack Router** (+ `@tanstack/router-plugin`) | 1.170.46 · MIT | **Typed, validated search params** (`asof`, `h`, `from/to`, `runs`) are the backbone of UX-P02 and of presentation stories |
| Server state | **TanStack Query** | 5.108.0 · MIT | Caching keyed by `asof` + snapshot; background refetch; SSE progress integration |
| Tables | **TanStack Table** + **TanStack Virtual** | 9.3.1 (v8.21.3 previous) · MIT; Virtual 3.14 · MIT | Sorting, column pinning, virtualisation for logs/forecast tables. *Note:* v9 is the current major; most shadcn "data table" examples were written for v8. Pin v8.21.3 if the agent hits API friction (`UNVERIFIED` whether shadcn examples were updated). |
| Styling | **Tailwind CSS** v4 | 4.3.5 · MIT | CSS-variable tokens (`@theme`), OKLCH, `color-mix`; density via data attributes |
| Components | **shadcn/ui** (copy-in components) on **Radix** primitives (`-b radix`) | radix-ui 1.8.1 · MIT | Accessible primitives; consistent with cmdk. **Fact:** since July 2026 shadcn's CLI defaults to **Base UI** (`@base-ui/react` 1.9.0, MIT); Radix is still fully supported and receives every update. **Recommendation:** Radix for R1 (far more examples and agent familiarity, lower risk in a one-week build); keep Base UI as the R2 migration path (shadcn ships a migration skill). |
| Command palette | **cmdk** (via shadcn `Command`) | 1.1.1 · MIT | ⌘K. Mature; last release Mar 2025 (low activity, low risk) |
| Price chart | **TradingView Lightweight Charts** | 5.3.0 (10 Nov 2026) · Apache-2.0 | Terminal-grade pan/zoom, panes (v5), series markers, ~35 kB base. **Licence obligation:** credit TradingView, show the NOTICE attribution, and link to tradingview.com on a page users can reach (About › Licences); the `attributionLogo` option can satisfy the link requirement on the chart itself |
| Analytical charts + all exports | **Apache ECharts** (+ thin custom React wrapper, or `echarts-for-react` 3.1.0 · MIT) | 6.1.0 (19 May 2026) · Apache-2.0 | Every chart in §7 except CH01; **SVG renderer** for print export; `renderToSVGString` SSR (≥ 5.3) for server-side figure rendering if A7 wants it; built-in ARIA and decal patterns; dynamic theme switching (v6); custom series for fans and ribbons |
| Micro-charts | **d3-shape** | 3.2.1 · ISC | Sparklines and probability bars as inline SVG (no chart instance per table row) |
| Motion | **Motion** (formerly Framer Motion), `motion/react` | 14.14.0 · MIT | Curtain, drawers, reveal; CSS transitions for everything else. Optional: drop it if bundle or time is tight |
| Editor | **CodeMirror 6** via `@uiw/react-codemirror` + `@codemirror/lang-yaml` + `codemirror-json-schema` (has a `./yaml` entry) | 4.25.12 · MIT; 6.1.3 · MIT; 0.8.1 · MIT | YAML config editing with schema validation and autocomplete; much lighter than Monaco (`monaco-yaml` 5.5.1 is the heavier alternative) |
| Forms | **react-hook-form** + **zod**; **RJSF** with the shadcn theme for analyzer parameter forms generated from JSON Schema | 7.92.0 · MIT; 4.6.7 · MIT; `@rjsf/shadcn` 6.11.1 · MIT | Fixed forms (idea card, upload) vs schema-driven parameter forms (run launcher), all in the same visual language |
| Toasts / panels | **sonner**, **react-resizable-panels** (via shadcn) | 2.0.8 · MIT; 4.24.0 · MIT | Job completion toasts; resizable drawers/panels |
| Client UI state | **zustand** | 5.1.0 · MIT | Cursor bus, theme, density, presentation state (URL remains the source of truth for view state) |
| API typing | **openapi-typescript** + **openapi-fetch** | 7.13.0 · MIT; 0.17.0 · MIT | Typed client from the back-end's OpenAPI (`DEP:A7`) |
| Dates | **date-fns** + **@date-fns/tz** | 4.4.0 · MIT; 1.5.0 · MIT | ET/UK display, trading-day labels (trading calendar from the engine) |
| Markdown + maths | **react-markdown** + **remark-gfm** + **KaTeX** (rehype-katex) | 10.1.0 · MIT; 4.0.1 · MIT; 0.19.1 · MIT | Methodology and glossary with formulas (CRPS, PIT): a credibility signal for the professor |
| Icons | **lucide-react** | 1.74.0 · ISC | Consistent stroke icons; custom domain glyphs on the same grid |
| Fonts | **Fontsource**: Inter Variable, JetBrains Mono Variable, Source Serif 4 Variable | 5.3.x · OFL-1.1 | Self-hosted, offline-safe, no third-party requests |
| PDF export (R2) | **jsPDF** + **svg2pdf.js** | 4.2.1 · MIT; 2.9.0 · MIT | Vector PDF figures with embedded fonts |
| Testing | **Playwright** + **@axe-core/playwright**; Vitest | 1.65.1 · Apache-2.0; 4.14.0 · MPL-2.0 (dev only) | E2E flows, a11y scans, visual regression of the chart gallery (R2) |
| Component workshop (R2) | Storybook 10 or Ladle | 10.6.7 · MIT; 5.1.1 · MIT | Chart gallery and token docs for recruiters |

**Do not use**

- **`xlsx` from npm** (0.18.5 is the last npm release). SheetJS publishes fixed versions only on its own CDN. The npm build is affected by CVE-2023-30533 (prototype pollution; fixed in 0.19.3) and CVE-2024-22363 (ReDoS; fixed in 0.20.2). Parse spreadsheets server-side in Python instead.
- **Recharts** (3.11.0, MIT; it powers shadcn's chart blocks). It is fine for simple dashboards, but it is SVG-only with weaker performance at around 11k points × several series and lacks the scientific chart types. Adding it would make a third charting idiom.
- **Plotly.js**: strong for scientific charts, but a multi-megabyte bundle with a recognisable "default Plotly" look that is hard to make feel premium. **visx**: excellent, but low-level, which means much more code per chart for a one-week build. **Observable Plot** (0.6.19, ISC): a lovely static SVG grammar and a credible *report-renderer* alternative, but adopting it would split the export path. Keep it as the fallback if ECharts print output disappoints.
- **Google Fonts CDN** (privacy, offline demo) and **Monaco** (weight, unless the in-app LLM editor in R2 needs it).

**Performance budgets (UX-STK-PB):** initial JS ≤ 350 kB gzip for the shell + Home (charts lazy-loaded per route; ECharts imported modularly); route transition ≤ 150 ms with warm cache; chart interaction at 60 fps for 11.6k points; as-of change → full page re-render ≤ 800 ms from cache, ≤ 2 s cold; backtest progress updates ≥ 2 Hz.

**ADR candidates raised by this design (for the lead):**

| ID | Decision | Recommendation |
|---|---|---|
| UX-ADR-01 | Charting: LWC + ECharts vs ECharts-only | LWC (CH01) + ECharts (rest + all exports); ECharts-only as fallback |
| UX-ADR-02 | shadcn base: Radix vs Base UI | Radix for R1; reconsider in R2 |
| UX-ADR-03 | URL-first state with typed search params | TanStack Router `validateSearch` (zod) |
| UX-ADR-04 | Export pipeline | One renderer-independent print contract (§7.3). Renderer: A7 ARC-ADR-03 makes server-side matplotlib canonical; accept that, provided the studio previews the *same* server render and an `orchard.mplstyle` is generated from the token JSON (§17). ECharts SVG stays as the in-browser convenience path |
| UX-ADR-05 | Default up/down scheme | Blue–orange with glyphs; green–red opt-in |
| UX-ADR-06 | Default theme | Dark for the app, light for all exports; system preference respected (UX-Q02) |

---

## 12. Demo choreography

### 12.1 UX-DEMO-01 — Five-minute professor demo (live, using the `professor-5min` story)

**Setup checklist (T−30 min):** engine running + snapshot cached (story preflight shows "Ready (live)"); presenter notes on the laptop, story on the projector at 1920 × 1080; dark theme (projectors wash out light-grey panels), presentation density; as-of = latest; committee frozen as "Report consensus v1"; backup: snapshot mode and a recorded MP4 of the same story.

| Time | Scene (screen) | Action | What to say (gist) | Wow beat |
|---|---|---|---|---|
| 0:00–0:25 | 1 · Title → Home | Story opens on Mission control | "Five of us each had a different idea about Apple. Orchard turns each idea into a forecaster, tests it on decades of history *without letting it see the future*, and combines them into one probabilistic forecast. Every number on screen has a source." | The **61% with its interval** and the fan |
| 0:25–1:20 | 2 · Time machine | `T` → preset "Guidance letter, 2 Jan 2019", time 16:00 ET → curtain drops | "This is 2 January 2019 at the close. Everything after this moment is *not loaded*. Apple's letter cutting revenue guidance came out after the close, so at 16:00 it doesn't exist." Step the clock to 20:00: the event appears on the rail. | **Information arrives at a time, not a date** |
| 1:20–1:50 | 3 · Replay reveal | Click "Reveal what happened" | "Here's what the committee would have said then, and here's what actually happened." The realised path draws over the old fan; the scorecard shows where it landed. | The **reveal** |
| 1:50–2:40 | 4 · Run view › Calibration | Open the Momentum 12-1 run | "We don't judge forecasts by whether they were right once. Probabilities should be *calibrated*. Here's the reliability diagram with a consistency band (Dimitriadis et al., 2021) and the PIT histogram (Gneiting et al., 2007)." | Proper scoring, recognised by any econometrician |
| 2:40–3:10 | 5 · Run view › Overview verdict | Point at the verdict and pre-registered criterion | "And this one is honest: +4% skill, but the CI includes zero with about 28 effective observations, so it's *weak evidence*. We wrote the success test *before* running it, and it wasn't met." Show trials counter and holdout lock. | **A negative result presented with pride** |
| 3:10–4:00 | 6 · Committee › Attribution + Scenarios | Show the waterfall, then scenarios | "So why 61%? Starting from the random-walk baseline at 56%, momentum adds 3 points, valuation 2, RSI subtracts… Scenario probabilities feed straight into our report's Future-performance section." | **"Why" is answered, not asserted** |
| 4:00–4:40 | 7 · Report studio | `R` on the fan → studio → export | "Every figure leaves as a report-quality export with a figure number, a caption that says *what is plotted*, a source line and Harvard references collected automatically. The interpretation sentence is ours to write." Show the lint. | **Publication-ready in one click; integrity preserved** |
| 4:40–5:00 | 8 · Provenance + close | Press `I` on a P/E value → drawer with filing date | "Any number traces back to its source and the moment it became public. It's a research tool: data and probabilities, not advice." | **Every number has a source** |

**If something fails:** switch the story to snapshot mode (`S` in the notes window). If the projector misbehaves, play the recorded MP4. Never improvise data.

### 12.2 UX-DEMO-02 — 60-second LinkedIn video storyboard

Format: **1920 × 1080, 30 fps, 60 s**, burned-in captions (most feed videos are watched muted), light background music, no voice-over required. Recorded from presentation mode with the cursor spotlight. Export a **1080 × 1350 (4:5)** cut by cropping to the main panel for mobile.

| # | Time | Shot | On-screen caption (≤ 8 words) | Motion |
|---|---|---|---|---|
| 1 | 0–4 s | Logo on dark canvas → Home hero fades in | "What did we know — and when?" | 400 ms fade |
| 2 | 4–10 s | Mission control: P(up) 61% + fan | "One forecast from five analysts' ideas" | Slow 5% zoom to the readout |
| 3 | 10–19 s | ⌘K → "Travel to 2 Jan 2019" → curtain drops | "Backtests that can't see the future" | Curtain 240 ms; amber frame appears |
| 4 | 19–26 s | Step clock 16:00 → 20:00; event appears on rail | "Information arrives at a time, not a date" | Highlight pulse on the event glyph |
| 5 | 26–33 s | Reveal: realised path over the fan | "Then we check against reality" | 1.2 s path draw |
| 6 | 33–41 s | Calibration tab: reliability + PIT | "Scored like a scientist: calibration, not hype" | Pan across the two charts |
| 7 | 41–48 s | Committee attribution waterfall | "Every probability explains itself" | Bars appear in sequence (only place bars animate) |
| 8 | 48–55 s | Report studio export → PNG with caption + Harvard refs | "Report-ready figures with sources" | Cross-fade to the white print preview |
| 9 | 55–60 s | Repo card: name, stack badges, "Open source" + disclaimer line | "Orchard · built with Python + React · link in comments" | Hold |

### 12.3 Demo-readiness criteria (UX-DEMO-03)

- Seeded, deterministic data snapshot for the story (same numbers every time).
- The 2 Jan 2019 event has a verified `available_at` time (`DEP:A4`). **If the exact time cannot be verified, drop the 16:00 → 20:00 beat and use the 2 Jan → 3 Jan date step instead.**
- Every number shown in the story has provenance (UX-P01 check passes on all story URLs).
- The story runs offline in snapshot mode.

---

## 13. R1 vs R2 UX scope

**Polish budget (R1):** spend the design and engineering polish on four surfaces: (1) the **consensus fan + readout** (Home, Committee), (2) the **time-machine curtain and banner**, (3) the **run view Overview + Calibration**, (4) the **report export** (print variant, caption, references). Everything else ships with stock shadcn components, correct tokens and correct states. That is enough to feel professional.

Effort is in **agent-hours** (the coding agent building from this spec, PO reviewing). It is a rough planning input for the roadmap, `DEP:A7` for back-end parts.

| Area | R1 (coursework, by ~25 Nov) | Est. h | R2 (showcase) | R3 |
|---|---|---|---|---|
| Shell (top bar, rail, status bar, routing, tokens, themes, density) | Full | 8 | Remappable shortcuts | — |
| As-of control + time-machine mode | Full (frame, banner, curtain, URL) | 5 | — | — |
| Command palette | Navigate, objects, core actions | 3 | All actions, prefixes | — |
| Provenance drawer + chips | Full for prices, EDGAR, FRED, events, runs | 4 | Lineage graph view | — |
| Home | Full (activity-log fallback) | 5 | "Since your last visit" diff | — |
| Data explorer | Price & events (LWC), Fundamentals (table + ratio chart), Macro (2–4 series), Peers (rebased + table), Catalog | 12 | Restated Diff (if vintages later), candles, peer scatter, coverage map | Multi-ticker |
| Time machine / replay | Pick moment, knowable panels, reveal, scorecard | 5 | Blind mode, surprise me, replay journal | Human-vs-committee calibration |
| Events | Timeline, list, drawer with sources | 5 | Event-study builder (multiple models), splits | News feed ingestion UI |
| Idea lab | Board (status menu), idea card form + checks, copy brief, YAML config editor | 7 | Builder as block canvas; DOI lookup | In-app LLM idea → analyzer (V-11) with review gate UI |
| Builder | Structured rule form (if A5 DSL lands in R1) | 6 | Visual canvas, live backtest preview | — |
| Analyzer library + detail | Library table, detail (overview, performance, parameters, data & PIT, versions, code link, refs) | 5 | Code diff between versions | — |
| Run launcher | Form + YAML, standard protocol | 3 | Param grid UI with estimates | — |
| Run view | Overview, Calibration, Scores, Manifest, running state; Robustness (trials, holdout, PIT tests); Breakdown (per year) | 12 | Regimes, PBO/DSR, sensitivity heatmap, strategy view | — |
| Leaderboard + Compare | Leaderboard with CIs and rank intervals; compare 2 runs | 5 | 4 runs, error-correlation matrix | — |
| Committee | Forecast, Members & weights, Attribution (P(up)), Scenarios, Why, Freeze snapshot | 10 | Diagnostics full, human views UI, method sandbox | — |
| Report studio | Figures (PNG + SVG, full/half, caption builder, lint 01–06), Tables (Word/TSV), References (Harvard + BibTeX), Evidence pack | 10 | PDF, slide preset, CVD/grayscale preview, RIS, lint 07–08 | Word add-in |
| Presentation | Story JSON, kiosk, scenes, callouts, notes window | 5 | Story editor, step actions | — |
| Data upload | CSV wizard ①–⑤, PIT validation, licence flag | 6 | XLSX, vintages, scheduled refresh | — |
| Settings, About | Appearance, data sources, licences, methodology, glossary, disclaimer | 5 | Team admin | — |
| Accessibility | Keyboard, focus, labels, table views, axe in CI | (built in) | Full VoiceOver audit, chart sonification? (R3) | — |
| Responsive | Desktop ≥ 1280 (1024 degraded) | — | Tablet | Mobile read-only |
| **Total front-end R1** | | **≈ 121 h** | | |

**Reading the total:** about 121 agent-hours is more than one developer-week of serial work, even at high AI velocity. **Cut line, in order, if behind schedule:** (1) builder → idea cards + the coding agent only; (2) presentation mode → record the demo from the normal UI; (3) events timeline → list only; (4) peers tab → table only; (5) LWC → ECharts-only (UX-ADR-01 fallback); (6) Compare → leaderboard only. **Never cut:** as-of mode, provenance, run verdict + calibration, committee readout, report export. Those *are* the product.

---

## 14. Inspiration references (what to borrow, specifically)

| Source | Borrow | Don't borrow |
|---|---|---|
| **Bloomberg Terminal** | Density, tiled panels, keyboard-first workflow, amber-on-dark "serious" feel; its documented colour-vision-deficiency schemes (`PDFU COLORS <GO>`) justify Orchard's default blue/orange | Opaque mnemonics; walls of text |
| **TradingView** | Readout bar instead of tooltips; price-scale behaviours; hollow/filled candles; the feel of LWC | Social/"idea" hype; buy/sell signals |
| **Koyfin** | Fundamentals presented cleanly in dashboards; macro dashboard composition (reviews consistently praise these) | Drag-and-drop widget sprawl (out of scope for R1) |
| **Linear** | Calm polish, ⌘K, `G`-prefixed navigation, LCH/OKLCH-based theme generation from a few variables (base, accent, contrast) | — |
| **Bank of England Inflation Report fan charts** (since 1996) | Probability bands that avoid spurious precision; the BoE's later *evaluation* of its own fans is the model for Orchard's calibration tab | Two-colour fans (we use one hue for consensus) |
| **Metaculus** | Continuous forecasts shown as PDF/CDF with a threshold query; aggregation of many forecasters | Free-hand distribution drawing (not needed) |
| **Our World in Data Grapher** | Every chart carries its source; downloads as SVG/PNG/CSV; chart = data + metadata | — |
| **Financial Times Visual Vocabulary** | Choose chart by relationship (change over time, distribution, deviation…); used for the CH catalogue | — |
| **CORP reliability diagrams** (Dimitriadis, Gneiting & Jordan 2021) and **PIT histograms** (Gneiting, Balabdaoui & Raftery 2007) | The exact calibration visuals and their uncertainty bands | Binned reliability diagrams as default (unstable to binning choice) |

---

## 15. Open questions and decisions for the product owner

| ID | Question | My recommendation |
|---|---|---|
| UX-Q01 | **Default up/down colours:** blue/orange (colour-blind safe) or green/red (traditional)? | Blue/orange default; green/red opt-in; glyphs always |
| UX-Q02 | **Default theme:** dark (terminal feel, better on projectors) or light (academic feel)? | Dark app, light exports; follow system after first run |
| UX-Q03 | **Charting stack:** accept two libraries (LWC + ECharts) for the price-chart feel, or ECharts-only to save R1 time? | Two, with ECharts-only as a pre-agreed fallback |
| UX-Q04 | **Presentation mode in R1?** It costs ~5 h; the alternative is presenting from the normal UI | Yes, "lite": the demo is a stated goal (V-14) |
| UX-Q05 | **When is the professor demo?** Before or after 4 Dec? It decides whether presentation polish is R1 or R2 | — (need date) |
| UX-Q06 | **Hosting model** (`DEP:A7`): one shared hosted instance or local installs? This changes identity (name picker vs auth), the "since your last visit" diff and the read-only demo | Shared instance with name picker for R1, if A7 agrees |
| UX-Q07 | **Who can freeze the report consensus and run the final holdout evaluation?** | PO only (role in Settings › Team) |
| UX-Q08 | **Figure font in the report:** Inter (modern, matches app), Arial (max compatibility) or Source Serif 4 (matches a serif report)? | Match the report's body font family; default Inter |
| UX-Q09 | **UI language:** British English (UCL) or US English (international GitHub audience)? | British English, consistent with the report |
| UX-Q10 | **Evidence-grade thresholds** must be fixed with A2 before R1. Is showing a grade at all acceptable to the team (it may label someone's idea "Weak")? | Yes. Frame it as evidence, not a judgement of the person; credit authors for negative results |
| UX-Q11 | **Product name:** "Orchard" appears in the logo, titles and the LinkedIn video. Decide before the visual identity is drawn (A1 has candidates) | Keep "Orchard" unless A1 finds a conflict |
| UX-Q12 | **Event curation:** should curated (hindsight-selected) events be usable in backtests at all, or only for display? (`DEP:A2/A4`) | Display + event studies with a "curated" badge; backtests only on systematic event sets |

---

## 16. Sources

All accessed **17 November 2026** unless stated otherwise. Package versions and licences come from the npm registry (`npm view <pkg> version license time`), accessed 2026-11-17.

**Libraries and licences**

- TradingView (2025) *Welcome the newest Lightweight Charts™ — version 5* (3 Mar 2025). https://www.tradingview.com/blog/en/tradingview-lightweight-charts-version-5-50837
- TradingView, *lightweight-charts* repository (Apache-2.0, NOTICE/attribution requirement). https://github.com/tradingview/lightweight-charts
- TradingView, *Lightweight Charts docs*: getting started (client-side only), panes, v4→v5 migration (`createSeriesMarkers`). https://tradingview.github.io/lightweight-charts/docs · …/docs/panes · …/docs/migrations/from-v4-to-v5
- newreleases.io, *lightweight-charts 5.0.9 release notes* (`takeScreenshot` options). https://newreleases.io/project/npm/lightweight-charts/release/5.0.9
- Apache ECharts, *ECharts 6 new features* (design-token theme, dynamic theme switching, custom series). https://echarts.apache.org/handbook/en/basics/release-note/v6-feature
- Apache ECharts, *Server-side rendering* (`renderToSVGString` since 5.3.0; SSR client runtime since 5.5.0). https://echarts.apache.org/handbook/en/how-to/cross-platform/server/
- Apache ECharts, *Accessibility (aria, decal)*. https://echarts.apache.org/handbook/en/best-practices/aria/
- ASF release catalog, *ECharts 6.1.0* (19 May 2026). https://release-catalog.apache.org/echarts/6.1.0/index.html
- shadcn/ui changelog (July 2026), *Base UI is now the default* (Radix still supported, `-b radix`). https://ui.shadcn.com/docs/changelog/2026-07-base-ui-default
- Motion, README (MIT; import from `motion/react`). https://unpkg.com/motion@12.42.2/README.md
- cmdk (MIT). https://github.com/pacocoursey/cmdk/releases
- SheetJS advisories: CVE-2023-30533 and CVE-2024-22363 (fixes only on the SheetJS CDN). https://cdn.sheetjs.com/advisories/CVE-2023-30533.html · https://cdn.sheetjs.com/advisories/CVE-2024-22363.html
- Inter typeface, OpenType features (`tnum`, `zero`). https://rsms.me/inter/
- npm registry entries for: react, vite, @tanstack/react-router, @tanstack/react-query, @tanstack/react-table, @tanstack/react-virtual, tailwindcss, radix-ui, @base-ui/react, cmdk, lightweight-charts, echarts, echarts-for-react, d3-shape, motion, @uiw/react-codemirror, @codemirror/lang-yaml, codemirror-json-schema, react-hook-form, zod, @rjsf/shadcn, sonner, react-resizable-panels, zustand, openapi-typescript, openapi-fetch, date-fns, @date-fns/tz, react-markdown, remark-gfm, katex, lucide-react, @fontsource-variable/inter, @fontsource-variable/jetbrains-mono, @fontsource-variable/source-serif-4, jspdf, svg2pdf.js, @playwright/test, @axe-core/playwright, storybook, @ladle/react, recharts, @observablehq/plot, @visx/xychart, vega-lite, monaco-yaml, xlsx. https://www.npmjs.com/

**Accessibility and colour**

- W3C WAI, *What's New in WCAG 2.2*. https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/
- Bloomberg (Tech at Bloomberg), *Designing the Terminal for color accessibility* (red/green similarity under deuteranopia; CVD schemes). https://www.techatbloomberg.com/blog/designing-the-terminal-for-color-accessibility/ (403 for automated fetch; content via search summary) and Bloomberg UX, *Accessibility*: https://www.bloomberg.com/ux/accessibility/
- Okabe, M. and Ito, K. (2002/2008) *Color Universal Design (CUD): how to make figures and presentations that are friendly to colorblind people*. https://jfly.uni-koeln.de/color/ (palette hex values cross-checked at https://rdrr.io/cran/see/man/okabeito_colors.html)
- Machado, G.M., Oliveira, M.M. and Fernandes, L.A.F. (2009) 'A physiologically-based model for simulation of color vision deficiency', *IEEE Transactions on Visualization and Computer Graphics*, 15(6), pp. 1291–1298 (simulation matrices used in §6.2; citation from memory, `UNVERIFIED` page range).
- Linear (2024) *How we redesigned the Linear UI* (LCH theme generation). https://linear.app/blog/how-we-redesigned-the-linear-ui

**Forecast visualisation and methods**

- Bank of England (1998) *The Inflation Report projections: understanding the fan chart*, Quarterly Bulletin. https://www.bankofengland.co.uk/-/media/boe/files/quarterly-bulletin/1998/the-inflation-report-projections-understanding-the-fan-chart
- Bank of England (2005) *Assessing the MPC's fan charts*, Quarterly Bulletin. https://www.bankofengland.co.uk/-/media/boe/files/quarterly-bulletin/2005/assessing-the-mpcs-fan-charts.pdf
- Gneiting, T., Balabdaoui, F. and Raftery, A.E. (2007) 'Probabilistic forecasts, calibration and sharpness', *JRSS B*, 69(2), pp. 243–268. doi:10.1111/j.1467-9868.2007.00587.x. https://sites.stat.washington.edu/people/raftery/Research/PDF/Gneiting2007jrssb.pdf
- Dimitriadis, T., Gneiting, T. and Jordan, A.I. (2021) 'Stable reliability diagrams for probabilistic classifiers', *PNAS*, 118(8), e2016191118. https://pmc.ncbi.nlm.nih.gov/articles/PMC7923594
- Metaculus (2016) *Continuous predictions arrive*. https://www.metaculus.com/news/2016/12/31/me-calculus-continuous-predictions-arrive/
- Our World in Data, *The OWID Grapher* and *How to use OWID visualisations* (source on every chart; SVG/PNG/CSV downloads). https://ourworldindata.org/owid-grapher · https://ourworldindata.org/how-to-use-our-world-in-data
- Financial Times, *Visual Vocabulary* (chart-doctor). https://github.com/Financial-Times/chart-doctor/blob/main/visual-vocabulary/README.md
- Koyfin reviews (dashboards, fundamentals, macro): e.g. https://www.luxalgo.com/blog/koyfin-financial-analytics-review/ (secondary source)

**Referencing and company facts**

- UCL Library Services, *Harvard referencing guide* (UCL Harvard, based on *Cite Them Right*). https://library-guides.ucl.ac.uk/harvard/welcome
- Apple Inc. (2019) *Letter from Tim Cook to Apple investors*, Apple Newsroom, 2 Jan 2019. https://www.apple.com/newsroom/2019/01/letter-from-tim-cook-to-apple-investors/ (release *time* after the close is `UNVERIFIED`, A4 to confirm)
- Other historical anchors used as time-machine presets (Lehman bankruptcy 15 Sep 2008; COVID-19 market low 23 Mar 2020; AAPL 4-for-1 split effective 31 Aug 2020) are well known but `UNVERIFIED` here. A4's events seed is the source of truth.

**Method note (fact, reproducible):** contrast ratios use the WCAG 2.x relative-luminance formula. CVD screening uses Machado et al. (2009) severity-1.0 matrices on linearised sRGB, with CIE76 ΔE in CIELAB (D65). Palette candidates were generated by a constrained random search over CIELAB (hue windows per slot, contrast floors 4.5:1 dark / 3:1 light, reserved accent and ink included in the separation objective), then hand-moderated for aesthetics. The scripts are in the session scratchpad and are **not** part of the repo. R0 should add an equivalent `tokens.test.ts`.

---

## 17. Alignment with sibling outputs (added after A1–A3 and A7 landed)

A2, A3 and A7 finished while this document was being completed. I read their key decisions and aligned this design: holdout dates, reveal budget, evidence grades and the target definition above already follow A2. Remaining points for the synthesiser (R2):

| # | Topic | Sibling position | This design | Resolution proposed |
|---|---|---|---|---|
| 1 | Front-end stack | A7 ARC-ADR-02: Vite 8 + React 19 + TS + TanStack Router/Query + Tailwind 4 + shadcn/ui (Radix) + TanStack Table 9 + cmdk + Zustand | Same | **Agreed.** A7 notes a hash-history build for GitHub Pages: deep links in snapshot mode become `/#/runs/…`, and presentation stories must store routes *without* the hash prefix so they work in both modes. |
| 2 | Charting in UI | A7 ARC-ADR-03: Lightweight Charts (price/events) + ECharts (statistical) | Same (§7.2) | **Agreed.** |
| 3 | Report figure renderer | A7: **server-side matplotlib is canonical** for report figures (deterministic, vector, testable with pytest-mpl). Client PNG export is a convenience. About 6 chart kinds exist twice. | ECharts SVG print theme in the browser | **Accept A7's canonical path**, with two UX conditions: (a) the Report studio preview shows the **server-rendered** image, so what you see is what you export; (b) a single `tokens.json` generates both the CSS variables and an `orchard.mplstyle` (colours, fonts, sizes from §6 and §7.3), so print figures match the app's identity. §7.3 (geometry, fonts, caption, source line, lint) is the renderer-independent contract. ECharts SVG export stays for non-report charts and slides. |
| 4 | YAML editor | A7 ARC-ADR-09: Monaco + `monaco-yaml` 5.5.1 (lazy-loaded; CSP exception for that route) | CodeMirror 6 + `codemirror-json-schema` (`./yaml`) | Either meets the UX spec (schema validation, autocomplete, inline diagnostics, keyboard-accessible error list). I prefer CodeMirror for weight and for **no CSP `unsafe-eval` exception**. If A7 keeps Monaco, it must stay lazy-loaded on `/lab/config` only. Decision for the lead (UX-Q13). |
| 5 | Identity | A7 ARC-ADR-10: one shared instance, **team passphrase + name picker** (attribution, not security), edge auth | Name picker (UX-C06) | **Agreed.** Add a passphrase field before the picker on the hosted instance. Session expiry shows a non-destructive re-auth dialog that keeps unsaved idea-card and config drafts (WCAG 3.3.7). |
| 6 | Holdout | A2 QNT-110: development ≤ 2015, validation 2016–2020, **sealed holdout ≥ 2021-01-01**, reveal budget 2 per analyzer family, reveals logged and displayed | Updated throughout | **Agreed.** The run header chip becomes `Holdout ≥ 2021 · locked · reveals 0/2`. After a reveal: `Holdout seen 1×` on every later output of that family. |
| 7 | Evidence grades | A2 QNT-175: A–D per analyzer × horizon | Harvey balls mapped to A–D (§6.2) + UX "worse than baseline" flag | **Agreed**, with the flag added. The leaderboard and run header show the grade **for the selected horizon**. Analyzer cards show a 5-cell mini-row (one grade per horizon: 5d … 252d), because A2 expects skill mostly at 21–63 sessions and weak grades at 252. |
| 8 | Target definition | A2 QNT-012: forward total-return index | P(up) and thresholds defined on total return; fan drawn in price with a caption note | **Agreed.** The fan's subtitle reads "Price fan (from total-return forecast, dividends reinvested; dividend yield ≈ x%)" so the price/TR distinction is visible. |
| 9 | Context stamps | A2 QNT-057/QNT-176: exported figures carry window, n, n_eff, trial count, baseline and holdout status | Notes line optional (§7.3) | **Adopt as default:** the export's notes line is auto-filled with a context stamp, e.g. `Notes: eval 1993–2020; n = 336, n_eff ≈ 28; trials 7; baseline RW+drift; holdout sealed.` It can be shortened but not silently removed (lint warning UX-LINT-11). |
| 10 | Prospective forecast | A2 QNT-249: log the 1 Dec 2026 forecast for scoring in Dec 2027 | Committee "Freeze snapshot" | **Extend:** add "Register as prospective forecast" to the freeze dialog (PO only). It stores the hash and timestamp. Home shows a quiet card "Registered forecast · 1 Dec 2026 · to be scored ≈ 1 Dec 2027". This is a strong honesty signal for the professor and on GitHub. |
| 11 | FRED terms | A3: FRED API terms require the notice "This product uses the FRED® API but is not endorsed or certified by the Federal Reserve Bank of St. Louis." | Not yet placed | **Add** the notice to About › Data & licences, the Catalog entry for every FRED/ALFRED dataset, and the Evidence pack README. |
| 12 | FX publication lag | A3 DAT-256: H.10 FX/dollar index is published **weekly** (ALFRED `realtime_start`), not daily | Macro tab plots "as published" steps | **Agreed.** In the Macro tab, H.10 series render as weekly steps in "as known" mode. The UI notes "published weekly (H.10); daily values were not public on their observation dates" so the look-ahead lesson is visible. |
| 13 | Price vendor | A3 recommends sources per tier (`DEP:A3`) | `<vendor>` placeholders in wireframes | Replace placeholders with A3's chosen R1 price source and its exact Harvard citation format during build. |

**New lint rule from this alignment:** `UX-LINT-11 — Context stamp present`: the notes line contains window, n, n_eff, trials, baseline and holdout status whenever the figure shows backtest results (A2 QNT-057).

**New open question:** `UX-Q13 — YAML editor: CodeMirror 6 (lighter, no CSP exception) or Monaco (A7)?` My recommendation is CodeMirror 6; either satisfies the UX spec.
