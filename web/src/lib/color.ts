/**
 * Colour maths for the token tests (ux-spec §2.9, UXR1-08).
 *
 * - Contrast: WCAG 2.x relative luminance, (L1 + 0.05) / (L2 + 0.05) (W3C, 2008).
 * - CVD simulation: Machado, Oliveira and Fernandes (2009) full-severity matrices,
 *   applied in linear RGB.
 * - Colour difference: CIE76 ΔE*ab in CIELAB (D65 white).
 */

export type RGB = [number, number, number];

export function hexToRgb(hex: string): RGB {
  const h = hex.replace("#", "");
  const n = Number.parseInt(h.length === 3 ? h.replace(/(.)/g, "$1$1") : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toLinear(c8: number): number {
  const c = c8 / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function linearRgb(hex: string): RGB {
  const [r, g, b] = hexToRgb(hex);
  return [toLinear(r), toLinear(g), toLinear(b)];
}

export function luminance(hex: string): number {
  const [r, g, b] = linearRgb(hex);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

type M3 = [RGB, RGB, RGB];

/** Machado et al. (2009), severity 1.0. */
export const CVD: Record<"protan" | "deutan" | "tritan", M3> = {
  protan: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deutan: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
  tritan: [
    [1.255528, -0.076749, -0.178779],
    [-0.078411, 0.930809, 0.147602],
    [0.004733, 0.691367, 0.3039],
  ],
};

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x));
}

function apply(m: M3, v: RGB): RGB {
  return [
    clamp01(m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2]),
    clamp01(m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2]),
    clamp01(m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2]),
  ];
}

function linToLab([r, g, b]: RGB): RGB {
  // sRGB (linear) → XYZ (D65)
  const x = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047;
  const y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b;
  const z = (0.0193339 * r + 0.119192 * g + 0.9503041 * b) / 1.08883;
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : ((24389 / 27) * t + 16) / 116);
  const fx = f(x);
  const fy = f(y);
  const fz = f(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

export type Vision = "normal" | "protan" | "deutan" | "tritan";

export function lab(hex: string, vision: Vision = "normal"): RGB {
  const lin = linearRgb(hex);
  return linToLab(vision === "normal" ? lin : apply(CVD[vision], lin));
}

/** CIE76 ΔE between two colours as seen with the given vision. */
export function deltaE(a: string, b: string, vision: Vision = "normal"): number {
  const [l1, a1, b1] = lab(a, vision);
  const [l2, a2, b2] = lab(b, vision);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
}
