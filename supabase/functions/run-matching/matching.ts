// Pure matching logic, split out of index.ts so it can be unit tested
// with `deno test` without spinning up the HTTP handler.

export type Diner = {
  id: string;
  energy_level: string;
  conv_style: string;
  food_prefs: string[];
  dietary: string[];
  no_show_count?: number;
  is_premium?: boolean;
  trust_score?: number;
  prefers_window_seat?: boolean;
};

export function scoreCompatibility(user1: Diner, user2: Diner): number {
  let score = 0;

  // Energy level compatibility (0-25 points)
  const energyMatch =
    user1.energy_level === user2.energy_level
      ? 25
      : ["low_key", "balanced", "high_energy"].includes(user1.energy_level) &&
          ["low_key", "balanced", "high_energy"].includes(user2.energy_level)
        ? 15
        : 5;
  score += energyMatch;

  // Conversation style complementarity (0-25 points)
  // listener + storyteller = good, balanced + anything = okay
  const convScore =
    (user1.conv_style === "listener" && user2.conv_style === "storyteller") ||
    (user1.conv_style === "storyteller" && user2.conv_style === "listener")
      ? 25
      : user1.conv_style === "balanced" || user2.conv_style === "balanced"
        ? 20
        : user1.conv_style === user2.conv_style
          ? 15
          : 5;
  score += convScore;

  // Food preference overlap (0-25 points)
  const foodOverlap = user1.food_prefs.filter((f) =>
    user2.food_prefs.includes(f)
  ).length;
  const foodScore = Math.min(
    25,
    (foodOverlap / Math.max(user1.food_prefs.length, user2.food_prefs.length, 1)) * 25
  );
  score += foodScore;

  // Dietary compatibility (0-25 points)
  const dietaryCompatible =
    user1.dietary.length === 0 ||
    user2.dietary.length === 0 ||
    user1.dietary.every((d) => user2.dietary.includes(d)) ||
    user2.dietary.every((d) => user1.dietary.includes(d));
  score += dietaryCompatible ? 25 : 5;

  // Seating Preference compatibility (up to 15 points)
  if (user1.prefers_window_seat && user2.prefers_window_seat) {
    score += 15;
  }

  // Premium priority matching (up to 15 points)
  if (user1.is_premium && user2.is_premium) {
    score += 15;
  }

  // High Trust score pairing (up to 15 points)
  const isHighTrust1 = (user1.trust_score ?? 100) >= 90;
  const isHighTrust2 = (user2.trust_score ?? 100) >= 90;
  if (isHighTrust1 && isHighTrust2) {
    score += 15;
  }

  // Chronic no-show penalty: deprioritize pairing with diners who have a
  // track record of not checking in (capped so it can't zero out the score).
  const noShowPenalty =
    Math.min(3, user1.no_show_count ?? 0) * 5 + Math.min(3, user2.no_show_count ?? 0) * 5;
  score = Math.max(0, score - noShowPenalty);

  return score;
}

export interface MatchGroup {
  user_ids: string[];
  score: number;
}

export function greedyMatching(
  diners: Diner[],
  groupSize: number
): MatchGroup[] {
  if (diners.length < groupSize) {
    return [];
  }

  const matched = new Set<string>();
  const groups: MatchGroup[] = [];

  // Greedy algorithm: start with highest-scoring pairs
  const pairs: Array<{ ids: [string, string]; score: number }> = [];

  for (let i = 0; i < diners.length; i++) {
    for (let j = i + 1; j < diners.length; j++) {
      const score = scoreCompatibility(diners[i], diners[j]);
      pairs.push({ ids: [diners[i].id, diners[j].id], score });
    }
  }

  // Sort by score descending
  pairs.sort((a, b) => b.score - a.score);

  // Build groups greedily
  for (const pair of pairs) {
    if (!matched.has(pair.ids[0]) && !matched.has(pair.ids[1])) {
      const group: MatchGroup = {
        user_ids: [pair.ids[0], pair.ids[1]],
        score: pair.score,
      };

      // Try to add more people to reach groupSize
      for (const diner of diners) {
        if (
          group.user_ids.length >= groupSize ||
          matched.has(diner.id) ||
          group.user_ids.includes(diner.id)
        ) {
          continue;
        }

        // Calculate average compatibility with group
        const avgCompat =
          group.user_ids.reduce(
            (sum, uid) => {
              const groupMember = diners.find((d) => d.id === uid)!;
              return sum + scoreCompatibility(diner, groupMember);
            },
            0
          ) / group.user_ids.length;

        if (avgCompat > 40) {
          // Threshold for adding to group
          group.user_ids.push(diner.id);
          group.score = (group.score + avgCompat) / 2; // Update score
        }
      }

      // Mark users as matched
      group.user_ids.forEach((id) => matched.add(id));
      groups.push(group);
    }
  }

  // Place any diners the greedy pass left unmatched (odd counts, or everyone
  // below the avgCompat threshold) so nobody who paid is dropped. Fill the
  // smallest non-full group first; if every group is full, open a new one.
  //
  // Known edge case (documented, not fixed here): if every existing group
  // is already at capacity, this opens a brand new "group" of a single
  // diner rather than a real dinner group. Resolving that requires a
  // product decision (over-fill an existing table by one? refund and
  // notify the diner? hold them for the next event?) rather than a
  // silent algorithm change, so run-matching's caller should treat any
  // returned group with user_ids.length < 2 as needing manual review.
  const leftovers = diners.filter((d) => !matched.has(d.id));
  for (const diner of leftovers) {
    const openGroup = groups
      .filter((g) => g.user_ids.length < groupSize)
      .sort((a, b) => a.user_ids.length - b.user_ids.length)[0];

    if (openGroup) {
      openGroup.user_ids.push(diner.id);
    } else {
      groups.push({ user_ids: [diner.id], score: 0 });
    }
    matched.add(diner.id);
  }

  return groups;
}
