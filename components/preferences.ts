import type { ConvStyle, Dietary, EnergyLevel, DinerTag } from "../lib/supabase";

export type Option<T extends string = string> = { value: T; label: string };

export const CUISINES: Option[] = [
  "Italian",
  "Japanese",
  "Mexican",
  "Thai",
  "Indian",
  "Mediterranean",
  "French",
  "Korean",
  "Chinese",
  "American",
  "Ethiopian",
  "Vietnamese",
].map((c) => ({ value: c, label: c }));

export const DIETARY: Option<Dietary>[] = [
  { value: "none", label: "No restrictions" },
  { value: "vegetarian", label: "Vegetarian" },
  { value: "vegan", label: "Vegan" },
  { value: "halal", label: "Halal" },
  { value: "kosher", label: "Kosher" },
  { value: "gluten_free", label: "Gluten-free" },
  { value: "dairy_free", label: "Dairy-free" },
];

export const ENERGY_OPTIONS: Option<EnergyLevel>[] = [
  { value: "low_key", label: "Low-key" },
  { value: "balanced", label: "Balanced" },
  { value: "high_energy", label: "High-energy" },
];

export const CONV_OPTIONS: Option<ConvStyle>[] = [
  { value: "listener", label: "Listener" },
  { value: "balanced", label: "Balanced" },
  { value: "storyteller", label: "Storyteller" },
];

export const LANGUAGE_OPTIONS: Option[] = [
  { value: "en", label: "English" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "zh", label: "Mandarin" },
  { value: "ja", label: "Japanese" },
];

export const TAG_OPTIONS: Option<DinerTag["tag"]>[] = [
  { value: "great_conversationalist", label: "Great conversationalist" },
  { value: "good_listener", label: "Good listener" },
  { value: "adventurous_eater", label: "Adventurous eater" },
  { value: "always_on_time", label: "Always on time" },
  { value: "generous", label: "Generous" },
  { value: "funny", label: "Funny" },
  { value: "great_energy", label: "Great energy" },
];

export const ALLERGEN_OPTIONS: Option[] = [
  "gluten",
  "dairy",
  "eggs",
  "nuts",
  "peanuts",
  "shellfish",
  "fish",
  "soy",
  "sesame",
  "meat",
].map((a) => ({ value: a, label: a }));

export const MENU_CATEGORY_OPTIONS: Option[] = [
  { value: "appetizer", label: "Appetizer" },
  { value: "entree", label: "Entrée" },
  { value: "dessert", label: "Dessert" },
  { value: "drink", label: "Drink" },
];

export const CITY_OPTIONS: Option[] = [
  "Houston",
  "New York",
  "Brooklyn",
  "San Francisco",
  "Oakland",
  "Los Angeles",
  "Chicago",
  "Austin",
  "Seattle",
  "Boston",
  "Portland",
].map((c) => ({ value: c, label: c }));
