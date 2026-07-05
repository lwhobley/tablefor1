import { corsHeaders } from "./_shared/cors.ts";

type Diner = {
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

function scoreCompatibility(user1: Diner, user2: Diner): number {
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

interface MatchGroup {
  user_ids: string[];
  score: number;
}

function greedyMatching(
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { event_id } = await req.json();

    if (!event_id) {
      return new Response(JSON.stringify({ error: "Missing event_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");

    if (!supabaseServiceKey || !supabaseUrl) {
      throw new Error("Missing Supabase configuration");
    }

    // Fetch event details
    const eventResponse = await fetch(
      `${supabaseUrl}/rest/v1/events?id=eq.${event_id}&select=group_size,status`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${supabaseServiceKey}`,
          apikey: supabaseServiceKey,
        },
      }
    );

    const events = await eventResponse.json();
    if (!Array.isArray(events) || events.length === 0) {
      return new Response(JSON.stringify({ error: "Event not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const event = events[0];

    // Check if matching already done
    const existingMatches = await fetch(
      `${supabaseUrl}/rest/v1/matches?event_id=eq.${event_id}&select=id`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${supabaseServiceKey}`,
          apikey: supabaseServiceKey,
        },
      }
    );

    const existing = await existingMatches.json();
    if (Array.isArray(existing) && existing.length > 0) {
      return new Response(
        JSON.stringify({
          error: "Matching already completed for this event",
          matches: existing,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Fetch confirmed bookings with user details
    const bookingsResponse = await fetch(
      `${supabaseUrl}/rest/v1/bookings?event_id=eq.${event_id}&status=eq.confirmed&select=user_id,user:users(id,energy_level,conv_style,food_prefs,dietary,no_show_count,is_premium,trust_score,prefers_window_seat)`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${supabaseServiceKey}`,
          apikey: supabaseServiceKey,
        },
      }
    );

    const bookings = await bookingsResponse.json();
    if (!Array.isArray(bookings) || bookings.length < 2) {
      return new Response(
        JSON.stringify({
          error: "Not enough confirmed bookings to create matches",
          bookings: bookings.length,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Extract diner profiles
    const diners = bookings
      .map((b: any) => b.user)
      .filter((u: any) => u);

    // Run matching algorithm
    const groups = greedyMatching(diners, event.group_size);

    if (groups.length === 0) {
      return new Response(
        JSON.stringify({
          error: "Could not form valid groups with current bookings",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Create match rows
    const matchRows = groups.map((g) => ({
      event_id,
      user_ids: g.user_ids,
      score: parseFloat(g.score.toFixed(2)),
      revealed_at: null,
    }));

    const createResponse = await fetch(
      `${supabaseUrl}/rest/v1/matches`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${supabaseServiceKey}`,
          apikey: supabaseServiceKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(matchRows),
      }
    );

    if (!createResponse.ok) {
      throw new Error(
        `Failed to create matches: ${await createResponse.text()}`
      );
    }

    const created = await createResponse.json();

    // Update event status to 'matched'
    const updateResponse = await fetch(
      `${supabaseUrl}/rest/v1/events?id=eq.${event_id}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${supabaseServiceKey}`,
          apikey: supabaseServiceKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: "matched" }),
      }
    );

    if (!updateResponse.ok) {
      console.error("Failed to update event status");
    }

    return new Response(
      JSON.stringify({
        success: true,
        groups: groups.length,
        matches_created: Array.isArray(created) ? created.length : 0,
        total_diners: diners.length,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
