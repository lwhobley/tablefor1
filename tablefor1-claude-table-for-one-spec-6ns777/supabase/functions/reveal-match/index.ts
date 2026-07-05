import { corsHeaders } from "./_shared/cors.ts";

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

    // Update all matches to set revealed_at = now()
    const now = new Date().toISOString();
    const updatePromises = matches.map((match: any) => {
      if (match.revealed_at) {
        // Already revealed, skip
        return Promise.resolve(null);
      }

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

    // TODO: Invoke send-match-revealed edge function for each match
    // This would send emails to all matched diners

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
