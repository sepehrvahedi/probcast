# ADR-001: System shape: library-first spine, thin API, pro SPA

- **Status:** Accepted (2026-11-17)
- **Deciders:** Lead (the coding agent) on behalf of the product owner; PO confirmation recorded in `decision-log.md`
- **Sources:** A7 §0, §2; R1b §4; D-010

## Context
The report needs every number and figure by 1 Dec. The PO also wants a full pro UI (D-010), and capacity is one lead coding-agent session plus subagents (D-012). R1b showed that gating the release on a web UI puts the report at risk (CRT-B-02).

## Options considered
(a) Library + CLI core → FastAPI → React SPA (A7 ARC-ADR-01). (b) Streamlit/Dash only (fast, but not pro). (c) SPA with no backend (precomputed JSON only; no run launching or idea entry). (d) Next.js full-stack.

## Decision
**(a)**, with **engine-first sequencing**: the library + CLI produce the complete evidence pack before any UI dependency. The SPA is a committed parallel stream (D-010), and it stays presentation-only.

## Consequences
The report is safe if the UI slips (Plan B is built in). Science lives in one language and module, so PIT enforcement is centralised. There is more total code than option (b). This is offset by parallel subagents and a contract-first API.
