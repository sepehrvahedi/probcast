/**
 * Plain-language vocabulary for the idea studio (one place, so every page says the same thing).
 * Target reader: someone who does not work in finance.
 */
import * as fmt from "@/lib/fmt";
import type { CardStatus, Headline, MetricCell } from "./api";

export const SIMPLE_GUESS = "the simple guess";

export const GLOSSARY: { term: string; meaning: string }[] = [
  {
    term: "Idea",
    meaning:
      "A rule of thumb about what makes the stock go up or down, written in plain words (for example “after a big drop the price bounces back”). It is turned into an exact rule the computer can test.",
  },
  {
    term: "Backtest",
    meaning:
      "Going back in time and pretending it is the end of every month since 1990. Each time, the idea only sees what was known on that day and makes a forecast. Then we check what really happened.",
  },
  {
    term: "Looking ahead",
    meaning:
      "How far into the future a forecast reaches: 1 week, 1 month, 3 months, 6 months or 1 year. Every idea is tested at each distance it covers.",
  },
  {
    term: "The simple guess",
    meaning:
      "The yardstick every idea must beat. It assumes the stock just grows at the normal long-run rate for a stock this risky (worked out from interest rates and how much the stock moves with the whole market), with its usual ups and downs. It knows nothing clever. An idea is only useful if it does better than this.",
  },
  {
    term: "Better than the simple guess",
    meaning:
      "Our main score. It compares the whole forecast (the best guess and the range around it) with what happened, and says how much closer the idea got than the simple guess, in %. +2% means 2% more accurate. Negative means worse. Even +1% is meaningful for stock prices, which are very hard to predict.",
  },
  {
    term: "Right direction",
    meaning:
      "How often the idea correctly said whether the price would be higher or lower. Compare it with the simple guess: if the stock mostly went up, a guess that always says “up” is already right most of the time.",
  },
  {
    term: "Typical miss",
    meaning:
      "How far the best guess usually was from the real price, as a % of the price. Lower is better.",
  },
  {
    term: "Likely range",
    meaning:
      "The band the forecast says the price will land in 8 times out of 10. If the price lands inside it about 80% of the time, the forecast is honest about its uncertainty: not too confident, not too timid.",
  },
  {
    term: "Consistency",
    meaning:
      "We reshuffle the history 1,000 times in chunks and re-score the idea each time. Consistency is how often it still beats the simple guess. Near 100% means the result is solid; near 50% means it could easily be luck.",
  },
  {
    term: "Say in the final forecast",
    meaning:
      "How much the idea counts in the combined forecast. Ideas that beat the simple guess get a say in proportion to how well they did (pulled part of the way towards an equal share so that one lucky idea can't take over). Ideas that don't beat it get no say. The simple guess always keeps 25%.",
  },
  {
    term: "Recent years count more",
    meaning:
      "When we add up an idea's track record, a result from 5 years ago counts half as much as one from today, and one from 10 years ago a quarter. Markets change, so recent behaviour matters more.",
  },
  {
    term: "Confidence-weighted growth",
    meaning:
      "Expected growth multiplied by consistency: how often this stock's combined forecast was more accurate than the simple guess when history was reshuffled 1,000 times. +7% growth at 90% consistency counts as +6.3%; the same +7% at 30% counts as +2.1%. It ranks stocks by growth you have reason to trust. It is still a forecast, not a promise.",
  },
  {
    term: "Advanced method",
    meaning:
      "An idea that is a model rather than a rule of thumb: statistical models of turbulence and market moods, machine learning retrained every month, or a pretrained AI forecasting model. They follow exactly the same rules as every other idea: they only see what was known at each date, and they are judged against the simple guess on every stock.",
  },
  {
    term: "Across all stocks",
    meaning:
      "Every idea is tested on each of the 32 largest US companies, not only the one you are looking at. If a rule really captures something about how markets work, it should help on many stocks, not just one. This is the most reliable verdict.",
  },
  {
    term: "Luck check",
    meaning:
      "When you try many ideas, a few will look good by pure chance, just as a few people in a big room will flip five heads in a row. We have tested every idea on every forecast length, so we raise the bar to match: an idea passes only if its result across all stocks is too strong to be explained by that many tries (a false-discovery-rate test, Benjamini and Hochberg 1995). Only ideas that pass can be called “Helps”. Deleted ideas still count as tries.",
  },
  {
    term: "Survivor bias",
    meaning:
      "The 32 stocks were chosen because they are the biggest companies today, so we already know they did very well. Any test on them looks rosier than it would have at the time. The simple guess is affected in the same way, so comparisons between an idea and the simple guess are much fairer than raw returns.",
  },
  {
    term: "No peeking at the future",
    meaning:
      "Every idea is automatically checked to make sure that, at each date, it could only use information that was public at that time (prices, company reports, news). Without this, a backtest can look brilliant and mean nothing.",
  },
];

export const STATUS_WORDS: Record<CardStatus, { label: string; next: string }> = {
  waiting: {
    label: "Needs building",
    next: "Implement the idea as a testable rule.",
  },
  ready: { label: "Ready to test", next: "Press “Test this idea” to run it through history." },
  running: { label: "Testing…", next: "Going through history month by month." },
  scored: { label: "Tested", next: "Results below." },
  error: {
    label: "Needs attention",
    next: "The rule linked to this idea is missing; check the analyzer link.",
  },
};

export type VerdictKind = "helps" | "unclear" | "worse" | "none";

/** One-word verdict from the recency-weighted score and its bootstrap consistency. For an idea,
 * ``proven`` is whether its all-stocks result passed the luck check at this horizon (D-103): an
 * idea that has not passed is never called "Helps". Leave it undefined for a single test. */
export function verdict(
  h: Pick<Headline, "score" | "support"> | null | undefined,
  proven?: boolean,
): {
  kind: VerdictKind;
  label: string;
  sentence: string;
} {
  if (!h || h.score == null || !Number.isFinite(h.score))
    return {
      kind: "none",
      label: "Not tested yet",
      sentence: "This idea has not been tested yet.",
    };
  if (h.score > 0 && h.support >= 0.9 && proven === false)
    return {
      kind: "unclear",
      label: "Promising, not proven",
      sentence:
        "This idea forecast better than the simple guess, but it hasn't passed the luck check: with this many ideas tried, a result like this can still happen by chance.",
    };
  if (h.score > 0 && h.support >= 0.9)
    return {
      kind: "helps",
      label: "Helps",
      sentence:
        "This idea forecast better than the simple guess, and the result holds up when history is reshuffled.",
    };
  if (h.score <= 0 && h.support <= 0.1)
    return {
      kind: "worse",
      label: "Doesn't help",
      sentence:
        "This idea forecast worse than the simple guess. It gets no say in the final forecast.",
    };
  if (h.score > 0)
    return {
      kind: "unclear",
      label: "Slightly helps",
      sentence:
        "This idea did a little better than the simple guess, but not consistently enough to be sure it isn't luck.",
    };
  return {
    kind: "unclear",
    label: "No clear effect",
    sentence:
      "This idea did about as well as the simple guess, or slightly worse. It gets no say in the final forecast.",
  };
}

export const AHEAD: Record<number, string> = {
  5: "1 week",
  21: "1 month",
  63: "3 months",
  126: "6 months",
  252: "1 year",
};
export const ahead = (h: number | null | undefined) =>
  h == null ? "—" : (AHEAD[h] ?? `${h} days`);

export const PERIOD: Record<string, string> = {
  "1y": "Last year",
  "3y": "Last 3 years",
  "5y": "Last 5 years",
  "10y": "Last 10 years",
  all: "Since 1990",
  recent: "Overall (recent years count more)",
};

/** "81 of 100" from a share. */
export const ofHundred = (p: number | null | undefined) =>
  p == null || !Number.isFinite(p) ? "—" : `${Math.round(p * 100)} of 100`;

/** Signed "+1.2%" / "−0.6%" with the word for the direction. */
export function betterWorse(x: number | null | undefined, dp = 1): string {
  if (x == null || !Number.isFinite(x)) return "—";
  if (Math.abs(x) < 0.0005) return "about the same";
  return `${fmt.pct(Math.abs(x), dp, false)} ${x > 0 ? "better" : "worse"}`;
}

export function enoughData(c: MetricCell | undefined): boolean {
  return !!c && c.skill !== undefined && (c.n_eff ?? 0) >= 3;
}
