import { createClient } from "https://esm.sh/@supabase/supabase-js@2.110.0";
import { corsHeaders } from "../_shared/cors.ts";

function timingSafeEqual(provided: string, expected: string): boolean {
  const enc = new TextEncoder();
  const a = enc.encode(provided);
  const b = enc.encode(expected);
  let diff = a.length === b.length ? 0 : 1;
  for (let i = 0; i < b.length; i++) {
    diff |= (a[i % a.length] ?? 0) ^ b[i];
  }
  return diff === 0 && a.length > 0;
}

async function verifySignature(
  payload: string,
  header: string,
  secret: string,
  tolerance = 300,
): Promise<boolean> {
  const parts = Object.fromEntries(
    header.split(",").map((part) => {
      const index = part.indexOf("=");
      return [part.slice(0, index), part.slice(index + 1)];
    }),
  ) as Record<string, string>;
  const timestamp = parts.t;
  const expected = parts.v1;
  if (!timestamp || !expected) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const data = new TextEncoder().encode(`${timestamp}.${payload}`);
  const signature = await crypto.subtle.sign("HMAC", key, data);
  const computed = Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

  if (!timingSafeEqual(computed, expected)) {
    return false;
  }

  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > tolerance) {
    return false;
  }

  return true;
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

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const expectedAuth = Deno.env.get("REVENUECAT_WEBHOOK_AUTHORIZATION");
    if (expectedAuth) {
      const providedAuth = req.headers.get("Authorization") ?? "";
      if (!timingSafeEqual(providedAuth, expectedAuth)) {
        return json({ error: "Unauthorized" }, 401);
      }
    }

    const rawBody = await req.text();
    const signingSecret = Deno.env.get("REVENUECAT_WEBHOOK_SIGNING_SECRET");
    if (signingSecret) {
      const signature = req.headers.get("X-RevenueCat-Webhook-Signature") ?? "";
      if (!signature || !(await verifySignature(rawBody, signature, signingSecret))) {
        return json({ error: "Invalid signature" }, 401);
      }
    }

    const payload = JSON.parse(rawBody) as {
      event?: {
        id?: string;
        app_user_id?: string;
        entitlement_id?: string;
        entitlement_ids?: string[];
        expiration_at_ms?: number | null;
        type?: string;
      };
    };

    const event = payload.event;
    const userId = event?.app_user_id;
    if (!userId) {
      return json({ received: true });
    }

    const entitlementId = Deno.env.get("REVENUECAT_ENTITLEMENT_ID") ?? "premium";
    const entitlementIds = event.entitlement_ids ?? (event.entitlement_id ? [event.entitlement_id] : []);
    const hasEntitlement = entitlementIds.includes(entitlementId);
    if (!hasEntitlement) {
      return json({ received: true });
    }

    const expiresAt = event.expiration_at_ms
      ? new Date(event.expiration_at_ms).toISOString()
      : null;
    const isPremium = !expiresAt || new Date(expiresAt).getTime() > Date.now();

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
      .eq("id", userId);
    if (updateError) throw updateError;

    return json({ received: true });
  } catch (error) {
    console.error("revenuecat-webhook error:", error);
    return json({ error: (error as Error).message }, 500);
  }
});
