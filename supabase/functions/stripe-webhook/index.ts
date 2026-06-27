import "jsr:@supabase/functions-js/init";
import { corsHeaders } from "../_shared/cors.ts";
import Stripe from "stripe";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "");

async function updateBooking(
  bookingId: string,
  status: string,
  stripeSessionId?: string,
  stripePaymentId?: string
) {
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");

  if (!supabaseServiceKey || !supabaseUrl) {
    throw new Error("Missing Supabase configuration");
  }

  const updatePayload: Record<string, unknown> = { status };
  if (stripeSessionId) updatePayload.stripe_session_id = stripeSessionId;
  if (stripePaymentId) updatePayload.stripe_payment_id = stripePaymentId;

  const response = await fetch(
    `${supabaseUrl}/rest/v1/bookings?id=eq.${bookingId}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${supabaseServiceKey}`,
        apikey: supabaseServiceKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(updatePayload),
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to update booking: ${response.statusText}`);
  }
}

async function getBooking(bookingId: string) {
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");

  if (!supabaseServiceKey || !supabaseUrl) {
    throw new Error("Missing Supabase configuration");
  }

  const response = await fetch(
    `${supabaseUrl}/rest/v1/bookings?id=eq.${bookingId}&select=*`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${supabaseServiceKey}`,
        apikey: supabaseServiceKey,
      },
    }
  );

  if (!response.ok) {
    throw new Error("Failed to fetch booking");
  }

  const bookings = await response.json();
  return Array.isArray(bookings) && bookings.length > 0
    ? bookings[0]
    : null;
}

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

  try {
    const body = await req.text();
    const sig = req.headers.get("stripe-signature");

    if (!sig) {
      return new Response(JSON.stringify({ error: "No signature" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    if (!webhookSecret) {
      throw new Error("STRIPE_WEBHOOK_SECRET not set");
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
    } catch (err) {
      return new Response(
        JSON.stringify({ error: `Webhook Error: ${(err as Error).message}` }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Handle different event types
    if (
      event.type === "checkout.session.completed" ||
      event.type === "payment_intent.succeeded"
    ) {
      const data = event.data.object as any;

      if (event.type === "checkout.session.completed") {
        const session = data as Stripe.Checkout.Session;
        const bookingId = session.metadata?.booking_id;

        if (!bookingId) {
          console.error("No booking_id in session metadata");
          return new Response(JSON.stringify({ received: true }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        try {
          const booking = await getBooking(bookingId);

          if (!booking) {
            console.error(`Booking ${bookingId} not found`);
            return new Response(JSON.stringify({ received: true }), {
              status: 200,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }

          // Only update if booking is still pending
          if (booking.status === "pending") {
            await updateBooking(
              bookingId,
              "confirmed",
              session.id,
              session.payment_intent as string
            );

            // TODO: Invoke send-booking-confirmation email function
            // await invokeFunction("send-booking-confirmation", { booking_id: bookingId });
          }
        } catch (error) {
          console.error("Error processing payment:", error);
          // Don't fail the webhook, we log it for manual intervention
        }
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
