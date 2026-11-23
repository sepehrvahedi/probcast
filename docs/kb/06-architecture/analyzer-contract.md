# CONTRACT v1 — the Analyzer contract (binding)

> **Status:** v1.1, binding from Wed 18 Nov 2026 (ADR-004). v1.1 adds drift neutrality, the anchor moment, outcome-date segments and true-lag strict mode (R3: RT-01/03/04/09/15/24/25). It resolves CRT-A-002, which found five incompatible versions across A1, A2, A5 and A7.
> **Owner:** lead. Changes need a new ADR and a version bump, and every analyzer must be re-validated afterwards.
> **Basis:** A2 §3 (QNT-070…088) is the reference. Where A1, A5, A6 or A7 differ, this document wins.

## 1. Principles

1. **One output type.** Every analyzer forecasts the **same target**, at the **same horizons**, on the **same quantile grid**. Analyzers differ in their inputs and models, never in their output format.
2. **Distribution first, everything else derived.** P(up), median, mean, intervals, "confidence" and scenario probabilities are computed by the platform from the distribution. **Analyzers may not report them.** The validator rejects `p_up`, `mean` and `sd` fields.
3. **The analyzer sees only `ctx`**, the as-of context. There is no other data path: no file handles, DB connections, network or environment variables (enforced by the leak suite T1–T7 and an import ban-list).
4. **Abstaining is honest.** Return `Abstain(reason)` before warm-up, when data are missing or when a rule's condition is absent.
5. **Explanations are data, not prose.** Drivers, their values, their sources and a numeric template. No free-form persuasive text (D-007).
6. **Anchored, drift-neutral location.** Every forecast is the **platform location anchor (CAPM, ADR-006)** plus an analyzer-specific **tilt**. Calibrators, baselines and the forecast floor are **drift-neutral**: AAPL's unconditional excess return over the anchor (survivor-biased, ≈ +8 pp/yr in-sample) can never enter a forecast through a fallback distribution or an intercept (§8.1; RT-01).

## 2. Target, horizons, grid

| Item | Value |
|---|---|
| Target | $y_{t,h} = \ln(\text{TRI}_{t+h} / \text{TRI}_t)$, the forward **log total return** of AAPL over $h$ trading sessions. TRI is the forward-built total-return index (ADR-007) |
| Horizons | $h \in \{5, 21, 63, 126, 252\}$ sessions (≈ 1 week, 1 month, 1 quarter, 6 months, 12 months) |
| Decision time | Origin $t$ = **session close (16:00 America/New_York)**. Information set = every row with `available_at ≤ t` |
| Evaluation origins | **Month-end sessions** (last trading session of each month) **from 1990-01** to the latest month-end. Calibration may use daily pairs; shrinkage always uses $n_\text{eff}$ |
| Segments (by **outcome date**) | Each (origin $t$, horizon $h$) pair is tagged by the session $t+h$ at which its outcome is known (RT-03): **dev** = outcome ≤ 2015-12-31; **val** = outcome 2016-01-01…2020-12-31; **holdout** = outcome ≥ 2021-01-01, **sealed** until the single reveal (ADR-005). Presets and family assignment may use dev scores only; val is reported separately and is the gate sample (RT-31) |
| Anchor moment | The anchor fixes the **expected simple return**: $E[\exp(y_{t,h})] = 1 + (r_f + \beta\cdot\text{ERP})\cdot h/252$, under the platform scale and the re-centred shape. The median log return is therefore lower by the convexity term (≈ ½σ²_h for a Normal shape). Unit test: Normal shape ⇒ median = $\ln(1+\mu h/252) - \tfrac12\sigma_h^2$ (RT-04) |
| `hist_drift` (yardstick only) | $h \times$ the expanding mean of daily **log total return** from 1980-12-12 to the origin. Labelled "survivor-biased" everywhere. The 50%-shrink sensitivity row averages anchor and `hist_drift` **in the same moment** (expected simple return) (RT-04) |
| Horizon in sessions | Always computed from `exchange_calendars` (XNYS) at runtime, never hard-coded (RT-25) |
| Quantile grid (23) | 0.01, 0.025, 0.05, 0.10, 0.15, 0.20, 0.25, 0.30, 0.35, 0.40, 0.45, **0.50**, 0.55, 0.60, 0.65, 0.70, 0.75, 0.80, 0.85, 0.90, 0.95, 0.975, 0.99 (U.S. COVID-19 Forecast Hub grid; Bracher et al. 2021) |
| Representations accepted | `quantiles` (grid or superset) · `parametric` (Normal, Student-t, skew-t, mixture) · `samples` (≥ 2,000 draws). The platform normalises all three to the grid |
| Validity | Finite; strictly increasing (crossings > 1% of the 5–95% width are an error); $q_{0.01} > -3$, $q_{0.99} < 3$; 5–95% width > 0 |
| CDF between quantiles | Piecewise-linear CDF, with exponential tails beyond $q_{0.01}$ and $q_{0.99}$ (A2 QNT-074) |
| Price conversion | Price quantiles are derived from TR quantiles minus the PIT expected dividend yield (A2 QNT-241). The headline is AAPL **price at ≈ 1 Dec 2027** (252 sessions after the 30 Nov 2026 close) |
| Secondary line (31 Dec 2027) | h ≈ 273 XNYS sessions after the 30 Nov 2026 close (computed at runtime; confirm on D1), **extrapolated** from the 126- and 252-session anchors with the QNT-087 scheme: median $m(h)$ linear in $h$, squared 80% width $w^2(h)$ linear in $h$, standardised shape held at its 252-session value. It is labelled "extrapolated" wherever shown (W1 gap) |
| Base rate for P(price > P₀) | Shown next to every P(up): (i) the share of AAPL 252-session windows with a positive price return, using all history up to the forecast date and labelled "survivor-biased"; (ii) the same share for the S&P 500 (D-048) |

## 3. Manifest (declared once per analyzer version)

```yaml
id: macro.usd_sensitivity          # stable, dot-namespaced
version: 1.0.0                     # semver; platform appends the code hash
name: "USD index sensitivity"
author: "handle-maya"              # pseudonymous handle; no personal data in repo
idea_card: IC-007                  # pre-registration link (required for teammate ideas)
family: macro.fx                   # assigned by the integrator from the fixed family list (§7)
category: macro                    # macro | sector | fundamental | technical | event | sentiment | statistical | judgemental | baseline
report_section: macro              # intro | macro | sector | fundamental | future
informs: [location]                # location | scale | both (A5); the missing part comes from the platform default partner
hypothesis: "A stronger USD lowers AAPL's USD-reported foreign revenue and next-quarter returns."
expected_direction: "USD up -> lower forward return"   # used by C3's sign restriction
course_concepts: ["FX exposure of multinationals", "CAPM"]
references: ["ref:apple-10k-2026-fx", "ref:jorion-1990"]   # keys into the citation registry
horizons: [21, 63, 126, 252]
data_dependencies: ["FRED:DTWEXBGS", "PX:AAPL:close_base"]
min_history_sessions: 756
calibrator: C3
params_schema:                     # JSON Schema generated from Pydantic; drives UI forms
  lookback_weeks: {type: integer, default: 156, minimum: 52, maximum: 260}
param_grid_declared: {lookback_weeks: [104, 156, 208]}   # declared up front; each evaluated config is a logged trial
```

## 4. Inputs: `AsOfContext` (semantic API; implementation in `probcast/sdk/context.py`)

```python
def forecast(ctx: AsOfContext, params: Params) -> ForecastBundle | Abstain: ...

ctx.asof                                              # tz-aware session close of the origin
ctx.prices("AAPL", field="close", basis="base_share")  # as-traded prices in forward base-share units, truncated at asof
ctx.tri("AAPL")                                       # forward-built total-return index up to asof
ctx.series("FRED:DGS10")                              # per-series availability rule applied (§6)
ctx.fundamentals("AAPL", concept="Revenues", freq="FQ", vintage="as_first_reported" | "latest_known")
ctx.events(kind="earnings")                           # rows with content_available_at <= asof; hindsight fields stripped
ctx.labels(h=21)                                      # realised (s, y_{s,h}) pairs with s + h <= asof (purged)
ctx.vol(h)                                            # platform scale model vol.ewma_blend (+ earnings bump)
ctx.anchor(h)                                         # platform location anchor distribution (CAPM, ADR-006)
ctx.calibrate(signal_history, method="C1", h=21)      # PIT calibrators C1, C3, C5 (+ elicited for judgemental)
ctx.rng                                               # numpy Generator seeded per (run, analyzer, origin)
```

Data returned by `ctx` is **physically truncated** at `asof` (copies, not views over the full table). `importance`, `selection_method` and any other hindsight-labelled field never reach `ctx`.

## 5. Output: `ForecastBundle`

```yaml
ForecastBundle:
  analyzer_id: macro.usd_sensitivity
  analyzer_version: 1.0.0+3f9c2ab
  params_hash: 9b1e…
  asof: 2016-03-31T20:00:00Z
  forecasts:
    "63":
      quantiles: {"0.01": -0.31, …, "0.5": 0.021, …, "0.99": 0.29}   # log TR, 23 levels
      signal: -1.43                     # optional raw score before calibration (for IC); unconstrained scale
      calibration: {method: C3, n_pairs: 1830, n_eff: 88, beta: -0.12, sign_restricted: false}
      explanation:
        drivers: [{name: "USD 13w change", value: 0.034, contribution_to_median: -0.006, source: "FRED:DTWEXBGS@2016-03-30"}]
        notes_template: "USD index rose {value:+.1%} over 13 weeks; historically ({n_eff} windows) this preceded a {effect:+.1%} shift in the 63-session median."
    "5": {abstain: "horizon not declared"}
  lineage: [{series_id: FRED:DTWEXBGS, snapshot_id: r1-dev, max_available_at: 2016-03-30T…}]
```

## 6. Availability rules (one table, owned by `07-data/data-plan.md`)

Every series has exactly one rule. The provenance chip shows it. **Strict mode** applies each series' true publication lag, as listed in the strict-mode column below. It is shown as the robustness row on every tear sheet (RT-09).

| Class | Rule (normal mode) | Strict mode |
|---|---|---|
| Exchange prices, volumes | Same session close | Same session close |
| **Market-observable rates**: Treasury yields (DGS*), bilateral FX (DEX*), VIX, VXAPLCLS (`available_basis: market_observable`, because closing market rates were observable at the close; FRED is a later archive) | Same session close | True publication lag: H.15 yields +1 session; H.10 FX next weekly release; CBOE indices +1 session (VIX settles 16:15 ET, after the 16:00 origin) |
| Constructed weekly indices (e.g. DTWEXBGS broad dollar index) | ALFRED `realtime_start` (weekly publication); never daily back-fill | Same |
| Monthly macro (CPI, unemployment, sentiment, PPI) | ALFRED first-release vintage `realtime_start` | Same |
| SEC filings / XBRL facts | EDGAR `acceptanceDateTime` (true **UTC**, converted to America/New_York; CRT-A-004), usable at the first session close ≥ acceptance | Same |
| Earnings press releases | 8-K acceptance time; Apple releases after 16:00 ET, so the first usable close is the next session | Same |
| Curated events | `content_available_at` (earliest cited public timestamp, never the period-of-report date) | +1 session |

## 7. Families (committee voting units)

There is a fixed list of 8 families, and the integrator assigns each analyzer to one before Fri 27 Nov: `technical.trend` · `technical.reversion` · `volatility` · `macro.rates` · `macro.fx` · `valuation` · `events` · `sentiment_alt`. There is one vote per family (A2 QNT-205). The anchor (CAPM) has a **fixed 25% weight**, shown with a sensitivity row (CRT-A-019).

## 8. Calibrators in R1

| ID | Name | Use | Key defaults |
|---|---|---|---|
| C1 | Conditional empirical distribution with shrinkage | Rule or bucket signals | κ = 20; $n_{\text{eff},b} \ge 5$ or unconditional; vol-standardised; centred on the anchor |
| C3 | Predictive regression + residual bootstrap | Continuous signals | Ridge prior $N(0, 0.1^2)$ on β; sign restriction from `expected_direction` |
| C5 | Model-implied | Simulation and valuation analyzers (GBM, bootstrap, GARCH) | Samples or parametric output |
| CJ | Elicited quantiles | Judgemental views (overlay only, ADR-009) | Three-point elicitation (q10, q50, q90) → skew-t fit |

C2 (Platt), C4 (quantile regression) and C6 (PIT recalibration) are R2. A5's `ANL-CAL-xx` numbers are kept only as aliases.

### 8.1 Drift-neutrality rule (binding; RT-01)

1. **Excess, standardised outcomes.** Calibrators work on $z_u = (y_{u,h} - a_{u,h})/\hat\sigma_{u,h}$, where $a_{u,h}$ is the anchor's median log return at $u$ (§2).
2. **Re-centring.** Every shape or residual distribution (C1's bucket and unconditional ECDFs, C3's residuals, the block-bootstrap baseline, the forecast floor) is **re-centred to zero median** using past pairs only (expanding, PIT) before the anchor location is added back.
3. **C1 location** = anchor + $\hat\sigma_{t,h}\cdot\lambda_b\,(\text{median}(Z_b) - \text{median}(Z_{all}))$. Only the *difference* between the bucket and the unconditional sample can move the forecast; the unconditional excess never can.
4. **C3** fits $z_u = \alpha + \beta\tilde s_u + \varepsilon_u$ but **forecasts with α = 0**. $\hat\alpha$ is reported as a diagnostic, "unconditional excess drift (survivor-biased)", and is excluded from the forecast.
5. **Tear sheets and the committee panel** show the **mean location tilt vs the anchor** over the backtest, in pp/yr.

## 9. Scale model (one engine)

`vol.ewma_blend` (A2 QNT-086: λ = 0.94; 10-year long-run variance; φ = 0.98) **plus the earnings-aware bump** $n_E \cdot \sigma^2_E$ (CRT-A-030; σ²_E is the PIT mean squared earnings-day abnormal return over the 88 releases). Baselines, calibrators and default partners all use it. GJR-GARCH is an **analyzer**, not the engine.

## 10. Versioning, caching, determinism

`analyzer_version` = semver + hash(source, manifest, calibrator code, platform version). Forecast cache key = `(analyzer_version, params_hash, origin, horizon, snapshot_id)`. Monte Carlo analyzers use only `ctx.rng`, so re-runs are bit-identical. Every evaluated (analyzer_version, params) pair is appended to the **trials registry**. Entries can't be deleted.

## 11. Acceptance gate (analyzer enters the committee only if all pass)

1. Schema-valid manifest, an idea card linked (teammate ideas) and a family assigned.
2. Leak suite green: T1 future-poisoning (20 origins), T2 truncation equivalence, T3 order independence, T5 as-of canary, T7 hindsight-field stripping.
2b. **T-DN drift neutrality (difference-in-differences; amended by D-072):** the same synthetic return path is run with and without a constant +8%/yr excess return over the anchor (CAPM inputs unchanged). The analyzer's tilt vs the anchor must not move: the signed mean change over 40 origins × horizons is within **±0.8 pp/yr** (10% of the injected excess) and within ±1.5 pp/yr for every horizon. The survivor-biased `hist_drift` yardstick is the negative control and moves by ≈ +8 pp/yr (RT-01).
2c. **T6-lite warning:** 12-month CRPSS > 25% or 21-session hit rate > 65% over ≥ 100 origins raises a CLI warning that requires a recorded human review (RT-18).
3. A complete walk-forward over the **pre-holdout pairs** (outcome date ≤ 2020-12-31, §2) without errors.
4. Not significantly worse than the anchor at its declared horizons on the **val** segment (HLN-DM, one-sided 10%). The gate has low power at 252 sessions, and the UI says so.

**Anchor validation (RT-15).** The anchor itself (CAPM location + `vol.ewma_blend` with earnings bump + re-centred shape) must show 50/80/95% coverage within ±10 pp at 21, 63 and 252 sessions over pre-holdout pairs, with a PIT histogram. It is displayed on About › Scoring and in the methods facts. Every skill number is paired with the location/scale split, so that "beats CAPM" cannot be achieved only by fixing the anchor's scale.
5. A tear sheet has been generated and the implementer's checklist is complete (`05-requirements/idea-card.md` §4).
