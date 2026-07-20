import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { greedyMatching, scoreCompatibility, type Diner } from "./matching.ts";

function diner(id: string, overrides: Partial<Diner> = {}): Diner {
  return {
    id,
    energy_level: "balanced",
    conv_style: "balanced",
    food_prefs: [],
    dietary: [],
    ...overrides,
  };
}

Deno.test("scoreCompatibility: identical energy levels score higher than a mismatch", () => {
  const a = diner("a", { energy_level: "high_energy" });
  const b = diner("b", { energy_level: "high_energy" });
  const c = diner("c", { energy_level: "low_key" });

  const matchScore = scoreCompatibility(a, b);
  const mismatchScore = scoreCompatibility(a, c);
  assert(matchScore > mismatchScore);
});

Deno.test("scoreCompatibility: listener + storyteller beats two listeners", () => {
  const listener = diner("l", { conv_style: "listener" });
  const storyteller = diner("s", { conv_style: "storyteller" });
  const otherListener = diner("l2", { conv_style: "listener" });

  const complementary = scoreCompatibility(listener, storyteller);
  const same = scoreCompatibility(listener, otherListener);
  assert(complementary > same);
});

Deno.test("scoreCompatibility: chronic no-shows lower the score but never below zero", () => {
  const a = diner("a", { no_show_count: 10 });
  const b = diner("b", { no_show_count: 10 });
  const score = scoreCompatibility(a, b);
  assert(score >= 0);
});

Deno.test("greedyMatching: fewer diners than group size produces no groups", () => {
  const diners = [diner("a"), diner("b")];
  const groups = greedyMatching(diners, 4);
  assertEquals(groups, []);
});

Deno.test("greedyMatching: exact group size produces one full group", () => {
  const diners = [diner("a"), diner("b"), diner("c"), diner("d")];
  const groups = greedyMatching(diners, 4);
  assertEquals(groups.length, 1);
  assertEquals(groups[0].user_ids.length, 4);
  const allIds = groups.flatMap((g) => g.user_ids).sort();
  assertEquals(allIds, ["a", "b", "c", "d"]);
});

Deno.test("greedyMatching: every diner ends up in exactly one group", () => {
  const diners = Array.from({ length: 9 }, (_, i) => diner(`d${i}`));
  const groups = greedyMatching(diners, 4);

  const seen = new Set<string>();
  for (const group of groups) {
    for (const id of group.user_ids) {
      assert(!seen.has(id), `diner ${id} appears in more than one group`);
      seen.add(id);
    }
  }
  assertEquals(seen.size, diners.length);
});

Deno.test("greedyMatching: no group ever exceeds groupSize", () => {
  const diners = Array.from({ length: 11 }, (_, i) => diner(`d${i}`));
  const groupSize = 4;
  const groups = greedyMatching(diners, groupSize);
  for (const group of groups) {
    assert(
      group.user_ids.length <= groupSize,
      `group ${JSON.stringify(group.user_ids)} exceeds groupSize ${groupSize}`,
    );
  }
});

Deno.test("greedyMatching: blocked diners are never placed together", () => {
  const diners = [
    diner("a", { blocked_ids: ["b"] }),
    diner("b"),
    diner("c"),
  ];
  const groups = greedyMatching(diners, 2);
  const invalid = groups.some(
    (group) => group.user_ids.includes("a") && group.user_ids.includes("b"),
  );
  assert(!invalid, "blocked diners were placed in the same group");
});
