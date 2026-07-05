// Transfers the partner's share of a completed event to their Stripe Connect
// account. Triggered after admin flips an event to 'completed'.
//
// Math: gross = confirmed_covers * price_cents, partner share = gross * 0.80
// (platform keeps 20%). Adjust PLATFORM_FEE_BPS via env if needed.

import Stripe from "https://esm.sh/stripe@14";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, preflight } from "../_shared/cors.ts";

const PLATFORM_FEE_BPS = Number(Deno.env.get("PLATFORM_FEE_BPS") ?? 2000);

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;

  const { event_id } = await req.json();
  if (!event_id) {
    return new Response(JSON.stringify({ error: "event_id required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
    apiVersion: "2024-04-10",
  });
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: event, error: eventErr } = await supabase
    .from("events")
    .select("id, price_cents, restaurants(stripe_account)")
    .eq("id", event_id)
    .single();
  if (eventErr || !event) {
    return new Response(JSON.stringify({ error: eventErr?.message ?? "not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const stripeAccount = (event.restaurants as { stripe_account: string | null } | null)
    ?.stripe_account;
  if (!stripeAccount) {
    return new Response(JSON.stringify({ error: "restaurant has no Stripe account" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { count: covers } = await supabase
    .from("bookings")
    .select("*", { count: "exact", head: true })
    .eq("event_id", event_id)
    .eq("status", "confirmed");

  const gross = event.price_cents * (covers ?? 0);
  const partnerShare = Math.round(gross * (1 - PLATFORM_FEE_BPS / 10000));

  if (partnerShare <= 0) {
    return new Response(JSON.stringify({ transferred: 0, covers }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const transfer = await stripe.transfers.create({
    amount: partnerShare,
    currency: "usd",
    destination: stripeAccount,
    metadata: { event_id, covers: String(covers ?? 0) },
  });

  return new Response(
    JSON.stringify({ transferred: partnerShare, covers, transfer_id: transfer.id }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
