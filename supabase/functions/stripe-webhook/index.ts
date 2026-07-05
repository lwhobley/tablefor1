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

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      // Premium subscription checkout (create-premium-checkout-session).
      // Booking checkout uses mode "payment"; premium uses "subscription".
      if (session.mode === "subscription") {
        const userId = session.metadata?.user_id;
        const subscriptionId = session.subscription as string | null;
        if (!userId || !subscriptionId) {
          console.error("Missing user_id or subscription id on premium checkout session");
          return json({ received: true });
        }
        try {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          const expiresAt = new Date(subscription.current_period_end * 1000).toISOString();
          const { error: rpcErr } = await admin.rpc("set_premium_from_stripe", {
            p_user_id: userId,
            p_is_premium: subscription.status === "active" || subscription.status === "trialing",
            p_expires_at: expiresAt,
            p_customer_id: session.customer as string,
            p_subscription_id: subscriptionId,
          });
          if (rpcErr) throw rpcErr;
        } catch (err) {
          console.error(`Failed to activate premium for user ${userId}:`, err);
        }
        return json({ received: true });
      }

      const bookingId = session.metadata?.booking_id;

      if (!bookingId) {
        console.error("No booking_id in session metadata");
        return json({ received: true });
      }

      try {
        const { data: booking } = await admin
          .from("bookings")
          .select("id, event_id, status, event:events(price_cents)")
          .eq("id", bookingId)
          .maybeSingle();

        if (!booking) {
          console.error(`Booking ${bookingId} not found`);
          return json({ received: true });
        }

        // Idempotent: only act on a still-pending booking.
        if (booking.status === "pending") {
          const bookingEvent = booking.event as unknown as { price_cents: number } | null;
          const paidAmount = session.amount_total;
          const paidCurrency = session.currency?.toLowerCase();
          const metadataEventId = session.metadata?.event_id;
          const paymentMatchesBooking =
            !!bookingEvent &&
            metadataEventId === booking.event_id &&
            paidCurrency === "usd" &&
            paidAmount === bookingEvent.price_cents;

          if (!paymentMatchesBooking) {
            console.error(
              `Checkout session ${session.id} does not match booking ${bookingId}; refunding if paid.`,
              {
                booking_event_id: booking.event_id,
                metadata_event_id: metadataEventId,
                expected_amount: bookingEvent?.price_cents,
                paid_amount: paidAmount,
                paid_currency: paidCurrency,
              },
            );
            if (session.payment_intent) {
              try {
                await stripe.refunds.create({
                  payment_intent: session.payment_intent as string,
                });
              } catch (refundErr) {
                console.error(
                  `Refund failed for mismatched checkout session ${session.id}:`,
                  refundErr,
                );
              }
            }
            await admin
              .from("bookings")
              .update({
                status: "cancelled",
                stripe_session_id: session.id,
                stripe_payment_id: session.payment_intent as string,
              })
              .eq("id", bookingId)
              .eq("status", "pending");
            return json({ received: true, refunded: true });
          }

          const { error: updateError } = await admin
            .from("bookings")
            .update({
              status: "confirmed",
              amount_cents: bookingEvent!.price_cents,
              stripe_session_id: session.id,
              stripe_payment_id: session.payment_intent as string,
            })
            .eq("id", bookingId);

          if (updateError) {
            // The DB-level enforce_booking_capacity trigger (see migration
            // 0015) rejects this UPDATE if the event filled up between
            // create-checkout-session's best-effort check and this webhook
            // firing. The customer has already been charged by Stripe at
            // this point, so we must refund them and leave the booking
            // 'pending' -> 'cancelled' rather than silently dropping a paid
            // charge with no seat and no refund.
            const isCapacityRejection = updateError.code === "23514" ||
              /capacity/i.test(updateError.message ?? "");
            if (isCapacityRejection) {
              console.error(
                `Booking ${bookingId} rejected by capacity trigger after payment; refunding.`,
                updateError,
              );
              try {
                if (session.payment_intent) {
                  await stripe.refunds.create({
                    payment_intent: session.payment_intent as string,
                  });
                }
              } catch (refundErr) {
                console.error(
                  `Refund failed for booking ${bookingId} — needs manual reconciliation:`,
                  refundErr,
                );
              }
              await admin
                .from("bookings")
                .update({
                  status: "cancelled",
                  stripe_session_id: session.id,
                  stripe_payment_id: session.payment_intent as string,
                })
                .eq("id", bookingId)
                .eq("status", "pending");
              return json({ received: true, refunded: true });
            }
            throw updateError;
          }

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

    // Subscription renewals, cancellations, and payment failures. Without
    // this, `is_premium` only ever got set once at checkout and never
    // reflected a lapsed or cancelled subscription — `premium_expires_at`
    // existed in the schema but nothing kept it (or is_premium) in sync.
    if (
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted"
    ) {
      const subscription = event.data.object as Stripe.Subscription;
      const userId = subscription.metadata?.user_id;
      const isActive =
        event.type === "customer.subscription.updated" &&
        (subscription.status === "active" || subscription.status === "trialing");
      const expiresAt = new Date(subscription.current_period_end * 1000).toISOString();

      try {
        if (userId) {
          await admin.rpc("set_premium_from_stripe", {
            p_user_id: userId,
            p_is_premium: isActive,
            p_expires_at: expiresAt,
            p_customer_id: subscription.customer as string,
            p_subscription_id: subscription.id,
          });
        } else {
          // create-premium-checkout-session sets subscription_data.metadata
          // so this shouldn't normally happen, but fall back to matching on
          // the stripe_subscription_id we stored at checkout time in case a
          // subscription ever gets created some other way.
          await admin
            .from("users")
            .update({
              is_premium: isActive,
              premium_expires_at: expiresAt,
            })
            .eq("stripe_subscription_id", subscription.id);
        }
      } catch (err) {
        console.error(
          `Failed to sync subscription ${subscription.id} status:`,
          err,
        );
      }
    }

    return json({ received: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return json({ error: (error as Error).message }, 500);
  }
});
