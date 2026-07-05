import { corsHeaders } from "./_shared/cors.ts";
import { getAuthUserEmail } from "./_shared/users.ts";

function generateFeedbackRequestEmail(
  userName: string,
  matchId: string,
  restaurantName: string
): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; color: #1f1b16; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #fffbf7; padding: 20px; border-radius: 12px; margin-bottom: 20px; }
          .details { background: #fff; border: 1px solid #f5f5f4; padding: 20px; border-radius: 12px; margin-bottom: 20px; }
          .cta { display: inline-block; background: #c2410c; color: white; padding: 12px 32px; border-radius: 6px; text-decoration: none; margin-top: 20px; }
          .footer { color: #8c7f73; font-size: 12px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0 0 10px 0; font-size: 28px;">How was your dinner?</h1>
            <p style="margin: 0; color: #8c7f73;">We'd love to hear from you</p>
          </div>

          <div class="details">
            <p style="margin: 0 0 15px 0;">Hi ${userName},</p>
            <p style="margin: 0 0 15px 0;">
              Thank you for joining us for an exclusive dinner at ${restaurantName}! We hope you had an amazing evening and enjoyed meeting your table companions.
            </p>
            <p style="margin: 0;">
              Your feedback helps us improve future dinners and match diners even better. Share your experience—it takes just 2 minutes.
            </p>
          </div>

          <div style="text-align: center;">
            <a href="https://tableforone.app/feedback/${matchId}" class="cta">Leave Feedback</a>
          </div>

          <div style="background: #f5f5f4; padding: 16px; border-radius: 8px; margin-top: 20px;">
            <h3 style="margin: 0 0 10px 0; font-size: 16px;">What we'll ask:</h3>
            <ul style="margin: 0; padding-left: 20px; font-size: 14px;">
              <li>Your overall rating (1-5 stars)</li>
              <li>Whether you enjoyed your dinner companions</li>
              <li>If you'd like to stay connected with them</li>
            </ul>
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
    const { match_id } = await req.json();

    if (!match_id) {
      return new Response(JSON.stringify({ error: "Missing match_id" }), {
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

    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");

    if (!supabaseServiceKey || !supabaseUrl) {
      throw new Error("Missing Supabase configuration");
    }

    // Fetch match details
    const matchResponse = await fetch(
      `${supabaseUrl}/rest/v1/matches?id=eq.${match_id}&select=event_id,user_ids`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${supabaseServiceKey}`,
          apikey: supabaseServiceKey,
        },
      }
    );

    const matches = await matchResponse.json();
    if (!Array.isArray(matches) || matches.length === 0) {
      return new Response(JSON.stringify({ error: "Match not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const match = matches[0];

    // Fetch event details
    const eventResponse = await fetch(
      `${supabaseUrl}/rest/v1/events?id=eq.${match.event_id}&select=restaurant_id`,
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

    // Fetch users
    const userIds = match.user_ids || [];
    const usersResponse = await fetch(
      `${supabaseUrl}/rest/v1/users?id=in.(${userIds.join(",")})&select=id,name`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${supabaseServiceKey}`,
          apikey: supabaseServiceKey,
        },
      }
    );

    const users = await usersResponse.json();

    // Send emails to all matched users. public.users has no email column, so
    // each recipient address is resolved from auth.users.
    const emailPromises = users.map(async (user: any) => {
      const toEmail = await getAuthUserEmail(user.id);
      if (!toEmail) {
        console.error(`No email for user ${user.id}, skipping`);
        return null;
      }

      const htmlContent = generateFeedbackRequestEmail(
        user.name,
        match_id,
        restaurant?.name || "Exclusive Restaurant"
      );

      return fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: adminEmail,
          to: toEmail,
          subject: "How was your dinner at Table for One?",
          html: htmlContent,
        }),
      });
    });

    const results = await Promise.all(emailPromises);
    const sent = results.filter((r) => r && r.ok).length;

    if (sent < users.length) {
      console.error("Some feedback request emails failed");
    }

    return new Response(
      JSON.stringify({ success: true, sent }),
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
