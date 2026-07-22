import type { Spark } from "./supabase";

export function isMutualSpark(sparks: Spark[], userA: string, userB: string): boolean {
  const aToB = sparks.find(
    (s) => s.user_id === userA && s.target_user_id === userB && s.sparked,
  );
  const bToA = sparks.find(
    (s) => s.user_id === userB && s.target_user_id === userA && s.sparked,
  );
  return !!(aToB && bToA);
}
