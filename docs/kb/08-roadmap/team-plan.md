# Team plan: what the five of us do (no code required)

> **Scope note (D-069, 17 Nov):** writing the report is **out of scope for now**. Rows marked ⏸ (report editor, drafting, final edit, submission, module-lead email) are deferred to a later report phase. They are kept here only so nothing is lost.

> The platform is built by the PO + the coding agent. Teammates own the **finance thinking**, the **ideas**, the **sources** and the **report**. That split is also the honest answer to the professor's AI warning: humans choose, check and write; the tool measures.

## 1. Roles

| Role | Who | Responsibilities |
|---|---|---|
| **Product owner / integrator** | PO | Runs ProbCast on the laptop. Enters idea cards. Triages twice daily (12:00, 20:00). Assigns analyzer families by Fri 27 Nov. Freezes the committee Mon 30 Nov. Leads the reveal on 1 Dec |
| ⏸ **Report editor** (deferred, D-069) | Teammate A | Owns the 2,000-word structure, word budget per section, style consistency, final proofreading, the bibliography |
| ⏸ **Section owners** (writing part deferred; idea cards per section still apply) | All five, one section each, + the editor on the conclusion | Intro, Macro, Sector, Fundamental, Future performance. Each owner writes ≥ 1 idea card for their section, chooses the figures for it from the evidence pack, and writes the prose |
| **Source verifier** | All five, split | Opens every source the report cites and marks it `human_opened` (≈ 5 references + ≈ 4 facts each) |
| **Data requester** | Teammate B | WRDS (CRSP/Compustat) request on Wed 18; optional LSEG licence; optional Bloomberg G07 session for consensus/targets |
| **Witnesses** | ≥ 2 teammates | Present for the holdout reveal on Tue 1 Dec 12:00 UK |

## 2. This week's tasks

| # | Task | Owner | Due |
|---|---|---|---|
| T-1 | Read the one-page brief on how ProbCast works (the PO shares a link) | All | Wed 18 |
| T-2 | **Write wave-1 idea cards** using the template in `05-requirements/idea-card.md` §1: one per person, tied to your section | All | **Fri 20 Nov 18:00** |
| T-3 ⏸ | Agree the figure/table list with owners (`configs/report.yaml`, from `00-overview/coursework-alignment.md` §2) and name the report editor | All | Fri 20 Nov 18:00 |
| T-4 | Request WRDS access via UCL Library (CRSP + Compustat); optionally an LSEG Workspace licence | Teammate B | Wed 18 |
| T-5 | Approve the peer sets (A: MSFT, GOOGL, AMZN, META · B: DELL, HPQ, QCOM, CSCO · NVDA as "hindsight peer") | All | Thu 19 |
| T-6 | Section research from primary sources (Apple 10-K FY2026, 10-Qs, Apple Newsroom, Fed/BLS data); keep notes with URLs | Section owners | Ongoing |
| T-7 ⏸ | PO sends the module-lead email (§4) | PO | **Fri 20 Nov** |
| T-8 | Wave-2 cards (max 2 active per person + 1 judgemental view) | All | Wed 25 – **Sat 28 23:59** |
| T-9 | In-person onboarding: read a verdict, a fan chart, the leaderboard; try one standard run | All | Wed 25 (class) |
| T-10 ⏸ | Draft sections using **ledger keys** (e.g. `{{fy2026.gross_margin}}`) instead of typing numbers; `probcast report fill` substitutes the final values on 1 Dec and lists unknown or changed keys | Section owners | 26–30 Nov |
| T-11 | Verify cited sources (`human_opened`) | All | **Sun 29 Nov** |
| T-12 | Witness the holdout reveal (in person or on a recorded video call; same day by 20:00 if 12:00 fails). The forecast was already frozen and hashed on Mon 30 at 23:59; the reveal only unseals scores | PO + ≥ 2 | **Tue 1 Dec 12:00** |
| T-13 ⏸ | Final edit: 1,800–2,200 words; figures numbered, captioned and sourced; bibliography in Harvard style | Editor + all | Thu 3 Dec 12:00 |
| T-14 ⏸ | Submit | Editor | **Thu 3 Dec 16:00** (deadline Fri 4 Dec 16:00) |

## 3. Rules the team agrees to (research integrity)

1. **Pre-register before testing.** An idea is tested only after its card is registered (hashed and timestamped).
2. **Don't use ProbCast results for 2021 onwards to design ideas.** Those scores are sealed until one witnessed reveal on 1 Dec. We all know Apple's recent history, so the holdout tests *tuning*, not idea choice. The report calls it "pseudo-out-of-sample" and quotes holdout results at 1 and 3 months only.
3. **Every variant counts.** Changing a parameter is a new trial, and the trial counter is shown in the report.
4. **Negative results are results.** "Does not beat the CAPM anchor" is a legitimate finding, consistent with market efficiency. We report it honestly.
5. **We write the prose.** ProbCast provides numbers, figures, captions and citations. It never writes analysis text.
6. **We only cite what we opened.** No AI-recalled references in the bibliography.
7. **No advice language.** The prediction is a probability distribution, not a recommendation.

## 4. ⏸ Draft email to the module lead (deferred to the report phase, D-069)

> **Subject:** COMP0105 group coursework: AI-use and formatting questions (Group [n], AAPL)
>
> Dear Dr Vidal Tomas,
>
> Our group is analysing Apple Inc. for the coursework. We are building our own research software to backtest analysis methods without look-ahead bias and to combine them into a probabilistic 12-month forecast. We'd like to make sure we follow the module's rules, and would be grateful for guidance on five points:
>
> 1. **AI use.** We use an AI coding assistant to help write the *software* (data pipeline, statistics, charts). All analysis, interpretation and report text are written by us. Which UCL AI-use category applies to this module, and how would you like us to acknowledge it in the report?
> 2. **Appendices.** May we include a short technical appendix (e.g. methodology or extra figures), and would it count toward the 2,000-word limit?
> 3. **Captions.** Figure and table captions don't count toward the word limit. Is a two-sentence factual caption (what is plotted, data source) acceptable?
> 4. **"Next year".** Should the prediction be for the price 12 months from submission (about early December 2027), or for the end of calendar year 2027?
> 5. **Methods.** Is a brief methods paragraph (≈ 100 words) appropriate within the Future performance section?
>
> Kind regards,
> [Name], on behalf of Group [n]

## 5. What teammates will see in class (R1.0, Wed 25 Nov)

1. **Home:** the team's consensus 12-month forecast as a fan chart, with P(price higher) and its base rate, the 80% range, the scenarios and a disclaimer.
2. **Run view:** each idea's verdict (grade A–D, skill vs the CAPM anchor with a confidence interval, calibration, trials count, sealed-holdout chip).
3. **Committee:** how each idea family moves the median (waterfall) and what removing it would change.
4. **Leaderboard:** all ideas ranked with honest uncertainty.
5. **About:** the methodology in plain English with references.

R1.1 (Sat 28 Nov) adds the data explorer with events and provenance, the report studio (figure gallery with copy-caption and copy-reference), the analyzer library, the idea lab form and the run launcher.
