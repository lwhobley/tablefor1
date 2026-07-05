import type { Dietary } from "./supabase";

const DIETARY_ALLERGEN_MAP: Partial<Record<Dietary, string[]>> = {
  gluten_free: ["gluten"],
  dairy_free: ["dairy"],
  vegan: ["dairy", "eggs", "meat", "fish", "shellfish"],
  vegetarian: ["meat", "fish", "shellfish"],
};

export function conflictingAllergens(
  userDietary: Dietary[],
  itemAllergens: string[],
): string[] {
  const flagged = new Set<string>();
  for (const diet of userDietary) {
    const conflicts = DIETARY_ALLERGEN_MAP[diet];
    if (!conflicts) continue;
    for (const allergen of itemAllergens) {
      if (conflicts.includes(allergen)) flagged.add(allergen);
    }
  }
  return [...flagged];
}
