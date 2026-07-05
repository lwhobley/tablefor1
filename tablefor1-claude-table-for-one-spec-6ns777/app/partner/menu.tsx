import { useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "../../components/Screen";
import { Field } from "../../components/Field";
import { Button } from "../../components/Button";
import { ChipGroup } from "../../components/Chip";
import { PartnerNav } from "../../components/PartnerNav";
import { ALLERGEN_OPTIONS, MENU_CATEGORY_OPTIONS } from "../../components/preferences";
import {
  usePartnerRestaurant,
  usePartnerMenu,
  useAddMenuItem,
  useUpdateMenuItem,
  useDeleteMenuItem,
} from "../../lib/partnerQueries";
import type { MenuCategory, RestaurantMenuItem } from "../../lib/supabase";

function MenuItemRow({
  item,
  onDelete,
}: {
  item: RestaurantMenuItem;
  onDelete: () => void;
}) {
  return (
    <View className="gap-1 rounded-xl border border-ink/10 bg-white p-3">
      <View className="flex-row items-center justify-between">
        <Text className="font-medium text-ink">{item.name}</Text>
        <Pressable onPress={onDelete} className="p-1">
          <Ionicons name="trash-outline" size={16} color="#C2410C" />
        </Pressable>
      </View>
      {item.description && (
        <Text className="text-sm text-ink/60">{item.description}</Text>
      )}
      <View className="flex-row items-center gap-2">
        <Text className="text-xs uppercase tracking-widest text-ink/40">
          {item.category}
        </Text>
        {item.price_cents != null && (
          <Text className="text-xs text-ink/40">
            ${(item.price_cents / 100).toFixed(0)}
          </Text>
        )}
      </View>
      {item.allergens.length > 0 && (
        <Text className="text-xs text-ink/40">
          Allergens: {item.allergens.join(", ")}
        </Text>
      )}
    </View>
  );
}

export default function PartnerMenu() {
  const { data: restaurant } = usePartnerRestaurant();
  const { data: items, isLoading } = usePartnerMenu(restaurant?.id);
  const addItem = useAddMenuItem(restaurant?.id);
  const deleteItem = useDeleteMenuItem(restaurant?.id);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState<string[]>(["entree"]);
  const [allergens, setAllergens] = useState<string[]>([]);

  function resetForm() {
    setName("");
    setDescription("");
    setPrice("");
    setCategory(["entree"]);
    setAllergens([]);
  }

  async function handleAdd() {
    if (!name.trim() || !category[0]) return;
    const priceCents = price.trim() ? Math.round(parseFloat(price) * 100) : null;
    await addItem.mutateAsync({
      name: name.trim(),
      description: description.trim() || null,
      price_cents: priceCents,
      category: category[0] as MenuCategory,
      allergens,
    });
    resetForm();
  }

  return (
    <Screen>
      <View className="gap-2 pb-2">
        <Text className="font-serif text-3xl text-ink">Menu preview</Text>
        <Text className="text-sm text-ink/60">
          Diners see these dishes before booking, with allergen warnings
          matched against their dietary preferences.
        </Text>
      </View>
      <PartnerNav />

      <View className="mb-6 gap-4 rounded-2xl border border-ink/10 bg-white p-4">
        <Text className="font-semibold text-ink">Add a dish</Text>
        <Field label="Name" value={name} onChangeText={setName} placeholder="Burrata & heirloom tomato" />
        <Field
          label="Description"
          value={description}
          onChangeText={setDescription}
          placeholder="Optional"
        />
        <Field
          label="Price ($, optional)"
          value={price}
          onChangeText={setPrice}
          placeholder="18"
          keyboardType="decimal-pad"
        />
        <View className="gap-2">
          <Text className="text-sm font-medium text-ink/70">Category</Text>
          <View className="flex-row flex-wrap gap-2">
            <ChipGroup
              options={MENU_CATEGORY_OPTIONS}
              values={category}
              onChange={setCategory}
              multi={false}
            />
          </View>
        </View>
        <View className="gap-2">
          <Text className="text-sm font-medium text-ink/70">Allergens</Text>
          <View className="flex-row flex-wrap gap-2">
            <ChipGroup
              options={ALLERGEN_OPTIONS}
              values={allergens}
              onChange={setAllergens}
            />
          </View>
        </View>
        <Button
          label="Add dish"
          onPress={handleAdd}
          loading={addItem.isPending}
          disabled={!name.trim()}
        />
      </View>

      {isLoading ? (
        <ActivityIndicator />
      ) : (items ?? []).length === 0 ? (
        <View className="gap-2 rounded-2xl bg-clay/10 p-6">
          <Text className="font-serif text-xl text-ink">No dishes yet</Text>
          <Text className="text-sm text-ink/60">
            Add your set menu so diners know what to expect before they book.
          </Text>
        </View>
      ) : (
        <View className="gap-3">
          {(items ?? []).map((item: RestaurantMenuItem) => (
            <MenuItemRow
              key={item.id}
              item={item}
              onDelete={() => deleteItem.mutate(item.id)}
            />
          ))}
        </View>
      )}
    </Screen>
  );
}
