import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  supabase,
  type EventRow,
  type Profile,
  type Booking,
  type Restaurant,
} from "./supabase";

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

export type EventDetail = EventWithRestaurant & {
  restaurant: Restaurant;
  confirmed_covers: number;
};

export function useEventDetails(eventId: string | undefined) {
  return useQuery({
    queryKey: ["event", eventId],
    enabled: !!eventId,
    queryFn: async () => {
      const { data: event, error: eventError } = await supabase
        .from("events")
        .select(
          `id, restaurant_id, format, status, event_date, group_size,
           price_cents, city, description,
           restaurant:restaurants(*)`,
        )
        .eq("id", eventId!)
        .single();
      if (eventError) throw eventError;

      const { count, error: countError } = await supabase
        .from("bookings")
        .select("*", { count: "exact", head: true })
        .eq("event_id", eventId!)
        .eq("status", "confirmed");
      if (countError) throw countError;

      return {
        ...(event as unknown as EventWithRestaurant),
        confirmed_covers: count ?? 0,
      } as EventDetail;
    },
  });
}

export type UserBooking = Booking & {
  event: EventWithRestaurant;
};

export function useUserBookings(userId: string | undefined) {
  return useQuery({
    queryKey: ["bookings", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select(
          `id, event_id, user_id, status, stripe_session_id, stripe_payment_id,
           amount_cents, created_at, updated_at,
           event:events(id, restaurant_id, format, status, event_date, group_size,
             price_cents, city, description,
             restaurant:restaurants(name, neighborhood, cuisine))`,
        )
        .eq("user_id", userId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as UserBooking[];
    },
  });
}

export function useCreateBooking(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      eventId,
      amountCents,
    }: {
      eventId: string;
      amountCents: number;
    }) => {
      if (!userId) throw new Error("Not signed in");
      const { data, error } = await supabase
        .from("bookings")
        .insert({
          event_id: eventId,
          user_id: userId,
          status: "pending",
          amount_cents: amountCents,
        })
        .select()
        .single();
      if (error) throw error;
      return data as Booking;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bookings", userId] });
    },
  });
}

export function useCancelBooking(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (bookingId: string) => {
      const { data, error } = await supabase
        .from("bookings")
        .update({ status: "cancelled" })
        .eq("id", bookingId)
        .select()
        .single();
      if (error) throw error;
      return data as Booking;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bookings", userId] });
    },
  });
}
