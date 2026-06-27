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

export type BookingStatus = "pending" | "confirmed" | "cancelled" | "refunded";

export type Booking = {
  id: string;
  event_id: string;
  user_id: string;
  status: BookingStatus;
  stripe_session_id: string | null;
  stripe_payment_id: string | null;
  amount_cents: number;
  created_at: string;
  updated_at: string;
};

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
  created_at: string;
  updated_at: string;
};

export type Match = {
  id: string;
  event_id: string;
  user_ids: string[];
  score: number | null;
  revealed_at: string | null;
  created_at: string;
};

export type Message = {
  id: string;
  match_id: string;
  sender_id: string;
  body: string;
  created_at: string;
};

export type Feedback = {
  id: string;
  match_id: string;
  reviewer_id: string;
  rating: "1" | "2" | "3" | "4" | "5";
  showed_up: boolean;
  reconnect: boolean;
  notes: string | null;
  created_at: string;
};
