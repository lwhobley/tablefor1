// Transfers the partner's share of a completed event to their Stripe Connect
// account. Triggered after admin flips an event to 'completed'.
//
// Math: gross = confirmed_covers * price_cents, partner share = gross * 0.80
// (platform keeps 20%). Adjust PLATFORM_FEE_BPS via env if needed.

import Stripe from "https://esm.sh/stripe@14";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, preflight } from "../_shared/cors.ts";
import { isAuthorizedAdminCaller, unauthorizedResponse } from "../_shared/admin.ts";

const PLATFORM_FEE_BPS = Number(Deno.env.get("PLATFORM_FEE_BPS") ?? 2000);

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;

  if (!isAuthorizedAdminCaller(req)) return unauthorizedResponse(corsHeaders);

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
    .select("id, status, price_cents, restaurant_id, restaurants(stripe_account)")
    .eq("id", event_id)
    .single();
  if (eventErr || !event) {
    return new Response(JSON.stringify({ error: eventErr?.message ?? "not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (event.status !== "completed") {
    return new Response(
      JSON.stringify({ error: "Event must be completed before payout" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // Idempotency: a payout row already exists for this event means it was
  // already settled. Re-calling this function (retry, double cron tick,
  // manual re-trigger) must be a no-op, not a second Stripe transfer.
  const { data: existingPayout } = await supabase
    .from("payouts")
    .select("*")
    .eq("event_id", event_id)
    .maybeSingle();
  if (existingPayout) {
    return new Response(
      JSON.stringify({
        transferred: existingPayout.transferred_cents,
        covers: existingPayout.covers,
        transfer_id: existingPayout.stripe_transfer_id,
        already_settled: true,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const stripeAccount = (event.restaurants as unknown as { stripe_account: string | null } | null)
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

  const transfer = await stripe.transfers.create(
    {
      amount: partnerShare,
      currency: "usd",
      destination: stripeAccount,
      metadata: { event_id, covers: String(covers ?? 0) },
    },
    { idempotencyKey: `settle-payout:${event_id}` },
  );

  // Record the payout before returning. The unique(event_id) constraint
  // guarantees a concurrent duplicate call can't insert a second row even
  // if it raced past the maybeSingle() check above; it will fail here and
  // the operator will see a distinct error rather than a silent double-pay.
  const { error: insertErr } = await supabase.from("payouts").insert({
    event_id,
    restaurant_id: event.restaurant_id,
    covers: covers ?? 0,
    gross_cents: gross,
    platform_fee_bps: PLATFORM_FEE_BPS,
    transferred_cents: partnerShare,
    stripe_transfer_id: transfer.id,
  });
  if (insertErr) {
    console.error(
      `Payout row insert failed after a real Stripe transfer (transfer_id=${transfer.id}, event_id=${event_id}). Needs manual reconciliation:`,
      insertErr,
    );
  }

  return new Response(
    JSON.stringify({ transferred: partnerShare, covers, transfer_id: transfer.id }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
