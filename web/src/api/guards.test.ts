import { describe, expect, it } from "vitest";
import { assertNoSealedHoldout, findHoldoutPaths, IntegrityError } from "./guards";
import type { HoldoutState } from "./types";

const sealed: HoldoutState = {
  state: "sealed",
  boundary: "2021-01-01",
  basis: "outcome_date",
  freeze_at: "2026-11-30T23:59:00Z",
  reveal_at: "2026-12-01T12:00:00Z",
};
const revealed: HoldoutState = { ...sealed, state: "revealed" };

describe("holdout integrity guard (UXR1-02 rule 3)", () => {
  const payload = {
    horizons: [{ segments: { dev: { sample: "dev" }, holdout: { sample: "holdout", est: 0.1 } } }],
  };

  it("finds every holdout-tagged object", () => {
    expect(findHoldoutPaths(payload)).toEqual(["$.horizons[0].segments.holdout"]);
    expect(findHoldoutPaths({ a: [{ sample: "val" }] })).toEqual([]);
  });

  it("refuses holdout values while sealed", () => {
    expect(() => assertNoSealedHoldout(payload, sealed)).toThrow(IntegrityError);
    expect(() => assertNoSealedHoldout(payload, sealed)).toThrow(
      "Integrity check: holdout scores received while sealed. Not displayed.",
    );
  });

  it("fails safe when the holdout state is unknown", () => {
    expect(() => assertNoSealedHoldout(payload, undefined)).toThrow(IntegrityError);
  });

  it("passes holdout values after the reveal and clean payloads while sealed", () => {
    expect(assertNoSealedHoldout(payload, revealed)).toBe(payload);
    const clean = { x: { sample: "dev" } };
    expect(assertNoSealedHoldout(clean, sealed)).toBe(clean);
  });
});
