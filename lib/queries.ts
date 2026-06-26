import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase, type EventRow, type Profile } from "./supabase";

export function useProfile(userId: string | undefined) {
  return useQuery({
    queryKey: ["profile", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("id", userId!)
        .single();
      if (error) throw error;
      return data as Profile;
    },
  });
}

export function useUpdateProfile(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<Profile>) => {
      if (!userId) throw new Error("Not signed in");
      const { data, error } = await supabase
        .from("users")
        .update(patch)
        .eq("id", userId)
        .select()
        .single();
      if (error) throw error;
      return data as Profile;
    },
    onSuccess: (data) => {
      qc.setQueryData(["profile", userId], data);
    },
  });
}

export type EventWithRestaurant = EventRow & {
  restaurant: { name: string; neighborhood: string; cuisine: string[] } | null;
  spots_left: number | null;
};

export function useUpcomingEvents(city: string | null | undefined) {
  return useQuery({
    queryKey: ["events", city ?? "_all"],
    queryFn: async () => {
      const q = supabase
        .from("events")
        .select(
          `id, restaurant_id, format, status, event_date, group_size,
           price_cents, city, description,
           restaurant:restaurants(name, neighborhood, cuisine)`,
        )
        .gte("event_date", new Date().toISOString())
        .in("status", ["open", "matched", "full"])
        .order("event_date", { ascending: true })
        .limit(20);
      if (city) q.eq("city", city);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as EventWithRestaurant[];
    },
  });
}
