import type { ConvStyle, Dietary, EnergyLevel } from "../lib/supabase";

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
