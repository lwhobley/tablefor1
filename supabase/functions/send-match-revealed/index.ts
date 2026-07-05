import { corsHeaders } from "../_shared/cors.ts";
import { getAuthUserEmail } from "../_shared/users.ts";
import { isAuthorizedAdminCaller, unauthorizedResponse } from "../_shared/admin.ts";

async function generateMatchRevealEmail(
  userName: string,
  matchedUsers: Array<{ name: string; photo_url: string | null; bio: string | null; energy_level: string; conv_style: string }>,
  eventDate: string,
  restaurantName: string,
  matchId: string
): Promise<string> {
  const eventDateObj = new Date(eventDate);
  const formattedDate = eventDateObj.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const formattedTime = eventDateObj.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const userProfiles = matchedUsers
    .map(
      (u) =>
        `<div style="margin-bottom: 16px; padding: 12px; background: #f5f5f4; border-radius: 8px;">
          <div style="font-weight: 600; margin-bottom: 4px;">${u.name}</div>
          <div style="font-size: 12px; color: #8c7f73; margin-bottom: 4px;">
            ${u.energy_level || "?"} energy · ${u.conv_style || "?"} conversationalist
          </div>
          ${u.bio ? `<div style="font-size: 14px; color: #666; margin-top: 4px;">${u.bio}</div>` : ""}
        </div>`
    )
    .join("");

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; color: #1f1b16; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #c2410c 0%, #f97316 100%); color: white; padding: 30px 20px; border-radius: 12px; margin-bottom: 20px; text-align: center; }
          .details { background: #fff; border: 1px solid #f5f5f4; padding: 20px; border-radius: 12px; margin-bottom: 20px; }
          .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f5f5f4; }
          .detail-row:last-child { border-bottom: none; }
          .label { color: #8c7f73; font-size: 14px; }
          .value { font-weight: 600; }
          .cta { display: inline-block; background: #c2410c; color: white; padding: 12px 32px; border-radius: 6px; text-decoration: none; margin: 20px auto; text-align: center; }
          .footer { color: #8c7f73; font-size: 12px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0 0 10px 0; font-size: 32px;">Your dinner match is here!</h1>
            <p style="margin: 0; font-size: 16px;">Get ready for an amazing evening</p>
          </div>

          <div style="margin-bottom: 20px;">
            <h2 style="margin: 0 0 10px 0; font-size: 18px;">Meet your dinner companions</h2>
            ${userProfiles}
          </div>

          <div class="details">
            <h3 style="margin: 0 0 15px 0;">Dinner Details</h3>

            <div class="detail-row">
              <span class="label">Restaurant</span>
              <span class="value">${restaurantName}</span>
            </div>

            <div class="detail-row">
              <span class="label">Date & Time</span>
              <span class="value">${formattedDate} at ${formattedTime}</span>
            </div>
          </div>

          <div style="background: #fef3c7; border: 1px solid #fcd34d; padding: 16px; border-radius: 8px; margin-bottom: 20px;">
            <p style="margin: 0; font-size: 14px;">
              <strong>Pro tip:</strong> Message your group to get to know them before dinner!
            </p>
          </div>

          <div style="text-align: center;">
            <a href="https://tableforone.app/matches/${matchId}" class="cta">View Full Profiles & Message</a>
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
  if (!isAuthorizedAdminCaller(req)) return unauthorizedResponse(corsHeaders);

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
      `${supabaseUrl}/rest/v1/matches?id=eq.${match_id}&select=*`,
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
      `${supabaseUrl}/rest/v1/events?id=eq.${match.event_id}&select=*`,
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

    // Fetch matched users' details
    const userIds = match.user_ids || [];
    const usersResponse = await fetch(
      `${supabaseUrl}/rest/v1/users?id=in.(${userIds.join(",")})&select=*`,
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

      const otherUsers = users.filter((u: any) => u.id !== user.id);
      const htmlContent = await generateMatchRevealEmail(
        user.name,
        otherUsers,
        event.event_date,
        restaurant?.name || "Exclusive Restaurant",
        match_id
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
          subject: `Your dinner match is here! Meet your group at ${restaurant?.name || "Table for One"}`,
          html: htmlContent,
        }),
      });
    });

    const results = await Promise.all(emailPromises);
    const sent = results.filter((r) => r && r.ok).length;

    if (sent < users.length) {
      console.error("Some emails failed to send");
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
