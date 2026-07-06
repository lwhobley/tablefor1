import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
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

    const eventDate = new Date(event_date);
    if (!Number.isFinite(eventDate.getTime())) {
      return json({ error: "Invalid event date" }, 400);
    }

    const now = new Date();
    const latestAllowed = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
    if (eventDate <= now || eventDate > latestAllowed) {
      return json({ error: "Event date must be in the next 90 days" }, 400);
    }

    // 1. Fetch reconnect request
    const { data: request, error: reqErr } = await admin
      .from("reconnect_requests")
      .select("id, user_id, target_user_id, status, event_id")
      .eq("id", reconnect_request_id)
      .single();

    if (reqErr || !request) {
      return json({ error: "Reconnect request not found" }, 404);
    }

    // Ensure the caller is one of the users in this reconnect request
    if (caller.id !== request.user_id && caller.id !== request.target_user_id) {
      return json({ error: "You are not authorized to book this reconnect dinner" }, 403);
    }

    if (request.status !== "accepted") {
      return json({ error: "Reconnect request must be accepted before booking" }, 409);
    }

    if (request.event_id) {
      return json({ error: "Reconnect dinner has already been scheduled" }, 409);
    }

    // 2. Verify mutual spark
    const { data: sparkRows, error: sparkErr } = await admin
      .from("sparks")
      .select("match_id, user_id, target_user_id")
      .or(
        `and(user_id.eq.${request.user_id},target_user_id.eq.${request.target_user_id},sparked.eq.true),` +
          `and(user_id.eq.${request.target_user_id},target_user_id.eq.${request.user_id},sparked.eq.true)`,
      );

    if (sparkErr) throw sparkErr;
    const sparkMatchIds = new Set(
      (sparkRows ?? [])
        .filter((row) => row.user_id === request.user_id && row.target_user_id === request.target_user_id)
        .map((row) => row.match_id),
    );
    const hasMutualSpark = (sparkRows ?? []).some(
      (row) =>
        row.user_id === request.target_user_id &&
        row.target_user_id === request.user_id &&
        sparkMatchIds.has(row.match_id),
    );
    if (!hasMutualSpark) {
      return json({ error: "Users do not have a mutual spark" }, 400);
    }

    // 3. Fetch requester's city
    const { data: user, error: userErr } = await admin
      .from("users")
      .select("city")
      .eq("id", request.user_id)
      .single();

    if (userErr || !user) throw userErr || new Error("User city not found");

    const { data: restaurant, error: restaurantErr } = await admin
      .from("restaurants")
      .select("id, city, is_active")
      .eq("id", restaurant_id)
      .single();

    if (restaurantErr || !restaurant) {
      return json({ error: "Restaurant not found" }, 404);
    }
    if (!restaurant.is_active || restaurant.city !== user.city) {
      return json({ error: "Restaurant is not available for this reconnect dinner" }, 400);
    }

    // 4. Create custom Event
    const { data: event, error: eventErr } = await admin
      .from("events")
      .insert({
        restaurant_id,
        event_date: eventDate.toISOString(),
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
