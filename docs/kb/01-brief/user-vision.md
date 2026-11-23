# Product owner's vision (original request, 2026-11-17)

> Recorded verbatim (lightly formatted) so every later decision can be checked against the original intent.

---

We have a project for the course Financial Institutions and Markets which is in `GroupCoursework2026.pdf`. We have chosen to analyze the Apple stock.

My idea for how to analyze was that I create a platform that **any idea could be backtested** (from different intervals of times, **without knowledge of the future that already happened**) and gather those ideas on what to measure and how to do it and **make a call based on the ways of doing the analysis**.

For example, some indicator might be used, or even **any fundamental news could be fed to the platform**.

My goal is to implement this pro platform that could **get the way someone wants to analyze a stock and run backtest no matter what the analysis might need**. E.g. it could **get sentences and call LLMs in the back to implement the new tool**, or have **numerous tools that it can use** to do the analysis, or even have **configurable runs and settings** that could be fed into it and this platform would backtest it and **predict the future with probabilities** using the way of analysis given to it.

So the main goal is to have a platform that:
- has the prices and any data already available in it,
- could run backtests no matter the idea of analysis,
- is able to **get data from the user** that is using it,
- could get **several ways to analyse** the stock and then **combine them and give a final decision** based on several analyses.

I already told my teammates to go find the best ways to analyze this stock in particular, and this platform would be the tool for them to **backtest their idea, see how well it performed based on the data from the past**, and others could add theirs too, and this platform would **sum all of them together at the end**.

This should have the **perfect pro UI and UX**, should have the **past data from that stock, even the fundamental stuff that happened in the past** to this stock, and gather it around.

I want you to completely plan this project, have new agents on ideation on what features this platform would have and make it better, have agents review and sum the ideas together, and plan the platform completely to then develop it. **Functional and non-functional requirements should be listed completely.** Everything would be recorded — **every decision and data gathered by agents — so we have a knowledge base** on the work being done here.

If the platform needed to ask LLMs for things (e.g. code), **for the first release we would have the ideas given to this chat** so it would be available in the platform if it is not covered by it. Plan it completely, iterate on every decision and make sure nothing is missed. This is for my assignment, and this is a platform which **provides data, probabilities and that's it** — an analysis tool that is creative and innovative.

My ultimate goal is to show this platform to my professor to have his complete attention and WOW. I am planning on **publishing it on GitHub** in the future to showcase it on my CV and LinkedIn. It should look pro, do pro and act pro.

---

## Extracted requirements themes (index for traceability)

| Theme ID | Theme |
|---|---|
| V-01 | Any analysis idea can be backtested |
| V-02 | Backtests over arbitrary historical intervals with **zero look-ahead** |
| V-03 | Ideas expressed as indicators, fundamentals, news/events, user data, natural language |
| V-04 | Built-in library of numerous tools/analyzers |
| V-05 | Configurable runs/settings (declarative configs) |
| V-06 | Probabilistic predictions of the future |
| V-07 | Pre-loaded AAPL prices, fundamentals and historical events ("what happened") |
| V-08 | Users can upload/enter their own data |
| V-09 | Multiple analyses combined into a final decision (ensemble/consensus) |
| V-10 | Multi-user team workflow: each teammate adds ideas; platform sums them |
| V-11 | Natural-language → new tool via LLM (R2+); R1: ideas implemented via this coding-agent chat |
| V-12 | Pro UI/UX — "look pro, do pro, act pro" |
| V-13 | Full knowledge base of decisions and research |
| V-14 | Must impress the professor (demo-ready) |
| V-15 | Publishable on GitHub as a CV/LinkedIn portfolio piece |
| V-16 | Scope: data + probabilities only (analysis tool, not trading, not advice) |
