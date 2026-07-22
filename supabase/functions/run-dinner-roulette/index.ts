import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";
import { isAuthorizedAdminCaller, unauthorizedResponse } from "../_shared/admin.ts";

function isPremiumActive(user: { is_premium: boolean; premium_expires_at: string | null }): boolean {
  return user.is_premium && (!user.premium_expires_at || new Date(user.premium_expires_at) > new Date());
}

type RouletteUser = {
  id: string;
  city: string;
  travel_city: string | null;
  is_active: boolean;
  is_premium: boolean;
  premium_expires_at: string | null;
  trust_score: number | null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Only admin or service role can trigger roulette matching
  if (!isAuthorizedAdminCaller(req)) {
    return unauthorizedResponse(corsHeaders);
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const { date } = await req.json().catch(() => ({ date: null }));
    const targetDate = date || new Date().toISOString().split("T")[0]; // YYYY-MM-DD

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Fetch pending roulette opt-ins
    const { data: optIns, error: optInErr } = await admin
      .from("roulette_opt_ins")
      .select("id, user_id, city, preferred_event_id, passed_event_ids")
      .eq("date", targetDate)
      .eq("status", "pending");

    if (optInErr) throw optInErr;
    if (!optIns || optIns.length === 0) {
      return json({ success: true, message: "No pending roulette opt-ins for " + targetDate, matched: [] });
    }

    const { data: users, error: usersErr } = await admin
      .from("users")
      .select("id, city, travel_city, is_active, is_premium, premium_expires_at, trust_score")
      .in("id", optIns.map((optIn) => optIn.user_id));

    if (usersErr) throw usersErr;
    const usersById = new Map((users ?? []).map((user) => [user.id, user as RouletteUser]));

    const eligibleOptIns = (optIns ?? []).filter((optIn) => {
      const profile = usersById.get(optIn.user_id);
      return (
        profile &&
        profile.is_active === true &&
        (profile.travel_city || profile.city) === optIn.city &&
        (profile.trust_score ?? 0) >= 70 &&
        isPremiumActive(profile)
      );
    });

    if (eligibleOptIns.length === 0) {
      return json({ success: true, message: "No pending roulette opt-ins for " + targetDate, matched: [] });
    }

    // Group opt-ins by city
    const optInsByCity = eligibleOptIns.reduce((acc: Record<string, typeof eligibleOptIns>, item) => {
      acc[item.city] = acc[item.city] || [];
      acc[item.city].push(item);
      return acc;
    }, {});

    const matchedList: Array<{ user_id: string; event_id: string; booking_id: string }> = [];

    // Process each city
    for (const city of Object.keys(optInsByCity)) {
      const cityOptIns = optInsByCity[city];

      // 2. Fetch open seats over the next two weeks so members can cycle
      // real alternatives instead of being limited to a single same-day draw.
      const windowStart = new Date(`${targetDate}T00:00:00Z`);
      const windowEnd = new Date(windowStart);
      windowEnd.setUTCDate(windowEnd.getUTCDate() + 14);
      const { data: events, error: eventErr } = await admin
        .from("events")
        .select("id, event_date, group_size, status, bookings(id, status, user_id)")
        .eq("city", city)
        .gte("event_date", windowStart.toISOString())
        .lte("event_date", windowEnd.toISOString())
        .in("status", ["open", "matched"])
        .order("event_date", { ascending: true });

      if (eventErr) throw eventErr;
      if (!events || events.length === 0) {
        continue; // No events in this city tonight
      }

      // Map events with computed covers count
      const activeEvents = events.map((e) => {
        const bookingsList = (e.bookings as Array<{ id: string; status: string; user_id: string }> || []);
        const confirmedCount = bookingsList.filter((b) => b.status === "confirmed").length;
        const spotsLeft = e.group_size - confirmedCount;
        return {
          ...e,
          confirmedCount,
          spotsLeft,
          bookingUserIds: bookingsList.filter((b) => b.status === "confirmed").map((b) => b.user_id),
        };
      }).filter((e) => e.spotsLeft > 0);

      // 3. Match each user to an available table
      for (const optIn of cityOptIns) {
        const isEligible = (event: (typeof activeEvents)[number]) =>
          event.spotsLeft > 0 && !event.bookingUserIds.includes(optIn.user_id);
        const preferred = activeEvents.find(
          (event) => event.id === optIn.preferred_event_id && isEligible(event),
        );
        const passedIds = new Set<string>(optIn.passed_event_ids ?? []);
        const unpassed = activeEvents.find(
          (event) => !passedIds.has(event.id) && isEligible(event),
        );
        const event = preferred ?? unpassed ?? activeEvents.find(isEligible);
        if (!event) continue; // No available table for this diner

        // 4. Create confirmed booking
        const { data: newBooking, error: bookErr } = await admin
          .from("bookings")
          .insert({
            event_id: event.id,
            user_id: optIn.user_id,
            status: "confirmed",
            amount_cents: 0, // covered by premium / roulette
          })
          .select("id")
          .single();

        if (bookErr) {
          console.error(`Failed to create booking for user ${optIn.user_id} on event ${event.id}:`, bookErr);
          continue;
        }

        // Update local count
        event.spotsLeft--;
        event.confirmedCount++;
        event.bookingUserIds.push(optIn.user_id);

        // 5. Update roulette_opt_ins row
        await admin
          .from("roulette_opt_ins")
          .update({
            status: "matched",
            booking_id: newBooking.id,
          })
          .eq("id", optIn.id);

        // 6. Update matches row if it exists
        const { data: match } = await admin
          .from("matches")
          .select("id, user_ids")
          .eq("event_id", event.id)
          .maybeSingle();

        if (match) {
          const updatedUserIds = [...match.user_ids, optIn.user_id];
          await admin
            .from("matches")
            .update({ user_ids: updatedUserIds })
            .eq("id", match.id);
        }

        // 7. Update event status to 'full' if no spots left
        if (event.spotsLeft <= 0) {
          await admin
            .from("events")
            .update({ status: "full" })
            .eq("id", event.id);
        }

        matchedList.push({
          user_id: optIn.user_id,
          event_id: event.id,
          booking_id: newBooking.id,
        });
      }
    }

    return json({
      success: true,
      matched_count: matchedList.length,
      matched: matchedList,
    });
  } catch (error) {
    console.error("run-dinner-roulette error:", error);
    return json({ error: (error as Error).message }, 500);
  }
});
