import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { BANNED, DISCLAIMER, DISCLAIMER_FULL } from "./copy";

/**
 * String scans of ux-spec §9.6 and §7.1 (advice-word lint, NFR-ACA-04): over UI source,
 * Markdown and fixtures. The full disclaimer, which negates advice, is the only allowed use.
 */
const SRC = resolve(process.cwd(), "src");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : /\.(tsx?|md|json)$/.test(p) ? [p] : [];
  });
}

const files = walk(SRC).filter((f) => !/\.test\.tsx?$/.test(f) && !f.includes("__snapshots__"));

function scrub(text: string, rel: string): string {
  let t = text.split(DISCLAIMER_FULL).join(" ");
  t = t.replace(
    /It does not provide investment advice or recommendations to buy or sell any security\./g,
    " ",
  );
  if (rel === "lib/copy.ts") t = t.replace(/export const BANNED = \[[\s\S]*?\] as const;/, " ");
  // "risk-free rate" is a technical term in the §7.13 glossary, not a claim.
  t = t.replace(/risk-free rate/g, " ");
  return t;
}

describe("banned strings (ux-spec §7.1, §9.6)", () => {
  it.each(BANNED.map((b) => [b]))("no %s in UI strings, Markdown or fixtures", (word) => {
    const re = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![a-z])`, "i");
    const hits = files
      .filter((f) => re.test(scrub(readFileSync(f, "utf8"), relative(SRC, f))))
      .map((f) => relative(SRC, f));
    expect(hits).toEqual([]);
  });

  it("the disclaimer constant is exact", () => {
    expect(DISCLAIMER).toBe("Educational research tool. Not investment advice.");
  });
});

describe("integrity actions are CLI-only (UXR1-43, D-047)", () => {
  it("no button, link or menu item names a freeze, reveal or unlock action", () => {
    const tsx = files.filter((f) => f.endsWith(".tsx"));
    const offenders: string[] = [];
    for (const f of tsx) {
      const text = readFileSync(f, "utf8");
      for (const m of text.matchAll(
        /<(Button|button|a|Link|DropdownMenuItem)\b[^>]*>([^<]{0,80})/g,
      )) {
        if (/\b(freeze|reveal|unlock)\b/i.test(m[2] ?? ""))
          offenders.push(`${relative(SRC, f)}: ${m[0].slice(0, 80)}`);
      }
      for (const m of text.matchAll(/aria-label="([^"]*)"/g)) {
        if (/\b(freeze|reveal|unlock)\b/i.test(m[1] ?? ""))
          offenders.push(`${relative(SRC, f)}: ${m[1]}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("the API client is read-only (no POST, PUT, PATCH or DELETE)", () => {
    const api = walk(join(SRC, "api")).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"));
    for (const f of api)
      expect(readFileSync(f, "utf8")).not.toMatch(/method:\s*["'](POST|PUT|PATCH|DELETE)/);
  });
});

describe("yardstick rule (UXR1-05)", () => {
  it("hist_drift appears as JSX text only inside YardstickLabel's module", () => {
    const tsx = files.filter((f) => f.endsWith(".tsx") && !f.endsWith("status-chips.tsx"));
    const offenders = tsx.filter((f) =>
      />\s*[^<{]*\bhist_drift\b[^<]*</.test(readFileSync(f, "utf8")),
    );
    expect(offenders.map((f) => relative(SRC, f))).toEqual([]);
  });
});

describe("ticker-agnostic code (D-070)", () => {
  it("no hard-coded ticker in UI code", () => {
    const code = files.filter((f) => /\.tsx?$/.test(f));
    const offenders = code.filter((f) => /\bAAPL\b/.test(readFileSync(f, "utf8")));
    expect(offenders.map((f) => relative(SRC, f))).toEqual([]);
  });
});
