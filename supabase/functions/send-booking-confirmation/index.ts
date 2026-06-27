import "jsr:@supabase/functions-js/init";
import { corsHeaders } from "../_shared/cors.ts";

async function getBookingDetails(bookingId: string) {
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");

  if (!supabaseServiceKey || !supabaseUrl) {
    throw new Error("Missing Supabase configuration");
  }

  const response = await fetch(
    `${supabaseUrl}/rest/v1/bookings?id=eq.${bookingId}&select=*,event:events(*),user:users(name,email:auth.users(email))`,
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

async function getUserEmail(userId: string) {
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");

  if (!supabaseServiceKey || !supabaseUrl) {
    throw new Error("Missing Supabase configuration");
  }

  const response = await fetch(
    `${supabaseUrl}/rest/v1/users?id=eq.${userId}&select=*`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${supabaseServiceKey}`,
        apikey: supabaseServiceKey,
      },
    }
  );

  if (!response.ok) {
    throw new Error("Failed to fetch user");
  }

  const users = await response.json();
  // Get email from auth.users via a separate query
  const authResponse = await fetch(
    `${supabaseUrl}/rest/v1/rpc/get_user_email?user_id=eq.${userId}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${supabaseServiceKey}`,
        apikey: supabaseServiceKey,
      },
    }
  );

  // Fallback: get from auth endpoint (requires specific setup)
  return users[0]?.email || null;
}

function generateBookingConfirmationEmail(
  userName: string,
  eventDate: string,
  restaurantName: string,
  groupSize: number,
  price: number,
  bookingId: string
): string {
  const eventDateObj = new Date(eventDate);
  const formattedDate = eventDateObj.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const formattedTime = eventDateObj.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; color: #1f1b16; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #fffbf7; padding: 20px; border-radius: 12px; margin-bottom: 20px; }
          .details { background: #fff; border: 1px solid #f5f5f4; padding: 20px; border-radius: 12px; margin-bottom: 20px; }
          .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f5f5f4; }
          .detail-row:last-child { border-bottom: none; }
          .label { color: #8c7f73; font-size: 14px; }
          .value { font-weight: 600; }
          .cta { display: inline-block; background: #c2410c; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; margin-top: 20px; }
          .footer { color: #8c7f73; font-size: 12px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0; font-size: 28px;">Your table is booked!</h1>
            <p style="margin: 10px 0 0 0; color: #8c7f73;">Confirmation ID: ${bookingId.slice(0, 8)}</p>
          </div>

          <div class="details">
            <h2 style="margin: 0 0 20px 0; font-size: 20px;">Dinner Details</h2>

            <div class="detail-row">
              <span class="label">Restaurant</span>
              <span class="value">${restaurantName}</span>
            </div>

            <div class="detail-row">
              <span class="label">Date & Time</span>
              <span class="value">${formattedDate} at ${formattedTime}</span>
            </div>

            <div class="detail-row">
              <span class="label">Party Size</span>
              <span class="value">Table of ${groupSize}</span>
            </div>

            <div class="detail-row">
              <span class="label">Price per seat</span>
              <span class="value">$${(price / 100).toFixed(2)}</span>
            </div>
          </div>

          <div style="background: #fef3c7; border: 1px solid #fcd34d; padding: 16px; border-radius: 8px;">
            <p style="margin: 0; font-size: 14px;">
              <strong>Exciting news!</strong> You'll be matched with other solo diners <strong>24 hours before</strong> your dinner.
              Check your email for match details!
            </p>
          </div>

          <div class="footer">
            <p>Questions? Reply to this email or visit our website.</p>
            <p>© Table for One</p>
          </div>
        </div>
      </body>
    </html>
  `;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { booking_id } = await req.json();

    if (!booking_id) {
      return new Response(JSON.stringify({ error: "Missing booking_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const adminEmail = Deno.env.get("ADMIN_EMAIL");

    if (!resendApiKey || !adminEmail) {
      console.error("Missing Resend configuration");
      return new Response(
        JSON.stringify({ error: "Email service not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get booking details - including event and user info
    // Note: This is simplified; in production you'd fetch all related data
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");

    if (!supabaseServiceKey || !supabaseUrl) {
      throw new Error("Missing Supabase configuration");
    }

    // Fetch booking
    const bookingResponse = await fetch(
      `${supabaseUrl}/rest/v1/bookings?id=eq.${booking_id}&select=*`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${supabaseServiceKey}`,
          apikey: supabaseServiceKey,
        },
      }
    );

    const bookings = await bookingResponse.json();
    if (!Array.isArray(bookings) || bookings.length === 0) {
      return new Response(JSON.stringify({ error: "Booking not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const booking = bookings[0];

    // Fetch event
    const eventResponse = await fetch(
      `${supabaseUrl}/rest/v1/events?id=eq.${booking.event_id}&select=*`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${supabaseServiceKey}`,
          apikey: supabaseServiceKey,
        },
      }
    );

    const events = await eventResponse.json();
    const event = events[0];

    // Fetch restaurant
    const restaurantResponse = await fetch(
      `${supabaseUrl}/rest/v1/restaurants?id=eq.${event.restaurant_id}&select=name`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${supabaseServiceKey}`,
          apikey: supabaseServiceKey,
        },
      }
    );

    const restaurants = await restaurantResponse.json();
    const restaurant = restaurants[0];

    // Fetch user name
    const userResponse = await fetch(
      `${supabaseUrl}/rest/v1/users?id=eq.${booking.user_id}&select=name`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${supabaseServiceKey}`,
          apikey: supabaseServiceKey,
        },
      }
    );

    const users = await userResponse.json();
    const user = users[0];

    // TODO: Get user email from auth.users - this requires RPC call or different approach
    const userEmail = "user@example.com"; // Placeholder

    const htmlContent = generateBookingConfirmationEmail(
      user?.name || "Guest",
      event.event_date,
      restaurant?.name || "Exclusive Restaurant",
      event.group_size,
      booking.amount_cents,
      booking.id
    );

    // Send via Resend
    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: adminEmail,
        to: userEmail,
        subject: `Your Table is Booked at ${restaurant?.name || "Table for One"}!`,
        html: htmlContent,
      }),
    });

    if (!resendResponse.ok) {
      const error = await resendResponse.text();
      console.error("Resend error:", error);
      return new Response(JSON.stringify({ error: "Failed to send email" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ success: true, message: "Email sent" }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
