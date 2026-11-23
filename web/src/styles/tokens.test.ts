import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { contrast, deltaE, type Vision } from "@/lib/color";
import tokens from "./tokens.json";

function block(selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`);
  const end = css.indexOf("}", start);
  const out: Record<string, string> = {};
  for (const m of css.slice(start, end).matchAll(/--o-([a-z0-9-]+):([^;]+);/g)) {
    out[m[1] as string] = (m[2] as string).trim();
  }
  return out;
}

// Vitest runs from web/; read the stylesheet as text (CSS imports are stubbed in tests).
const css = readFileSync(resolve(process.cwd(), "src/styles/tokens.css"), "utf8");

const THEMES = { light: tokens.light, dark: tokens.dark } as const;
type Theme = keyof typeof THEMES;
const CVD: Vision[] = ["deutan", "protan", "tritan"];

describe("tokens.css ↔ tokens.json (UXR1-08)", () => {
  it("light block matches tokens.json", () => {
    expect(block(":root, .light")).toEqual(tokens.light);
  });
  it("dark block matches tokens.json", () => {
    expect(block(".dark")).toEqual(tokens.dark);
  });
});

describe.each(Object.keys(THEMES) as Theme[])(
  "%s theme contrast (WCAG 1.4.3 / 1.4.11)",
  (theme) => {
    const t = THEMES[theme] as Record<string, string>;
    const surfaces = ["surface", "raised", "canvas"] as const;

    it.each(["text", "text-2", "text-3"])("%s ≥ 4.5:1 on surface, raised and canvas", (k) => {
      for (const s of surfaces) {
        expect(contrast(t[k] as string, t[s] as string)).toBeGreaterThanOrEqual(4.5);
      }
    });

    it("text-3 ≥ 4.5:1 on every layer except selected", () => {
      for (const s of ["canvas", "surface", "raised", "overlay", "sunken", "hover"]) {
        expect(contrast(t["text-3"] as string, t[s] as string)).toBeGreaterThanOrEqual(4.5);
      }
    });

    it.each(["border-input", "ref", "s1", "s2", "s3", "s4", "s5", "s6", "up", "down"])(
      "%s ≥ 3:1 on surface",
      (k) => {
        expect(contrast(t[k] as string, t.surface as string)).toBeGreaterThanOrEqual(3);
      },
    );
  },
);

describe.each(Object.keys(THEMES) as Theme[])("%s theme CVD separation (NFR-UX-05)", (theme) => {
  const t = THEMES[theme] as Record<string, string>;

  it.each(CVD)("up vs down ΔE76 ≥ 18 under %s", (v) => {
    expect(deltaE(t.up as string, t.down as string, v)).toBeGreaterThanOrEqual(18);
  });

  it.each(CVD)("Series-6 + accent + ink pairwise ΔE76 ≥ 18 under %s", (v) => {
    const keys = ["s1", "s2", "s3", "s4", "s5", "s6", "accent", "ink"];
    let min = Number.POSITIVE_INFINITY;
    for (let i = 0; i < keys.length; i++) {
      for (let j = i + 1; j < keys.length; j++) {
        min = Math.min(
          min,
          deltaE(t[keys[i] as string] as string, t[keys[j] as string] as string, v),
        );
      }
    }
    expect(min).toBeGreaterThanOrEqual(18);
  });
});
