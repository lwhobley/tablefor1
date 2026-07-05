// Resolves a diner's email from auth.users via the Admin API. public.users
// has no email column (email lives in auth.users), so the edge functions that
// send mail must look it up with the service-role key here rather than reading
// a non-existent users.email.

export async function getAuthUserEmail(
  userId: string,
): Promise<string | null> {
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const url = Deno.env.get("SUPABASE_URL");
  if (!serviceKey || !url) {
    throw new Error("Missing Supabase configuration");
  }

  const res = await fetch(`${url}/auth/v1/admin/users/${userId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
    },
  });

  if (!res.ok) {
    console.error(`Failed to fetch auth user ${userId}: ${res.status}`);
    return null;
  }

  const user = await res.json();
  return user?.email ?? null;
}
