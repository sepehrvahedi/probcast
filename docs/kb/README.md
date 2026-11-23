# ProbCast knowledge base

> **ProbCast** (formerly the working codename "Orchard") is a point-in-time backtesting and probabilistic forecasting lab for equities, built first for Apple (AAPL). Historical documents (ideation, reviews, logs) still say "Orchard".

Everything we have decided, researched and planned for **ProbCast**, the point-in-time forecasting lab for equities (Apple first), is recorded here: every agent brief, every agent output, every critique and every decision. Planning started on Tue 17 Nov 2026.

## Start here (15-minute read)

1. [`00-overview/project-charter.md`](00-overview/project-charter.md): what ProbCast is, why, scope, objectives, governance.
2. [`00-overview/coursework-alignment.md`](00-overview/coursework-alignment.md): how the platform earns marks, section by section.
3. [`08-roadmap/roadmap.md`](08-roadmap/roadmap.md): releases, day-by-day plan, checkpoints, cut order, Plan B.
4. [`08-roadmap/team-plan.md`](08-roadmap/team-plan.md): what each teammate does (no code), research rules, the draft email to the module lead.
5. [`04-decisions/decision-log.md`](04-decisions/decision-log.md): all decisions (D-001…), with links to ADRs.

## Map

| Folder | What's inside | Status |
|---|---|---|
| `00-overview/` | Project charter; coursework alignment (marking criteria → platform outputs; report sections → figures) | Final |
| `01-brief/` | Coursework brief summary (source of truth for grading); the PO's original request verbatim with vision themes V-01…V-16; shared context for agents | Final |
| `02-ideation/` | Raw outputs of 7 planning agents: A1 product, A2 quant methodology, A3 data sources, A4 AAPL dossier, A5 analyzer library, A6 UX/UI, A7 architecture (~165k words) | Archive; superseded where decisions differ |
| `03-reviews/` | R1a critique (science and data, incl. fact-check); R1b critique (product, engineering, scope); R2 synthesis (182 features, 82 analyzers, 50 conflicts resolved, R1 re-cut); R3 red-team review of the final plan (40 findings; sign-off "Ready with fixes"; fixes applied in plan v1.1) | Final |
| `04-decisions/` | Decision log (D-xxx) and 17 ADRs in `adr/` | Living |
| `05-requirements/` | SRS Part A, functional (`srs-functional.md`); SRS Part B, non-functional (`srs-nonfunctional.md`); idea-card intake protocol | Final v1.0 |
| `06-architecture/` | Architecture; **analyzer contract v1 (binding)**; R1 UX specification | Final v1.0 |
| `07-data/` | Data plan (R1 inventory, availability rules, snapshots, licensing); `seed/aapl_events_seed.csv` (261 events) | Final v1.0; events → v1.1 on D2 |
| `08-roadmap/` | Roadmap, team plan, risk register | Living |
| an internal brief (not published) | Session log (chronological record of the planning process); verbatim agent briefs | Living |

## Precedence (when documents disagree)

1. The **coursework brief** (`01-brief/coursework-brief.md`) decides what is graded.
2. **Decision log + ADRs**.
3. **Analyzer contract** and **architecture**.
4. **SRS** (functional + non-functional), **UX spec** (binding for `web/`), **data plan**, **roadmap**.
5. **Reviews** (R1a, R1b, R2, R3).
6. **Ideation** (A1–A7): rich background, superseded where the documents above differ.

## Conventions

- **IDs:**
  - Planning docs: `D-` decisions, `ADR-` records, `FR-`/`NFR-` requirements, `FEAT-` consolidated features, `ANZ-` analyzers, `RSK-` risks, `DEC-Q-` decision questions.
  - Agents: `PRD-`, `QNT-`, `DAT-`, `AAPL-`, `ANL-`, `UX-`, `ARC-`, `CRT-`.
- **Releases:** R0 Foundations → **R1.0 Wed 25 Nov** → **R1.1 Sat 28 Nov** → R1.2 stretch → R2 Showcase (Dec–Jan) → R3 Future.
- **Facts** carry a source (URL + access date). Unverified facts are marked `UNVERIFIED`. Nothing goes into the report bibliography unless a teammate has opened it (`human_opened`).
- **Privacy:** handles only, no teammates' real names in this KB or the repo.

## Planning process (how this KB was produced)

```
Coursework PDF + PO vision
        │
        ▼
7 parallel ideation/research agents (A1–A7)
        │
        ├─► R1a critic (science, data, fact-check)
        ├─► R1b critic (product, engineering, scope)
        │
        ▼
PO answers 4 key questions (full pro UI · laptop in class · 1 session + subagents · no coders)
        │
        ▼
R2 synthesiser (182 features, 82 analyzers, 50 conflicts, R1 re-cut)
        │
        ▼
Lead: contract, architecture, 17 ADRs, NFRs, data plan, roadmap, team plan, risks, charter
W1 writer: functional SRS   ·   W2 writer: R1 UX spec
        │
        ▼
R3 red team of the final plan  ──►  lead iterates fixes  ──►  plan v1.0
```
