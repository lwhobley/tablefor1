import { describe, expect, it } from "vitest";
import { isMysteryRevealed, priceTier, revealCountdownLabel, mysteryRevealAt } from "./mystery";

describe("isMysteryRevealed", () => {
  it("is always revealed for a non-mystery event", () => {
    expect(
      isMysteryRevealed({
        is_mystery: false,
        reveal_hours_before: 2,
        event_date: new Date(Date.now() + 3600_000).toISOString(),
      }),
    ).toBe(true);
  });

  it("is hidden before the reveal window", () => {
    expect(
      isMysteryRevealed({
        is_mystery: true,
        reveal_hours_before: 2,
        event_date: new Date(Date.now() + 3 * 3600_000).toISOString(),
      }),
    ).toBe(false);
  });

  it("is revealed once inside the reveal window", () => {
    expect(
      isMysteryRevealed({
        is_mystery: true,
        reveal_hours_before: 2,
        event_date: new Date(Date.now() + 1 * 3600_000).toISOString(),
      }),
    ).toBe(true);
  });
});

describe("mysteryRevealAt", () => {
  it("subtracts reveal_hours_before from the event date", () => {
    const eventDate = new Date("2026-01-01T20:00:00Z");
    const revealAt = mysteryRevealAt({
      is_mystery: true,
      reveal_hours_before: 3,
      event_date: eventDate.toISOString(),
    });
    expect(revealAt.toISOString()).toBe("2026-01-01T17:00:00.000Z");
  });
});

describe("priceTier", () => {
  it.each([
    [3999, "$"],
    [4000, "$$"],
    [7999, "$$"],
    [8000, "$$$"],
    [14999, "$$$"],
    [15000, "$$$$"],
  ])("maps %i cents to %s", (cents, tier) => {
    expect(priceTier(cents)).toBe(tier);
  });
});

describe("revealCountdownLabel", () => {
  it("says revealing now once the window has passed", () => {
    expect(
      revealCountdownLabel({
        is_mystery: true,
        reveal_hours_before: 2,
        event_date: new Date(Date.now() - 3600_000).toISOString(),
      }),
    ).toBe("Revealing now");
  });

  it("counts down in minutes under an hour", () => {
    const label = revealCountdownLabel({
      is_mystery: true,
      reveal_hours_before: 0,
      event_date: new Date(Date.now() + 30 * 60_000).toISOString(),
    });
    expect(label).toMatch(/^Revealed in \d+m$/);
  });
});
