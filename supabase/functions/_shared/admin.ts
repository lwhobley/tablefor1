// Shared guard for edge functions that must only run for admins/cron jobs,
// never for arbitrary authenticated diners or partners. There's no admin
// role in auth.users yet, so we gate on a shared secret the admin
// dashboard/cron job sends as `x-admin-secret`, matched against the
// ADMIN_FUNCTION_SECRET env var. We also accept the service-role key as a
// Bearer token, since some functions call each other server-to-server
// (e.g. stripe-webhook -> send-booking-confirmation) using it already.
export function isAuthorizedAdminCaller(req: Request): boolean {
  const adminSecret = Deno.env.get("ADMIN_FUNCTION_SECRET");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  const providedSecret = req.headers.get("x-admin-secret");
  if (adminSecret && providedSecret === adminSecret) return true;

  const authHeader = req.headers.get("Authorization") ?? "";
  const bearer = authHeader.replace(/^Bearer\s+/i, "");
  if (serviceRoleKey && bearer === serviceRoleKey) return true;

  return false;
}

export function unauthorizedResponse(corsHeaders: Record<string, string>): Response {
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
