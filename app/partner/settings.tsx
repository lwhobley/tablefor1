import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { Screen } from "../../components/Screen";
import { Field } from "../../components/Field";
import { Button } from "../../components/Button";
import { PartnerNav } from "../../components/PartnerNav";
import {
  usePartnerRestaurant,
  useUpdateRestaurant,
} from "../../lib/partnerQueries";
import { useAuth } from "../../lib/auth";

export default function PartnerSettings() {
  const { signOut } = useAuth();
  const { data: restaurant } = usePartnerRestaurant();
  const update = useUpdateRestaurant(restaurant?.id);

  const [name, setName] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [cuisine, setCuisine] = useState("");
  const [capacity, setCapacity] = useState("");
  const [resyVenueId, setResyVenueId] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!restaurant) return;
    setName(restaurant.name);
    setNeighborhood(restaurant.neighborhood);
    setCity(restaurant.city);
    setAddress(restaurant.address);
    setCuisine(restaurant.cuisine.join(", "));
    setCapacity(String(restaurant.capacity));
    setResyVenueId(restaurant.resy_venue_id || "");
  }, [restaurant]);

  async function save() {
    const cap = parseInt(capacity, 10);
    if (isNaN(cap) || cap < 1) return;
    await update.mutateAsync({
      name: name.trim(),
      neighborhood: neighborhood.trim(),
      city: city.trim(),
      address: address.trim(),
      cuisine: cuisine
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean),
      capacity: cap,
      resy_venue_id: resyVenueId.trim() || null,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  return (
    <Screen>
      <View className="gap-2 pb-2">
        <Text className="font-serif text-3xl text-ink">Venue settings</Text>
      </View>
      <PartnerNav />

      <View className="gap-4">
        <Field label="Name" value={name} onChangeText={setName} />
        <Field
          label="Neighborhood"
          value={neighborhood}
          onChangeText={setNeighborhood}
        />
        <Field label="City" value={city} onChangeText={setCity} />
        <Field label="Address" value={address} onChangeText={setAddress} />
        <Field
          label="Cuisine tags (comma-separated)"
          value={cuisine}
          onChangeText={setCuisine}
          placeholder="Italian, Mediterranean"
          autoCapitalize="words"
        />
        <Field
          label="Seating capacity"
          value={capacity}
          onChangeText={setCapacity}
          placeholder="40"
        />
        <Field
          label="Resy Venue ID (Optional)"
          value={resyVenueId}
          onChangeText={setResyVenueId}
          placeholder="e.g. 12345"
        />

        {restaurant?.stripe_account ? (
          <View className="gap-1 rounded-2xl bg-sage/10 p-4">
            <Text className="text-xs uppercase tracking-widest text-sage">
              Stripe connected
            </Text>
            <Text className="text-sm text-ink/70">
              Payouts will route to {restaurant.stripe_account}.
            </Text>
          </View>
        ) : (
          <View className="gap-1 rounded-2xl bg-clay/10 p-4">
            <Text className="text-xs uppercase tracking-widest text-clay">
              Stripe not connected
            </Text>
            <Text className="text-sm text-ink/70">
              Visit the dashboard to start Connect onboarding.
            </Text>
          </View>
        )}

        <Button label="Save changes" onPress={save} loading={update.isPending} />
        {saved && <Text className="text-center text-sm text-sage">Saved!</Text>}
        <Button label="Sign out" variant="ghost" onPress={signOut} />
      </View>
    </Screen>
  );
}
