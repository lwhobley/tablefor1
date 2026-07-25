import { createClient } from "https://esm.sh/@supabase/supabase-js@2.110.0";
import { corsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader) {
    return json({ error: "Missing Authorization header" }, 401);
  }

  try {
    const { reconnect_request_id, restaurant_id, event_date } = await req.json();
    if (!reconnect_request_id || !restaurant_id || !event_date) {
      return json({ error: "Missing required parameters" }, 400);
    }

    const client = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data, error } = await client.rpc("create_reconnect_dinner_atomic", {
      p_reconnect_request_id: reconnect_request_id,
      p_restaurant_id: restaurant_id,
      p_event_date: event_date,
    });
    if (error) {
      const status = error.code === "42501" ? 403 : error.code === "P0002" ? 404 : 409;
      return json({ error: error.message }, status);
    }

    return json(data);
  } catch (error) {
    console.error("create-reconnect-dinner error:", error);
    return json({ error: "Could not schedule reconnect dinner" }, 500);
  }
});
