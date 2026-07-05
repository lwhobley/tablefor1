import { describe, expect, it } from "vitest";
import { isMutualSpark } from "./sparks";
import type { Spark } from "./supabase";

function spark(overrides: Partial<Spark>): Spark {
  return {
    id: "spark-id",
    match_id: "match-1",
    user_id: "a",
    target_user_id: "b",
    sparked: true,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

describe("isMutualSpark", () => {
  it("is false with no sparks", () => {
    expect(isMutualSpark([], "a", "b")).toBe(false);
  });

  it("is false with only a one-directional spark", () => {
    const sparks = [spark({ user_id: "a", target_user_id: "b", sparked: true })];
    expect(isMutualSpark(sparks, "a", "b")).toBe(false);
  });

  it("is false if one side sparked but marked sparked: false", () => {
    const sparks = [
      spark({ user_id: "a", target_user_id: "b", sparked: true }),
      spark({ user_id: "b", target_user_id: "a", sparked: false }),
    ];
    expect(isMutualSpark(sparks, "a", "b")).toBe(false);
  });

  it("is true when both directions sparked", () => {
    const sparks = [
      spark({ user_id: "a", target_user_id: "b", sparked: true }),
      spark({ user_id: "b", target_user_id: "a", sparked: true }),
    ];
    expect(isMutualSpark(sparks, "a", "b")).toBe(true);
    // Symmetric regardless of argument order.
    expect(isMutualSpark(sparks, "b", "a")).toBe(true);
  });

  it("ignores sparks between unrelated users", () => {
    const sparks = [
      spark({ user_id: "a", target_user_id: "c", sparked: true }),
      spark({ user_id: "c", target_user_id: "a", sparked: true }),
    ];
    expect(isMutualSpark(sparks, "a", "b")).toBe(false);
  });
});
