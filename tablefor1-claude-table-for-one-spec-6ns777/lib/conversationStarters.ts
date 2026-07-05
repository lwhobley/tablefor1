import type { Profile } from "./supabase";
import type { EventWithRestaurant } from "./queries";

const GENERIC_STARTERS = [
  "What's the best meal you've had in the last year, and where was it?",
  "If you could only eat one cuisine for the rest of your life, what would it be?",
  "What's a small thing that made your week better?",
  "What's a skill you're currently trying to get better at?",
  "What's the most spontaneous thing you've done recently?",
];

function sharedFoodPrefs(diners: Profile[]): string[] {
  if (diners.length === 0) return [];
  const [first, ...rest] = diners.map((d) => new Set(d.food_prefs));
  return [...first].filter((pref) => rest.every((set) => set.has(pref)));
}

export function generateConversationStarters(
  diners: Profile[],
  event: EventWithRestaurant,
): string[] {
  const starters: string[] = [];

  const shared = sharedFoodPrefs(diners);
  if (shared.length > 0) {
    starters.push(`You all love ${shared[0]} — what's your go-to order or dish?`);
  }

  const storyteller = diners.find((d) => d.conv_style === "storyteller");
  const listener = diners.find((d) => d.conv_style === "listener");
  if (storyteller && listener && storyteller.id !== listener.id) {
    starters.push(`Ask ${storyteller.name} about their most memorable trip.`);
  }

  const energies = new Set(diners.map((d) => d.energy_level));
  if (energies.size > 1) {
    starters.push("Table round: describe your ideal Friday night in three words.");
  } else if (energies.has("high_energy")) {
    starters.push("What's the most spontaneous thing you've done this year?");
  }

  const restaurantCuisine = event.restaurant?.cuisine?.[0];
  if (restaurantCuisine && starters.length < 3) {
    starters.push(
      `Since we're at a ${restaurantCuisine} spot — what's your history with this cuisine?`,
    );
  }

  let i = 0;
  while (starters.length < 3 && i < GENERIC_STARTERS.length) {
    const candidate = GENERIC_STARTERS[i];
    if (!starters.includes(candidate)) starters.push(candidate);
    i++;
  }

  return starters.slice(0, 3);
}
