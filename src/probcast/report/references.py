"""Harvard references for everything a report figure or table cites (ADR-012; UX-C23).

Each reference carries a ``verification`` state in {unverified, ai_recalled, web_checked,
human_opened}. Catalogue entries typed from memory are ``ai_recalled``; references generated
from lake data (SEC accession URLs, FRED/ALFRED series pages) start ``unverified``; event rows
keep the corpus's own state. A teammate who opens the source and confirms it records a
``human_opened`` line in the hash-chained ``registry/verifications.jsonl`` (who and when). The
bibliography export contains **only** ``human_opened`` references; the rest are listed as
"to verify". Style: UCL Harvard (Cite Them Right).
"""

from __future__ import annotations

import csv
import hashlib
import json
import re
from collections.abc import Iterable
from dataclasses import asdict, dataclass, field
from datetime import datetime
from html import escape
from pathlib import Path
from typing import Any, Literal

from probcast.config import SEED_DIR, Settings

Verification = Literal["unverified", "ai_recalled", "web_checked", "human_opened"]
VERIFICATION: tuple[str, ...] = ("unverified", "ai_recalled", "web_checked", "human_opened")
Kind = Literal["method", "literature", "filing", "series", "dataset", "event", "software"]
REGISTRY = "verifications"


@dataclass
class Reference:
    id: str
    kind: Kind
    authors: str
    year: str
    title: str
    container: str | None = None  # journal, publisher or site
    details: str | None = None  # volume(issue), pages; or the place of publication
    url: str | None = None
    medium: str | None = None  # "[Dataset]", "[Computer program]"
    verification: Verification = "unverified"
    used_by: list[str] = field(default_factory=list)
    accessed: str | None = None  # YYYY-MM-DD: the day a teammate opened the source

    @property
    def italic_title(self) -> bool:
        """Cite Them Right: article titles in quotes, stand-alone works (books, datasets) in italics."""
        return self.kind not in ("method", "literature") or not self.container

    @property
    def bibtex_key(self) -> str:
        key = re.sub(r"[^A-Za-z0-9]+", "", self.id.split(":", 1)[-1].title()) or "ref"
        return key if key[0].isalpha() else f"{self.id.split(':', 1)[0].upper()}{key}"

    def content_hash(self) -> str:
        """What a verification attests to; a changed title or URL voids an earlier check."""
        body = json.dumps([self.id, self.authors, self.year, self.title, self.container, self.details, self.url], ensure_ascii=False)
        return hashlib.sha256(body.encode()).hexdigest()[:16]

    def _parts(self, html: bool) -> list[str]:
        t = escape(self.title) if html else self.title
        title = (f"<i>{t}</i>" if html else t) if self.italic_title else f"‘{t}’"
        head = f"{self.authors} ({self.year}) {title}"
        if self.medium:
            head += f" {self.medium}"
        parts = [head]
        if self.container:
            c = escape(self.container) if html else self.container
            parts.append(f"<i>{c}</i>" if html and not self.italic_title else c)
        if self.details:
            parts.append(self.details)
        return parts

    def harvard(self, html: bool = False) -> str:
        s = ", ".join(self._parts(html)) if not self.italic_title else ". ".join(self._parts(html))
        s = s.rstrip(".") + "."
        if self.url:
            u = escape(self.url) if html else self.url
            s += f" Available at: {u}"
            s += f" (Accessed: {_long_date(self.accessed)})." if self.accessed else "."
        return s

    def bibtex(self) -> str:
        typ = "article" if self.kind in ("method", "literature") and self.container else "misc"
        author = " and ".join(self.names()) if self.kind in ("method", "literature") else "{" + self.authors + "}"
        fields = {"author": author, "year": self.year, "title": "{" + self.title + "}"}
        if typ == "article":
            fields["journal"] = self.container or ""
            if self.details:
                fields["note"] = self.details
        elif self.container:
            fields["howpublished"] = self.container
        if self.url:
            fields["url"] = self.url
        if self.accessed:
            fields["urldate"] = self.accessed
        body = ",\n".join(f"  {k} = {{{v}}}" for k, v in fields.items())
        return f"@{typ}{{{self.bibtex_key},\n{body}\n}}"

    def in_text(self) -> str:
        """Cite Them Right in-text form: (Surname, year), (A and B, year), (A et al., year)."""
        if self.kind not in ("method", "literature") or (" and " not in self.authors and "," not in self.authors):
            return f"({self.authors}, {self.year})"
        surnames = [n.split(",")[0].strip() for n in self.names()]
        if len(surnames) >= 4:  # Cite Them Right: four or more authors -> et al.
            who = f"{surnames[0]} et al."
        else:
            who = surnames[0] if len(surnames) == 1 else ", ".join(surnames[:-1]) + f" and {surnames[-1]}"
        return f"({who}, {self.year})"

    def names(self) -> list[str]:
        """Personal authors as "Surname, I." items; an organisation stays one name."""
        if self.kind not in ("method", "literature"):
            return [self.authors]
        return [n.strip() for n in re.split(r",? and |(?<=\.), ", self.authors) if n.strip()]

    def to_dict(self) -> dict[str, Any]:
        d = asdict(self)
        d.update({"text": self.harvard(), "html": self.harvard(html=True), "in_text": self.in_text(), "bibtex_key": self.bibtex_key,
                  "bibtex": self.bibtex(), "content_hash": self.content_hash(), "in_bibliography": self.verification == "human_opened"})
        return d


def _long_date(iso: str) -> str:
    d = datetime.fromisoformat(iso[:10])
    return f"{d.day} {d.strftime('%B %Y')}"


# ---------------------------------------------------------------------------- catalogue
# Literature and method references typed from memory: ai_recalled until a teammate opens them.
def _lit(rid: str, authors: str, year: str, title: str, journal: str, details: str, kind: Kind = "literature") -> Reference:
    return Reference(rid, kind, authors, year, title, journal, details, verification="ai_recalled")


CATALOGUE: dict[str, Reference] = {r.id: r for r in (
    # analyzer manifests (keys into this catalogue; contract §3)
    _lit("ref:sharpe-1964", "Sharpe, W.F.", "1964", "Capital asset prices: a theory of market equilibrium under conditions of risk", "Journal of Finance", "19(3), pp. 425–442"),
    _lit("ref:blume-1971", "Blume, M.E.", "1971", "On the assessment of risk", "Journal of Finance", "26(1), pp. 1–10"),
    _lit("ref:jorion-1990", "Jorion, P.", "1990", "The exchange-rate exposure of U.S. multinationals", "Journal of Business", "63(3), pp. 331–345"),
    _lit("ref:campbell-ammer-1993", "Campbell, J.Y. and Ammer, J.", "1993", "What moves the stock and bond markets? A variance decomposition for long-term asset returns", "Journal of Finance", "48(1), pp. 3–37"),
    _lit("ref:dechow-sloan-soliman-2004", "Dechow, P.M., Sloan, R.G. and Soliman, M.T.", "2004", "Implied equity duration: a new measure of equity risk", "Review of Accounting Studies", "9(2–3), pp. 197–228"),
    _lit("ref:moskowitz-ooi-pedersen-2012", "Moskowitz, T.J., Ooi, Y.H. and Pedersen, L.H.", "2012", "Time series momentum", "Journal of Financial Economics", "104(2), pp. 228–250"),
    _lit("ref:jegadeesh-titman-1993", "Jegadeesh, N. and Titman, S.", "1993", "Returns to buying winners and selling losers: implications for stock market efficiency", "Journal of Finance", "48(1), pp. 65–91"),
    _lit("ref:jegadeesh-1990", "Jegadeesh, N.", "1990", "Evidence of predictable behavior of security returns", "Journal of Finance", "45(3), pp. 881–898"),
    _lit("ref:lehmann-1990", "Lehmann, B.N.", "1990", "Fads, martingales, and market efficiency", "Quarterly Journal of Economics", "105(1), pp. 1–28"),
    _lit("ref:moskowitz-grinblatt-1999", "Moskowitz, T.J. and Grinblatt, M.", "1999", "Do industries explain momentum?", "Journal of Finance", "54(4), pp. 1249–1290"),
    _lit("ref:christensen-prabhala-1998", "Christensen, B.J. and Prabhala, N.R.", "1998", "The relation between implied and realized volatility", "Journal of Financial Economics", "50(2), pp. 125–150"),
    _lit("ref:poon-granger-2003", "Poon, S.-H. and Granger, C.W.J.", "2003", "Forecasting volatility in financial markets: a review", "Journal of Economic Literature", "41(2), pp. 478–539"),
    _lit("ref:basu-1977", "Basu, S.", "1977", "Investment performance of common stocks in relation to their price-earnings ratios: a test of the efficient market hypothesis", "Journal of Finance", "32(3), pp. 663–682"),
    _lit("ref:brock-lakonishok-lebaron-1992", "Brock, W., Lakonishok, J. and LeBaron, B.", "1992", "Simple technical trading rules and the stochastic properties of stock returns", "Journal of Finance", "47(5), pp. 1731–1764"),
    _lit("ref:bernard-thomas-1989", "Bernard, V.L. and Thomas, J.K.", "1989", "Post-earnings-announcement drift: delayed price response or risk premium?", "Journal of Accounting Research", "27, pp. 1–36"),
    _lit("ref:chan-jegadeesh-lakonishok-1996", "Chan, L.K.C., Jegadeesh, N. and Lakonishok, J.", "1996", "Momentum strategies", "Journal of Finance", "51(5), pp. 1681–1713"),
    _lit("ref:lakonishok-shleifer-vishny-1994", "Lakonishok, J., Shleifer, A. and Vishny, R.W.", "1994", "Contrarian investment, extrapolation, and risk", "Journal of Finance", "49(5), pp. 1541–1578"),
    _lit("ref:bouman-jacobsen-2002", "Bouman, S. and Jacobsen, B.", "2002", "The Halloween indicator, 'Sell in May and go away': another puzzle", "American Economic Review", "92(5), pp. 1618–1635"),
    _lit("ref:blitz-huij-martens-2011", "Blitz, D., Huij, J. and Martens, M.", "2011", "Residual momentum", "Journal of Empirical Finance", "18(3), pp. 506–521"),
    _lit("ref:george-hwang-2004", "George, T.J. and Hwang, C.-Y.", "2004", "The 52-week high and momentum investing", "Journal of Finance", "59(5), pp. 2145–2176"),
    _lit("ref:frazzini-pedersen-2014", "Frazzini, A. and Pedersen, L.H.", "2014", "Betting against beta", "Journal of Financial Economics", "111(1), pp. 1–25"),
    _lit("ref:gervais-kaniel-mingelgrin-2001", "Gervais, S., Kaniel, R. and Mingelgrin, D.H.", "2001", "The high-volume return premium", "Journal of Finance", "56(3), pp. 877–919"),
    _lit("ref:heston-sadka-2008", "Heston, S.L. and Sadka, R.", "2008", "Seasonality in the cross-section of stock returns", "Journal of Financial Economics", "87(2), pp. 418–445"),
    _lit("ref:lou-polk-skouras-2019", "Lou, D., Polk, C. and Skouras, S.", "2019", "A tug of war: overnight versus intraday expected returns", "Journal of Financial Economics", "134(1), pp. 192–213"),
    _lit("ref:aboody-et-al-2018", "Aboody, D., Even-Tov, O., Lehavy, R. and Trueman, B.", "2018", "Overnight returns and firm-specific investor sentiment", "Journal of Financial and Quantitative Analysis", "53(2), pp. 485–505"),
    _lit("ref:moreira-muir-2017", "Moreira, A. and Muir, T.", "2017", "Volatility-managed portfolios", "Journal of Finance", "72(4), pp. 1611–1644"),
    _lit("ref:cederburg-et-al-2020", "Cederburg, S., O'Doherty, M.S., Wang, F. and Yan, X.S.", "2020", "On the performance of volatility-managed portfolios", "Journal of Financial Economics", "138(1), pp. 95–117"),
    _lit("ref:foster-olsen-shevlin-1984", "Foster, G., Olsen, C. and Shevlin, T.", "1984", "Earnings releases, anomalies, and the behavior of security returns", "The Accounting Review", "59(4), pp. 574–603"),
    _lit("ref:bernard-thomas-1990", "Bernard, V.L. and Thomas, J.K.", "1990", "Evidence that stock prices do not fully reflect the implications of current earnings for future earnings", "Journal of Accounting and Economics", "13(4), pp. 305–340"),
    _lit("ref:frazzini-lamont-2007", "Frazzini, A. and Lamont, O.A.", "2007", "The earnings announcement premium and trading volume", "NBER Working Paper", "13090"),
    _lit("ref:savor-wilson-2016", "Savor, P. and Wilson, M.", "2016", "Earnings announcements and systematic risk", "Journal of Finance", "71(1), pp. 83–138"),
    _lit("ref:pontiff-woodgate-2008", "Pontiff, J. and Woodgate, A.", "2008", "Share issuance and cross-sectional returns", "Journal of Finance", "63(2), pp. 921–945"),
    _lit("ref:ikenberry-lakonishok-vermaelen-1995", "Ikenberry, D., Lakonishok, J. and Vermaelen, T.", "1995", "Market underreaction to open market share repurchases", "Journal of Financial Economics", "39(2–3), pp. 181–208"),
    _lit("ref:sloan-1996", "Sloan, R.G.", "1996", "Do stock prices fully reflect information in accruals and cash flows about future earnings?", "The Accounting Review", "71(3), pp. 289–315"),
    _lit("ref:hribar-collins-2002", "Hribar, P. and Collins, D.W.", "2002", "Errors in estimating accruals: implications for empirical research", "Journal of Accounting Research", "40(1), pp. 105–134"),
    _lit("ref:cooper-gulen-schill-2008", "Cooper, M.J., Gulen, H. and Schill, M.J.", "2008", "Asset growth and the cross-section of stock returns", "Journal of Finance", "63(4), pp. 1609–1651"),
    _lit("ref:titman-wei-xie-2004", "Titman, S., Wei, K.C.J. and Xie, F.", "2004", "Capital investments and stock returns", "Journal of Financial and Quantitative Analysis", "39(4), pp. 677–700"),
    _lit("ref:abarbanell-bushee-1998", "Abarbanell, J.S. and Bushee, B.J.", "1998", "Abnormal returns to a fundamental analysis strategy", "The Accounting Review", "73(1), pp. 19–45"),
    _lit("ref:thomas-zhang-2002", "Thomas, J.K. and Zhang, H.", "2002", "Inventory changes and future returns", "Review of Accounting Studies", "7(2–3), pp. 163–187"),
    _lit("ref:fama-french-1989", "Fama, E.F. and French, K.R.", "1989", "Business conditions and expected returns on stocks and bonds", "Journal of Financial Economics", "25(1), pp. 23–49"),
    _lit("ref:estrella-mishkin-1998", "Estrella, A. and Mishkin, F.S.", "1998", "Predicting U.S. recessions: financial variables as leading indicators", "Review of Economics and Statistics", "80(1), pp. 45–61"),
    _lit("ref:keim-stambaugh-1986", "Keim, D.B. and Stambaugh, R.F.", "1986", "Predicting returns in the stock and bond markets", "Journal of Financial Economics", "17(2), pp. 357–390"),
    _lit("ref:gilchrist-zakrajsek-2012", "Gilchrist, S. and Zakrajšek, E.", "2012", "Credit spreads and business cycle fluctuations", "American Economic Review", "102(4), pp. 1692–1720"),
    _lit("ref:driesprong-jacobsen-maat-2008", "Driesprong, G., Jacobsen, B. and Maat, B.", "2008", "Striking oil: another puzzle?", "Journal of Financial Economics", "89(2), pp. 307–327"),
    _lit("ref:kilian-park-2009", "Kilian, L. and Park, C.", "2009", "The impact of oil price shocks on the U.S. stock market", "International Economic Review", "50(4), pp. 1267–1287"),
    _lit("ref:bollerslev-tauchen-zhou-2009", "Bollerslev, T., Tauchen, G. and Zhou, H.", "2009", "Expected stock returns and variance risk premia", "Review of Financial Studies", "22(11), pp. 4463–4492"),
    _lit("ref:campbell-1991", "Campbell, J.Y.", "1991", "A variance decomposition for stock returns", "Economic Journal", "101(405), pp. 157–179"),
    _lit("ref:thorbecke-1997", "Thorbecke, W.", "1997", "On stock market returns and monetary policy", "Journal of Finance", "52(2), pp. 635–654"),
    _lit("ref:cooper-priestley-2009", "Cooper, I. and Priestley, R.", "2009", "Time-varying risk premiums and the output gap", "Review of Financial Studies", "22(7), pp. 2801–2833"),
    _lit("ref:fama-schwert-1977", "Fama, E.F. and Schwert, G.W.", "1977", "Asset returns and inflation", "Journal of Financial Economics", "5(2), pp. 115–146"),
    _lit("ref:campbell-vuolteenaho-2004", "Campbell, J.Y. and Vuolteenaho, T.", "2004", "Inflation illusion and stock prices", "American Economic Review", "94(2), pp. 19–23"),
    _lit("ref:fisher-statman-2003", "Fisher, K.L. and Statman, M.", "2003", "Consumer confidence and stock returns", "Journal of Portfolio Management", "30(1), pp. 115–127"),
    _lit("ref:lemmon-portniaguina-2006", "Lemmon, M. and Portniaguina, E.", "2006", "Consumer confidence and asset prices: some empirical evidence", "Review of Financial Studies", "19(4), pp. 1499–1529"),
    _lit("ref:glosten-jagannathan-runkle-1993", "Glosten, L.R., Jagannathan, R. and Runkle, D.E.", "1993", "On the relation between the expected value and the volatility of the nominal excess return on stocks", "Journal of Finance", "48(5), pp. 1779–1801"),
    _lit("ref:bollerslev-1986", "Bollerslev, T.", "1986", "Generalized autoregressive conditional heteroskedasticity", "Journal of Econometrics", "31(3), pp. 307–327"),
    _lit("ref:corsi-2009", "Corsi, F.", "2009", "A simple approximate long-memory model of realized volatility", "Journal of Financial Econometrics", "7(2), pp. 174–196"),
    _lit("ref:hamilton-1989", "Hamilton, J.D.", "1989", "A new approach to the economic analysis of nonstationary time series and the business cycle", "Econometrica", "57(2), pp. 357–384"),
    _lit("ref:ang-bekaert-2002", "Ang, A. and Bekaert, G.", "2002", "International asset allocation with regime shifts", "Review of Financial Studies", "15(4), pp. 1137–1187"),
    _lit("ref:harvey-1989", "Harvey, A.C.", "1989", "Forecasting, structural time series models and the Kalman filter", "Cambridge University Press", "Cambridge"),
    _lit("ref:durbin-koopman-2012", "Durbin, J. and Koopman, S.J.", "2012", "Time series analysis by state space methods", "Oxford University Press", "2nd edn, Oxford"),
    _lit("ref:friedman-2001", "Friedman, J.H.", "2001", "Greedy function approximation: a gradient boosting machine", "Annals of Statistics", "29(5), pp. 1189–1232"),
    _lit("ref:gu-kelly-xiu-2020", "Gu, S., Kelly, B. and Xiu, D.", "2020", "Empirical asset pricing via machine learning", "Review of Financial Studies", "33(5), pp. 2223–2273"),
    _lit("ref:ansari-et-al-2024", "Ansari, A.F. et al.", "2024", "Chronos: learning the language of time series", "Transactions on Machine Learning Research", "2024"),
    _lit("ref:campbell-shiller-1988", "Campbell, J.Y. and Shiller, R.J.", "1988", "Stock prices, earnings, and expected dividends", "Journal of Finance", "43(3), pp. 661–676"),
    # methods the platform itself uses (the stats docstrings cite the same works)
    _lit("method:lintner-1965", "Lintner, J.", "1965", "The valuation of risk assets and the selection of risky investments in stock portfolios and capital budgets", "Review of Economics and Statistics", "47(1), pp. 13–37", "method"),
    _lit("method:gneiting-raftery-2007", "Gneiting, T. and Raftery, A.E.", "2007", "Strictly proper scoring rules, prediction, and estimation", "Journal of the American Statistical Association", "102(477), pp. 359–378", "method"),
    _lit("method:matheson-winkler-1976", "Matheson, J.E. and Winkler, R.L.", "1976", "Scoring rules for continuous probability distributions", "Management Science", "22(10), pp. 1087–1096", "method"),
    _lit("method:diebold-mariano-1995", "Diebold, F.X. and Mariano, R.S.", "1995", "Comparing predictive accuracy", "Journal of Business & Economic Statistics", "13(3), pp. 253–263", "method"),
    _lit("method:harvey-leybourne-newbold-1997", "Harvey, D., Leybourne, S. and Newbold, P.", "1997", "Testing the equality of prediction mean squared errors", "International Journal of Forecasting", "13(2), pp. 281–291", "method"),
    _lit("method:politis-romano-1994", "Politis, D.N. and Romano, J.P.", "1994", "The stationary bootstrap", "Journal of the American Statistical Association", "89(428), pp. 1303–1313", "method"),
    _lit("method:benjamini-hochberg-1995", "Benjamini, Y. and Hochberg, Y.", "1995", "Controlling the false discovery rate: a practical and powerful approach to multiple testing", "Journal of the Royal Statistical Society: Series B", "57(1), pp. 289–300", "method"),
    _lit("method:newey-west-1987", "Newey, W.K. and West, K.D.", "1987", "A simple, positive semi-definite, heteroskedasticity and autocorrelation consistent covariance matrix", "Econometrica", "55(3), pp. 703–708", "method"),
    _lit("method:bracher-2021", "Bracher, J., Ray, E.L., Gneiting, T. and Reich, N.G.", "2021", "Evaluating epidemic forecasts in an interval format", "PLOS Computational Biology", "17(2), e1008618", "method"),
    _lit("method:genest-1992", "Genest, C.", "1992", "Vincentization revisited", "Annals of Statistics", "20(2), pp. 1137–1142", "method"),
    _lit("method:dawid-1984", "Dawid, A.P.", "1984", "Statistical theory: the prequential approach", "Journal of the Royal Statistical Society: Series A", "147(2), pp. 278–292", "method"),
    _lit("method:brocker-smith-2007", "Bröcker, J. and Smith, L.A.", "2007", "Increasing the reliability of reliability diagrams", "Weather and Forecasting", "22(3), pp. 651–661", "method"),
    _lit("method:koenker-bassett-1978", "Koenker, R. and Bassett, G.", "1978", "Regression quantiles", "Econometrica", "46(1), pp. 33–50", "method"),
    _lit("method:mackinlay-1997", "MacKinlay, A.C.", "1997", "Event studies in economics and finance", "Journal of Economic Literature", "35(1), pp. 13–39", "method"),
    Reference("method:rappaport-mauboussin-2001", "method", "Rappaport, A. and Mauboussin, M.J.", "2001", "Expectations investing: reading stock prices for better returns", None,
              "Boston, MA: Harvard Business School Press", verification="ai_recalled"),
)}

#: Which method references each figure or table relies on (by key).
METHODS_BY_ITEM: dict[str, tuple[str, ...]] = {
    "F2": ("ref:sharpe-1964", "method:newey-west-1987"),
    "F5": ("method:gneiting-raftery-2007", "method:matheson-winkler-1976", "ref:sharpe-1964", "method:lintner-1965", "method:politis-romano-1994",
           "method:diebold-mariano-1995", "method:harvey-leybourne-newbold-1997"),
    "F6": ("method:genest-1992", "ref:sharpe-1964"),
    "F7": ("method:bracher-2021", "method:genest-1992", "ref:sharpe-1964", "method:lintner-1965"),
    "F8": ("method:dawid-1984", "method:brocker-smith-2007"),
    "T3": ("method:gneiting-raftery-2007", "method:diebold-mariano-1995", "method:harvey-leybourne-newbold-1997", "method:politis-romano-1994",
           "method:benjamini-hochberg-1995"),
    "T4": ("method:rappaport-mauboussin-2001", "ref:sharpe-1964"),
    "T6": ("ref:sharpe-1964", "method:lintner-1965"),
}


def catalogue_ref(key: str) -> Reference:
    """A copy of a catalogue entry, or an explicit placeholder for an unknown key (never invented)."""
    r = CATALOGUE.get(key)
    if r is None:
        return Reference(key, "literature", "Reference key", "n.d.", f"{key} (not yet in the citation catalogue)", verification="unverified")
    return Reference(**{k: v for k, v in asdict(r).items() if k != "used_by"})


# ---------------------------------------------------------------------------- generated references
def edgar_url(cik: str | int, accession: str) -> str:
    return f"https://www.sec.gov/Archives/edgar/data/{int(str(cik))}/{accession.replace('-', '')}/"


def filing_ref(accession: str, *, company: str, cik: str | int | None = None, form: str | None = None, filed: str | None = None,
               period: str | None = None, url: str | None = None) -> Reference:
    year = str(filed)[:4] if filed else "n.d."
    what = f"Form {form}" if form else "SEC filing"
    if period:
        what += f" for the period ended {_long_date(str(period))}"
    what += f" (accession {accession})"
    link = url or (edgar_url(cik, accession) if cik is not None else None)
    return Reference(f"sec:{accession}", "filing", company, year, what, "U.S. Securities and Exchange Commission, EDGAR", None, link)


def _fred_meta() -> dict[str, dict[str, str]]:
    p = SEED_DIR / "fred_series.csv"
    if not p.exists():
        return {}
    with p.open(newline="", encoding="utf-8") as f:
        return {r["series_id"]: r for r in csv.DictReader(f)}


def series_ref(series_id: str, *, year: str, vintages: bool = False) -> Reference:
    code = series_id.split(":", 1)[-1]
    meta = _fred_meta().get(series_id, {})
    agency = meta.get("source_agency") or "Federal Reserve Bank of St. Louis"
    name = meta.get("name") or code
    if vintages:
        return Reference(f"alfred:{code}", "dataset", "Federal Reserve Bank of St. Louis", year, f"ALFRED archival vintages: {name} [{code}]",
                         "ArchivaL Federal Reserve Economic Data (ALFRED)".replace("ArchivaL", "Archival"), None,
                         f"https://alfred.stlouisfed.org/series?seid={code}", "[Dataset]")
    return Reference(f"fred:{code}", "dataset", agency, year, f"{name} [{code}]", "Federal Reserve Economic Data (FRED), Federal Reserve Bank of St. Louis",
                     None, f"https://fred.stlouisfed.org/series/{code}", "[Dataset]")


def price_source_ref(year: str) -> Reference:
    return Reference("data:yahoo-finance", "dataset", "Yahoo Finance", year, "Historical daily prices, dividends and splits", "accessed via the yfinance Python package",
                     None, "https://finance.yahoo.com/", "[Dataset]")


def event_ref(row: dict[str, Any]) -> Reference:
    occurred = str(row.get("occurred_at") or row.get("content_available_at") or "")
    v = str(row.get("verification") or "unverified")
    source = str(row.get("source_name") or "").split(" | ")[0].strip() or "Source not recorded"
    return Reference(f"event:{row['event_id']}", "event", source, occurred[:4] or "n.d.",
                     str(row.get("title") or row["event_id"]), "ProbCast events corpus", None, (row.get("source_url") or None),
                     verification=v if v in VERIFICATION else "unverified")  # type: ignore[arg-type]


def probcast_ref(version: str, year: str) -> Reference:
    return Reference("software:probcast", "software", "ProbCast contributors", year,
                     f"ProbCast: point-in-time backtesting and probabilistic forecasting platform (version {version})", None, None, None, "[Computer program]")


# ---------------------------------------------------------------------------- collection and verification
class RefSet:
    """References collected while a pack is built, with the figures/tables that use each."""

    def __init__(self) -> None:
        self.items: dict[str, Reference] = {}

    def add(self, ref: Reference, *used_by: str) -> Reference:
        cur = self.items.setdefault(ref.id, ref)
        for u in used_by:
            if u and u not in cur.used_by:
                cur.used_by.append(u)
        return cur

    def add_keys(self, keys: Iterable[str], *used_by: str) -> None:
        for k in keys:
            self.add(catalogue_ref(k), *used_by)

    def to_list(self) -> list[dict[str, Any]]:
        return [r.to_dict() for r in sorted(self.items.values(), key=lambda r: (r.authors.lower(), r.year, r.title.lower()))]


def verifications(settings: Settings) -> dict[str, dict[str, Any]]:
    """Latest human_opened record per reference id from the hash-chained registry."""
    from probcast.scoring import registry as R

    out: dict[str, dict[str, Any]] = {}
    for rec in R.read(REGISTRY, settings):
        if rec.get("action") == "human_opened":
            out[rec["ref_id"]] = rec
    return out


def apply_verifications(refs: list[dict[str, Any]], recs: dict[str, dict[str, Any]]) -> list[dict[str, Any]]:
    """Merge registry records: a reference is human_opened only if a record attests to its current content."""
    out = []
    for d in refs:
        rec = recs.get(d["id"])
        d = dict(d)
        if rec is not None and rec.get("content_hash") == d.get("content_hash"):
            r = Reference(**{k: d[k] for k in Reference.__dataclass_fields__})
            r.verification, r.accessed = "human_opened", str(rec.get("ts", ""))[:10] or None
            d = r.to_dict() | {"opened_by": rec.get("by"), "opened_at": rec.get("ts"), "record_hash": rec.get("hash")}
        out.append(d)
    return out


def record_opened(settings: Settings, ref: dict[str, Any], who: str, snapshot_id: str) -> dict[str, Any]:
    from probcast.scoring import registry as R

    return R.append(REGISTRY, {"action": "human_opened", "ref_id": ref["id"], "content_hash": ref["content_hash"], "url": ref.get("url"),
                               "by": who, "snapshot_id": snapshot_id}, settings)


def bibliography(refs: list[dict[str, Any]], fmt: Literal["text", "bib"] = "text") -> str:
    """Export only human_opened references (ADR-012)."""
    ok = [Reference(**{k: d[k] for k in Reference.__dataclass_fields__}) for d in refs if d.get("verification") == "human_opened"]
    ok.sort(key=lambda r: (r.authors.lower(), r.year, r.title.lower()))
    if fmt == "bib":
        return "\n\n".join(r.bibtex() for r in ok) + ("\n" if ok else "")
    return "\n".join(r.harvard() for r in ok) + ("\n" if ok else "")


def write(refs: RefSet, path: Path) -> list[dict[str, Any]]:
    items = refs.to_list()
    path.write_text(json.dumps(items, indent=2, ensure_ascii=False), encoding="utf-8")
    return items
