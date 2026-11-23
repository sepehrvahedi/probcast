/**
 * Shared number and date formats (ux-spec §2.5, UX-T04). Every label, tick and readout in
 * the app goes through this module; ECharts default formatters are never used (§6.1).
 */

export const MINUS = "−"; // U+2212, never a hyphen for negative numbers

export type Direction = "up" | "down" | "flat";

export const GLYPH: Record<Direction, string> = { up: "▲", down: "▼", flat: "▬" };

const SESSION_LABEL: Record<number, string> = {
  5: "1W",
  21: "1M",
  63: "3M",
  126: "6M",
  252: "12M",
};

function fixed(x: number, dp: number): string {
  return Math.abs(x).toLocaleString("en-GB", {
    minimumFractionDigits: dp,
    maximumFractionDigits: dp,
  });
}

/** Sign character for a value already rounded to `dp` decimals (−0.0 renders as +0.0). */
function signOf(x: number, dp: number): "" | "+" | typeof MINUS {
  const r = Number(x.toFixed(dp));
  if (r > 0) return "+";
  if (r < 0) return MINUS;
  return "+";
}

export function direction(x: number, dp = 1): Direction {
  const r = Number((x * 100).toFixed(dp));
  if (r > 0) return "up";
  if (r < 0) return "down";
  return "flat";
}

/** Price, 2 dp with thousands separators: `$1,234.50`. */
export function price(x: number | null | undefined, dp = 2): string {
  if (x == null || !Number.isFinite(x)) return "—";
  return `${x < 0 ? MINUS : ""}$${fixed(x, dp)}`;
}

/** Whole-dollar price for interval bounds, rounded outward (ForecastReadout rule, §5.3). */
export function priceOutward(x: number, side: "lo" | "hi"): string {
  const v = side === "lo" ? Math.floor(x) : Math.ceil(x);
  return price(v, 0);
}

/** Large money: 1 dp + bn / tn: `$394.3bn`. */
export function money(x: number): string {
  const a = Math.abs(x);
  const s = x < 0 ? MINUS : "";
  if (a >= 1e12) return `${s}$${fixed(a / 1e12, 1)}tn`;
  if (a >= 1e9) return `${s}$${fixed(a / 1e9, 1)}bn`;
  if (a >= 1e6) return `${s}$${fixed(a / 1e6, 1)}m`;
  return price(x);
}

/** Signed percentage from a fraction: 0.079 → `+7.9%`, −0.13 → `−13.0%`. */
export function pct(x: number | null | undefined, dp = 1, signed = true): string {
  if (x == null || !Number.isFinite(x)) return "—";
  const v = x * 100;
  const sign = signed ? signOf(v, dp) : v < 0 ? MINUS : "";
  return `${sign}${fixed(v, dp)}%`;
}

/** Return with glyph: `▲ +7.9%`, `▼ −13.0%`, `▬ +0.0%`. */
export function ret(x: number, dp = 1): { text: string; glyph: string; dir: Direction } {
  const dir = direction(x, dp);
  return { text: pct(x, dp), glyph: GLYPH[dir], dir };
}

/** Probability: integer %, `<1%` / `>99%` at the extremes. */
export function prob(p: number | null | undefined): string {
  if (p == null || !Number.isFinite(p)) return "—";
  if (p < 0.01) return "<1%";
  if (p > 0.99) return ">99%";
  return `${Math.round(p * 100)}%`;
}

/** Probability rounded to 5 pp for caption-like text (QNT-244). */
export function prob5(p: number): string {
  if (p < 0.025) return "<5%";
  if (p > 0.975) return ">95%";
  return `${Math.round((p * 100) / 5) * 5}%`;
}

/** Percentage-point change, signed: `+3 pp`, `−1.2 pp`. Input is in fraction units. */
export function pp(x: number, dp = 0): string {
  const v = x * 100;
  return `${signOf(v, dp)}${fixed(v, dp)} pp`;
}

/** Plain signed number without unit (for CI bounds already in %). */
export function signedNum(x: number, dp = 1): string {
  return `${signOf(x, dp)}${fixed(x, dp)}`;
}

/** Skill (CRPSS) with CI in brackets: `+4.1% [−0.6, +8.8]`. Inputs are fractions. */
export function skill(est: number, lo: number, hi: number, dp = 1): string {
  return `${pct(est, dp)} [${signedNum(lo * 100, dp)}, ${signedNum(hi * 100, dp)}]`;
}

/** CI bounds only: `[−0.6, +8.8]`. */
export function ci(lo: number, hi: number, dp = 1): string {
  return `[${signedNum(lo * 100, dp)}, ${signedNum(hi * 100, dp)}]`;
}

/** p-value: 2 significant figures, floor `< 0.001`. */
export function pValue(p: number): string {
  if (p < 0.001) return "p < 0.001";
  return `p = ${Number(p.toPrecision(2))}`;
}

/** n_eff label: `n_eff ≈ 33`. */
export function nEff(n: number): string {
  return `n_eff ≈ ${Math.round(n)}`;
}

export function int(n: number): string {
  return Math.round(n).toLocaleString("en-GB");
}

/** MDE: `±2.4%`. */
export function mde(x: number, dp = 1): string {
  return `±${fixed(x * 100, dp)}%`;
}

/** Tilt in pp per year: `+0.4 pp/yr`. Input in fraction per year. */
export function tilt(x: number, dp = 1): string {
  const v = x * 100;
  return `${signOf(v, dp)}${fixed(v, dp)} pp/yr`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function parseISO(iso: string): Date {
  // Date-only strings are calendar dates: read them as UTC midnight so they never shift by zone.
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return new Date(`${iso}T00:00:00Z`);
  return new Date(iso);
}

/** UI date: `2 Jan 2019`. */
export function date(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = parseISO(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** Short date without year: `24 Nov`. */
export function dateShort(iso: string): string {
  const d = parseISO(iso);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

/** Month label: `Mar 2027`. */
export function month(iso: string): string {
  const d = parseISO(iso);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** Date in a long, screen-reader-friendly form: `1 December 2027`. */
export function dateLong(iso: string): string {
  const d = parseISO(iso);
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function zoned(iso: string, timeZone: string): { hm: string; day: string } {
  const d = new Date(iso);
  const hm = d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone,
  });
  const day = d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone,
  });
  return { hm, day };
}

/** Market time in ET: `16:30 ET`. */
export function timeET(iso: string): string {
  return `${zoned(iso, "America/New_York").hm} ET`;
}

/** Team-process time in UK: `23:59 UK`. */
export function timeUK(iso: string): string {
  return `${zoned(iso, "Europe/London").hm} UK`;
}

/** Date and time in ET: `24 Nov 2026 16:00 ET`. */
export function dateTimeET(iso: string): string {
  const z = zoned(iso, "America/New_York");
  return `${z.day} ${z.hm} ET`;
}

/** Date and time in UK: `30 Nov 2026 23:59 UK`. */
export function dateTimeUK(iso: string): string {
  const z = zoned(iso, "Europe/London");
  return `${z.day} ${z.hm} UK`;
}

/** Horizon label: `12M`. */
export function hLabel(h: number): string {
  return SESSION_LABEL[h] ?? `${h}s`;
}

/** Horizon chip: `12M · 252 sessions`. */
export function horizon(h: number): string {
  return `${hLabel(h)} · ${h} sessions`;
}

/** Hash: first 6 characters (full on hover and copy). */
export function hash(h: string | null | undefined, n = 6): string {
  if (!h) return "—";
  return h.replace(/^sha256:/, "").slice(0, n);
}

/** Run ID display: `run 01JD…7F3A`. */
export function runId(id: string): string {
  if (id.length <= 12) return id;
  return `${id.slice(0, 4)}…${id.slice(-4)}`;
}
