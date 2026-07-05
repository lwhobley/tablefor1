// Creates a Stripe Connect Express account for a restaurant (if it doesn't
// already have one) and returns an account onboarding link the partner is
// redirected to. The partner_email-scoped lookup keeps a partner from
// linking an account to someone else's restaurant.

import Stripe from "https://esm.sh/stripe@14";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, preflight } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;

  const authHeader = req.headers.get("Authorization") ?? "";
  // We verify the caller by checking the JWT — the user-bound client
  // resolves auth.uid() / auth.email() the same way PostgREST does, so the
  // restaurant lookup below is implicitly scoped to that partner.
  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: userData } = await userClient.auth.getUser();
  if (!userData.user?.email) {
    return new Response("unauthorized", { status: 401, headers: corsHeaders });
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: restaurant } = await admin
    .from("restaurants")
    .select("id, stripe_account, city, name")
    .eq("partner_email", userData.user.email)
    .single();

  if (!restaurant) {
    return new Response("no restaurant registered for this email", {
      status: 403,
      headers: corsHeaders,
    });
  }

  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
    apiVersion: "2024-04-10",
  });

  let accountId = restaurant.stripe_account;
  if (!accountId) {
    const account = await stripe.accounts.create({
      type: "express",
      email: userData.user.email,
      business_profile: { name: restaurant.name },
    });
    accountId = account.id;
    await admin
      .from("restaurants")
      .update({ stripe_account: accountId })
      .eq("id", restaurant.id);
  }

  const appUrl = Deno.env.get("APP_URL") ?? "http://localhost:8081";
  const link = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${appUrl}/partner/connect/stripe`,
    return_url: `${appUrl}/partner/dashboard`,
    type: "account_onboarding",
  });

  return new Response(JSON.stringify({ url: link.url }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
