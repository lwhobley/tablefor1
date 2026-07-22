import type { EventRow, Profile } from "./supabase";
import type { EventWithRestaurant } from "./queries";

export type MatchFit = {
  score: number;
  reasons: string[];
};

const normal = (value: string) => value.trim().toLowerCase().replaceAll("_", " ");

export function getEventMatchFit(
  profile: Profile | null | undefined,
  event: EventWithRestaurant,
): MatchFit {
  if (!profile) return { score: 70, reasons: ["Curated for the local Table for 2 community"] };

  let score = 45;
  const reasons: string[] = [];
  const activeCity = profile.travel_city || profile.city;

  if (normal(activeCity) === normal(event.city)) {
    score += 15;
    reasons.push(profile.travel_city ? `Fits your ${profile.travel_city} travel mode` : "Close to home");
  }

  const cuisines = event.restaurant?.cuisine ?? [];
  const cuisineMatches = cuisines.filter((cuisine) =>
    profile.food_prefs.some((preference) => normal(preference) === normal(cuisine)),
  );
  if (cuisineMatches.length > 0) {
    score += 20;
    reasons.push(`Matches your taste for ${cuisineMatches[0]}`);
  }

  if (event.price_cents <= (profile.budget_max_cents || 15000)) {
    score += 10;
    reasons.push("Within your preferred dinner budget");
  }

  const vibeMatches = (event.vibe_tags ?? []).filter((vibe) =>
    (profile.preferred_vibes ?? []).some((preferred) => normal(preferred) === normal(vibe)),
  );
  if (vibeMatches.length > 0) {
    score += 10;
    reasons.push(`${vibeMatches[0]} atmosphere`);
  }

  if (event.is_signature && profile.is_premium) {
    score += 5;
    reasons.push("Signature Table access");
  }

  if (reasons.length === 0) {
    reasons.push("A fresh experience based on your city and availability");
  }

  return { score: Math.min(98, score), reasons: reasons.slice(0, 3) };
}

export function getGroupMatchReasons(profile: Profile, diners: Profile[]): string[] {
  const others = diners.filter((diner) => diner.id !== profile.id);
  const reasons: string[] = [];
  const sharedFood = new Set<string>();
  const sharedInterests = new Set<string>();

  for (const diner of others) {
    for (const food of diner.food_prefs ?? []) {
      if (profile.food_prefs.some((item) => normal(item) === normal(food))) sharedFood.add(food);
    }
    for (const interest of diner.interests ?? []) {
      if ((profile.interests ?? []).some((item) => normal(item) === normal(interest))) {
        sharedInterests.add(interest);
      }
    }
  }

  if (sharedFood.size > 0) reasons.push(`Shared taste for ${[...sharedFood][0]}`);
  if (sharedInterests.size > 0) reasons.push(`Common interest in ${[...sharedInterests][0]}`);

  const hasConversationBalance = others.some(
    (diner) =>
      diner.conv_style === "balanced" ||
      profile.conv_style === "balanced" ||
      (profile.conv_style === "listener" && diner.conv_style === "storyteller") ||
      (profile.conv_style === "storyteller" && diner.conv_style === "listener"),
  );
  if (hasConversationBalance) reasons.push("Complementary conversation styles");
  if (others.some((diner) => diner.energy_level === profile.energy_level)) {
    reasons.push("Similar social energy");
  }

  return reasons.length > 0
    ? reasons.slice(0, 3)
    : ["Balanced personalities", "Compatible dining preferences"];
}

export function googleCalendarUrl(event: EventRow, title: string, location?: string) {
  const start = new Date(event.event_date);
  const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
  const format = (date: Date) => date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates: `${format(start)}/${format(end)}`,
    details: "Your Table for 2 dinner. Open the app for your group, check-in, and table details.",
    location: location ?? event.city,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
