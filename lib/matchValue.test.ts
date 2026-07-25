import { describe, expect, it } from "vitest";
import { getEventMatchFit } from "./matchValue";

const profile = {
  id: "user-1",
  city: "Houston",
  travel_city: null,
  food_prefs: ["Italian"],
  preferred_vibes: ["warm"],
  budget_max_cents: 10000,
  is_premium: true,
} as any;

const event = {
  city: "Houston",
  price_cents: 7500,
  restaurant: { cuisine: ["Italian"] },
  vibe_tags: ["warm"],
  is_signature: true,
} as any;

describe("getEventMatchFit", () => {
  it("explains strong event compatibility", () => {
    const fit = getEventMatchFit(profile, event);
    expect(fit.score).toBe(98);
    expect(fit.reasons).toContain("Matches your taste for Italian");
  });

  it("uses travel mode as the active city", () => {
    const fit = getEventMatchFit({ ...profile, travel_city: "Austin" }, { ...event, city: "Austin" });
    expect(fit.reasons[0]).toBe("Fits your Austin travel mode");
  });

  it("returns a sub-cap score when few signals match", () => {
    const fit = getEventMatchFit(
      { ...profile, food_prefs: ["Korean"], preferred_vibes: ["lively"], is_premium: false } as any,
      { ...event, is_signature: false },
    );
    expect(fit.score).toBeLessThan(98);
    expect(fit.score).toBeGreaterThanOrEqual(45);
  });
});
