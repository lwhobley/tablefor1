import React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  supabase,
  type EventRow,
  type Profile,
  type Booking,
  type Restaurant,
  type Match,
  type Message,
  type Feedback,
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

      const eventWithRestaurant = event as unknown as EventWithRestaurant;
      const restaurant = eventWithRestaurant.restaurant;
      if (!restaurant) throw new Error("Event is missing its restaurant");

      return {
        ...eventWithRestaurant,
        restaurant,
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
      if (error) {
        // 23505 = unique (event_id, user_id) violation: the user already has a
        // booking for this event. Reuse a still-pending one so an abandoned
        // checkout can be resumed instead of dead-ending.
        if (error.code === "23505") {
          const { data: existing, error: fetchErr } = await supabase
            .from("bookings")
            .select("*")
            .eq("event_id", eventId)
            .eq("user_id", userId)
            .maybeSingle();
          if (fetchErr) throw fetchErr;
          if (existing?.status === "pending") return existing as Booking;
          throw new Error(
            existing?.status === "confirmed"
              ? "You've already booked this event."
              : "This booking can no longer be reopened.",
          );
        }
        throw error;
      }
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

export type MatchWithDiners = Match & {
  diners: Profile[];
  event: EventWithRestaurant;
};

export function useMyMatches(userId: string | undefined) {
  return useQuery({
    queryKey: ["matches", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data: matches, error: matchError } = await supabase
        .from("matches")
        .select("*")
        .contains("user_ids", [userId!])
        .order("revealed_at", { ascending: false, nullsFirst: false });
      if (matchError) throw matchError;

      const enrichedMatches = await Promise.all(
        (matches ?? []).map(async (match) => {
          const { data: diners } = await supabase
            .from("users")
            .select("*")
            .in("id", match.user_ids);

          const { data: event } = await supabase
            .from("events")
            .select(
              `id, restaurant_id, format, status, event_date, group_size,
               price_cents, city, description,
               restaurant:restaurants(name, neighborhood, cuisine)`
            )
            .eq("id", match.event_id)
            .single();

          return {
            ...match,
            diners: (diners ?? []) as Profile[],
            event: event as unknown as EventWithRestaurant,
          };
        })
      );

      return enrichedMatches as MatchWithDiners[];
    },
  });
}

export type MatchDetail = Match & {
  diners: (Profile & { feedback?: Feedback })[];
  event: EventWithRestaurant;
};

export function useMatchDetail(matchId: string | undefined) {
  return useQuery({
    queryKey: ["match", matchId],
    enabled: !!matchId,
    queryFn: async () => {
      const { data: match, error: matchError } = await supabase
        .from("matches")
        .select("*")
        .eq("id", matchId!)
        .single();
      if (matchError) throw matchError;

      const { data: diners } = await supabase
        .from("users")
        .select("*")
        .in("id", match.user_ids);

      const { data: event } = await supabase
        .from("events")
        .select(
          `id, restaurant_id, format, status, event_date, group_size,
           price_cents, city, description,
           restaurant:restaurants(name, neighborhood, cuisine)`
        )
        .eq("id", match.event_id)
        .single();

      return {
        ...match,
        diners: (diners ?? []) as Profile[],
        event: event as unknown as EventWithRestaurant,
      } as MatchDetail;
    },
  });
}

export function useMatchMessages(matchId: string | undefined) {
  return useQuery({
    queryKey: ["messages", matchId],
    enabled: !!matchId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages")
        .select(
          `id, match_id, sender_id, body, created_at,
           sender:users(id, name, photo_url)`
        )
        .eq("match_id", matchId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as (Message & { sender: Profile })[];
    },
  });
}

export function useSubscribeToMessages(matchId: string | undefined) {
  const qc = useQueryClient();

  // Set up real-time subscription (supabase-js v2 channel API).
  React.useEffect(() => {
    if (!matchId) return;

    const channel = supabase
      .channel(`messages:${matchId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `match_id=eq.${matchId}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: ["messages", matchId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [matchId, qc]);
}

export function usePostMessage(matchId: string | undefined, userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: string) => {
      if (!userId || !matchId) throw new Error("Not signed in");
      const { data, error } = await supabase
        .from("messages")
        .insert({
          match_id: matchId,
          sender_id: userId,
          body,
        })
        .select()
        .single();
      if (error) throw error;
      return data as Message;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["messages", matchId] });
    },
  });
}

export function useSubmitFeedback(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (feedback: {
      match_id: string;
      rating: "1" | "2" | "3" | "4" | "5";
      showed_up: boolean;
      reconnect: boolean;
      notes?: string;
    }) => {
      if (!userId) throw new Error("Not signed in");
      const { data, error } = await supabase
        .from("feedback")
        .insert({
          ...feedback,
          reviewer_id: userId,
        })
        .select()
        .single();
      if (error) throw error;
      return data as Feedback;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["matches", userId] });
    },
  });
}
