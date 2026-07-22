import { corsHeaders } from "../_shared/cors.ts";
import { isAuthorizedAdminCaller, unauthorizedResponse } from "../_shared/admin.ts";

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

    // Revealing tells diners where to show up. For Resy-integrated events,
    // never reveal unless the real reservation is actually secured
    // ('booked') or the event has no Resy integration at all ('none') —
    // revealing a 'pending' or 'failed' event sends people to a restaurant
    // that has no table for them.
    const eventCheckResponse = await fetch(
      `${supabaseUrl}/rest/v1/events?id=eq.${event_id}&select=resy_booking_status`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${supabaseServiceKey}`,
          apikey: supabaseServiceKey,
        },
      }
    );
    const eventRows = await eventCheckResponse.json();
    const resyStatus = Array.isArray(eventRows)
      ? eventRows[0]?.resy_booking_status
      : undefined;
    if (resyStatus === "pending" || resyStatus === "failed") {
      return new Response(
        JSON.stringify({
          error:
            `Resy reservation for this event is '${resyStatus}' — the table is not secured. Resolve the reservation before revealing the match.`,
        }),
        {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Fetch all matches for this event
    const matchesResponse = await fetch(
      `${supabaseUrl}/rest/v1/matches?event_id=eq.${event_id}&select=id,user_ids,revealed_at`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${supabaseServiceKey}`,
          apikey: supabaseServiceKey,
        },
      }
    );

    const matches = await matchesResponse.json();
    if (!Array.isArray(matches) || matches.length === 0) {
      return new Response(JSON.stringify({ error: "No matches found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update all matches to set revealed_at = now(), and remember which ones
    // were newly revealed (as opposed to an already-revealed match returned
    // again by a retry) so we only email diners once.
    const now = new Date().toISOString();
    const newlyRevealed: string[] = [];
    const updatePromises = matches.map((match: any) => {
      if (match.revealed_at) {
        // Already revealed, skip
        return Promise.resolve(null);
      }
      newlyRevealed.push(match.id);

      return fetch(`${supabaseUrl}/rest/v1/matches?id=eq.${match.id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${supabaseServiceKey}`,
          apikey: supabaseServiceKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ revealed_at: now }),
      });
    });

    const results = await Promise.all(updatePromises);
    const successful = results.filter((r) => r && r.ok).length;

    // Fire the reveal email for each newly-revealed match. Fire-and-forget:
    // an email failure shouldn't fail the reveal itself, since the match
    // rows are already committed above.
    await Promise.all(
      newlyRevealed.map((matchId) =>
        fetch(`${supabaseUrl}/functions/v1/send-match-revealed`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${supabaseServiceKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ match_id: matchId }),
        }).catch((err) =>
          console.error(`send-match-revealed failed for match ${matchId}:`, err),
        ),
      ),
    );

    return new Response(
      JSON.stringify({
        success: true,
        total_matches: matches.length,
        revealed: successful,
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
