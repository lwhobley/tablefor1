// Creates a Stripe Checkout Session for a pending booking and returns the
// hosted-checkout URL. The caller is verified to own the booking (the
// service-role reads below bypass RLS, so we re-check ownership explicitly),
// and the line item is priced from the event row so the amount can't be
// tampered with client-side.

import Stripe from "https://esm.sh/stripe@14";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, preflight } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const { booking_id, event_id } = await req.json();
    if (!booking_id) {
      return json({ error: "Missing fields" }, 400);
    }

    // Verify the caller and resolve their user id from the JWT.
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData } = await userClient.auth.getUser();
    const callerId = userData.user?.id;
    if (!callerId) {
      return json({ error: "Not authenticated" }, 401);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: booking } = await admin
      .from("bookings")
      .select("id, event_id, user_id, status, amount_cents")
      .eq("id", booking_id)
      .maybeSingle();

    if (!booking) {
      return json({ error: "Booking not found" }, 404);
    }
    // Ownership check: the service-role read above bypassed RLS.
    if (booking.user_id !== callerId) {
      return json({ error: "Forbidden" }, 403);
    }
    if (booking.status !== "pending") {
      return json({ error: "Booking already processed" }, 400);
    }
    if (event_id && booking.event_id !== event_id) {
      return json({ error: "Booking does not belong to this event" }, 400);
    }

    const { data: event } = await admin
      .from("events")
      .select(
        "id, status, event_date, group_size, format, price_cents, published_at, early_access_hours, restaurant:restaurants(name)",
      )
      .eq("id", booking.event_id)
      .maybeSingle();

    if (!event) {
      return json({ error: "Event not found" }, 404);
    }
    if (!["open", "matched", "full"].includes(event.status)) {
      return json({ error: "Event not available" }, 400);
    }
    if (new Date(event.event_date) <= new Date()) {
      return json({ error: "This event has already passed" }, 400);
    }

    // Early-access enforcement: previously this was a client-side-only
    // lock (the "Book Now" button was just disabled), so a non-premium
    // user could still create a booking + checkout session directly
    // during the premium-only window. Check it here, server-side, against
    // the caller's actual premium status.
    const publishedAt = new Date(event.published_at).getTime();
    const earlyAccessLimit =
      publishedAt + (event.early_access_hours || 24) * 60 * 60 * 1000;
    if (Date.now() < earlyAccessLimit) {
      const { data: caller } = await admin
        .from("users")
        .select("is_premium, premium_expires_at")
        .eq("id", callerId)
        .maybeSingle();
      const callerIsPremium =
        !!caller?.is_premium &&
        (!caller.premium_expires_at || new Date(caller.premium_expires_at) > new Date());
      if (!callerIsPremium) {
        return json(
          { error: "This event is in early access for Premium members only" },
          403,
        );
      }
    }

    // Best-effort capacity check so we don't hand out a Stripe Checkout URL
    // for a table that's already full. This is not the source of truth —
    // the `enforce_booking_capacity` trigger rejects the booking UPDATE
    // itself at confirmation time (in stripe-webhook) even if two checkouts
    // race past this check concurrently.
    const { count: confirmedCovers } = await admin
      .from("bookings")
      .select("*", { count: "exact", head: true })
      .eq("event_id", booking.event_id)
      .eq("status", "confirmed");
    if ((confirmedCovers ?? 0) >= event.group_size) {
      return json({ error: "This event is already full" }, 400);
    }

    if (booking.amount_cents !== event.price_cents) {
      const { error: amountErr } = await admin
        .from("bookings")
        .update({ amount_cents: event.price_cents })
        .eq("id", booking.id)
        .eq("status", "pending");
      if (amountErr) throw amountErr;
    }

    const restaurantName =
      (event.restaurant as unknown as { name?: string } | null)?.name ??
      "an exclusive venue";

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
      apiVersion: "2024-04-10",
    });

    const appUrl = Deno.env.get("APP_URL") || "http://localhost:8081";
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `Dinner at ${restaurantName}`,
              description: `${event.format} on ${new Date(
                event.event_date,
              ).toDateString()}`,
            },
            // Price from the event row, never the client.
            unit_amount: event.price_cents,
          },
          quantity: 1,
        },
      ],
      success_url: `${appUrl}/bookings/${booking.event_id}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/events/${booking.event_id}`,
      metadata: { booking_id, event_id: booking.event_id, user_id: booking.user_id },
    });

    return json({ url: session.url });
  } catch (error) {
    console.error("create-checkout-session error:", error);
    return json({ error: (error as Error).message }, 500);
  }
});
