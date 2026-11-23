# A4 — Apple Inc. (AAPL) company dossier and historical events corpus

| Field | Value |
|---|---|
| Agent | A4 (equity research analyst / historian) |
| ID prefix | `AAPL-` |
| Written | 2026-11-17 (all sources accessed 2026-11-17 unless stated) |
| Companion file | `docs/kb/07-data/seed/aapl_events_seed.csv` (261 events, 1976 to Nov 2026) |
| Report sections fed | Introduction (§1), Macro (§6), Sector (§7), Fundamental (§2 to §5), Future performance (§8, §9) |

**How to read this file.** Statements are tagged **[F]** fact (with source tag `[S#]` → §13 bibliography, URL + access date), **[A]** assumption or derived figure (method stated), **[R]** recommendation. `UNVERIFIED` marks anything not checked against a source in this session. Derived numbers are computed by A4 from the cited primary data and show the formula.

**Method note.** Most numbers come from primary sources pulled from SEC EDGAR: the submissions index, the XBRL "company facts" API, and the 10-K, 10-Q and 8-K documents with exhibits. Requests used a generic placeholder User-Agent (`OrchardResearch research@example.com`), which should become a configuration item in the platform. A3 should note that Stooq's CSV endpoint returned a JavaScript bot check, so no price series was downloaded. Price-dependent figures therefore use filed market values (public float) or cited news reports.

---

## 0. Ten findings that matter most (summary)

| ID | Finding |
|---|---|
| AAPL-001 | **[F] FY2026 (ended 26 Sep 2026) was a record year.** Net sales were $478.8bn (+15.1%), gross margin 48.8%, net income $132.2bn and diluted EPS $8.98 (+20%). iPhone grew +21% to $254.1bn and Services +13% to $123.3bn. The 10-K was filed **3 Nov 2026**, the day after the 2 Nov earnings release. [S1][S8][S10] |
| AAPL-002 | **[F] The CEO changed.** On 20 Apr 2026 (after the close) Apple announced that Tim Cook would become Executive Chair and **John Ternus** CEO, effective **1 Sep 2026**. Art Levinson became Lead Independent Director. The CFO (Kevan Parekh, 1 Jan 2025), COO (Sabih Khan, 25 Jul 2025) and General Counsel (Jennifer Newstead, 1 Mar 2026) also changed within 20 months. [S9][S22] |
| AAPL-003 | **[F] Tariffs reversed into a margin tailwind.** On 20 Feb 2026 the Supreme Court struck down the IEEPA tariffs. Apple applied for refunds and books them as a reduction of product cost of sales: ~1pt of Q4 FY2026 gross margin and $0.05 of Q4 EPS. Product gross margin rose to 39.3% (FY2025: 36.8%). [S1][S8] |
| AAPL-004 | **[F] Memory costs and supply are the stated forward headwind.** The FY2026 10-K reports "supply constraints and rising costs" for advanced semiconductors, memory and storage, and "expects these trends to intensify for memory and storage". [S1] |
| AAPL-005 | **[F] FX exposure is structural.** 65.0% of FY2026 net sales were outside the US (US $167.7bn of $478.8bn). Apple hedges only partly; its one-day 95% VaR on FX derivatives is $560m. The Jan 2019 profit warning attributed ~200bp of lost growth to the strong USD. [S1][S15] |
| AAPL-006 | **[F] Greater China came back.** Greater China sales were $82.4bn (+28%) in FY2026 after −4% in FY2025. Its share of sales is 17.2%, down from 25.1% in FY2015. Manufacturing remains concentrated in China mainland, India, Japan, South Korea, Taiwan and Vietnam. [S1][S7] |
| AAPL-007 | **[F] Services drive the margin mix.** Services were 25.8% of sales but ~40% of gross profit in FY2026 ($93.9bn of $233.6bn) at a 76.2% margin. Both Services profit pools now face legal risk: the US v. Google remedies (licensing revenue) are under appeal, and in the Epic contempt case (App Store commissions) the Supreme Court granted certiorari on 30 Jun 2026. [S1] |
| AAPL-008 | **[F] Capital return has shrunk the share count by about a third.** Repurchases totalled about $737bn in FY2018 to FY2026. Diluted shares fell from about 23.2bn in FY2015 (split-adjusted) to 14.7bn in FY2026 (−36.5%). Net cash fell from $141bn (FY2015) to $57bn (FY2026). [S10][A] |
| AAPL-009 | **[A] Valuation has re-rated from about 10–16× to about 30× and higher.** On public float ÷ trailing-twelve-month net income, the multiple was ~10.5× (Mar 2013) to ~16× (2017–19) and ~26–33× (2021–26). The 23 Oct 2026 close implies ~38–39× FY2026 earnings. Market value briefly reached ~$5.1tn on 23 Oct 2026 (iPhone Duo launch day). [S10][S31][S32] |
| AAPL-010 | **[F/A] Point-in-time traps are real.** Examples: the 2006 option-backdating restatement; the FY2019 restatement of FY2017 product categories (Services $29.98bn first reported vs $32.70bn restated); four splits since 2000; 14-week Q1s (FY2006, FY2012, FY2017, FY2023); and XBRL "latest" values that differ from what was known at the time. The events CSV therefore carries `available_at` and uses **as-reported** figures. [S6][S7][S11] |

---

## 1. Company snapshot (feeds report §1 "Introduction")

### 1.1 Business and listing
- [F] "The Company designs, manufactures and markets smartphones, personal computers, tablets, wearables and accessories, and sells a variety of related services." The fiscal year is the **52- or 53-week period ending on the last Saturday of September**. [S1]
  - FY2026 ended 26 Sep 2026. FY2027 runs 27 Sep 2026 to 25 Sep 2027. [S1][S12]
- [F] Current product lines (FY2026 10-K):
  - iPhone: iPhone Duo (foldable), 18 Pro, Air, 17, 17e, 16.
  - Mac: MacBook Neo, MacBook Air, MacBook Pro (incl. "Touch"), iMac, Mac mini, Mac Studio.
  - iPad.
  - Wearables, Home and Accessories: AirPods, Apple TV, Apple Watch, Beats, HomePod and accessories (category definition per the FY2020 10-K [S5]).
  - Services: advertising, AppleCare, cloud, digital content and payment services. [S1]
- [F] There is a **single class of common stock** on the **Nasdaq Stock Market LLC, ticker AAPL**, with no preferred stock outstanding. [S1][S12]
  - 14,532,182,000 shares outstanding at 23 Oct 2026; 21,458 holders of record. [S1]
  - Aggregate market value of non-affiliate stock was ~$3.647tn at 27 Mar 2026. [S1]
- [F] SIC 3571 (Electronic Computers); California corporation; CIK 0000320193; "Large accelerated filer". [S11]
- [F] Classification and index membership:
  - GICS: Information Technology → Technology Hardware, Storage & Peripherals (per the Wikipedia S&P 500 table; `UNVERIFIED` against S&P/MSCI directly). [S27]
  - S&P 500 member since 1982-11-30 (same source, `UNVERIFIED` against S&P DJI). [S27]
  - **Dow Jones Industrial Average since 19 Mar 2015** (announced 6 Mar 2015, replacing AT&T). [S28]
  - Nasdaq-100 member (start date `UNVERIFIED`).
- [F] ~**167,000** full-time equivalent employees at 26 Sep 2026. About **60%** of FY2026 net sales went through indirect channels (carriers, resellers). [S1]
- [F] IPO on **12 Dec 1980 at $22.00** per share ($0.10 split-adjusted). Incorporated **3 Jan 1977**. [S12]
- [F] Stock splits [S12][S13]:

  | Ratio | Declared | First split-adjusted trading day |
  |---|---|---|
  | 2:1 | 1987-04-22 | 1987-06-16 |
  | 2:1 | 2000-04-19 | 2000-06-21 |
  | 2:1 | 2005-02-11 | 2005-02-28 |
  | 7:1 | 2014-04-23 | 2014-06-09 |
  | 4:1 | 2020-07-30 | 2020-08-31 |

  - [A] Cumulative factor: 2×2×2×7×4 = **224 current shares per original IPO share**. $22.00 ÷ 224 = $0.098, which matches IR's "$.10".

### 1.2 Leadership history

| Period | CEO | Source / status |
|---|---|---|
| 1983–1993 | John Sculley (from PepsiCo) | Year per [S36]; start day `UNVERIFIED` (1983-04-08 in CSV) |
| 1993–1996 | Michael Spindler | `UNVERIFIED` (1993-06-18 in CSV) |
| 1996–9 Jul 1997 | Gil Amelio | Ouster date [S36]; start `UNVERIFIED` (1996-02-02) |
| 16 Sep 1997–2000 | Steve Jobs (interim) | [S36] (Steve Jobs page); the History of Apple page says "August 1997" — sources conflict |
| 2000–24 Aug 2011 | Steve Jobs | Resignation letter and 8-K [S37][S11]. Medical leaves 14 Jan 2009 and 17 Jan 2011 (8-Ks). Died 5 Oct 2011 (8-K) |
| 24 Aug 2011–31 Aug 2026 | Tim Cook (COO from 14 Oct 2005) | 8-Ks [S11] |
| 1 Sep 2026– | **John Ternus** (age 50; joined 2001; SVP Hardware Engineering) | 8-K 2026-04-20; 8-K/A 2026-09-01 [S9] |

- [F] Current senior team [S9][S11]:
  - Executive Chair: Tim Cook.
  - Lead Independent Director: Art Levinson (Chair for the previous ~15 years).
  - CFO: Kevan Parekh (since 1 Jan 2025; succeeded Luca Maestri, who succeeded Peter Oppenheimer in 2014).
  - COO: Sabih Khan (since 25 Jul 2025; succeeded Jeff Williams, COO from 16 Dec 2015).
  - General Counsel: Jennifer Newstead (from 1 Mar 2026; succeeded Kate Adams).
  - Principal Accounting Officer: Ben Borders (from 1 Jan 2026).
- [F] Ternus pay (8-K/A): $3m salary, plus a $55m target FY2027 equity award, of which 75% is performance RSUs vesting on TSR relative to the S&P 500. [S9]
- [A] Media report Johny Srouji's promotion to "Chief Hardware Officer" at the time of the CEO announcement (secondary, `UNVERIFIED`).

---

## 2. Revenue mix over time (feeds report §4 "Fundamental")

### 2.1 Net sales by category ($bn, as presented in the 10-K that covers the year)

| FY | iPhone | Mac | iPad | Wearables, Home & Acc. (pre-FY2018: "Other Products") | Services | Total | iPhone % | Services % |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| FY2015 | 155.0 | 25.5 | 23.2 | 10.1 | 19.9 | 233.7 | 66.3% | 8.5% |
| FY2016 | 136.7 | 22.8 | 20.6 | 11.1 | 24.3 | 215.6 | 63.4% | 11.3% |
| FY2017 (first reported) | 141.3 | 25.9 | 19.2 | 12.9 | 30.0 | 229.2 | 61.6% | 13.1% |
| FY2017 (restated, FY2019 10-K) | 139.3 | 25.6 | 18.8 | 12.8 | 32.7 | 229.2 | 60.8% | 14.3% |
| FY2018 | 164.9 | 25.2 | 18.4 | 17.4 | 39.7 | 265.6 | 62.1% | 15.0% |
| FY2019 | 142.4 | 25.7 | 21.3 | 24.5 | 46.3 | 260.2 | 54.7% | 17.8% |
| FY2020 | 137.8 | 28.6 | 23.7 | 30.6 | 53.8 | 274.5 | 50.2% | 19.6% |
| FY2021 | 192.0 | 35.2 | 31.9 | 38.4 | 68.4 | 365.8 | 52.5% | 18.7% |
| FY2022 | 205.5 | 40.2 | 29.3 | 41.2 | 78.1 | 394.3 | 52.1% | 19.8% |
| FY2023 | 200.6 | 29.4 | 28.3 | 39.8 | 85.2 | 383.3 | 52.3% | 22.2% |
| FY2024 | 201.2 | 30.0 | 26.7 | 37.0 | 96.2 | 391.0 | 51.4% | 24.6% |
| FY2025 | 209.6 | 33.7 | 28.0 | 35.7 | 109.2 | 416.2 | 50.4% | 26.2% |
| **FY2026** | **254.1** | **37.9** | **27.9** | **35.6** | **123.3** | **478.8** | **53.1%** | **25.8%** |

Sources: FY2015–17 [S7]; FY2017 restated, FY2018–19 [S6]; FY2020 [S5]; FY2021–23 [S4]; FY2024–26 [S1].

- [F] The FY2017 restatement moved about $2.7bn into Services and reshuffled hardware categories. This is the textbook point-in-time pitfall: a backtest run "as of 2018" must see the first-reported split, not the restated one. [S6][S7]
- [F] FY2026 drivers per the 10-K [S1]:
  - iPhone: "higher net sales of Pro models".
  - Mac: laptops.
  - Services: "advertising and cloud services".
  - iPad and Wearables: flat.
  - Wearables, Home & Accessories has declined every year since its FY2022 peak of $41.2bn.

### 2.2 Net sales by reportable (geographic) segment ($bn)

| FY | Americas | Europe¹ | Greater China² | Japan | Rest of APAC | Total | Greater China % | US net sales | Non-US % |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| FY2015 | 93.9 | 50.3 | 58.7 | 15.7 | 15.1 | 233.7 | 25.1% | 81.7 | 65.0% |
| FY2016 | 86.6 | 50.0 | 48.5 | 16.9 | 13.7 | 215.6 | 22.5% | 75.7 | 64.9% |
| FY2017 | 96.6 | 54.9 | 44.8 | 17.7 | 15.2 | 229.2 | 19.5% | 84.3 | 63.2% |
| FY2018 | 112.1 | 62.4 | 51.9 | 21.7 | 17.4 | 265.6 | 19.6% | 98.1 | 63.1% |
| FY2019 | 116.9 | 60.3 | 43.7 | 21.5 | 17.8 | 260.2 | 16.8% | 102.3 | 60.7% |
| FY2020 | 124.6 | 68.6 | 40.3 | 21.4 | 19.6 | 274.5 | 14.7% | 109.2 | 60.2% |
| FY2021 | 153.3 | 89.3 | 68.4 | 28.5 | 26.4 | 365.8 | 18.7% | 133.8 | 63.4% |
| FY2022 | 169.7 | 95.1 | 74.2 | 26.0 | 29.4 | 394.3 | 18.8% | 147.9 | 62.5% |
| FY2023 | 162.6 | 94.3 | 72.6 | 24.3 | 29.6 | 383.3 | 18.9% | 138.6 | 63.8% |
| FY2024 | 167.0 | 101.3 | 67.0 | 25.1 | 30.7 | 391.0 | 17.1% | 142.2 | 63.6% |
| FY2025 | 178.4 | 111.0 | 64.4 | 28.7 | 33.7 | 416.2 | 15.5% | 151.8 | 63.5% |
| **FY2026** | **198.1** | **127.6** | **82.4** | **30.9** | **39.9** | **478.8** | **17.2%** | **167.7** | **65.0%** |

¹ [F] "Europe includes European countries, as well as **India, the Middle East and Africa**." India's growth is therefore inside "Europe", not "Rest of Asia Pacific". [S1]
² [F] Greater China = China mainland, Hong Kong and Taiwan. [S1]
Sources: [S7], [S5], [S4], [S1]. The US/China split comes from the "countries ≥10% of net sales" note in each 10-K.

- [F] FY2026 segment operating income ($bn) [S1]:
  - Americas 86.0
  - Europe 58.1
  - Greater China 35.3 (42.9% segment margin)
  - Japan 14.7
  - Rest of APAC 18.4
  - Corporate (R&D plus G&A) −54.4
- [F] FX commentary in the FY2026 10-K [S1]:
  - Euro area and CNY strength helped Europe and Greater China.
  - Yen weakness hurt Japan.
  - In FY2023, by contrast, "weakness in foreign currencies ... accounted for more than the entire year-over-year decrease in Europe net sales". [S4]

---

## 3. Key financial metrics FY2015–FY2026

| FY | Net sales ($bn) | y/y | Gross margin (Products / Services) | Op. margin | Net income ($bn) | Diluted EPS ($)³ | FCF ($bn)⁴ | Cash + mkt. sec. ($bn) | Total debt incl. CP ($bn) | Diluted shares (m)³ | DPS declared ($)³ | Buybacks ($bn)⁵ | Dividends paid ($bn) |
|---|---:|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| FY2015 | 233.7 | — | 40.1% (n/d) | 30.5% | 53.4 | 2.31 | 70.0 | 205.7 | 64.3 | 23,172 | 0.495 | 35.3 | 11.6 |
| FY2016 | 215.6 | −7.7% | 39.1% (n/d) | 27.8% | 45.7 | 2.08 | 53.5 | 237.6 | 87.0 | 22,001 | 0.545 | 29.7 | 12.2 |
| FY2017 | 229.2 | +6.3% | 38.5% (35.7 / 55.0) | 26.8% | 48.4 | 2.30 | 51.8 | 268.9 | 115.7 | 21,007 | 0.600 | 32.9 | 12.8 |
| FY2018 | 265.6 | +15.9% | 38.3% (34.4 / 60.8) | 26.7% | 59.5 | 2.98 | 64.1 | 237.1 | 114.5 | 20,000 | 0.680 | 72.7 | 13.7 |
| FY2019 | 260.2 | −2.0% | 37.8% (32.2 / 63.7) | 24.6% | 55.3 | 2.97 | 58.9 | 205.9 | 108.0 | 18,596 | 0.750 | 66.9 | 14.1 |
| FY2020 | 274.5 | +5.5% | 38.2% (31.5 / 66.0) | 24.1% | 57.4 | 3.28 | 73.4 | 191.8 | 112.4 | 17,528 | 0.795 | 72.4 | 14.1 |
| FY2021 | 365.8 | +33.3% | 41.8% (35.3 / 69.7) | 29.8% | 94.7 | 5.61 | 93.0 | 190.5 | 124.7 | 16,865 | 0.850 | 86.0 | 14.5 |
| FY2022 | 394.3 | +7.8% | 43.3% (36.3 / 71.7) | 30.3% | 99.8 | 6.11 | 111.4 | 169.1 | 120.1 | 16,326 | 0.900 | 89.4 | 14.8 |
| FY2023 | 383.3 | −2.8% | 44.1% (36.5 / 70.8) | 29.8% | 97.0 | 6.13 | 99.6 | 162.1 | 111.1 | 15,813 | 0.940 | 77.5 | 15.0 |
| FY2024 | 391.0 | +2.0% | 46.2% (37.2 / 73.9) | 31.5% | 93.7⁶ | 6.08⁶ | 108.8 | 156.7 | 106.6 | 15,408 | 0.980 | 94.9 | 15.2 |
| FY2025 | 416.2 | +6.4% | 46.9% (36.8 / 75.4) | 32.0% | 112.0 | 7.46 | 98.8 | 132.4 | 98.7 | 15,005 | 1.020 | 90.7 | 15.4 |
| **FY2026** | **478.8** | **+15.1%** | **48.8% (39.3 / 76.2)** | **33.0%** | **132.2** | **8.98** | **136.1** | **136.9** | **80.1** | **14,720** | **1.060** | **86.4** | **15.7** |

Notes:
- Source: SEC XBRL company facts [S10], using the latest-filed value per fiscal year. Products/Services gross margin: [S6], [S5], [S4], [S1].
- ³ [A] FY2015–FY2017 EPS, shares and DPS divided or multiplied by 4 for the 2020 split (current basis). From FY2018 on, the XBRL values are already on the current basis.
- ⁴ [A] FCF = operating cash flow − purchases of PP&E.
- ⁵ Cash-flow-statement repurchases. The 10-K text gives $85.8bn repurchased in FY2026 (the difference is timing). [S1]
- ⁶ [F] Includes a one-time income tax charge of about $10.2bn from the CJEU State Aid ruling. Q4 FY2024 EPS was $0.97, or $1.64 excluding it. [S17][8-K 2024-10-31]
- [A] **Point-in-time warning:** these "latest-filed" values are for the dossier only. The platform must store **as-filed** values with their filing timestamp (XBRL `filed`, plus `acceptanceDateTime` from the submissions API).

**Other FY2026 facts** [S1][S8]:
- [F] R&D was $45.8bn (+32%, 9.6% of sales), "including investments in artificial intelligence". Capex was $9.0bn, down from $12.7bn.
- [F] Quarterly net sales in FY2026: Q1 $143.8bn (+16%), Q2 $111.2bn (+17%), Q3 $109.4bn (+16%), Q4 $114.5bn (+12%).
- [F] Net cash (cash and marketable securities minus debt) was **$56.8bn**. [A]
- [F] Shareholders' equity was $112.1bn.

---

## 4. Capital return programme history

| Date announced | Buyback | Quarterly dividend (as declared; current-basis equivalent) | Source |
|---|---|---|---|
| 1987-04-22 | — | First dividend $0.06 (with 2:1 split) | [S13] |
| 1995-10-06 | — | Last declaration ($0.12) before the 1996–2012 gap (suspension decision `UNVERIFIED`) | [S13] |
| **2012-03-19** | $10bn (FY2013–15) | **Reinstated: $2.65** (≈$0.095) | [S19] |
| 2013-04-23 | to **$60bn**; programme $100bn by end-2015; first bonds ($17bn, 30 Apr 2013) | $3.05 (+15%) | [S14] |
| 2014-04-23 | to $90bn; programme >$130bn; **7:1 split** | $3.29 (+8%) | [S14] |
| 2015-04-27 | to $140bn; programme $200bn by Mar 2017 | $0.52 (+11%) | [S14] |
| 2016-04-26 | to $175bn; programme $250bn | $0.57 (+~10%) | [S14] |
| 2017-05-02 | to $210bn; programme $300bn | $0.63 (+10.5%) | [S14] |
| 2018-05-01 | **new $100bn** (after US tax reform; Apple expected ~$38bn repatriation tax [S37]) | $0.73 (+16%) | [S14] |
| 2019-04-30 | +$75bn | $0.77 (+5%) | [S14] |
| 2020-04-30 | +$50bn; 4:1 split announced 2020-07-30 | $0.82 (+6%) | [S14] |
| 2021-04-28 / 2022-04-28 / 2023-05-04 | +$90bn each | $0.22 / $0.23 / $0.24 | [S14] |
| 2024-05-02 | **$110bn** | $0.25 (+4%) | [S14] |
| 2025-05-01 | $100bn | $0.26 (+4%) | [S14] |
| 2026-04-30 | $100bn | $0.27 (+4%) | [S1][S14] |

- [F] Cumulative returns:
  - August 2012 to March 2018: **$275bn** returned, including $200bn of buybacks. [S14]
  - [A] FY2018–FY2026 cash-flow sum: repurchases **≈$737bn** and dividends ≈$133bn. [S10]
  - [F] FY2026: $85.8bn of repurchases and $15.7bn of dividends. [S1]
- [F] Apple "intends to increase its dividend on an annual basis". The increase has come with the Q2 (Apr/May) release every year since 2013. [S1][S14]
- [A] **Pattern for analyzers:** capital-return news clusters on the Q2 earnings date. Isolating the capital-return effect from the earnings effect in an event study is therefore not possible without a model of the earnings surprise.

---

## 5. Valuation history

### 5.1 P/E proxy from filed data (no price feed needed)
[A] Method: the 10-K cover discloses the market value of non-affiliate stock at the end of fiscal Q2 (late March). That is ≈ market capitalisation, since affiliates hold well under 0.1%. Divide it by trailing-twelve-month net income at the same date: TTM = prior FY NI − prior-year H1 NI + current H1 NI, using as-first-filed XBRL values. [S1][S10]

| Date (end Q2) | Market value ($bn) | TTM net income ($bn) | P/E proxy |
|---|---:|---:|---:|
| 2011-03-25 | 323 | 19.6 | 16.5× |
| 2012-03-30 | 560 | 38.6 | 14.5× |
| 2013-03-29 | 416 | 39.7 | **10.5×** (low) |
| 2014-03-28 | 463 | 37.7 | 12.3× |
| 2015-03-27 | 710 | 47.8 | 14.8× |
| 2016-03-25 | 579 | 50.7 | 11.4× |
| 2017-03-31 | 748 | 45.7 | 16.3× |
| 2018-03-30 | 829 | 53.3 | 15.5× |
| 2019-03-29 | 875 | 57.2 | 15.3× |
| 2020-03-27 | 1,071 | 57.2 | 18.7× |
| 2021-03-26 | 2,021 | 76.3 | 26.5× |
| 2022-03-25 | 2,830 | 101.9 | 27.8× |
| 2023-03-31 | 2,591 | 94.3 | 27.5× |
| 2024-03-29 | 2,629 | 100.4 | 26.2× |
| 2025-03-28 | 3,253 | 97.3 | 33.4× (30.3× excl. $10.2bn State Aid charge) |
| 2026-03-27 | 3,647 | 122.6 | 29.8× |

- [A] Latest: the 23 Oct 2026 close of $347.73 ÷ FY2026 EPS of $8.98 gives **≈38.7×**. Market cap ~$5.07tn ÷ FY2026 NI of $132.2bn gives ≈38.4×. Price per [S32] (secondary). One outlet quotes "45 times earnings" on an unstated basis. [S32]
- [R] For the report, pair this series with **Services share of gross profit**: ≈24% in FY2018 ($24.2bn of $101.8bn) versus ≈40% in FY2026 ($93.9bn of $233.6bn) [S5][S1]. That pairing is the core "re-rating" argument (hypothesis AAPL-H05).

### 5.2 Market-cap milestones (all in CSV, `event_type=market_milestone`)

| Date | Milestone | Status |
|---|---|---|
| 2012-08-20 | Passed Microsoft's 1999 record market value | `UNVERIFIED` |
| 2018-08-02 | First US public company to reach $1tn (intraday) | verified_secondary [S29][S36] |
| 2020-08-19 | $2tn intraday (closed ~$1.98tn) | verified_secondary [S29] |
| 2022-01-03 | $3tn intraday (closed $182.01, just below) | verified_secondary [S29] |
| 2023-06 (30th per recollection) | First **close** above $3tn | month verified [S29]; day `UNVERIFIED` |
| 2025-10-28 | $4tn intraday (third company after Nvidia and Microsoft) | verified_secondary [S30] |
| 2026-10-23 | Record intraday high $351.73, ~$5.1tn; briefly world's most valuable; closed $5.074tn vs Nvidia $5.094tn | verified_secondary [S31][S32] |

---

## 6. Macro sensitivities (feeds report §2 "Macroeconomic analysis")

| ID | Channel | Evidence | Measurable proxy (free) |
|---|---|---|---|
| AAPL-M01 | **FX: USD strength** | [F] 65% of sales are non-US. A stronger USD "will negatively affect the Company's net sales and gross margins". Apple hedges with derivatives, may leave exposures unhedged, and may adjust local prices. FX VaR (95%, one-day) was $560m (FY2026) vs $590m (FY2025). The Jan 2019 letter cited ~200bp of FX drag on growth. FY2023 Europe decline was more than fully explained by FX. [S1][S15][S4] | FRED broad USD index (DTWEXBGS), EUR/USD (DEXUSEU), JPY (DEXJPUS), CNY (DEXCHUS) |
| AAPL-M02 | **China demand** | [F] Greater China revenue was 25.1% of sales (FY2015), 14.7% (FY2020) and 17.2% (FY2026). Swings: −16% (FY2019), +28% (FY2026). Siri AI is "unavailable in China while Apple works through regulatory requirements" (WWDC26). [S1][S5][S20] [A] A 2023 media report of iPhone-use restrictions for officials is `UNVERIFIED`. | China retail sales, CNY/USD; Greater China segment revenue (10-Q, as filed) |
| AAPL-M03 | **China/Asia manufacturing concentration** | [F] "A significant majority" of manufacturing is by outsourcing partners "primarily in China mainland, India, Japan, South Korea, Taiwan and Vietnam". Single or limited sources exist for "advanced semiconductors, memory and storage". Zhengzhou COVID disruption (8-K, 6 Nov 2022) and the Feb 2020 guidance miss show the transmission. [S1][S16] | Event dummies; supplier news |
| AAPL-M04 | **Tariffs / trade policy** | [F] 2018–19 Section 301 escalation (CSV, Wikipedia [S33]). 2025 IEEPA "reciprocal" tariffs (2 Apr 2025), 90-day pause (9 Apr). Court of International Trade (28 May 2025), Federal Circuit (29 Aug 2025) and **Supreme Court (20 Feb 2026)** rulings against IEEPA tariffs. Refunds recognised in cost of sales. Section 232 semiconductors (initial results 14 Jan 2026, no new tariffs on Apple products). "Recent imposition of tariffs under Section 301". [S1][S33] Apple US-investment pledges of $500bn (24 Feb 2025) and $600bn (6 Aug 2025). [S37] | Tariff event dummies (CSV `tags` contain `tariffs`) |
| AAPL-M05 | **Interest rates / equity duration** | [F] +100bp across tenors → $2.6bn fair-value decline on the investment portfolio and +$95m annual interest on term debt. [S1] [A] The bigger channel is valuation: P/E rose with the zero-rate era (2020–21) and stayed high through the 2022–23 hikes. That is a testable de-coupling (AAPL-H10). Fed path (Fed table [S24]): 4.25–4.50% (Dec 2024) → cuts to 3.50–3.75% (Dec 2025) → **+25bp to 3.75–4.00% (effective 17 Sep 2026)**. | FRED DGS10, DFII10 (real yields); FOMC dates |
| AAPL-M06 | **Consumer cycle** | [F] Risk factors cite inflation, unemployment, credit and consumer confidence. About 60% of sales go through indirect channels, so carriers' and resellers' inventory amplifies cycles. [S1] | FRED UMCSENT, RSXFS (retail sales), PCE |
| AAPL-M07 | **Component costs (memory)** | [F] FY2026: product gross margin up "partially offset by higher costs, including memory". Memory/storage cost pressure is expected to "intensify". Price increases "may not effectively mitigate" and could reduce demand. [S1] | Proxy: Micron/SK Hynix returns; DRAM contract prices (TrendForce, licensed) |
| AAPL-M08 | **AI capex cycle** | [F] R&D +32% in FY2026 on AI infrastructure. Houston AI-server facility (2026) [S37]. 12 Jan 2026 joint statement: future Apple Foundation Models to be based on Google Gemini (secondary [S35]). WWDC26 "Siri AI" (8 Jun 2026) [S20]. Apple competes for compute capacity (10-K). [S1] | Peer capex (MSFT/GOOGL/AMZN/META XBRL), NVDA revenue |
| AAPL-M09 | **Tax** | [F] EU State Aid: Commission decision 30 Aug 2016 (up to €13bn); General Court annulled it 15 Jul 2020; CJEU confirmed it 10 Sep 2024, giving a ~$10.2bn charge. US TCJA (signed 22 Dec 2017) led to the ~$38bn repatriation tax. OECD minimum-tax risk is cited. [S17][S23][S37][S38] | Event dummies |

[R] For the Macro section, the strongest Apple-specific, primary-sourced chain is: **USD and tariffs → product gross margin → EPS**. It can be shown with the 10-K's own words plus the FY2026 tariff-refund quantification.

---

## 7. Sector and peers (feeds report §3 "Sector/industry analysis")

### 7.1 Competitive landscape
- [F] Apple describes its markets as having "aggressive price competition, downward pressure on gross margins ... short product life cycles". Competitors compete "through aggressive pricing and very low cost structures". Some of its markets have "experienced little to no growth or contracted". Apple also competes in AI "development and deployment". [S1]
- [A] Arenas and the main rivals:
  - Smartphones: Samsung, Xiaomi, Huawei, OPPO/vivo, Transsion; Google Pixel.
  - PCs: Lenovo, HP, Dell; Windows/Chrome OS ecosystems.
  - Tablets: Samsung, Huawei, Lenovo.
  - Wearables: Samsung, Huawei, Xiaomi, Garmin, Meta (glasses).
  - Services: Google (Play, YouTube), Spotify, Netflix, Microsoft, Amazon.
  - AI platforms: Google, OpenAI/Microsoft, Meta.

### 7.2 Peer financials (latest fiscal year, SEC XBRL [S25]; derived ratios [A])

| Company (FY end) | Revenue ($bn) | Gross margin | Op. margin | Net margin | R&D/sales | Why compare |
|---|---:|---:|---:|---:|---:|---|
| **Apple (Sep 2026)** | **478.8** | **48.8%** | **33.0%** | **27.6%** | **9.6%** | — |
| Microsoft (Jun 2026) | 331.8 | 67.9% | 46.8% | 40.3% | 10.7% | Mega-cap platform/software; OS rival; index weight peer |
| Alphabet (Dec 2025) | 402.8 | 59.7% | 32.0% | 32.8% | 15.2% | Android, Play Store; **counterparty** (search licensing, Gemini) |
| Amazon (Dec 2025) | 716.9 | 50.3% | 11.2% | 10.8% | n/a | Devices + services ecosystem; consumer-spending peer |
| Meta (Dec 2025) | 201.0 | 82.0% | 41.4% | 30.1% | 28.5% | AR/VR (Vision Pro vs Quest); exposure to Apple privacy/ad rules |
| Nvidia (Jan 2026) | 215.9 | 71.1% | 60.4% | 55.6% | 8.6% | AI-capex cycle bellwether; largest market-cap rival |
| Qualcomm (Sep 2026) | 43.1 | 53.1% | 20.1% | 31.6% | 23.7% | Supplier/licensor (modems); smartphone-cycle proxy |
| Dell (Jan 2026) | 113.5 | 20.0% | 7.2% | 5.2% | 2.8% | PC hardware margin benchmark |
| HP Inc. (Oct 2025) | 55.3 | 20.6% | 5.7% | 4.6% | 2.9% | PC hardware margin benchmark |

- [F] Samsung Electronics, Xiaomi, Lenovo and Huawei are **not SEC filers**. Their data must come from their IR sites or from Bloomberg/LSEG, and licensed data must stay out of git.
- [A] Apple's gross margin (48.8%) sits about 28pt above PC OEMs and about 11pt below Alphabet. That gap is the quantitative core of a "hardware company with software-like margins" argument.

### 7.3 Market share
- [F] **Usage share** (StatCounter, October 2026; page-view based, *not* shipments) [S26]:
  - Mobile vendor, worldwide: Apple 27.61%, Samsung 22.74%, Xiaomi 11.81%, vivo 7.33%, OPPO 7.15%.
  - US: Apple 51.96%, Samsung 28.94%.
  - China: Apple 30.41%, Xiaomi 16.4%, vivo 12.46%, Huawei 10.28%.
  - Desktop OS, worldwide: Windows 76.65%; OS X + macOS 15.67% (listed separately as 9.86% + 5.81%).
- [A] **Shipment share** (IDC, Counterpoint, Canalys/Omdia) is `UNVERIFIED` here: the web-search budget ran out and the vendor pages tried returned 404. [R] One teammate with Bloomberg access should pull quarterly smartphone and PC shipment shares (BI or IDC tables) for the report. They must be cited as licensed sources and not committed to the public repo.

---

## 8. Key risks (feeds report §5 "Future performance")

| ID | Risk | Evidence (primary where possible) | CSV events to watch |
|---|---|---|---|
| AAPL-R01 | **App Store economics** (Epic / anti-steering) | [F] 30 Apr 2025: no commission allowed on link-out purchases, plus criminal-contempt referral. 11 Dec 2025: Ninth Circuit lets Apple charge "some commission" and require parity. **30 Jun 2026: Supreme Court grants cert** on the civil-contempt standard. The 10-K says restrictions on commissions could "materially and adversely" affect revenue and gross margin. [S1][S2] | `epic_*` |
| AAPL-R02 | **EU DMA** | [F] Gatekeeper since 6 Sep 2023. €500m DMA fine (23 Apr 2025, under appeal). Art. 6(4) preliminary findings pending (fines up to 10% of worldwide sales). €1.8bn music-streaming antitrust fine (4 Mar 2024). Siri AI is not initially offered in the EU. [S1][S20][S23] | `dma_*`, `eu_*` |
| AAPL-R03 | **US DOJ monopolisation suit** (filed 21 Mar 2024, D.N.J.) | [F] Seeks equitable relief; private follow-on suits. [S1] | `doj_antitrust_suit` |
| AAPL-R04 | **Google search licensing revenue** | [F] Remedies ordered 2 Sep 2025 and appealed by both DOJ and Google. A reversal could bar Google "from offering the Company commercial terms for search distribution". [S1] | `us_v_google_*` |
| AAPL-R05 | **Product-cycle dependence** | [F] iPhone was 53.1% of FY2026 sales. FY2016 (−7.7%) and FY2019 (−2.0%) were iPhone-driven declines. FY2026's +21% iPhone growth sets a high comparison base for FY2027. [S1][S7] | `iphone_event`, earnings |
| AAPL-R06 | **Memory costs and supply** | [F] Cost pressure expected to intensify. [S1] | (add memory-price macro events) |
| AAPL-R07 | **AI competition / dependence on a rival's model** | [F] The 2025 personalised-Siri delay (`UNVERIFIED` date). Gemini-based foundation models (secondary). R&D +32%. [S1][S35] | `ai`, `siri` tags |
| AAPL-R08 | **Key-person / leadership transition** | [F] New CEO from 1 Sep 2026. CFO, COO and GC all new since 2025. Historic AAPL sensitivity to Jobs's health news (2009, 2011 8-Ks). [S9][S11] | `leadership`, `key_person` |
| AAPL-R09 | **Geopolitics: Taiwan/China** | [F] Concentrated suppliers of advanced semiconductors. Greater China is both a market (17%) and a manufacturing base. [S1] | `china`, `tariffs` |
| AAPL-R10 | **Tariff regime uncertainty** | [F] Section 232 (semis), Section 301 and possible new sector tariffs. IEEPA refunds are a one-off tailwind. [S1] | `tariffs` |
| AAPL-R11 | **FX** | See AAPL-M01. | — |
| AAPL-R12 | **Tax** | [F] Ireland/Singapore subsidiaries; OECD global minimum tax; history of the State Aid case. [S1] | `state_aid` |

---

## 9. Testable hypotheses for teammates (≥20)

Conventions:
- "Prices" means daily AAPL total-return series, adjusted for splits and dividends (source TBD by A3).
- "Market" means the S&P 500 or Nasdaq-100 total return.
- Event windows use `available_at`, not `event_date`. Day 0 is the first session whose **open** is at or after `available_at`.
- All tests are in-sample over 2005–2026 unless stated; n = number of events in the CSV.

| ID | Hypothesis | Test design | Data needed | n (approx.) / R1-feasible? |
|---|---|---|---|---|
| AAPL-H01 | iPhone keynote days show negative abnormal returns ("sell the news") | Market-model CAR[0,+1] and [0,+5] for `subtype=iphone_event` plus iPhone product launches | Prices, market index, CSV | ~20 / **Yes** |
| AAPL-H02 | Post-earnings drift: sign of day-0 abnormal return predicts CAR[+2,+40] | Sort earnings events by day-0 AR tercile; t-test, plus placebo on random dates | Prices, CSV earnings (88) | 88 / **Yes** |
| AAPL-H03 | Earnings surprise (SUE) drives day-0 AR more than revenue surprise | Regress AR on EPS and revenue surprise | Consensus EPS/revenue (Bloomberg/LSEG, licensed) | 70+ / R1 if a teammate exports consensus |
| AAPL-H04 | USD strength predicts weaker next-quarter non-Americas revenue growth | Regress y/y growth of (Europe + Japan + RoAP) on prior-quarter Δ DTWEXBGS; use **as-filed** 10-Q segment data | FRED, segment data (EDGAR) | ~80 quarters / **Yes** |
| AAPL-H05 | Services mix re-rated the multiple | Regress the §5.1 P/E proxy (or EV/EBIT) on Services share of gross profit, controlling for 10y real yield | 10-K GM split, float, FRED DFII10 | 10–16 annual points (low power) / **Yes** |
| AAPL-H06 | Capital-return announcements (Apr/May) earn higher CAR than other earnings days | Compare CAR[0,+1] of Q2 releases vs other quarters | CSV `capital_return`, prices | 15 vs 70 / **Yes** |
| AAPL-H07 | Larger buyback authorisation (% of market cap) leads to higher 3-month excess return | Cross-section of 15 announcements | CSV, float/market cap | 15 / Yes (descriptive) |
| AAPL-H08 | Greater China growth tracks CNY/USD and China retail sales | Quarterly regression; check breaks at 2019 and 2023 | FRED DEXCHUS, NBS retail sales | ~70 / **Yes** |
| AAPL-H09 | Tariff-escalation days hit AAPL harder than the market (β to tariff news) | Event-day AR for `tags∋tariffs` (escalation vs de-escalation coded) | CSV, prices | ~20 / **Yes** |
| AAPL-H10 | AAPL's rate sensitivity changed after 2021 (duration de-coupling) | Rolling 252-day regression of returns on ΔDGS10 and ΔDFII10 | FRED, prices | daily / **Yes** |
| AAPL-H11 | FOMC statement days have higher AAPL variance | Variance ratio on FOMC days vs others (extend CSV with the full FOMC calendar) | Fed calendar, prices | ~170 meetings / Yes, after the calendar is added |
| AAPL-H12 | Leadership/health news produces large negative AR | Descriptive CAR for `key_person` events | CSV, prices | ~8 / Yes (descriptive only) |
| AAPL-H13 | App Store legal rulings move AAPL more than fines of similar headline size | CAR by subtype (`epic_*` vs `eu_*`) | CSV, prices | ~15 / Yes (descriptive) |
| AAPL-H14 | AAPL and GOOGL co-move on US v. Google rulings (TAC channel) | Two-stock event study on 2024-08-05 and 2025-09-02 | Prices AAPL, GOOGL | 2 / Yes (case study) |
| AAPL-H15 | Pre-earnings run-up: CAR[−10,−1] > 0 | Mean CAR before 88 earnings releases | CSV, prices | 88 / **Yes** |
| AAPL-H16 | Calendar seasonality: September (launch month) weak, Oct–Dec strong | Monthly mean returns, bootstrap | Prices 1985–2026 | ~480 months / **Yes** |
| AAPL-H17 | Memory price cycle leads product gross margin by 1–2 quarters | Lagged regression of Products GM% (as filed) on Micron/SK Hynix returns (proxy) | XBRL, peer prices | ~40 / Yes (proxy) |
| AAPL-H18 | Consumer sentiment predicts Americas revenue growth | Regress next-quarter Americas growth on ΔUMCSENT and Δ retail sales | FRED, segment data | ~80 / **Yes** |
| AAPL-H19 | Form-factor "super-cycles" (iPhone 6 FY2015, iPhone 12 5G FY2021, iPhone 17/Duo FY2026) lead to 12-month excess returns | Compare 12m CAR after the September event in super-cycle years vs others; mind the hindsight in labelling super-cycles | CSV, prices | 3 vs ~17 / descriptive |
| AAPL-H20 | Guidance warnings spill over to suppliers | CAR of TSMC (ADR), QCOM, AVGO, SWKS around 2019-01-02 and 2020-02-17 | CSV, peer prices | 2 / case study |
| AAPL-H21 | Valuation mean reversion: a high P/E-proxy z-score predicts lower 12m returns | Annual regression (overlapping); Newey–West | §5.1 series, prices | ~16 / weak power |
| AAPL-H22 | Dow inclusion (price-weighted) caused no lasting AR | CAR from 2015-03-06 to 2015-03-19 vs [+1,+60] | CSV, prices | 1 / case study |
| AAPL-H23 | Gross margin is sensitive to EUR/USD and JPY/USD | Regress quarterly Products GM% change on Δ EUR/USD and Δ JPY/USD | FRED, XBRL (as filed) | ~70 / **Yes** |
| AAPL-H24 | Split announcements earn positive AR; split effective dates do not | CAR on the 4 announcement dates vs effective dates | CSV, prices | 4+4 / descriptive |
| AAPL-H25 | AI-news days (WWDC24, Gemini deal, WWDC26) have AR beyond the market | CAR for `tags∋ai` | CSV, prices | ~5 / descriptive |

[R] **Statistical honesty.** Many AAPL-specific event sets have n < 20. Analyzers should report the event count, use a market model estimated on [−250,−30], and show a placebo distribution from random dates. Small-n results should be labelled "case study", not "evidence".

---

## 10. The events corpus (`docs/kb/07-data/seed/aapl_events_seed.csv`)

### 10.1 Contents (261 rows, validated: every row has 13 columns, ISO dates, tz-aware `available_at`, unique IDs)

| Dimension | Breakdown |
|---|---|
| Period | 1976-04-01 → 2026-11-05. 42 events before 2007, 219 from 2007 to 2026 |
| `event_type` | earnings 88; product_launch 35; legal_regulatory 25; macro 23; leadership 22; capital_return 17; corporate_action 14; keynote_event 9; other 7; market_milestone 7; guidance 5; index 3; m_and_a 2; supply_chain 2; geopolitical 2 |
| `verification_status` | verified_primary 196; verified_secondary 47; unverified 18 |
| Earnings coverage | **Every quarterly release FY2005 Q1 → FY2026 Q4 (88)**, with dates and acceptance times from SEC EDGAR 8-K Item 2.02. Descriptions give as-reported net sales, y/y vs the as-reported prior-year quarter, diluted EPS with its split basis, dividend declared, and 14-week flags |
| Must-haves from the brief | All 5 splits (declaration and effective rows); 1987 dividend initiation; 2012 reinstatement; CEO changes; iPod/iPhone/iPad/Watch/AirPods/Vision Pro/iPhone Duo; App Store; Intel and Apple-silicon/M1 transitions; Apple Intelligence; Jan 2019 warning; COVID guidance miss/suspension; EU/DOJ/Epic/Google milestones; tariff episodes; market-cap milestones; WWDCs; capital-return announcements; S&P 500 and Dow |

**Columns**
- `event_id`: `AAPL-EV-YYYYMMDD-NN`. Stable; NN orders same-day events, with earnings first.
- `event_date`: calendar date of the event in US/Eastern.
- `event_time_et`: `HH:MM` ET when known. For EDGAR rows it is the acceptance time. For keynotes it is the assumed start. Empty when unknown.
- `available_at`: ISO-8601 with UTC offset (America/New_York; EST/EDT applied).
- `event_type`, `subtype`, `title`, `description`: neutral wording. Uncertainty is spelled out in the description.
- `source_url`, `source_name`: `source_name` ends with "accessed 2026-11-17".
- `verification_status`, `importance`.
- `tags`: `;`-separated. Includes `avail:<rule>`, `time:<precision>`, `scheduled`, and `src:wikipedia` where Wikipedia is the only secondary source.

### 10.2 `available_at` rules (rule id stored in `tags`)

| Tag | Rule | Count | Rationale / caveat |
|---|---|---:|---|
| `avail:edgar_accept` | SEC EDGAR `acceptanceDateTime` (UTC) converted to ET | 124 | Primary, second-precision. Apple earnings 8-Ks are accepted 16:26–16:40 ET (almost all within 16:28–16:32), which corroborates the ~16:30 ET wire release (call at 14:00 PT). Exception: 2020-07-30, accepted 18:55 ET; the later time is kept (conservative) |
| `avail:keynote_plus_2h` | Keynote start (assumed 10:00 PT; Macworld 2007 09:00 PT) + 2h | 27 | Announcements happen during the keynote, before the 16:00 ET close. **Start times are assumptions** (`time:assumed`) |
| `avail:eod` | Date known, time unknown → `event_date 23:59:59 ET` | 85 | Conservative: usable from the next session's open. It **misattributes intraday news** (e.g., 2025-04-09 tariff pause) to the next day. Event studies should use a [0,+1] window |
| `avail:announcement` | Scheduled events (split effective dates, product on-sale dates, CEO effective date, Dow effective date): `available_at` = when the schedule was announced | 13 | The only rows where `available_at` < `event_date`. Tagged `scheduled` |
| `avail:fomc_statement` | FOMC statement at the standard 14:00 ET; date = Fed table "effective" date − 1 day | 5 | The derivation is flagged in the description |
| `avail:market_close` | Market-value milestones → 16:00 ET on the day | 5 | Observable only from prices; intraday crossing could be earlier |
| `avail:press_release_call_time` | 2012-03-19 dividend reinstatement: 06:00 PT call | 1 | Release time itself `UNVERIFIED`; pre-open either way |
| `avail:earliest_public_report` | 2026-04-20 CEO succession: 9to5Mac at 13:34 PT (8-K accepted 17:29 ET) | 1 | After the close; exact release minute `UNVERIFIED` |

[R] **Invariant for the platform:** when a better source appears, `available_at` may only move later, or earlier with a cited timestamp. Never set it earlier without a source.

### 10.3 Importance rubric (1–5)

| Score | Meaning | Examples |
|---|---|---|
| 5 | Regime-changing for the business model, leadership or capital structure | iPhone announced (2007); Jobs resigns (2011); dividend reinstated (2012); Jan 2019 warning; CEO succession (2026) |
| 4 | Major expected effect on fundamentals or valuation | iPad, Watch, Apple silicon, Apple Intelligence; $100bn+ buyback steps; DOJ suit; SCOTUS IEEPA ruling; Liberation Day and pause; iPhone Duo |
| 3 | Notable or recurring material event. **Every scheduled earnings release defaults to 3 (no hindsight)** | Earnings; EU fines; Fed regime shifts; Zhengzhou disruption |
| 2 | Contextual | Annual iPhone events (2010s), market-cap milestones, executive changes below CEO, ITC order |
| 1 | Reference or mechanics | Split effective dates, name change, debt pricing (2026), incorporation |

### 10.4 ⚠️ Hindsight-bias warning (must appear in the platform UI and the report's method note)

[R] This corpus was **curated in November 2026, after the fact**. Three things follow:

1. **`importance` is a hindsight label.** Some events were judged important partly *because* the stock moved. Using `importance` (or "is this event in the list at all") as an analyzer input leaks future information. Analyzers may use `event_type`, `subtype`, `tags` (except `importance`) and `available_at`. `importance` is for **display, filtering and human triage only**. The platform should enforce this in the analyzer SDK by not exposing the column to backtests.
2. **Selection bias.** Non-earnings events are over-represented where something "happened". Rumours that came to nothing, minor launches and non-events are missing. Event studies on these sets estimate *conditional* reactions and must not be extrapolated to "all keynotes" without adding the full calendar. The earnings set (all 88) and the FOMC set (once completed) are the only unbiased, complete calendars.
3. **Unverified and secondary rows.** Default backtests should filter to `verification_status ∈ {verified_primary, verified_secondary}`. Rows tagged `src:wikipedia` should be re-checked before they are cited in the report.

### 10.5 Known limitations / to-do
- [A] Pre-2005 earnings dates are missing. EDGAR's 8-K Item 2.02 only began in Aug 2004; earlier dates need Apple's press-release archive.
- [A] 10-Q/10-K filing timestamps are not in the CSV. They belong to the fundamentals point-in-time store, sourced live from `data.sec.gov/submissions` (each filing's `acceptanceDateTime`). Example: the FY2026 10-K was accepted 2026-11-03 08:05 ET. [S11]
- [A] Keynote start times, the FOMC date derivation and `eod` times are approximations, as flagged.
- [A] The full FOMC, CPI and NFP calendars are not included (only 7 FOMC regime points). [R] A3/A5 should generate those from Fed and BLS calendars as a separate macro calendar.

---

## 11. Point-in-time (PIT) notes specific to AAPL

| ID | Trap | Handling |
|---|---|---|
| AAPL-PIT01 | Splits (1987, 2000, 2005, 2014, 2020) | Store raw prices and as-reported EPS/DPS together with a split-factor table (CSV `corporate_action/stock_split_*`). Adjust on read, never on write |
| AAPL-PIT02 | Restatements: 2006 option backdating (non-reliance 8-K 3 Aug 2006; restated 10-K 29 Dec 2006); FY2017 category restatement in the FY2019 10-K; ASC 606 adoption; 2010 retrospective revenue-recognition change (`UNVERIFIED` detail; avoid TTM series spanning FY2009–FY2010) | Use as-first-filed XBRL facts (`filed` date) for backtests |
| AAPL-PIT03 | 14-week quarters (Q1 FY2006, FY2012, FY2017, FY2023) | Flag them and normalise y/y growth (×13/14) in analyzers |
| AAPL-PIT04 | Unit sales disclosure stopped from Q1 FY2019 | Unit-based analyzers end at Q4 FY2018 |
| AAPL-PIT05 | Guidance regime: formal revenue guidance bullets ran until Jan 2020 and none from Apr 2020 | Guidance-surprise analyzers must be regime-aware |
| AAPL-PIT06 | Earnings after 16:00 ET | First tradable close is the next session. With daily bars, day 0 = next trading day |
| AAPL-PIT07 | 8-K lag: leadership 8-Ks are often filed 1–3 days after the press advisory (e.g., 2009, 2011 leaves) | `available_at` uses the press date (eod), not the 8-K date |

---

## 12. Open questions for the product owner

| ID | Question |
|---|---|
| AAPL-Q01 | Ship the 18 `unverified` rows in R1 hidden by default, or drop them? (Recommendation: ship hidden, with a visible badge.) |
| AAPL-Q02 | Add a `time_precision` column (`exact` / `assumed` / `date_only`) instead of encoding it in `tags`? This is a small schema change and cleaner for analyzers. |
| AAPL-Q03 | Who pulls licensed data (consensus EPS for AAPL-H03, shipment market share, DRAM prices), and where is it stored outside git? |
| AAPL-Q04 | Price source: Stooq's endpoint presents a bot check (not to be bypassed). A3 must pick a sanctioned free daily-price source, or rely on a teammate's Bloomberg export kept locally. |
| AAPL-Q05 | Should R1 also ingest the EDGAR submissions API live, so that every 8-K, 10-Q and 10-K is an event with exact `available_at`? This would make the seed CSV the curated overlay rather than the only events source. |
| AAPL-Q06 | Should the team's 12-month forecast treat the CEO transition (Sep 2026) and the Supreme Court Epic review (cert granted Jun 2026; decision likely in 2027) as explicit scenario branches? |
| AAPL-Q07 | Accept "Wikipedia-only" rows as `verified_secondary` (tagged `src:wikipedia`), or downgrade them to `unverified` until a non-wiki source is found? |

---

## 13. Bibliography (Harvard style; all accessed 17 November 2026)

Tags [S#] map to entries below. Ready to paste into the report (alphabetical order is up to the report editor).

- **[S1]** Apple Inc. (2026) *Form 10-K for the fiscal year ended 26 September 2026*. Filed 3 November 2026. Cupertino, CA: Apple Inc. Available at: https://www.sec.gov/Archives/edgar/data/320193/000032019326000026/0000320193-26-000026-index.htm (Accessed: 17 November 2026).
- **[S2]** Apple Inc. (2025) *Form 10-K for the fiscal year ended 27 September 2025*. Available at: https://www.sec.gov/Archives/edgar/data/320193/000032019325000079/0000320193-25-000079-index.htm (Accessed: 17 November 2026).
- **[S3]** Apple Inc. (2024) *Form 10-K for the fiscal year ended 28 September 2024*. Available at: https://www.sec.gov/Archives/edgar/data/320193/000032019324000123/0000320193-24-000123-index.htm (Accessed: 17 November 2026).
- **[S4]** Apple Inc. (2023) *Form 10-K for the fiscal year ended 30 September 2023*. Available at: https://www.sec.gov/Archives/edgar/data/320193/000032019323000106/0000320193-23-000106-index.htm (Accessed: 17 November 2026).
- **[S5]** Apple Inc. (2020) *Form 10-K for the fiscal year ended 26 September 2020*. Available at: https://www.sec.gov/Archives/edgar/data/320193/000032019320000096/0000320193-20-000096-index.htm (Accessed: 17 November 2026).
- **[S6]** Apple Inc. (2019) *Form 10-K for the fiscal year ended 28 September 2019*. Available at: https://www.sec.gov/Archives/edgar/data/320193/000032019319000119/0000320193-19-000119-index.htm (Accessed: 17 November 2026).
- **[S7]** Apple Inc. (2017) *Form 10-K for the fiscal year ended 30 September 2017*. Available at: https://www.sec.gov/Archives/edgar/data/320193/000032019317000070/0000320193-17-000070-index.htm (Accessed: 17 November 2026).
- **[S8]** Apple Inc. (2026) *Form 8-K, Exhibit 99.1: Apple reports fourth quarter results*, 2 November 2026. Available at: https://www.sec.gov/Archives/edgar/data/320193/000032019326000024/0000320193-26-000024-index.htm (Accessed: 17 November 2026).
- **[S9]** Apple Inc. (2026) *Form 8-K (Item 5.02), 20 April 2026, and Form 8-K/A, 1 September 2026* (CEO transition). Available at: https://www.sec.gov/Archives/edgar/data/320193/000114036126015711/0001140361-26-015711-index.htm and https://www.sec.gov/Archives/edgar/data/320193/000114036126035325/0001140361-26-035325-index.htm (Accessed: 17 November 2026).
- **[S10]** U.S. Securities and Exchange Commission (2026) *XBRL company facts: Apple Inc. (CIK 0000320193)*. Available at: https://data.sec.gov/api/xbrl/companyfacts/CIK0000320193.json (Accessed: 17 November 2026).
- **[S11]** U.S. Securities and Exchange Commission (2026) *EDGAR submissions: Apple Inc.* Available at: https://data.sec.gov/submissions/CIK0000320193.json and https://data.sec.gov/submissions/CIK0000320193-submissions-001.json (Accessed: 17 November 2026). Individual 8-K index URLs are in the CSV `source_url` column.
- **[S12]** Apple Inc. (2026) *Investor Relations: Frequently asked questions*. Available at: https://investor.apple.com/faq/default.aspx (Accessed: 17 November 2026).
- **[S13]** Apple Inc. (2026) *Investor Relations: Dividend history*. Available at: https://investor.apple.com/dividend-history/default.aspx (Accessed: 17 November 2026).
- **[S14]** Apple Inc. (2013–2026) *Capital-return press releases furnished on Form 8-K*:
  - 23 Apr 2013: https://www.sec.gov/Archives/edgar/data/320193/000119312513167469/0001193125-13-167469-index.htm
  - 23 Apr 2014: https://www.sec.gov/Archives/edgar/data/320193/000119312514154883/0001193125-14-154883-index.htm
  - 27 Apr 2015: https://www.sec.gov/Archives/edgar/data/320193/000119312515149607/0001193125-15-149607-index.htm
  - Q2 earnings releases 2016–2026 (see CSV).

  (Accessed: 17 November 2026).
- **[S15]** Apple Inc. (2019) *Letter from Tim Cook to Apple investors* (Form 8-K, 2 January 2019). Available at: https://www.sec.gov/Archives/edgar/data/320193/000032019319000002/0000320193-19-000002-index.htm (Accessed: 17 November 2026).
- **[S16]** Apple Inc. (2020) *Investor update on quarterly guidance* (Form 8-K, 17 February 2020). Available at: https://www.sec.gov/Archives/edgar/data/320193/000119312520039203/0001193125-20-039203-index.htm (Accessed: 17 November 2026).
- **[S17]** Apple Inc. (2024) *Form 8-K (Item 7.01): European Commission State Aid decision*, 10 September 2024. Available at: https://www.sec.gov/Archives/edgar/data/320193/000114036124040659/0001140361-24-040659-index.htm (Accessed: 17 November 2026).
- **[S18]** Apple Inc. (2024) *Form 10-Q for the quarter ended 30 December 2023*. Available at: https://www.sec.gov/Archives/edgar/data/320193/000032019324000006/0000320193-24-000006-index.htm (Accessed: 17 November 2026).
- **[S19]** Apple Inc. (2012) *Apple announces plans to initiate dividend and share repurchase program*, 19 March. Available at: https://www.apple.com/newsroom/2012/03/19Apple-Announces-Plans-to-Initiate-Dividend-and-Share-Repurchase-Program/ (Accessed: 17 November 2026).
- **[S20]** Apple Inc. (2026) *Apple unveils next generation of Apple Intelligence, Siri AI, and more*, 8 June. Available at: https://www.apple.com/newsroom/2026/06/apple-unveils-next-generation-of-apple-intelligence-siri-ai-and-more/ (Accessed: 17 November 2026).
- **[S21]** Apple Inc. (2026) *Apple unveils iPhone Duo*, 9 September. Available at: https://www.apple.com/newsroom/2026/09/apple-unveils-iphone-duo/ (Accessed: 17 November 2026).
- **[S22]** Apple Inc. (2026) *Tim Cook to become Apple executive chairman; John Ternus to become Apple CEO*, April. Available at: https://www.apple.com/newsroom/2026/04/tim-cook-to-become-apple-executive-chairman-john-ternus-to-become-apple-ceo/ (Accessed: 17 November 2026; located via search, text cross-checked against the 8-K [S9]).
- **[S23]** European Commission (2016–2025) *Press releases IP/16/2923, IP/23/4328, IP/24/1161, IP/24/1689, IP/25/1085*. Available at: https://ec.europa.eu/commission/presscorner/detail/en/ip_16_2923 (and analogous URLs) (Accessed: 17 November 2026).
- **[S24]** Board of Governors of the Federal Reserve System (2026) *Open market operations: target federal funds rate changes*. Available at: https://www.federalreserve.gov/monetarypolicy/openmarket.htm (Accessed: 17 November 2026).
- **[S25]** U.S. Securities and Exchange Commission (2026) *XBRL company facts* for Microsoft (CIK 789019), Alphabet (1652044), Amazon (1018724), Meta (1326801), Nvidia (1045810), Qualcomm (804328), Dell (1571996) and HP Inc. (47217). Available at: https://data.sec.gov/api/xbrl/companyfacts/CIK##########.json (Accessed: 17 November 2026).
- **[S26]** StatCounter (2026) *Mobile vendor market share* (worldwide, United States, China) and *Desktop OS market share* (worldwide), October 2026. Available at: https://gs.statcounter.com/vendor-market-share/mobile (Accessed: 17 November 2026).
- **[S27]** Wikipedia (2026) *List of S&P 500 companies*. Available at: https://en.wikipedia.org/wiki/List_of_S%26P_500_companies (Accessed: 17 November 2026).
- **[S28]** S&P Dow Jones Indices (2015) *Apple set to join the Dow Jones Industrial Average* (Indexology blog), 6 March. Available at: https://www.indexologyblog.com/2015/03/06/apple-set-to-join-the-dow-jones-industrial-average/ (Accessed: 17 November 2026; via search result).
- **[S29]** CNBC (2019–2023) Articles of 11 Sep 2019, 19 Aug 2020, 3 Jan 2022 and 5 Dec 2023 on Apple market-cap milestones. Available at: https://www.cnbc.com/2020/08/19/apple-reaches-2-trillion-market-cap.html ; https://www.cnbc.com/2022/01/03/apple-becomes-first-us-company-to-reach-3-trillion-market-cap.html ; https://www.cnbc.com/2023/12/05/apples-market-cap-closes-above-3-trillion.html (Accessed: 17 November 2026).
- **[S30]** TechCrunch (2025) *Apple and Microsoft are now both worth more than $4T*, 28 October. Available at: https://techcrunch.com/2025/10/28/apple-and-microsoft-are-now-both-worth-more-than-4t (Accessed: 17 November 2026; via search result).
- **[S31]** 9to5Mac (2026) *Apple overtakes Nvidia as most valuable company in the world on iPhone Duo launch day*, 23 October; and *Apple CEO Tim Cook stepping down, John Ternus confirmed as new Apple CEO*, 20 April. Available at: https://9to5mac.com/2026/10/23/apple-overtakes-nvidia-as-most-valuable-company-in-the-world-on-iphone-duo-launch-day/ (Accessed: 17 November 2026).
- **[S32]** 24/7 Wall St. via Yahoo Finance (2026) *Apple just passed Nvidia as the world's most valuable company on iPhone Duo day*. Available at: https://finance.yahoo.com/markets/stocks/articles/apple-just-passed-nvidia-world-111537504.html (Accessed: 17 November 2026).
- **[S33]** Wikipedia (2026) *China–United States trade war*; *Tariffs in the second Trump administration*. Available at: https://en.wikipedia.org/wiki/China%E2%80%93United_States_trade_war ; https://en.wikipedia.org/wiki/Tariffs_in_the_second_Trump_administration (Accessed: 17 November 2026).
- **[S34]** Wikipedia (2026) *United States v. Google LLC (2020)*. Available at: https://en.wikipedia.org/wiki/United_States_v._Google_LLC_(2020) (Accessed: 17 November 2026).
- **[S35]** Daring Fireball (2026) *Apple and Google joint statement on Apple Foundation Models* (link post), 12 January. Available at: https://daringfireball.net/linked/2026/01/12/apple-google-foundation-models-cnbc (Accessed: 17 November 2026; via search result; corroborated by Engadget and IT Brief).
- **[S36]** Wikipedia (2026) *History of Apple Inc.*; *Steve Jobs*; *List of Apple Inc. media events*. Available at: https://en.wikipedia.org/wiki/History_of_Apple_Inc. ; https://en.wikipedia.org/wiki/Steve_Jobs ; https://en.wikipedia.org/wiki/List_of_Apple_Inc._media_events (Accessed: 17 November 2026).
- **[S37]** Apple Inc. (2001–2025) *Newsroom press releases*. Available at:
  - https://www.apple.com/newsroom/2001/10/23Apple-Presents-iPod/
  - https://www.apple.com/newsroom/2003/04/28Apple-Launches-the-iTunes-Music-Store/
  - https://www.apple.com/newsroom/2007/01/09Apple-Reinvents-the-Phone-with-iPhone/
  - https://www.apple.com/newsroom/2010/01/27Apple-Launches-iPad/
  - https://www.apple.com/newsroom/2011/08/24Letter-from-Steve-Jobs/
  - https://www.apple.com/newsroom/2014/09/09Apple-Unveils-Apple-Watch-Apples-Most-Personal-Device-Ever/
  - https://www.apple.com/newsroom/2018/01/apple-accelerates-us-investment-and-job-creation/
  - https://www.apple.com/newsroom/2020/06/apple-announces-mac-transition-to-apple-silicon/
  - https://www.apple.com/newsroom/2024/06/introducing-apple-intelligence-for-iphone-ipad-and-mac/
  - https://www.apple.com/newsroom/2025/02/apple-will-spend-more-than-500-billion-usd-in-the-us-over-the-next-four-years/
  - https://www.apple.com/newsroom/2025/08/apple-increases-us-commitment-to-600-billion-usd-announces-ambitious-program/

  (Accessed: 17 November 2026). Full list in the CSV `source_url` column.
- **[S38]** Wikipedia (2026) *Tax Cuts and Jobs Act*; *Bankruptcy of Lehman Brothers*. Available at: https://en.wikipedia.org/wiki/Tax_Cuts_and_Jobs_Act ; https://en.wikipedia.org/wiki/Bankruptcy_of_Lehman_Brothers (Accessed: 17 November 2026).

[R] **For the report:**
- Cite Apple filings ([S1] to [S18]) and regulator documents ([S23], [S24]) wherever possible.
- Avoid citing Wikipedia ([S27], [S33], [S34], [S36], [S38]) in the final report; use those entries only as pointers to the underlying primary documents.

---

*Research-process note: the shared web-search quota ran out during this session. Later verification used direct fetches of known URLs (Apple Newsroom and IR, SEC EDGAR, the European Commission press-corner API, the Federal Reserve, StatCounter, Wikipedia). Bot-protected pages (Stooq, justice.gov) were not bypassed.*
