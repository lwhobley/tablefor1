import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { RestaurantMenuItem, Dietary, MenuCategory } from "../lib/supabase";
import { conflictingAllergens } from "../lib/allergens";

const CATEGORY_ORDER: MenuCategory[] = ["appetizer", "entree", "dessert", "drink"];
const CATEGORY_LABELS: Record<MenuCategory, string> = {
  appetizer: "Appetizers",
  entree: "Entrées",
  dessert: "Desserts",
  drink: "Drinks",
};

export function MenuPreview({
  items,
  userDietary,
}: {
  items: RestaurantMenuItem[];
  userDietary: Dietary[];
}) {
  if (items.length === 0) return null;

  const grouped = CATEGORY_ORDER.map((cat) => ({
    category: cat,
    items: items.filter((i) => i.category === cat),
  })).filter((g) => g.items.length > 0);

  return (
    <View className="mb-8 gap-4">
      <Text className="text-lg font-bold text-ink">Menu preview</Text>
      {grouped.map((group) => (
        <View key={group.category} className="gap-2">
          <Text className="text-xs font-semibold uppercase tracking-widest text-ink/50">
            {CATEGORY_LABELS[group.category]}
          </Text>
          {group.items.map((item) => {
            const conflicts = conflictingAllergens(userDietary, item.allergens);
            return (
              <View
                key={item.id}
                className="gap-1 rounded-xl border border-ink/10 bg-white p-3"
              >
                <View className="flex-row items-center justify-between">
                  <Text className="font-medium text-ink">{item.name}</Text>
                  {item.price_cents != null && (
                    <Text className="text-sm text-ink/60">
                      ${(item.price_cents / 100).toFixed(0)}
                    </Text>
                  )}
                </View>
                {item.description && (
                  <Text className="text-sm text-ink/60">{item.description}</Text>
                )}
                {item.allergens.length > 0 && (
                  <Text className="text-xs text-ink/40">
                    Contains: {item.allergens.join(", ")}
                  </Text>
                )}
                {conflicts.length > 0 && (
                  <View className="mt-1 flex-row items-center gap-1 self-start rounded-full bg-clay/10 px-2 py-1">
                    <Ionicons name="warning-outline" size={12} color="#C2410C" />
                    <Text className="text-xs text-clay">
                      May conflict with your {conflicts.join(", ")} preference
                    </Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}
