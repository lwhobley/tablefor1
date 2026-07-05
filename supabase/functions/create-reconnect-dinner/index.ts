import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { isAuthorizedAdminCaller } from "../_shared/admin.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    // Both users can call this if they are logged in and accepting the invitation
    // Let's authenticate the caller to make sure they are one of the users in the request.
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, supabaseServiceKey);

    // Get authorization header to verify token
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ error: "Missing Authorization header" }, 401);
    }
    const token = authHeader.replace("Bearer ", "");
    const { data: { user: caller }, error: authErr } = await admin.auth.getUser(token);
    if (authErr || !caller) {
      return json({ error: "Unauthorized" }, 401);
    }

    const { reconnect_request_id, restaurant_id, event_date } = await req.json();

    if (!reconnect_request_id || !restaurant_id || !event_date) {
      return json({ error: "Missing required parameters" }, 400);
    }

    // 1. Fetch reconnect request
    const { data: request, error: reqErr } = await admin
      .from("reconnect_requests")
      .select("id, user_id, target_user_id, status")
      .eq("id", reconnect_request_id)
      .single();

    if (reqErr || !request) {
      return json({ error: "Reconnect request not found" }, 404);
    }

    // Ensure the caller is one of the users in this reconnect request
    if (caller.id !== request.user_id && caller.id !== request.target_user_id) {
      return json({ error: "You are not authorized to book this reconnect dinner" }, 403);
    }

    // 2. Verify mutual spark
    const { data: sparkCheck, error: sparkErr } = await admin.rpc("has_mutual_spark", {
      p_user_a: request.user_id,
      p_user_b: request.target_user_id,
    });

    if (sparkErr) throw sparkErr;
    if (!sparkCheck) {
      return json({ error: "Users do not have a mutual spark" }, 400);
    }

    // 3. Fetch requester's city
    const { data: user, error: userErr } = await admin
      .from("users")
      .select("city")
      .eq("id", request.user_id)
      .single();

    if (userErr || !user) throw userErr || new Error("User city not found");

    // 4. Create custom Event
    const { data: event, error: eventErr } = await admin
      .from("events")
      .insert({
        restaurant_id,
        event_date,
        group_size: 2,
        status: "matched", // already matched!
        city: user.city,
        format: "dinner",
        price_cents: 0, // covered / free booking
        is_mystery: false,
      })
      .select("id")
      .single();

    if (eventErr) throw eventErr;

    // 5. Create confirmed bookings for both users
    const { error: bookingsErr } = await admin
      .from("bookings")
      .insert([
        { event_id: event.id, user_id: request.user_id, status: "confirmed", amount_cents: 0 },
        { event_id: event.id, user_id: request.target_user_id, status: "confirmed", amount_cents: 0 },
      ]);

    if (bookingsErr) throw bookingsErr;

    // 6. Create matches row
    const { error: matchErr } = await admin
      .from("matches")
      .insert({
        event_id: event.id,
        user_ids: [request.user_id, request.target_user_id],
        score: 100.00,
        revealed_at: new Date().toISOString(), // immediately revealed!
      });

    if (matchErr) throw matchErr;

    // 7. Update reconnect request status and link event
    const { error: updateErr } = await admin
      .from("reconnect_requests")
      .update({
        status: "accepted",
        event_id: event.id,
      })
      .eq("id", reconnect_request_id);

    if (updateErr) throw updateErr;

    return json({
      success: true,
      event_id: event.id,
      message: "Reconnect dinner successfully scheduled!",
    });
  } catch (error) {
    console.error("create-reconnect-dinner error:", error);
    return json({ error: (error as Error).message }, 500);
  }
});
