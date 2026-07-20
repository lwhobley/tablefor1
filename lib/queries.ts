import React from "react";
import { FunctionsHttpError } from "@supabase/supabase-js";
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
  type VibeCheck,
  type Spark,
  type RestaurantMenuItem,
  type Checkin,
  type WaitlistEntry,
  type DinerTag,
  type BadgeCount,
  type PlusOneInvite,
  type CityVote,
  type DinnerStory,
  type FavoriteRestaurant,
  type RestaurantRecommendation,
  type ProfileVerification,
  type RestaurantPerk,
  type MatchPoll,
} from "./supabase";
import { getChatPhotoSignedUrl } from "./uploadChatPhoto";

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
      // get_upcoming_events masks the restaurant embed server-side for
      // unrevealed mystery dinners — the anon/authenticated key can no
      // longer read a mystery restaurant's identity directly.
      const { data, error } = await supabase.rpc("get_upcoming_events", {
        p_city: city ?? null,
      });
      if (error) throw error;
      const rows = (data ?? []) as unknown as EventWithRestaurant[];
      if (rows.length === 0) return rows;
      const { data: metadata, error: metadataError } = await supabase
        .from("events")
        .select("id, theme, vibe_tags, dress_code, host_name, is_signature")
        .in("id", rows.map((event) => event.id));
      if (metadataError) throw metadataError;
      const byId = new Map((metadata ?? []).map((event) => [event.id, event]));
      return rows.map((event) => ({ ...event, ...byId.get(event.id) }));
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
      // get_event_detail masks the restaurant embed the same way
      // get_upcoming_events does, and computes confirmed_covers in one
      // round trip instead of two.
      const { data, error } = await supabase
        .rpc("get_event_detail", { p_event_id: eventId! })
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Event not found");
      const detail = data as unknown as EventDetail;
      const eventMetadataPromise = supabase
        .from("events")
        .select("theme, vibe_tags, dress_code, host_name, is_signature")
        .eq("id", eventId!)
        .single();
      const restaurantMetadataPromise = detail.restaurant
        ? supabase
            .from("restaurants")
            .select("website_url, menu_url, reservation_url, parking_info")
            .eq("id", detail.restaurant_id)
            .single()
        : Promise.resolve({ data: null, error: null });
      const [eventMetadata, restaurantMetadata] = await Promise.all([
        eventMetadataPromise,
        restaurantMetadataPromise,
      ]);
      if (eventMetadata.error) throw eventMetadata.error;
      if (restaurantMetadata.error) throw restaurantMetadata.error;
      return {
        ...detail,
        ...eventMetadata.data,
        restaurant: detail.restaurant
          ? { ...detail.restaurant, ...restaurantMetadata.data }
          : detail.restaurant,
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
             price_cents, city, description, is_mystery, reveal_hours_before,
             theme, vibe_tags, dress_code, host_name, is_signature,
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
      plusOneInviteId,
    }: {
      eventId: string;
      amountCents: number;
      plusOneInviteId?: string;
    }) => {
      if (!userId) throw new Error("Not signed in");
      const { data, error } = await supabase
        .from("bookings")
        .insert({
          event_id: eventId,
          user_id: userId,
          status: "pending",
          amount_cents: amountCents,
          plus_one_invite_id: plusOneInviteId || null,
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
    onSuccess: async (booking) => {
      qc.invalidateQueries({ queryKey: ["bookings", userId] });
      // Clear any waitlist entry now that the user has a booking again.
      const { error } = await supabase
        .from("event_waitlist")
        .delete()
        .eq("event_id", booking.event_id)
        .eq("user_id", userId!);
      if (error) {
        console.warn("[bookings] Could not clear waitlist entry", error);
      }
      qc.invalidateQueries({ queryKey: ["waitlist", booking.event_id, userId] });
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
      // Single round trip via get_my_matches() instead of the list query
      // plus a Promise.all of two queries per match (diners + event).
      const { data, error } = await supabase.rpc("get_my_matches");
      if (error) throw error;
      return (data ?? []) as unknown as MatchWithDiners[];
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
      const { data, error } = await supabase
        .rpc("get_match_detail", { p_match_id: matchId! })
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Match not found");
      return data as unknown as MatchDetail;
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
          `id, match_id, sender_id, recipient_id, body, photo_url, created_at,
           sender:users(id, name, photo_url),
           reactions:message_reactions(id, emoji, user_id, user:users(name))`
        )
        .eq("match_id", matchId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      const messages = (data ?? []) as unknown as (Message & {
        sender: Profile;
        reactions: { id: string; emoji: string; user_id: string; user: { name: string } }[];
      })[];
      return Promise.all(
        messages.map(async (message) => {
          if (!message.photo_url) return message;
          try {
            return {
              ...message,
              photo_url: await getChatPhotoSignedUrl(message.photo_url),
            };
          } catch {
            return { ...message, photo_url: null };
          }
        }),
      );
    },
  });
}

export function useSubscribeToMessages(matchId: string | undefined) {
  const qc = useQueryClient();

  React.useEffect(() => {
    if (!matchId) return;

    const channel1 = supabase
      .channel(`messages:${matchId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
          filter: `match_id=eq.${matchId}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: ["messages", matchId] });
        }
      )
      .subscribe();

    const channel2 = supabase
      .channel(`reactions:${matchId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "message_reactions",
        },
        () => {
          qc.invalidateQueries({ queryKey: ["messages", matchId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel1);
      supabase.removeChannel(channel2);
    };
  }, [matchId, qc]);
}

export function usePostMessage(matchId: string | undefined, userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: string | { body?: string; recipientId?: string; photoUrl?: string }) => {
      if (!userId || !matchId) throw new Error("Not signed in");
      const message =
        typeof body === "string" ? { body, recipientId: undefined, photoUrl: undefined } : body;
      const { data, error } = await supabase
        .from("messages")
        .insert({
          match_id: matchId,
          sender_id: userId,
          recipient_id: message.recipientId ?? null,
          body: message.body ?? "",
          photo_url: message.photoUrl ?? null,
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

// ============================================================
// VIBE CHECKS
// ============================================================

export function useEventAttendees(eventId: string | undefined, userId: string | undefined) {
  return useQuery({
    queryKey: ["event-attendees", eventId, userId],
    enabled: !!eventId && !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_event_attendees", {
        p_event_id: eventId!,
      });
      if (error) throw error;
      return (data ?? []) as unknown as Profile[];
    },
  });
}

export function useMyVibeChecks(eventId: string | undefined, userId: string | undefined) {
  return useQuery({
    queryKey: ["vibe-checks", eventId, userId],
    enabled: !!eventId && !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vibe_checks")
        .select("*")
        .eq("event_id", eventId!)
        .eq("user_id", userId!);
      if (error) throw error;
      return (data ?? []) as VibeCheck[];
    },
  });
}

export function useSwipeVibeCheck(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      eventId,
      targetUserId,
      direction,
    }: {
      eventId: string;
      targetUserId: string;
      direction: "like" | "pass";
    }) => {
      if (!userId) throw new Error("Not signed in");
      const { data, error } = await supabase
        .from("vibe_checks")
        .insert({
          event_id: eventId,
          user_id: userId,
          target_user_id: targetUserId,
          direction,
        })
        .select()
        .single();
      if (error) throw error;
      return data as VibeCheck;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["vibe-checks", vars.eventId, userId] });
    },
  });
}

// ============================================================
// SPARKS
// ============================================================

export function useMatchSparks(matchId: string | undefined, userId: string | undefined) {
  return useQuery({
    queryKey: ["sparks", matchId, userId],
    enabled: !!matchId && !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sparks")
        .select("*")
        .eq("match_id", matchId!)
        .or(`user_id.eq.${userId},target_user_id.eq.${userId}`);
      if (error) throw error;
      return (data ?? []) as Spark[];
    },
  });
}

export function useSendSpark(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      matchId,
      targetUserId,
      sparked,
    }: {
      matchId: string;
      targetUserId: string;
      sparked: boolean;
    }) => {
      if (!userId) throw new Error("Not signed in");
      const { data, error } = await supabase
        .from("sparks")
        .insert({
          match_id: matchId,
          user_id: userId,
          target_user_id: targetUserId,
          sparked,
        })
        .select()
        .single();
      if (error) throw error;
      return data as Spark;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["sparks", vars.matchId, userId] });
    },
  });
}

export { isMutualSpark } from "./sparks";

// ============================================================
// STREAKS
// ============================================================

export function useStreak(userId: string | undefined) {
  return useQuery({
    queryKey: ["streak", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("users")
        .select("streak_count, streak_updated_at")
        .eq("id", userId!)
        .single();
      if (error) throw error;
      return data as { streak_count: number; streak_updated_at: string | null };
    },
  });
}

// ============================================================
// LIVE MENU PREVIEW (diner-facing read)
// ============================================================

export function useRestaurantMenu(restaurantId: string | undefined) {
  return useQuery({
    queryKey: ["menu", restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("restaurant_menu_items")
        .select("*")
        .eq("restaurant_id", restaurantId!)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as RestaurantMenuItem[];
    },
  });
}

// Finds the match (if any) this user belongs to for a given event, so
// screens that only have an event/booking on hand (like the bookings tab)
// can link to /matches/[matchId] or /feedback/[matchId] correctly instead
// of passing a booking id where a match id is expected.
export function useMyMatchForEvent(eventId: string | undefined, userId: string | undefined) {
  return useQuery({
    queryKey: ["my-match-for-event", eventId, userId],
    enabled: !!eventId && !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("matches")
        .select("id")
        .eq("event_id", eventId!)
        .contains("user_ids", [userId!])
        .maybeSingle();
      if (error) throw error;
      return data?.id as string | undefined;
    },
  });
}

// ============================================================
// CHECK-INS (trust & safety: selfie confirmation at the table)
// ============================================================

export function useMyBookingId(eventId: string | undefined, userId: string | undefined) {
  return useQuery({
    queryKey: ["my-booking-id", eventId, userId],
    enabled: !!eventId && !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("id")
        .eq("event_id", eventId!)
        .eq("user_id", userId!)
        .eq("status", "confirmed")
        .maybeSingle();
      if (error) throw error;
      return data?.id as string | undefined;
    },
  });
}

export function useMyCheckin(bookingId: string | undefined) {
  return useQuery({
    queryKey: ["checkin", bookingId],
    enabled: !!bookingId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("checkins")
        .select("*")
        .eq("booking_id", bookingId!)
        .maybeSingle();
      if (error) throw error;
      return data as Checkin | null;
    },
  });
}

export function useCheckIn(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      bookingId,
      selfieUrl,
    }: {
      bookingId: string;
      selfieUrl: string;
    }) => {
      if (!userId) throw new Error("Not signed in");
      const { data, error } = await supabase
        .from("checkins")
        .insert({ booking_id: bookingId, user_id: userId, selfie_url: selfieUrl })
        .select()
        .single();
      if (error) throw error;
      await supabase.rpc("recalculate_trust_score");
      await supabase.rpc("recalculate_streak");
      return data as Checkin;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["checkin", vars.bookingId] });
      qc.invalidateQueries({ queryKey: ["streak", userId] });
      qc.invalidateQueries({ queryKey: ["trust-score", userId] });
    },
  });
}

export function useTrustScore(userId: string | undefined) {
  return useQuery({
    queryKey: ["trust-score", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("users")
        .select("trust_score, no_show_count")
        .eq("id", userId!)
        .single();
      if (error) throw error;
      return data as { trust_score: number; no_show_count: number };
    },
  });
}

// ============================================================
// WAITLIST (trust & safety: no-show insurance)
// ============================================================

export function useMyWaitlistEntry(eventId: string | undefined, userId: string | undefined) {
  return useQuery({
    queryKey: ["waitlist", eventId, userId],
    enabled: !!eventId && !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_waitlist")
        .select("*")
        .eq("event_id", eventId!)
        .eq("user_id", userId!)
        .maybeSingle();
      if (error) throw error;
      return data as WaitlistEntry | null;
    },
  });
}

export function useJoinWaitlist(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (eventId: string) => {
      if (!userId) throw new Error("Not signed in");
      const { data, error } = await supabase
        .from("event_waitlist")
        .insert({ event_id: eventId, user_id: userId })
        .select()
        .single();
      if (error) throw error;
      return data as WaitlistEntry;
    },
    onSuccess: (_, eventId) => {
      qc.invalidateQueries({ queryKey: ["waitlist", eventId, userId] });
    },
  });
}

export function useLeaveWaitlist(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (eventId: string) => {
      if (!userId) throw new Error("Not signed in");
      const { error } = await supabase
        .from("event_waitlist")
        .delete()
        .eq("event_id", eventId)
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: (_, eventId) => {
      qc.invalidateQueries({ queryKey: ["waitlist", eventId, userId] });
    },
  });
}

export type WaitlistNotification = WaitlistEntry & { event: EventWithRestaurant };

export function useMyWaitlistNotifications(userId: string | undefined) {
  return useQuery({
    queryKey: ["waitlist-notifications", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_waitlist")
        .select(
          `id, event_id, user_id, created_at, notified_at,
           event:events(id, restaurant_id, format, status, event_date, group_size,
             price_cents, city, description, is_mystery, reveal_hours_before,
             restaurant:restaurants(name, neighborhood, cuisine))`,
        )
        .eq("user_id", userId!)
        .not("notified_at", "is", null)
        .order("notified_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as WaitlistNotification[];
    },
  });
}

// ============================================================
// DINER REPUTATION BADGES (trust & safety: peer-given tags)
// ============================================================

export function useMyGivenTags(matchId: string | undefined, userId: string | undefined) {
  return useQuery({
    queryKey: ["diner-tags-given", matchId, userId],
    enabled: !!matchId && !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("diner_tags")
        .select("*")
        .eq("match_id", matchId!)
        .eq("rater_id", userId!);
      if (error) throw error;
      return (data ?? []) as DinerTag[];
    },
  });
}

export function useToggleDinerTag(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      matchId,
      rateeId,
      tag,
      currentlyGiven,
    }: {
      matchId: string;
      rateeId: string;
      tag: DinerTag["tag"];
      currentlyGiven: boolean;
    }) => {
      if (!userId) throw new Error("Not signed in");
      if (currentlyGiven) {
        const { error } = await supabase
          .from("diner_tags")
          .delete()
          .eq("match_id", matchId)
          .eq("rater_id", userId)
          .eq("ratee_id", rateeId)
          .eq("tag", tag);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("diner_tags")
          .insert({ match_id: matchId, rater_id: userId, ratee_id: rateeId, tag });
        if (error) throw error;
      }
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["diner-tags-given", vars.matchId, userId] });
      qc.invalidateQueries({ queryKey: ["badges", vars.rateeId] });
    },
  });
}

export function useBadges(userId: string | undefined) {
  return useQuery({
    queryKey: ["badges", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_badge_counts", {
        p_user_id: userId!,
      });
      if (error) throw error;
      return (data ?? []) as BadgeCount[];
    },
  });
}

export function useVerifyInviteCode(inviteCode: string | undefined, eventId: string | undefined) {
  return useQuery({
    queryKey: ["verify-invite", inviteCode, eventId],
    enabled: !!inviteCode && !!eventId,
    queryFn: async () => {
      // Scoped RPC rather than a direct table select — the table's RLS no
      // longer allows reading arbitrary invite rows by code (that let any
      // signed-in user enumerate every invite in the system).
      const { data, error } = await supabase
        .rpc("lookup_plus_one_invite", {
          p_invite_code: inviteCode!.toUpperCase().trim(),
          p_event_id: eventId!,
        })
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const row = data as PlusOneInvite & { sender_name: string | null };
      return {
        ...row,
        sender: row.sender_name ? { name: row.sender_name } : null,
      } as PlusOneInvite & { sender: { name: string } | null };
    },
  });
}

export function useCreatePlusOneInvite(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ eventId }: { eventId: string }) => {
      if (!userId) throw new Error("Not signed in");
      const { data, error } = await supabase.rpc("create_plus_one_invite", {
        p_event_id: eventId,
      });
      if (error) throw error;
      return data as PlusOneInvite;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile", userId] });
      qc.invalidateQueries({ queryKey: ["event"] });
    },
  });
}

export function useClaimPlusOneInvite() {
  return useMutation({
    mutationFn: async ({ inviteCode }: { inviteCode: string }) => {
      const { data, error } = await supabase.rpc("claim_plus_one_invite", {
        p_invite_code: inviteCode,
      });
      if (error) throw error;
      return data as PlusOneInvite;
    },
  });
}

export function useEventInvite(eventId: string | undefined, userId: string | undefined) {
  return useQuery({
    queryKey: ["event-invite", eventId, userId],
    enabled: !!eventId && !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plus_one_invites")
        .select("*")
        .eq("event_id", eventId!)
        .eq("sender_id", userId!)
        .maybeSingle();
      if (error) throw error;
      return data as PlusOneInvite | null;
    },
  });
}

export function useExpansionCities(userId: string | undefined) {
  return useQuery({
    queryKey: ["expansion-cities", userId],
    queryFn: async () => {
      // Aggregate RPC rather than pulling the whole city_votes table client
      // side — RLS now scopes city_votes reads to each user's own rows, so
      // a raw select would only ever see the caller's own votes anyway.
      const { data, error } = await supabase.rpc("get_expansion_cities_with_votes");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCastCityVote(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ city }: { city: string }) => {
      if (!userId) throw new Error("Not signed in");
      const { data, error } = await supabase
        .from("city_votes")
        .insert({ city, user_id: userId })
        .select()
        .single();
      if (error) throw error;
      return data as CityVote;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expansion-cities", userId] });
    },
  });
}

export function useRemoveCityVote(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ city }: { city: string }) => {
      if (!userId) throw new Error("Not signed in");
      const { error } = await supabase
        .from("city_votes")
        .delete()
        .eq("city", city)
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expansion-cities", userId] });
    },
  });
}

export type DinnerStoryWithDetails = DinnerStory & {
  user: { name: string; photo_url: string | null } | null;
  event: {
    event_date: string;
    city: string;
    restaurant: { name: string; cuisine: string[]; neighborhood: string } | null;
  } | null;
};

export function useDinnerStories() {
  return useQuery({
    queryKey: ["dinner-stories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dinner_stories")
        .select(`
          id, event_id, user_id, author_name, is_featured, photo_url, caption, created_at,
          user:users(name, photo_url),
          event:events(
            event_date, city,
            restaurant:restaurants(name, cuisine, neighborhood)
          )
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as DinnerStoryWithDetails[];
    },
  });
}

export function useCreateDinnerStory(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      eventId,
      photoUrl,
      caption,
    }: {
      eventId: string;
      photoUrl: string;
      caption?: string;
    }) => {
      if (!userId) throw new Error("Not signed in");
      const { data, error } = await supabase
        .from("dinner_stories")
        .insert({
          event_id: eventId,
          user_id: userId,
          photo_url: photoUrl,
          caption: caption || null,
        })
        .select()
        .single();
      if (error) throw error;
      return data as DinnerStory;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["dinner-stories"] });
      qc.invalidateQueries({ queryKey: ["my-story", vars.eventId, userId] });
    },
  });
}

export function useDeleteDinnerStory(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ storyId, eventId }: { storyId: string; eventId: string }) => {
      if (!userId) throw new Error("Not signed in");
      const { error } = await supabase
        .from("dinner_stories")
        .delete()
        .eq("id", storyId)
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["dinner-stories"] });
      qc.invalidateQueries({ queryKey: ["my-story", vars.eventId, userId] });
    },
  });
}

export function useMyStoryForEvent(eventId: string | undefined, userId: string | undefined) {
  return useQuery({
    queryKey: ["my-story", eventId, userId],
    enabled: !!eventId && !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dinner_stories")
        .select("*")
        .eq("event_id", eventId!)
        .eq("user_id", userId!)
        .maybeSingle();
      if (error) throw error;
      return data as DinnerStory | null;
    },
  });
}

// Starts a real Stripe subscription checkout instead of instantly granting
// premium client-side. Returns the hosted checkout URL to open; premium is
// only actually granted once stripe-webhook sees the subscription complete.
export function useSubscribePremium(userId: string | undefined) {
  return useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("Not signed in");
      const { data, error } = await supabase.functions.invoke(
        "create-premium-checkout-session",
      );
      if (error instanceof FunctionsHttpError) {
        const payload = await error.context.json().catch(() => null) as
          | { error?: string }
          | null;
        throw new Error(payload?.error ?? "Failed to start Premium checkout");
      }
      if (error) throw error;
      if (!data?.url) throw new Error("No checkout URL returned");
      return data.url as string;
    },
  });
}

export function useToggleWindowSeat(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("Not signed in");
      const { data, error } = await supabase.rpc("toggle_window_seat_preference");
      if (error) throw error;
      return data as boolean;
    },
    onSuccess: (newPref) => {
      qc.setQueryData(["profile", userId], (old: Profile | undefined) => {
        if (!old) return old;
        return { ...old, prefers_window_seat: newPref };
      });
    },
  });
}

export function useFavoriteRestaurants(userId: string | undefined) {
  return useQuery({
    queryKey: ["favorite-restaurants", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("favorite_restaurants")
        .select("*, restaurant:restaurants(*)")
        .eq("user_id", userId!);
      if (error) throw error;
      return data as FavoriteRestaurant[];
    },
  });
}

export function useIsRestaurantFavorited(userId: string | undefined, restaurantId: string | undefined) {
  return useQuery({
    queryKey: ["is-restaurant-favorited", userId, restaurantId],
    enabled: !!userId && !!restaurantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("favorite_restaurants")
        .select("id")
        .eq("user_id", userId!)
        .eq("restaurant_id", restaurantId!)
        .maybeSingle();
      if (error) throw error;
      return !!data;
    },
  });
}

export function useToggleFavoriteRestaurant(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ restaurantId, isFavorited }: { restaurantId: string; isFavorited: boolean }) => {
      if (!userId) throw new Error("Not signed in");
      if (isFavorited) {
        const { error } = await supabase
          .from("favorite_restaurants")
          .delete()
          .eq("user_id", userId)
          .eq("restaurant_id", restaurantId);
        if (error) throw error;
        return { restaurantId, isFavorited: false };
      } else {
        const { error } = await supabase
          .from("favorite_restaurants")
          .insert({ user_id: userId, restaurant_id: restaurantId });
        if (error) throw error;
        return { restaurantId, isFavorited: true };
      }
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["favorite-restaurants", userId] });
      qc.invalidateQueries({ queryKey: ["is-restaurant-favorited", userId, data.restaurantId] });
    },
  });
}

export function useSubmitRestaurantRecommendation(userId: string | undefined) {
  return useMutation({
    mutationFn: async ({
      name,
      city,
      neighborhood,
      notes,
    }: {
      name: string;
      city: string;
      neighborhood?: string;
      notes?: string;
    }) => {
      if (!userId) throw new Error("Not signed in");
      const { data, error } = await supabase
        .from("restaurant_recommendations")
        .insert({
          user_id: userId,
          name,
          city,
          neighborhood: neighborhood || null,
          notes: notes || null,
        })
        .select()
        .single();
      if (error) throw error;
      return data as RestaurantRecommendation;
    },
  });
}

// ============================================================
// DINNER ROULETTE HOOKS
// ============================================================

export function useRouletteOptInStatus(userId: string | undefined, dateString: string) {
  return useQuery({
    queryKey: ["rouletteOptIn", userId, dateString],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("roulette_opt_ins")
        .select("id, status, booking_id")
        .eq("user_id", userId!)
        .eq("date", dateString)
        .maybeSingle();
      if (error) throw error;
      return data as { id: string; status: "pending" | "matched" | "expired"; booking_id: string | null } | null;
    },
  });
}

export function useOptInRoulette(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { city: string; date: string }) => {
      if (!userId) throw new Error("Not signed in");
      const { data, error } = await supabase
        .from("roulette_opt_ins")
        .insert({
          user_id: userId,
          city: params.city,
          date: params.date,
          status: "pending",
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ["rouletteOptIn", userId, variables.date] });
    },
  });
}

export function useOptOutRoulette(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dateString: string) => {
      if (!userId) throw new Error("Not signed in");
      const { error } = await supabase
        .from("roulette_opt_ins")
        .delete()
        .eq("user_id", userId)
        .eq("date", dateString);
      if (error) throw error;
    },
    onSuccess: (_, dateString) => {
      qc.invalidateQueries({ queryKey: ["rouletteOptIn", userId, dateString] });
    },
  });
}

// ============================================================
// RECONNECT DINNER HOOKS
// ============================================================

export type ReconnectRequest = {
  id: string;
  user_id: string;
  target_user_id: string;
  status: "pending" | "accepted" | "declined";
  event_id: string | null;
  created_at: string;
  sender: { id: string; name: string; photo_url: string | null };
  recipient: { id: string; name: string; photo_url: string | null };
};

export function useReconnectRequests(userId: string | undefined) {
  return useQuery({
    queryKey: ["reconnectRequests", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reconnect_requests")
        .select(`
          id, user_id, target_user_id, status, event_id, created_at,
          sender:users!reconnect_requests_user_id_fkey(id, name, photo_url),
          recipient:users!reconnect_requests_target_user_id_fkey(id, name, photo_url)
        `)
        .or(`user_id.eq.${userId},target_user_id.eq.${userId}`);
      if (error) throw error;
      const formatted = (data ?? []).map((row: any) => ({
        ...row,
        sender: Array.isArray(row.sender) ? row.sender[0] : row.sender,
        recipient: Array.isArray(row.recipient) ? row.recipient[0] : row.recipient,
      }));
      return formatted as ReconnectRequest[];
    },
  });
}

export function useCreateReconnectRequest(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (targetUserId: string) => {
      if (!userId) throw new Error("Not signed in");
      const { data, error } = await supabase
        .from("reconnect_requests")
        .insert({
          user_id: userId,
          target_user_id: targetUserId,
          status: "pending",
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reconnectRequests", userId] });
    },
  });
}

export function useRespondReconnectRequest(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { id: string; status: "accepted" | "declined" }) => {
      const { data, error } = await supabase
        .from("reconnect_requests")
        .update({ status: params.status })
        .eq("id", params.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reconnectRequests", userId] });
    },
  });
}

export function useBookReconnectDinner(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { reconnectRequestId: string; restaurantId: string; eventDate: string }) => {
      const { data, error } = await supabase.functions.invoke(
        "create-reconnect-dinner",
        {
          body: {
            reconnect_request_id: params.reconnectRequestId,
            restaurant_id: params.restaurantId,
            event_date: params.eventDate,
          },
        }
      );
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reconnectRequests", userId] });
      qc.invalidateQueries({ queryKey: ["matches"] });
    },
  });
}

// ============================================================
// CHAT REACTIONS HOOKS
// ============================================================

export function useReactToMessage(matchId: string | undefined, userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { messageId: string; emoji: string }) => {
      if (!userId) throw new Error("Not signed in");
      const { data, error } = await supabase
        .from("message_reactions")
        .insert({
          message_id: params.messageId,
          user_id: userId,
          emoji: params.emoji,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["messages", matchId] });
    },
  });
}

export function useRemoveReaction(matchId: string | undefined, userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { messageId: string; emoji: string }) => {
      if (!userId) throw new Error("Not signed in");
      const { error } = await supabase
        .from("message_reactions")
        .delete()
        .eq("message_id", params.messageId)
        .eq("user_id", userId)
        .eq("emoji", params.emoji);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["messages", matchId] });
    },
  });
}

// ============================================================
// ICEBREAKER HOOKS
// ============================================================

export type IcebreakerPrompt = {
  id: string;
  prompt_text: string;
};

export type UserIcebreaker = {
  id: string;
  user_id: string;
  prompt_id: string;
  answer: string;
  prompt: { prompt_text: string };
};

export function useIcebreakerPrompts() {
  return useQuery({
    queryKey: ["icebreakerPrompts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("icebreaker_prompts")
        .select("*")
        .order("prompt_text", { ascending: true });
      if (error) throw error;
      return data as IcebreakerPrompt[];
    },
  });
}

export function useUserIcebreakers(userId: string | undefined) {
  return useQuery({
    queryKey: ["userIcebreakers", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_icebreakers")
        .select(`
          id, user_id, prompt_id, answer,
          prompt:icebreaker_prompts(prompt_text)
        `)
        .eq("user_id", userId!);
      if (error) throw error;
      return (data ?? []) as unknown as UserIcebreaker[];
    },
  });
}

export function useSaveUserIcebreaker(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { promptId: string; answer: string }) => {
      if (!userId) throw new Error("Not signed in");
      const { data, error } = await supabase
        .from("user_icebreakers")
        .upsert({
          user_id: userId,
          prompt_id: params.promptId,
          answer: params.answer,
        }, { onConflict: "user_id,prompt_id" })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["userIcebreakers", userId] });
    },
  });
}

export function useDeleteUserIcebreaker(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("user_icebreakers")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["userIcebreakers", userId] });
    },
  });
}

export function useMutualSparks(userId: string | undefined) {
  return useQuery({
    queryKey: ["mutualSparks", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data: mySparks, error: myErr } = await supabase
        .from("sparks")
        .select("match_id, target_user_id, target:users!sparks_target_user_id_fkey(id, name, photo_url)")
        .eq("user_id", userId!)
        .eq("sparked", true);
      if (myErr) throw myErr;

      const { data: theirSparks, error: theirErr } = await supabase
        .from("sparks")
        .select("match_id, user_id")
        .eq("target_user_id", userId!)
        .eq("sparked", true);
      if (theirErr) throw theirErr;

      const mutual = (mySparks ?? []).filter((s) => 
        (theirSparks ?? []).some((ts) => ts.match_id === s.match_id && ts.user_id === s.target_user_id)
      );

      return mutual.map((m) => ({
        matchId: m.match_id,
        user: m.target as unknown as { id: string; name: string; photo_url: string | null }
      }));
    }
  });
}

export function useRestaurants(city: string | null | undefined) {
  return useQuery({
    queryKey: ["restaurants", city ?? "_all"],
    queryFn: async () => {
      let query = supabase
        .from("restaurants")
        .select("id, name, neighborhood, city, cuisine")
        .eq("is_active", true);
      if (city) {
        query = query.eq("city", city);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data as Restaurant[];
    }
  });
}

// ============================================================
// MEMBER VALUE, SAFETY, PASSPORT, POLLS, AND CONCIERGE
// ============================================================

export function useProfileVerification(userId: string | undefined) {
  return useQuery({
    queryKey: ["profile-verification", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profile_verifications")
        .select("*")
        .eq("user_id", userId!)
        .maybeSingle();
      if (error) throw error;
      return data as ProfileVerification | null;
    },
  });
}

export function useRequestProfileVerification(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("Not signed in");
      const { data, error } = await supabase
        .from("profile_verifications")
        .insert({ user_id: userId, method: "identity_review", status: "pending" })
        .select()
        .single();
      if (error) throw error;
      return data as ProfileVerification;
    },
    onSuccess: (data) => qc.setQueryData(["profile-verification", userId], data),
  });
}

export function useBlockedUsers(userId: string | undefined) {
  return useQuery({
    queryKey: ["blocked-users", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_blocks")
        .select("blocked_id, created_at")
        .eq("blocker_id", userId!);
      if (error) throw error;
      return data as { blocked_id: string; created_at: string }[];
    },
  });
}

export function useToggleBlockedUser(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ blockedId, blocked }: { blockedId: string; blocked: boolean }) => {
      if (!userId) throw new Error("Not signed in");
      if (blocked) {
        const { error } = await supabase
          .from("user_blocks")
          .delete()
          .eq("blocker_id", userId)
          .eq("blocked_id", blockedId);
        if (error) throw error;
        return false;
      }
      const { error } = await supabase
        .from("user_blocks")
        .insert({ blocker_id: userId, blocked_id: blockedId });
      if (error) throw error;
      return true;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["blocked-users", userId] }),
  });
}

export function useSafetyReports(userId: string | undefined) {
  return useQuery({
    queryKey: ["safety-reports", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("safety_reports")
        .select("id, category, details, status, created_at")
        .eq("reporter_id", userId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useSubmitSafetyReport(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (report: {
      subjectId?: string;
      matchId?: string;
      category: string;
      details: string;
    }) => {
      if (!userId) throw new Error("Not signed in");
      const { data, error } = await supabase
        .from("safety_reports")
        .insert({
          reporter_id: userId,
          subject_id: report.subjectId ?? null,
          match_id: report.matchId ?? null,
          category: report.category,
          details: report.details,
          status: "submitted",
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["safety-reports", userId] }),
  });
}

export function useRestaurantPerks(restaurantId: string | undefined) {
  return useQuery({
    queryKey: ["restaurant-perks", restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("restaurant_perks")
        .select("*")
        .eq("restaurant_id", restaurantId!)
        .order("premium_only", { ascending: false });
      if (error) throw error;
      return (data ?? []) as RestaurantPerk[];
    },
  });
}

export type PassportVisit = {
  id: string;
  checked_in_at: string;
  booking: {
    event: EventWithRestaurant;
  };
};

export function useDiningPassport(userId: string | undefined) {
  return useQuery({
    queryKey: ["dining-passport", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("checkins")
        .select(`
          id, checked_in_at,
          booking:bookings!inner(
            event:events!inner(
              id, event_date, format, city, theme, vibe_tags,
              restaurant:restaurants(name, neighborhood, cuisine)
            )
          )
        `)
        .eq("user_id", userId!)
        .order("checked_in_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as PassportVisit[];
    },
  });
}

export function useMatchPolls(matchId: string | undefined) {
  return useQuery({
    queryKey: ["match-polls", matchId],
    enabled: !!matchId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("match_polls")
        .select("*, votes:match_poll_votes(user_id, option_index)")
        .eq("match_id", matchId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as MatchPoll[];
    },
  });
}

export function useCreateMatchPoll(matchId: string | undefined, userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ question, options }: { question: string; options: string[] }) => {
      if (!matchId || !userId) throw new Error("Not signed in");
      const { data, error } = await supabase
        .from("match_polls")
        .insert({ match_id: matchId, creator_id: userId, question, options })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["match-polls", matchId] }),
  });
}

export function useVoteMatchPoll(matchId: string | undefined, userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ pollId, optionIndex }: { pollId: string; optionIndex: number }) => {
      if (!userId) throw new Error("Not signed in");
      const { error } = await supabase
        .from("match_poll_votes")
        .upsert(
          { poll_id: pollId, user_id: userId, option_index: optionIndex },
          { onConflict: "poll_id,user_id" },
        );
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["match-polls", matchId] }),
  });
}

export function useConciergeRequests(userId: string | undefined) {
  return useQuery({
    queryKey: ["concierge-requests", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("concierge_requests")
        .select("*")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useSubmitConciergeRequest(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ requestType, details }: { requestType: string; details: string }) => {
      if (!userId) throw new Error("Not signed in");
      const { data, error } = await supabase
        .from("concierge_requests")
        .insert({ user_id: userId, request_type: requestType, details })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["concierge-requests", userId] }),
  });
}





