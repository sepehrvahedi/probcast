# ADR-014: Name, repo and visibility

- **Status:** Accepted (2026-11-18). The product owner chose **ProbCast**. Supersedes the "Orchard" working codename (D-009, D-027).
- **Deciders:** Product owner
- **Sources:** `00-overview/naming.md` (registry checks, 17 Nov 2026); D-070 (multi-stock product); D-071

## Context
"Orchard" was a working codename. It nodded to Apple, and `orchard` was taken on PyPI and npm. The PO confirmed that the product is multi-stock and asked for technical, self-descriptive names. About 40 candidates were checked against PyPI, npm, `.dev` NS and GitHub.

## Options considered
PITcast, Walkforward Lab, NoLookahead, **ProbCast**, QuantileCast, PITBench, Firstprint, Backsight, Foreknown and others (see `naming.md`).

## Decision
**ProbCast**: *probabilistic forecasting*. It says what the product outputs: probability distributions rather than buy/sell calls, for any stock.
- **Repository, PyPI distribution, npm scope, import and CLI:** `probcast` (`pip install probcast`, `import probcast`, `probcast run …`). The state root environment variable is `PROBCAST_HOME`, and the analyzer package is `probcast_analyzers`. On 17 Nov 2026 PyPI, npm, `probcast.dev` (no NS) and the `github.com/probcast` org name were all unclaimed.
- **Descriptor line:** *"ProbCast: point-in-time backtesting and probabilistic forecasting for equities."* Taglines: *"Ex-ante by construction."* / *"What did we know, and when?"*
- **Visibility:** the repo stays **private until marks are returned**, then goes public in R2 (publication checklist in roadmap §8). Handles only in the repo. No apple imagery in the logo (Apple's third-party guidelines) and a non-affiliation note in the README.
- **To do before R2:** claim the `probcast` names on PyPI, npm and GitHub (an empty placeholder release is enough); run a basic trademark search (UKIPO/USPTO/EUIPO); register a domain if wanted.

## Consequences
Every forward-looking KB document now uses ProbCast, `probcast` and `PROBCAST_HOME`. Historical records (ideation, reviews, logs, the decision log before D-071) keep "Orchard" as the former codename. The project folder `orchard/` is renamed to `probcast/` at `git init` on D1.
