import { corsHeaders } from "../_shared/cors.ts";
import { isAuthorizedAdminCaller, unauthorizedResponse } from "../_shared/admin.ts";
import { greedyMatching } from "./matching.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (!isAuthorizedAdminCaller(req)) return unauthorizedResponse(corsHeaders);

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
