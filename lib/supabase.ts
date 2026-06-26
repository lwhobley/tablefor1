import "react-native-url-polyfill/auto";
import { createClient } from "@supabase/supabase-js";
import { Platform } from "react-native";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // Surfacing this in the console rather than throwing keeps the dev server
  // running so the developer can fix .env without a full restart loop.
  console.warn(
    "[supabase] Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY. Copy .env.example to .env.",
  );
}

export const supabase = createClient(
  supabaseUrl ?? "http://localhost:54321",
  supabaseAnonKey ?? "anon",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: Platform.OS === "web",
      flowType: "pkce",
    },
  },
);

export type Profile = {
  id: string;
  name: string | null;
  photo_url: string | null;
  city: string | null;
  food_prefs: string[] | null;
  dietary: string[] | null;
  energy_level: "chill" | "balanced" | "spirited" | null;
  conv_style: "listener" | "storyteller" | "debater" | "curious" | null;
  languages: string[] | null;
  onboarded_at: string | null;
  created_at: string;
};

export type EventRow = {
  id: string;
  restaurant_id: string | null;
  city: string;
  starts_at: string;
  format: "brunch" | "dinner" | "food_crawl";
  group_size: number;
  price_cents: number;
  status: "draft" | "open" | "full" | "cancelled" | "completed";
};
