import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";

// The schema's new-user trigger pre-fills name/city with placeholders and
// energy_level/conv_style with 'balanced'. There's no `onboarded_at` column
// on public.users, so we track onboarding completion in Supabase Auth's
// user_metadata instead. It survives sessions and is set in one place.
export function isOnboarded(session: Session | null): boolean {
  return !!session?.user.user_metadata?.onboarded_at;
}

export async function markOnboardingComplete() {
  const { error } = await supabase.auth.updateUser({
    data: { onboarded_at: new Date().toISOString() },
  });
  if (error) throw error;
}
