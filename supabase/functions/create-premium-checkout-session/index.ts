// Creates a Stripe Checkout Session (subscription mode) for Premium.
// Replaces the old subscribe_to_premium() RPC, which set is_premium = true
// directly with no payment step at all. Premium is now only ever granted
// by stripe-webhook after a real subscription checkout completes.

import Stripe from "https://esm.sh/stripe@14.25.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.110.0";
import { corsHeaders, preflight } from "../_shared/cors.ts";

const PREMIUM_PRICE_CENTS = Number(Deno.env.get("PREMIUM_PRICE_CENTS") ?? 999);

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    const appUrl = Deno.env.get("APP_URL");
    if (!stripeSecretKey || !appUrl) {
      console.error("Missing Premium checkout configuration");
      return json({ error: "Premium checkout is not configured" }, 500);
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData } = await userClient.auth.getUser();
    const caller = userData.user;
    if (!caller) {
      return json({ error: "Not authenticated" }, 401);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: profile, error: profileError } = await admin
      .from("users")
      .select("is_premium, premium_expires_at, stripe_customer_id")
      .eq("id", caller.id)
      .maybeSingle();
    if (profileError) throw profileError;
    if (!profile) return json({ error: "Profile not found" }, 404);

    const alreadyPremium = !!profile?.is_premium &&
      (!profile.premium_expires_at ||
        new Date(profile.premium_expires_at) > new Date());
    if (alreadyPremium) {
      return json(
        { error: "You already have an active Premium subscription" },
        400,
      );
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2024-04-10",
    });

    let customerId = profile?.stripe_customer_id ?? null;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: caller.email,
        metadata: { user_id: caller.id },
      });
      customerId = customer.id;
      // Persist immediately so retried/abandoned checkouts reuse the same
      // Stripe customer instead of creating orphaned duplicates.
      const { error: customerUpdateError } = await admin
        .from("users")
        .update({ stripe_customer_id: customerId })
        .eq("id", caller.id);
      if (customerUpdateError) throw customerUpdateError;
    }

    // The DB's is_premium flag lags behind Stripe by however long the
    // checkout->webhook round trip takes, so it can't stop a double-tap (or
    // two tabs) from minting two live subscriptions that each bill monthly.
    // Ask Stripe directly: any active/trialing/past_due/incomplete
    // subscription on this customer means one is live or mid-checkout.
    const existingSubs = await stripe.subscriptions.list({
      customer: customerId,
      status: "all",
      limit: 10,
    });
    const liveSub = existingSubs.data.find((s: Stripe.Subscription) =>
      ["active", "trialing", "past_due", "incomplete"].includes(s.status)
    );
    if (liveSub) {
      return json(
        {
          error:
            "A Premium subscription already exists or is being processed for your account. If you just subscribed, give it a minute to activate.",
        },
        409,
      );
    }

    const successUrl = new URL("/profile", appUrl);
    successUrl.searchParams.set("premium", "success");
    const cancelUrl = new URL("/profile", appUrl);
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      line_items: [
        {
          price_data: {
            currency: "usd",
            recurring: { interval: "month" },
            product_data: { name: "Table for 2 Premium" },
            unit_amount: PREMIUM_PRICE_CENTS,
          },
          quantity: 1,
        },
      ],
      success_url: successUrl.toString(),
      cancel_url: cancelUrl.toString(),
      metadata: { user_id: caller.id },
      // Propagate onto the Subscription object itself (not just this
      // Checkout Session) so later customer.subscription.updated/deleted
      // webhooks — renewals, cancellations — can resolve the user directly
      // from subscription.metadata instead of only being reachable via a
      // stripe_subscription_id lookup.
      subscription_data: { metadata: { user_id: caller.id } },
    });

    return json({ url: session.url });
  } catch (error) {
    console.error("create-premium-checkout-session error:", error);
    return json({ error: (error as Error).message }, 500);
  }
});
