import "jsr:@supabase/functions-js/init";
import { corsHeaders } from "../_shared/cors.ts";
import Stripe from "stripe";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { booking_id, event_id } = await req.json();

    if (!booking_id || !event_id) {
      return new Response(JSON.stringify({ error: "Missing fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get the supabase client with service role
    const supabaseClient = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseClient) {
      throw new Error("SUPABASE_SERVICE_ROLE_KEY not set");
    }

    // Fetch booking details
    const bookingResponse = await fetch(
      `${Deno.env.get("SUPABASE_URL")}/rest/v1/bookings?id=eq.${booking_id}&select=*`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${supabaseClient}`,
          apikey: supabaseClient,
        },
      }
    );

    if (!bookingResponse.ok) {
      throw new Error("Failed to fetch booking");
    }

    const bookings = await bookingResponse.json();
    if (!Array.isArray(bookings) || bookings.length === 0) {
      return new Response(JSON.stringify({ error: "Booking not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const booking = bookings[0];

    // Fetch event details
    const eventResponse = await fetch(
      `${Deno.env.get("SUPABASE_URL")}/rest/v1/events?id=eq.${event_id}&select=*`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${supabaseClient}`,
          apikey: supabaseClient,
        },
      }
    );

    if (!eventResponse.ok) {
      throw new Error("Failed to fetch event");
    }

    const events = await eventResponse.json();
    if (!Array.isArray(events) || events.length === 0) {
      return new Response(JSON.stringify({ error: "Event not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const event = events[0];

    // Verify booking status is still pending
    if (booking.status !== "pending") {
      return new Response(
        JSON.stringify({ error: "Booking already processed" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Verify event is open
    if (!["open", "matched", "full"].includes(event.status)) {
      return new Response(JSON.stringify({ error: "Event not available" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch user email from auth
    const auth = req.headers.get("authorization");
    if (!auth) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `Dinner at ${event.restaurant_id || "exclusive venue"}`,
              description: `${event.format} on ${new Date(event.event_date).toDateString()}`,
            },
            unit_amount: event.price_cents,
          },
          quantity: 1,
        },
      ],
      success_url: `${Deno.env.get("APP_URL") || "http://localhost:8081"}/bookings/${event_id}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${Deno.env.get("APP_URL") || "http://localhost:8081"}/events/${event_id}`,
      metadata: {
        booking_id,
        event_id,
        user_id: booking.user_id,
      },
    });

    return new Response(JSON.stringify({ url: session.url }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
