import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, preflight } from "../_shared/cors.ts";

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function sanitizeEmailHeader(value: unknown): string {
  return String(value ?? "").replace(/[\r\n]+/g, " ").trim();
}

const DEFAULT_LOGO_URL =
  "https://raw.githubusercontent.com/lwhobley/tablefor1/main/assets/images/table_for_2_logo.png";

function welcomeHtml(name: string, logoUrl: string): string {
  const safeName = escapeHtml(name || "there");
  const safeLogoUrl = escapeHtml(logoUrl);

  return `
    <!DOCTYPE html>
    <html>
      <body style="margin:0;background:#fff7ed;color:#1f1b16;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;line-height:1.6;">
        <div style="max-width:640px;margin:0 auto;padding:28px 20px;">
          <div style="text-align:center;margin:0 0 18px 0;">
            <img src="${safeLogoUrl}" width="210" alt="Table for 2" style="display:inline-block;width:210px;max-width:70%;height:auto;border:0;" />
          </div>
          <div style="background:#1f1b16;color:#fff7ed;border-radius:16px;padding:28px;">
            <p style="margin:0 0 8px 0;color:#d7b56d;font-size:13px;letter-spacing:.08em;text-transform:uppercase;">Welcome to Table for 2</p>
            <h1 style="margin:0;font-size:30px;line-height:1.2;">Your next great dinner starts here.</h1>
          </div>

          <div style="background:#ffffff;border:1px solid #eadfd4;border-radius:16px;margin-top:18px;padding:24px;">
            <p style="margin:0 0 16px 0;">Hi ${safeName},</p>
            <p style="margin:0 0 16px 0;">You are officially in. Table for 2 helps solo diners meet thoughtful new people over curated restaurant experiences, without the awkward group-chat planning.</p>

            <h2 style="margin:22px 0 10px 0;font-size:18px;">What you can do in the app</h2>
            <ul style="margin:0 0 18px 20px;padding:0;">
              <li>Browse upcoming dinners, brunches, food crawls, late-night tables, and chef's table experiences.</li>
              <li>Book a seat for events in your city and receive your booking confirmation by email.</li>
              <li>Complete your profile so matching can factor in energy level, conversation style, food preferences, dietary needs, languages, and neighborhood.</li>
              <li>Discover mystery dinners, where restaurant details are revealed closer to the event.</li>
              <li>See your match details before dinner once the table is finalized.</li>
              <li>Use conversation starters and sparks to make the dinner feel easier from the first hello.</li>
              <li>Check in with a selfie at the table for trust and safety.</li>
              <li>Share dinner stories, favorite restaurants, and recommendations after you go.</li>
              <li>Leave feedback, build your trust score, keep streaks, earn badges, and reconnect when the feeling is mutual.</li>
              <li>Vote for expansion cities and help bring Table for 2 to more neighborhoods.</li>
            </ul>

            <h2 style="margin:22px 0 10px 0;font-size:18px;">A few useful notes</h2>
            <p style="margin:0 0 12px 0;">Keep your profile current. The better your preferences are, the better your table can be.</p>
            <p style="margin:0 0 12px 0;">Arrive on time, be kind to the restaurant team, and bring the version of yourself that makes a table feel warm.</p>
            <p style="margin:0;">Booking, match reveal, feedback, and follow-up emails will come from Table for 2, so keep an eye on your inbox.</p>
          </div>

          <p style="color:#8c7f73;font-size:12px;margin:18px 0 0 0;">Table for 2</p>
        </div>
      </body>
    </html>
  `;
}

Deno.serve(async (req) => {
  const preflightResponse = preflight(req);
  if (preflightResponse) return preflightResponse;

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const fromEmail = Deno.env.get("WELCOME_FROM_EMAIL") ??
      Deno.env.get("ADMIN_EMAIL");
    if (!resendApiKey || !fromEmail) {
      console.error("Missing welcome email configuration");
      return json({ error: "Email service not configured" }, 500);
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: userError } = await userClient.auth
      .getUser();
    if (userError || !userData.user?.email) {
      return json({ error: "Not authenticated" }, 401);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const staleBefore = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { error: staleClaimError } = await admin
      .from("users")
      .update({ welcome_email_status: null, welcome_email_claimed_at: null })
      .eq("id", userData.user.id)
      .eq("welcome_email_status", "sending")
      .lt("welcome_email_claimed_at", staleBefore);

    if (staleClaimError) throw staleClaimError;

    const claimedAt = new Date().toISOString();
    const { data: profile, error: profileError } = await admin
      .from("users")
      .update({
        welcome_email_status: "sending",
        welcome_email_claimed_at: claimedAt,
      })
      .eq("id", userData.user.id)
      .is("welcome_email_status", null)
      .is("welcome_email_sent_at", null)
      .select("name")
      .maybeSingle();

    if (profileError) throw profileError;
    if (!profile) {
      return json({ success: true, skipped: true });
    }

    const releaseClaim = async () => {
      const { error } = await admin
        .from("users")
        .update({ welcome_email_status: null, welcome_email_claimed_at: null })
        .eq("id", userData.user.id)
        .eq("welcome_email_status", "sending")
        .eq("welcome_email_claimed_at", claimedAt);
      if (error) console.error("Failed to release welcome email claim:", error);
    };

    const name = profile?.name ?? userData.user.user_metadata?.name ?? "there";
    const logoUrl = Deno.env.get("AUTH_EMAIL_LOGO_URL") ?? DEFAULT_LOGO_URL;
    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: userData.user.email,
        subject: "Welcome to Table for 2",
        html: welcomeHtml(name, logoUrl),
        reply_to: sanitizeEmailHeader(fromEmail),
      }),
    });

    if (!resendResponse.ok) {
      console.error("Resend error:", await resendResponse.text());
      await releaseClaim();
      return json({ error: "Failed to send welcome email" }, 500);
    }

    const { data: completedProfile, error: updateError } = await admin
      .from("users")
      .update({
        welcome_email_status: "sent",
        welcome_email_sent_at: new Date().toISOString(),
        welcome_email_claimed_at: null,
      })
      .eq("id", userData.user.id)
      .eq("welcome_email_status", "sending")
      .eq("welcome_email_claimed_at", claimedAt)
      .select("id")
      .maybeSingle();

    if (updateError) throw updateError;
    if (!completedProfile) throw new Error("Welcome email claim was lost");

    return json({ success: true });
  } catch (error) {
    console.error("send-welcome-email error:", error);
    return json({ error: (error as Error).message }, 500);
  }
});
