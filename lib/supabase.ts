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

export type EnergyLevel = "low_key" | "balanced" | "high_energy";
export type ConvStyle = "listener" | "balanced" | "storyteller";
export type Dietary =
  | "none"
  | "vegetarian"
  | "vegan"
  | "halal"
  | "kosher"
  | "gluten_free"
  | "dairy_free";
export type EventFormat =
  | "dinner"
  | "brunch"
  | "late_night"
  | "food_crawl"
  | "chefs_table";
export type EventStatus =
  | "open"
  | "matched"
  | "full"
  | "cancelled"
  | "completed";

export type Profile = {
  id: string;
  name: string;
  photo_url: string | null;
  bio: string | null;
  city: string;
  neighborhood: string | null;
  energy_level: EnergyLevel;
  conv_style: ConvStyle;
  food_prefs: string[];
  dietary: Dietary[];
  languages: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type EventRow = {
  id: string;
  restaurant_id: string;
  format: EventFormat;
  status: EventStatus;
  event_date: string;
  group_size: number;
  price_cents: number;
  city: string;
  description: string | null;
};
