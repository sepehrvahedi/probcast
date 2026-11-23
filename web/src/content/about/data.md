# Data and licences

ProbCast separates data by licence class. Only curated seeds (CC BY) and synthetic fixtures are committed to the repository.

| Class                              | Examples                                                                         | Where it lives                         | In git?                                  |
| ---------------------------------- | -------------------------------------------------------------------------------- | -------------------------------------- | ---------------------------------------- |
| L0 public domain / redistributable | SEC EDGAR, FRED (most series), company facts transcribed from investor relations | Generated data lake + small seed files | Seeds yes; lake no                       |
| L1 CC BY                           | The events corpus, the knowledge base                                            | `data/seed/`, `docs/`                  | Yes (CC BY 4.0)                          |
| L2 terms-limited free APIs         | Yahoo Finance via yfinance, Tiingo                                               | Local raw cache and lake               | No                                       |
| L3/L4 licensed                     | Bloomberg, Refinitiv/LSEG, WRDS                                                  | `data/local/`                          | No; the importer refuses committed paths |

**This demo build uses synthetic fixture data** (ticker DEMO, a seeded random walk). Charts drawn from fixtures carry an ILLUSTRATIVE watermark.

## Notices

This product uses the FRED® API but is not endorsed or certified by the Federal Reserve Bank of St. Louis.

The events corpus is published under the Creative Commons Attribution 4.0 licence (CC BY 4.0).

## Third-party software

| Component                 | Licence    |
| ------------------------- | ---------- |
| Apache ECharts            | Apache-2.0 |
| Inter (font)              | OFL-1.1    |
| JetBrains Mono (font)     | OFL-1.1    |
| Lucide icons              | ISC        |
| shadcn/ui and Radix UI    | MIT        |
| TanStack Router and Query | MIT        |
| React                     | MIT        |
| KaTeX                     | MIT        |
| cmdk                      | MIT        |
| Tailwind CSS              | MIT        |
