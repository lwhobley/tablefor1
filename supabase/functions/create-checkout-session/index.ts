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
    if (!booking_id || !event_id) {
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
      .select("id, user_id, status, amount_cents")
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

    const { data: event } = await admin
      .from("events")
      .select(
        "id, status, event_date, format, price_cents, restaurant:restaurants(name)",
      )
      .eq("id", event_id)
      .maybeSingle();

    if (!event) {
      return json({ error: "Event not found" }, 404);
    }
    if (!["open", "matched", "full"].includes(event.status)) {
      return json({ error: "Event not available" }, 400);
    }

    const restaurantName =
      (event.restaurant as { name?: string } | null)?.name ??
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
      success_url: `${appUrl}/bookings/${event_id}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/events/${event_id}`,
      metadata: { booking_id, event_id, user_id: booking.user_id },
    });

    return json({ url: session.url });
  } catch (error) {
    console.error("create-checkout-session error:", error);
    return json({ error: (error as Error).message }, 500);
  }
});
