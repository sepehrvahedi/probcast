# How the committee combines

The committee turns many analyzers into one 12-month predictive distribution. The method is fixed in advance and has no tuning knobs.

## Families and equal weights

Analyzers belong to one of eight fixed **families**: `technical.trend`, `technical.reversion`, `volatility`, `macro.rates`, `macro.fx`, `valuation`, `events` and `sentiment_alt`. Each family gets **one equal vote**, so many similar ideas cannot dominate.

Members enter only through the gate: schema, leak-tested, T-DN drift neutrality, a T6-lite review if warned, a complete pre-holdout walk-forward, not significantly worse than the CAPM anchor on the validation segment (HLN-DM, one-sided 10%), and a tear sheet.

## Quantile averaging

Families are combined by **quantile averaging** (Vincentization): their forecast quantiles are averaged level by level. The CAPM anchor joins with a **fixed 25% weight**; the families share the remaining 75%.

Its **effective location weight** is higher than 25%, because scale-only families such as `volatility` leave the median at the anchor. Every committee view states both numbers.

## Drift-neutral calibration

Calibrators work on excess, standardised outcomes and re-centre every shape to a zero median using past pairs only, so the stock's past excess return cannot create a tilt on its own (contract §8.1). The committee panel reports the **mean location tilt** against the anchor, in percentage points per year, and the T-DN drift-neutrality status.

## Spread recalibration

After averaging, the spread is recalibrated so that the committee's intervals cover as stated on past pairs.

## Why is the median where it is?

The **median waterfall** decomposes the committee median exactly, in log-return space:

$$
m_{\text{committee}} = m_{\text{CAPM}} + \sum_{f} w_f\,(m_f - m_{\text{CAPM}}) + \Delta_{\text{spread}}
$$

Each bar is a family's weight times the gap between its median and the CAPM median. The CAPM anchor contributes 0 by construction. Price labels are converted from the log steps and do not add up.

P(price higher) is not additive across families, so its attribution is **leave-one-family-out**: the change in P(price higher) when one family is removed, not a share of a total.

## Scenarios and sensitivity

Scenarios use fixed economic thresholds on the 12-month total return: **R < −15%**, **−15% to +15%** and **R > +15%**. The probabilities are findings, not assumptions.

The **anchor-sensitivity table** shows the forecast under five location anchors: CAPM with an equity risk premium of 4%, 5% (headline) and 6%, a 50% shrink to hist_drift, and hist_drift itself (survivor-biased).

## Freeze and reveal

The final forecast is computed and hashed (SHA-256) at the freeze on Mon 30 Nov 23:59 UK. The freeze is a witnessed command-line action, `probcast committee freeze`; the app shows the freeze history read-only. The holdout reveal on Tue 1 Dec 12:00 UK unseals scores only; the forecast hash is unchanged.
