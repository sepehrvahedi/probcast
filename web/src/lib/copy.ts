/**
 * Microcopy deck (ux-spec §7). Fixed strings live here so no screen can reword them.
 * Ticker-specific copy takes the ticker as a parameter (D-070: no hard-coded ticker).
 */

export const PRODUCT = "ProbCast";
export const TAGLINE = "Ex-ante by construction";

/** §7.2 short form. DisclaimerBar has no text prop: this constant is the only source. */
export const DISCLAIMER = "Educational research tool. Not investment advice.";

export const DISCLAIMER_FULL =
  "ProbCast is an educational research tool built for a university coursework project. It presents data and probabilistic forecasts. It does not provide investment advice or recommendations to buy or sell any security. Forecasts are uncertain, and a method's past performance does not guarantee its future results. Data may be delayed, revised or incomplete; check the sources before relying on any figure.";

// §7.5 Sealed holdout
export const HOLDOUT = {
  statusSealed: "Holdout ≥ 2021 sealed until 1 Dec 12:00 UK",
  statusSealedShort: "Sealed ≥ 2021",
  statusFrozen: "Holdout ≥ 2021 sealed until 1 Dec 12:00 UK · methods frozen",
  statusRevealed: "Holdout ≥ 2021 revealed 1 Dec (witnessed)",
  chip: "Holdout ≥ 2021 · sealed",
  region: "Holdout ≥ 2021 · sealed",
  cell: "Sealed",
  column: "Holdout 2021–2026 (revealed 1 Dec, witnessed)",
  popover:
    "Forecasts whose outcome date falls on or after 1 Jan 2021 are scored only once, at a witnessed reveal on Tue 1 Dec 2026 at 12:00 UK. This includes forecasts made in 2020 whose horizon ends in 2021: a 12-month forecast made at the 30 June 2020 close is sealed. Every analyzer and the committee are frozen first (Mon 30 Nov 23:59 UK), and the final forecast is computed and hashed at that freeze; the reveal unseals scores only and never changes the forecast. Until then these scores are hidden everywhere, so nobody can tune an idea to them. Prices and other data after 2021 stay visible: the holdout seals scores, not data. This makes it pseudo-out-of-sample: scores sealed and methods frozen; the data and history are public knowledge.",
  revealedNote: (time: string, n: number) =>
    `Revealed once on Tue 1 Dec 2026 at ${time} UK in front of ${n} witnesses. These numbers were not used to choose or tune any method. The forecast was hashed at the Mon 30 Nov freeze and is unchanged. Only the 21- and 63-session results are reported; at 126 and 252 sessions the holdout is insufficient evidence.`,
  integrity: "Integrity check: holdout scores received while sealed. Not displayed.",
} as const;

// §7.6 Leak-tested
export const LEAK = {
  badge: "Leak-tested",
  popoverTitle: "Leak-tested (future-poisoning).",
  popover: (date: string) =>
    `On ${date} this analyzer passed ProbCast's leak suite: when data after each of 20 forecast dates was scrambled, its forecasts did not change (T1); truncated and full data gave identical forecasts (T2); the order of inputs did not matter (T3); a canary series confirmed the as-of rule (T5); hindsight-only fields could not be read (T7); and, on a synthetic market with a built-in excess return, its median stayed at the CAPM anchor unless its signal said otherwise (T-DN, drift neutrality).`,
  notCovered:
    "What it does not cover: which ideas the team chose to test (selection hindsight), revisions made by a source before we first downloaded it, approximate availability times before 2009, and how the events list was curated.",
  failed: (test: string, date: string) =>
    `Leak test failed: ${test} on ${date}. This analyzer cannot join the committee until it passes.`,
} as const;

// §7.7 Survivor-biased yardstick
export const YARDSTICK = {
  short: "hist_drift · survivor-biased",
  long: "hist_drift yardstick · survivor-biased",
  tooltip: (ticker: string) =>
    `Historical-drift yardstick: ${ticker}'s average daily log total return from its listing up to each forecast date, scaled to the horizon. It is shown for comparison only. It is survivor-biased: we study this stock because it became one of the world's most valuable companies, so its own past average overstates what an investor could have expected in advance. Headline skill is measured against the CAPM anchor instead.`,
} as const;

// §7.8 Anchor, attribution, scenarios and probability notes
export const ANCHOR_NOTE = (effective: string) =>
  `Anchor: CAPM. The committee's location is anchored on the CAPM expected return: the 1-year Treasury yield plus β × a 5% equity risk premium, with β estimated at each date from 5 years of monthly returns against the S&P 500 total return (Blume-adjusted). The anchor fixes the expected simple return, so the median log return sits slightly below it (the Jensen gap). The anchor has a fixed 25% weight; its effective location weight is ${effective} because scale-only families such as volatility leave the median at the anchor. It is a modelling assumption; the table shows how the forecast changes under other choices.`;

export const ANCHOR_CAPTION = (ticker: string, target: string) =>
  `Median and 80% range of the ${ticker} price on ≈ ${target} under five location anchors. The headline uses CAPM with a 5% equity risk premium. hist_drift is survivor-biased and shown as a yardstick only.`;

export const BASE_RATE = (ticker: string, x: string, period: string, y: string) =>
  `Base rate: ${ticker}'s price rose over ${x} of past 12-month windows (${period}); the S&P 500 rose over ${y}.`;

export const WATERFALL = {
  title: (m: string) => `Why is the median ${m}?`,
  note: "Each bar is the family's weight × (family median − CAPM median), in percentage points of 12-month log total return. In log terms the bars add up exactly to the committee median. Price values are converted from these log steps for reading and do not add up. The CAPM anchor (25%) contributes 0 by construction.",
  blocked: "Attribution does not reconcile; not displayed.",
  blockedBody: "The family contributions do not add up to the committee median.",
} as const;

export const LOFO = {
  title: "Effect of each family on P(price higher) · leave-one-family-out",
  note: "P(up) is not additive across families, so each bar is the change when that family is left out, not a share of a total.",
} as const;

export const WEIGHTS_NOTE =
  "Weights are equal by design: one vote per family, plus the CAPM anchor at 25%.";

export const SCENARIO = {
  labels: { bear: "Bear", base: "Base", bull: "Bull" },
  note: "Thresholds are fixed economic levels, so the probabilities are findings, not assumptions. Narratives are written by the team; ProbCast supplies the numbers.",
  defs: "R = 12-month total return",
} as const;

export const BASELINE_ONLY =
  "Baseline committee: no family is active yet, so the forecast uses the CAPM anchor with bootstrap and volatility baselines only.";

// §7.9 Final-forecast caveats
export const CAVEATS = {
  selection: (ticker: string) =>
    `Selection bias: ${ticker} was chosen with knowledge of its past success; its historical average return overstates a forward-looking expected return.`,
  anchorAssumption: "The anchor is a modelling assumption.",
  jensen: (vol: string, gap: string) =>
    `The mean price is above the median because returns compound: with a 12-month volatility of about ${vol}, the gap is about ${gap}. The median is the central forecast.`,
  priceFromTR: (dy: string) =>
    `The fan is drawn in price for readability. ProbCast forecasts total return (dividends reinvested) and converts it to price using an expected dividend yield of ${dy}.`,
  workingChip: "Working forecast · not frozen",
  frozenChip: (n: number, when: string, hash: string) =>
    `Committee forecast v${n} · frozen ${when} · forecast hash ${hash}`,
  registered: (when: string, hash: string, scoreOn: string) =>
    `Registered as the prospective forecast on ${when} · hash ${hash} · to be scored ≈ ${scoreOn}.`,
  notFrozen:
    "Not frozen yet. Final freeze Mon 30 Nov 23:59 UK: the final forecast is computed and hashed then, before the reveal.",
} as const;

// §7.4 Insufficient evidence
export const INSUFFICIENT = {
  hidden: (n: string) =>
    `Not enough independent observations to show this number (n_eff ≈ ${n}; the minimum is 10).`,
  greyed: (n: string) =>
    `insufficient evidence · Only ${n} independent observations. The number is shown for transparency; no test is reported below 20.`,
  gradeD: "Insufficient evidence to assess this method at this horizon.",
  committee12m: (n: string) =>
    `At 12 months ProbCast reports calibration only. With about ${n} independent 12-month outcomes, differences in skill cannot be detected reliably.`,
  region: "insufficient evidence",
} as const;

// §7.10 Empty states
export const EMPTY = {
  forecast: {
    title: "No committee forecast yet",
    body: "The forecast appears once baselines have run on the current snapshot. The PO creates it with",
    cli: "probcast committee evaluate",
  },
  leaderboard: {
    title: "No scored analyzers yet",
    body: "Analyzers appear here after a standard run on the current snapshot.",
  },
  run: {
    title: "Run not found",
    body: "This run ID does not exist on this laptop. It may come from another snapshot or a deleted branch.",
  },
  attribution: {
    title: "No family contributions yet",
    body: "Contributions appear when at least one family passes the committee gate.",
  },
  runs: { title: "No runs yet", body: "Run the standard protocol to score this analyzer." },
} as const;

// §7.11 Errors and blocks
export const ERRORS = {
  offline: (host: string) => `Can't reach the ProbCast engine at ${host}.`,
  offlineBody: (time: string) => `Start it with \`just serve\`. Showing cached data from ${time}.`,
  intervalMissing: "Interval missing — not displayed.",
  intervalMissingBody: "A forecast is never shown without its range.",
  failedRun: (stage: string) => `Run failed at ${stage}.`,
  failedRunBody: "Nothing from this run is used anywhere.",
  generic: (thing: string) => `Something went wrong loading ${thing}.`,
} as const;

// §7.12 notices
export const NOTICES = {
  stalePrices: (n: number, date: string) =>
    `Prices were last updated ${n} trading days ago (${date}). Numbers on this page use data to ${date}. The PO refreshes data with \`probcast ingest all\` and a new snapshot.`,
  olderSnapshot: (old: string, cur: string) =>
    `This run used snapshot ${old}; the current snapshot is ${cur}.`,
} as const;

/** Banned in UI strings (§7.1, NFR-ACA-04). Checked by src/lib/copy.test.ts over web/src. */
export const BANNED = [
  "buy",
  "sell",
  "target price",
  "price target",
  "recommend",
  "should invest",
  "guaranteed",
  "risk-free",
  "will rise",
  "will fall",
  "beat the market",
  "AI predicts",
  "Success!",
  "PIT-verified",
  "PIT guard",
  "Why is P(up)",
  "Inverse-CRPS",
  "weights over time",
] as const;
