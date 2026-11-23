# How forecasts are scored

Every analyzer forecasts the whole distribution of the forward log total return, as 23 quantiles, at five horizons (5, 21, 63, 126 and 252 sessions). Scores compare those distributions with what happened.

## CRPS and CRPSS

The **continuous ranked probability score** measures the distance between the forecast's cumulative distribution _F_ and the outcome _y_:

$$
\mathrm{CRPS}(F, y) = \int_{-\infty}^{\infty} \big(F(x) - \mathbf{1}\{x \ge y\}\big)^2 \, dx
$$

Lower is better. It rewards forecasts that are both calibrated and sharp (Gneiting and Raftery, 2007). ProbCast computes it exactly from the 23 quantiles, with a piecewise-linear CDF and exponential tails.

The **skill score** compares a method with a reference:

$$
\mathrm{CRPSS} = 1 - \dfrac{\overline{\mathrm{CRPS}}_{\,\mathrm{method}}}{\overline{\mathrm{CRPS}}_{\,\mathrm{reference}}}
$$

Above zero means better than the reference.

## The CAPM anchor and the hist_drift yardstick

The headline reference is the **CAPM anchor**. It fixes the expected simple return over _h_ sessions:

$$
E\!\left[e^{y_{t,h}}\right] = 1 + \left(r_f + \beta \cdot \mathrm{ERP}\right)\frac{h}{252}
$$

with the 1-year Treasury yield as $r_f$, an equity risk premium of 5% and β estimated at each date. Because returns compound, the median log return sits slightly below the mean (the Jensen gap). The anchor is validated by its own coverage: 50%, 80% and 95% intervals must cover within ±10 pp at 21, 63 and 252 sessions, with a PIT histogram.

**hist_drift** is the stock's own average past log total return scaled to the horizon. It is shown beside the anchor as a yardstick only, and is always labelled **survivor-biased**: the stock is studied because it succeeded, so its own past average overstates what was expectable in advance.

## Uncertainty: confidence intervals and tests

- Every CRPSS carries a **90% confidence interval** from the stationary bootstrap (Politis and Romano, 1994), which respects the overlap between forecasts.
- Forecast comparisons use the **HLN-adjusted Diebold–Mariano test** (Harvey, Leybourne and Newbold, 1997).
- **n_eff** is the effective number of independent observations. Monthly forecasts of 12-month returns overlap by 11 months, so about 400 monthly origins carry only about 33 independent outcomes.

Display rules: a metric with n_eff below 10 is hidden (—); between 10 and 19 it is greyed and no test is reported; tests are reported from 20.

## Evidence grades

| Grade                       | Rule                                                                                                                          |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| ● A · Strong evidence       | n_eff ≥ 100; CRPSS 90% CI excludes 0; HLN-DM p < 0.05; BH q < 0.10; holdout CRPSS > 0 if revealed; 80% coverage within ±10 pp |
| ◐ B · Moderate evidence     | n_eff ≥ 40; HLN-DM p < 0.10; holdout not significantly negative; coverage within ±10 pp                                       |
| ◔ C · Weak evidence         | n_eff ≥ 20; CRPSS point estimate > 0; coverage within ±15 pp                                                                  |
| ○ D · Insufficient evidence | Anything else                                                                                                                 |
| ⊘                           | Shown with D when the CRPSS 90% CI lies wholly below 0: worse than the CAPM anchor                                            |

Skill is described as "consistent with real skill against the anchor" only at grade B or above; otherwise the verdict says "not distinguishable from the CAPM anchor". Most analyzers grade C or D at 12 months on one stock; that is the honest state of the evidence.

## Minimum detectable effect

The **MDE** is the smallest skill the sample could reliably distinguish from zero. A smaller true effect would usually look like noise. It is shown next to every skill value.

## Calibration

- **Reliability diagram** — forecast probability against observed frequency, in 10 bins with counts; a calibrated forecaster lies on the diagonal.
- **PIT histogram** — the share of outcomes in each tenth of the forecast distribution. Flat is calibrated; U-shaped is overconfident; hump-shaped is underconfident; sloped is biased. At 252 sessions it is computed on non-overlapping sub-series.
- **Coverage** — how often the 50%, 80% and 95% intervals contained the outcome, with binomial intervals.

## References

- Gneiting, T. and Raftery, A.E. (2007) 'Strictly proper scoring rules, prediction, and estimation', _Journal of the American Statistical Association_, 102(477), pp. 359–378.
- Harvey, D., Leybourne, S. and Newbold, P. (1997) 'Testing the equality of prediction mean squared errors', _International Journal of Forecasting_, 13(2), pp. 281–291.
- Politis, D.N. and Romano, J.P. (1994) 'The stationary bootstrap', _Journal of the American Statistical Association_, 89(428), pp. 1303–1313.

Each cited work must be opened by a teammate before the report relies on it.
