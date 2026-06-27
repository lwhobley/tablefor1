// Stripe webhook receiver. Verifies the signature (async — Deno's crypto is
// only available asynchronously, so constructEventAsync is required), then
// flips the matching booking to 'confirmed' on checkout.session.completed and
// fires the confirmation email. Idempotent: a replayed event whose booking is
// already confirmed is a no-op.

import Stripe from "https://esm.sh/stripe@14";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-04-10",
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response("Method not allowed", {
      status: 405,
      headers: corsHeaders,
    });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const body = await req.text();
    const sig = req.headers.get("stripe-signature");
    if (!sig) return json({ error: "No signature" }, 400);

    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    if (!webhookSecret) throw new Error("STRIPE_WEBHOOK_SECRET not set");

    let event: Stripe.Event;
    try {
      // constructEventAsync — the sync variant throws in Deno because
      // SubtleCrypto can't be used synchronously.
      event = await stripe.webhooks.constructEventAsync(
        body,
        sig,
        webhookSecret,
      );
    } catch (err) {
      return json({ error: `Webhook Error: ${(err as Error).message}` }, 400);
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const bookingId = session.metadata?.booking_id;

      if (!bookingId) {
        console.error("No booking_id in session metadata");
        return json({ received: true });
      }

      const admin = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );

      try {
        const { data: booking } = await admin
          .from("bookings")
          .select("id, status")
          .eq("id", bookingId)
          .maybeSingle();

        if (!booking) {
          console.error(`Booking ${bookingId} not found`);
          return json({ received: true });
        }

        // Idempotent: only act on a still-pending booking.
        if (booking.status === "pending") {
          const { error: updateError } = await admin
            .from("bookings")
            .update({
              status: "confirmed",
              stripe_session_id: session.id,
              stripe_payment_id: session.payment_intent as string,
            })
            .eq("id", bookingId);

          if (updateError) throw updateError;

          // Fire-and-forget the confirmation email; a mail failure must not
          // fail the webhook (Stripe would retry and double-confirm).
          try {
            await fetch(
              `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-booking-confirmation`,
              {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({ booking_id: bookingId }),
              },
            );
          } catch (mailErr) {
            console.error("Confirmation email failed:", mailErr);
          }
        }
      } catch (error) {
        // Log for manual reconciliation but don't 500 — a paid charge with a
        // failed DB write needs a human, not an infinite Stripe retry loop.
        console.error("Error processing payment:", error);
      }
    }

    return json({ received: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return json({ error: (error as Error).message }, 500);
  }
});
