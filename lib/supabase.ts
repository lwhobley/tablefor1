import "react-native-url-polyfill/auto";
import { createClient } from "@supabase/supabase-js";

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
  plus_one_tokens: number;
  is_premium: boolean;
  premium_expires_at: string | null;
  prefers_window_seat: boolean;
  created_at: string;
  updated_at: string;
};

export type PlusOneInvite = {
  id: string;
  sender_id: string;
  event_id: string;
  invite_code: string;
  invitee_id: string | null;
  created_at: string;
  used_at: string | null;
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
  is_mystery: boolean;
  reveal_hours_before: number;
  published_at: string;
  early_access_hours: number;
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
  recipient_id: string | null;
  body: string;
  photo_url: string | null;
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

export type VibeCheck = {
  id: string;
  event_id: string;
  user_id: string;
  target_user_id: string;
  direction: "like" | "pass";
  created_at: string;
};

export type Spark = {
  id: string;
  match_id: string;
  user_id: string;
  target_user_id: string;
  sparked: boolean;
  created_at: string;
};

export type MenuCategory = "appetizer" | "entree" | "dessert" | "drink";

export type RestaurantMenuItem = {
  id: string;
  restaurant_id: string;
  name: string;
  description: string | null;
  price_cents: number | null;
  category: MenuCategory;
  allergens: string[];
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type Checkin = {
  id: string;
  booking_id: string;
  user_id: string;
  selfie_url: string;
  checked_in_at: string;
};

export type WaitlistEntry = {
  id: string;
  event_id: string;
  user_id: string;
  created_at: string;
  notified_at: string | null;
};

export type DinerTag = {
  id: string;
  match_id: string;
  rater_id: string;
  ratee_id: string;
  tag:
    | "great_conversationalist"
    | "good_listener"
    | "adventurous_eater"
    | "always_on_time"
    | "generous"
    | "funny"
    | "great_energy";
  created_at: string;
};

export type BadgeCount = {
  tag: DinerTag["tag"];
  count: number;
};

export type ExpansionCity = {
  city: string;
  target_pledges: number;
  description: string | null;
  created_at: string;
};

export type CityVote = {
  id: string;
  city: string;
  user_id: string;
  created_at: string;
};

export type DinnerStory = {
  id: string;
  event_id: string;
  user_id: string;
  photo_url: string;
  caption: string | null;
  created_at: string;
};

export type FavoriteRestaurant = {
  id: string;
  user_id: string;
  restaurant_id: string;
  created_at: string;
  restaurant?: Restaurant;
};

export type RestaurantRecommendation = {
  id: string;
  user_id: string;
  name: string;
  city: string;
  neighborhood: string | null;
  notes: string | null;
  created_at: string;
};
