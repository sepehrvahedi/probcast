# ADR-002: R1 runs locally on the PO's laptop; no auth or hosting

- **Status:** Accepted (2026-11-17)
- **Deciders:** Lead (the coding agent) on behalf of the product owner; PO confirmation recorded in `decision-log.md`
- **Sources:** PO answer 2; CRT-B-06; A7 ARC-ADR-10/11

## Context
Teammates will use the platform on the PO's laptop in class, and the PO enters their ideas (D-011). A7 proposed a Mac + Cloudflare tunnel; R1b found it fragile (no uptime guarantee, no SSE, changing URLs, over-broad email allow-list).

## Options considered
(a) Local only, `127.0.0.1`. (b) Mac + tunnel with Access. (c) Azure-for-Students VM. (d) Each teammate installs locally.

## Decision
**(a)**. FastAPI on localhost serves the built SPA. An 'acting as' author selector records attribution (it is not security). Hosting and the static public demo move to R2.

## Consequences
Removes deployment, auth, CSRF and rate-limit work (≈ 14 h) from R1. Teammates can only use it when the PO is present; between classes, the shared evidence pack (PNG/CSV/BibTeX) covers asynchronous needs.
