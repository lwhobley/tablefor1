// Admin-only: turns an approved partner availability slot into a real event
// row, then flips the slot's is_approved flag. Expects { availability_id,
// price_cents } in the JSON body.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, preflight } from "../_shared/cors.ts";
import { isAuthorizedAdminCaller, unauthorizedResponse } from "../_shared/admin.ts";

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;

  if (!isAuthorizedAdminCaller(req)) return unauthorizedResponse(corsHeaders);

  const { availability_id, price_cents, is_mystery, reveal_hours_before } = await req.json();
  if (!availability_id || !price_cents) {
    return new Response(
      JSON.stringify({ error: "availability_id and price_cents required" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: slot, error: slotErr } = await supabase
    .from("partner_availability")
    .select("*, restaurants(*)")
    .eq("id", availability_id)
    .single();
  if (slotErr || !slot) {
    return new Response(JSON.stringify({ error: slotErr?.message ?? "slot not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (slot.is_approved) {
    return new Response(
      JSON.stringify({ error: "This availability slot was already approved" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const { data: event, error: eventErr } = await supabase
    .from("events")
    .insert({
      restaurant_id: slot.restaurant_id,
      format: slot.format,
      event_date: slot.proposed_date,
      group_size: Math.min(slot.max_covers, 6),
      price_cents,
      city: slot.restaurants.city,
      status: "open",
      resy_booking_status: slot.restaurants?.resy_venue_id ? "pending" : "none",
      is_mystery: is_mystery ?? false,
      ...(reveal_hours_before ? { reveal_hours_before } : {}),
    })
    .select()
    .single();
  if (eventErr) {
    return new Response(JSON.stringify({ error: eventErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  await supabase
    .from("partner_availability")
    .update({ is_approved: true })
    .eq("id", availability_id);

  return new Response(JSON.stringify({ event_id: event.id }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
