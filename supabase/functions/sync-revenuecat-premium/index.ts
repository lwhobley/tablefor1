import { createClient } from "https://esm.sh/@supabase/supabase-js@2.110.0";
import { corsHeaders } from "../_shared/cors.ts";

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

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader) {
    return json({ error: "Missing Authorization header" }, 401);
  }

  try {
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) {
      return json({ error: "Unauthorized" }, 401);
    }

    const revenueCatSecret = Deno.env.get("REVENUECAT_SECRET_API_KEY");
    const entitlementId = Deno.env.get("REVENUECAT_ENTITLEMENT_ID") ?? "premium";
    if (!revenueCatSecret) {
      throw new Error("REVENUECAT_SECRET_API_KEY is not set");
    }

    const response = await fetch(
      `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(user.id)}`,
      {
        headers: {
          Authorization: `Bearer ${revenueCatSecret}`,
          "Content-Type": "application/json",
        },
      },
    );
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`RevenueCat subscriber lookup failed: ${response.status} ${detail}`);
    }

    const payload = await response.json() as {
      subscriber?: {
        entitlements?: Record<string, { expires_date?: string | null }>;
      };
    };

    const entitlement = payload.subscriber?.entitlements?.[entitlementId];
    const expiresAt = entitlement?.expires_date
      ? new Date(entitlement.expires_date).toISOString()
      : null;
    const isPremium = !!entitlement &&
      (!expiresAt || new Date(expiresAt).getTime() > Date.now());

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { error: updateError } = await admin
      .from("users")
      .update({
        is_premium: isPremium,
        premium_expires_at: expiresAt,
      })
      .eq("id", user.id);
    if (updateError) throw updateError;

    return json({ ok: true, is_premium: isPremium, premium_expires_at: expiresAt });
  } catch (error) {
    console.error("sync-revenuecat-premium error:", error);
    return json({ error: (error as Error).message }, 500);
  }
});
