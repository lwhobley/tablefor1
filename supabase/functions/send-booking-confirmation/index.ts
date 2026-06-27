// Sends the "your table is booked" email after a booking is confirmed.
// Invoked by stripe-webhook with { booking_id }.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "./_shared/cors.ts";
import { getAuthUserEmail } from "./_shared/users.ts";

function bookingConfirmationHtml(
  userName: string,
  eventDate: string,
  restaurantName: string,
  groupSize: number,
  priceCents: number,
  bookingId: string,
): string {
  const d = new Date(eventDate);
  const formattedDate = d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const formattedTime = d.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return `
    <!DOCTYPE html>
    <html>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; color: #1f1b16;">
        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #fffbf7; padding: 20px; border-radius: 12px; margin-bottom: 20px;">
            <h1 style="margin: 0; font-size: 28px;">Your table is booked!</h1>
            <p style="margin: 10px 0 0 0; color: #8c7f73;">Confirmation ID: ${bookingId.slice(0, 8)}</p>
          </div>
          <div style="background: #fff; border: 1px solid #f5f5f4; padding: 20px; border-radius: 12px; margin-bottom: 20px;">
            <h2 style="margin: 0 0 20px 0; font-size: 20px;">Dinner Details</h2>
            <p style="margin: 0 0 8px 0;"><strong>Restaurant:</strong> ${restaurantName}</p>
            <p style="margin: 0 0 8px 0;"><strong>Date &amp; Time:</strong> ${formattedDate} at ${formattedTime}</p>
            <p style="margin: 0 0 8px 0;"><strong>Party Size:</strong> Table of ${groupSize}</p>
            <p style="margin: 0;"><strong>Price per seat:</strong> $${(priceCents / 100).toFixed(2)}</p>
          </div>
          <div style="background: #fef3c7; border: 1px solid #fcd34d; padding: 16px; border-radius: 8px;">
            <p style="margin: 0; font-size: 14px;">
              Hi ${userName}, you'll be matched with other solo diners <strong>24 hours before</strong> your dinner.
            </p>
          </div>
          <p style="color: #8c7f73; font-size: 12px; margin-top: 20px;">© Table for One</p>
        </div>
      </body>
    </html>
  `;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const { booking_id } = await req.json();
    if (!booking_id) return json({ error: "Missing booking_id" }, 400);

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const adminEmail = Deno.env.get("ADMIN_EMAIL");
    if (!resendApiKey || !adminEmail) {
      console.error("Missing Resend configuration");
      return json({ error: "Email service not configured" }, 500);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: booking } = await admin
      .from("bookings")
      .select(
        "id, user_id, amount_cents, event:events(event_date, group_size, restaurant:restaurants(name))",
      )
      .eq("id", booking_id)
      .maybeSingle();

    if (!booking) return json({ error: "Booking not found" }, 404);

    const { data: user } = await admin
      .from("users")
      .select("name")
      .eq("id", booking.user_id)
      .maybeSingle();

    const userEmail = await getAuthUserEmail(booking.user_id);
    if (!userEmail) return json({ error: "User email not found" }, 404);

    const event = booking.event as {
      event_date: string;
      group_size: number;
      restaurant: { name?: string } | null;
    };
    const restaurantName = event?.restaurant?.name ?? "Exclusive Restaurant";

    const html = bookingConfirmationHtml(
      user?.name ?? "Guest",
      event.event_date,
      restaurantName,
      event.group_size,
      booking.amount_cents,
      booking.id,
    );

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: adminEmail,
        to: userEmail,
        subject: `Your Table is Booked at ${restaurantName}!`,
        html,
      }),
    });

    if (!resendResponse.ok) {
      console.error("Resend error:", await resendResponse.text());
      return json({ error: "Failed to send email" }, 500);
    }

    return json({ success: true });
  } catch (error) {
    console.error("send-booking-confirmation error:", error);
    return json({ error: (error as Error).message }, 500);
  }
});
