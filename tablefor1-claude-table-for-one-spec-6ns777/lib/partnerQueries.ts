import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  supabase,
  type EventFormat,
  type EventStatus,
  type RestaurantMenuItem,
} from "./supabase";

export type Restaurant = {
  id: string;
  name: string;
  neighborhood: string;
  city: string;
  address: string;
  cuisine: string[];
  capacity: number;
  stripe_account: string | null;
  partner_email: string | null;
  is_active: boolean;
  resy_venue_id: string | null;
};

export type PartnerEvent = {
  event_id: string;
  event_date: string;
  format: EventFormat;
  status: EventStatus;
  group_size: number;
  price_cents: number;
  confirmed_covers: number;
  first_names: string[];
  resy_booking_status: "none" | "pending" | "booked" | "failed" | null;
  resy_booking_token: string | null;
  resy_error: string | null;
};

export type PartnerStats = {
  upcoming_events: number;
  confirmed_covers: number;
  pending_slots: number;
  gross_payout_cents: number;
};

export type AvailabilitySlot = {
  id: string;
  restaurant_id: string;
  proposed_date: string;
  format: EventFormat;
  max_covers: number;
  notes: string | null;
  is_approved: boolean;
  created_at: string;
};

export function usePartnerRestaurant(enabled = true) {
  return useQuery({
    queryKey: ["partner", "restaurant"],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("partner_my_restaurant");
      if (error) throw error;
      return (data as Restaurant) ?? null;
    },
  });
}

export function usePartnerStats(enabled = true) {
  return useQuery({
    queryKey: ["partner", "stats"],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("partner_dashboard_stats");
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return (row as PartnerStats) ?? null;
    },
  });
}

export function usePartnerEvents(enabled = true) {
  return useQuery({
    queryKey: ["partner", "events"],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("partner_upcoming_events");
      if (error) throw error;
      return (data ?? []) as PartnerEvent[];
    },
  });
}

export function usePartnerAvailability(restaurantId: string | undefined) {
  return useQuery({
    queryKey: ["partner", "availability", restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("partner_availability")
        .select("*")
        .eq("restaurant_id", restaurantId!)
        .order("proposed_date", { ascending: true });
      if (error) throw error;
      return (data ?? []) as AvailabilitySlot[];
    },
  });
}

export function useSubmitAvailability(restaurantId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      proposed_date: string;
      format: EventFormat;
      max_covers: number;
      notes?: string | null;
    }) => {
      if (!restaurantId) throw new Error("No restaurant");
      const { error } = await supabase.from("partner_availability").insert({
        restaurant_id: restaurantId,
        proposed_date: input.proposed_date,
        format: input.format,
        max_covers: input.max_covers,
        notes: input.notes ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["partner", "availability", restaurantId] });
      qc.invalidateQueries({ queryKey: ["partner", "stats"] });
    },
  });
}

export function useUpdateRestaurant(restaurantId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<Restaurant>) => {
      if (!restaurantId) throw new Error("No restaurant");
      const { data, error } = await supabase
        .from("restaurants")
        .update(patch)
        .eq("id", restaurantId)
        .select()
        .single();
      if (error) throw error;
      return data as Restaurant;
    },
    onSuccess: (data) => {
      qc.setQueryData(["partner", "restaurant"], data);
    },
  });
}

export function useRetryResyBooking() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (eventId: string) => {
      const { error } = await supabase.rpc("partner_retry_resy_booking", {
        p_event_id: eventId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["partner", "events"] });
    },
  });
}

// ============================================================
// LIVE MENU PREVIEW (partner-managed)
// ============================================================

export function usePartnerMenu(restaurantId: string | undefined) {
  return useQuery({
    queryKey: ["partner", "menu", restaurantId],
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

export function useAddMenuItem(restaurantId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      name: string;
      description?: string | null;
      price_cents?: number | null;
      category: RestaurantMenuItem["category"];
      allergens: string[];
      sort_order?: number;
    }) => {
      if (!restaurantId) throw new Error("No restaurant");
      const { data, error } = await supabase
        .from("restaurant_menu_items")
        .insert({ restaurant_id: restaurantId, ...input })
        .select()
        .single();
      if (error) throw error;
      return data as RestaurantMenuItem;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["partner", "menu", restaurantId] });
    },
  });
}

export function useUpdateMenuItem(restaurantId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string;
      patch: Partial<RestaurantMenuItem>;
    }) => {
      const { data, error } = await supabase
        .from("restaurant_menu_items")
        .update(patch)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as RestaurantMenuItem;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["partner", "menu", restaurantId] });
    },
  });
}

export function useDeleteMenuItem(restaurantId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("restaurant_menu_items")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["partner", "menu", restaurantId] });
    },
  });
}
