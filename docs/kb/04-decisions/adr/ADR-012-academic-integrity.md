# ADR-012: Academic integrity: evidence not prose; verified citations; AI-use disclosure

- **Status:** Accepted (2026-11-17)
- **Deciders:** Lead (the coding agent) on behalf of the product owner; PO confirmation recorded in `decision-log.md`
- **Sources:** R1a CRT-A-026/027; R1b CRT-B-17; brief slide 11

## Context
The professor warns against generic, unreferenced AI output. About 300 agent-written references are memory-sourced (CRT-A-026). The dossier prose is AI-written (CRT-A-027). UCL treats unacknowledged GenAI use as misconduct (CRT-B-17).

## Options considered
(a) Verification gating + implementer rules + disclosure. (b) Trust agent references.

## Decision
**(a)**: (1) the platform never writes report prose (D-007); captions are factual templates; (2) every reference and event has `verification ∈ {unverified, ai_recalled, web_checked, human_opened}`, and **bibliography export only includes `human_opened`**; (3) the coding-agent implementer **may not choose or suggest parameter values**: it uses card or literature defaults, and any deviation is a logged trial; (4) an AI-assistance register (from commit trailers); (5) the PO emails the module lead about the AI-use category and acknowledgement wording by Fri 20 Nov.

## Consequences
Protects the grade and credibility. Costs the team ≈ 15 min each to open and check the ≈ 25 cited sources.
