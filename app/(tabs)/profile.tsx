import { useEffect, useState } from "react";
import { Image, Linking, Pressable, Text, View, TextInput, Alert } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { Screen } from "../../components/Screen";
import { Field } from "../../components/Field";
import { Button } from "../../components/Button";
import { ChipGroup } from "../../components/Chip";
import {
  CITY_OPTIONS,
  CONV_OPTIONS,
  CUISINES,
  DIETARY,
  ENERGY_OPTIONS,
  LANGUAGE_OPTIONS,
} from "../../components/preferences";
import { useAuth } from "../../lib/auth";
import { useProfile, useUpdateProfile, useStreak, useTrustScore, useBadges, useSubscribePremium, useToggleWindowSeat, useFavoriteRestaurants, useSubmitRestaurantRecommendation } from "../../lib/queries";
import { uploadAvatar } from "../../lib/uploadAvatar";
import { StreakBadge } from "../../components/StreakBadge";
import { BadgeList } from "../../components/BadgeList";
import { Ionicons } from "@expo/vector-icons";
import type { ConvStyle, Dietary, EnergyLevel, FavoriteRestaurant } from "../../lib/supabase";

export default function ProfileScreen() {
  const router = useRouter();
  const { session, signOut } = useAuth();
  const { data: profile } = useProfile(session?.user.id);
  const { data: streak } = useStreak(session?.user.id);
  const { data: trust } = useTrustScore(session?.user.id);
  const { data: badges } = useBadges(session?.user.id);
  const update = useUpdateProfile(session?.user.id);
  const subscribePremium = useSubscribePremium(session?.user.id);
  const toggleWindowSeat = useToggleWindowSeat(session?.user.id);
  const { data: favorites } = useFavoriteRestaurants(session?.user.id);
  const recommendRestaurant = useSubmitRestaurantRecommendation(session?.user.id);

  const [name, setName] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [city, setCity] = useState<string[]>([]);
  const [food, setFood] = useState<string[]>([]);
  const [diet, setDiet] = useState<Dietary[]>([]);
  const [energy, setEnergy] = useState<EnergyLevel[]>([]);
  const [conv, setConv] = useState<ConvStyle[]>([]);
  const [languages, setLanguages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saved, setSaved] = useState(false);

  // Suggestion form state
  const [showRecommend, setShowRecommend] = useState(false);
  const [recName, setRecName] = useState("");
  const [recCity, setRecCity] = useState("");
  const [recNeighborhood, setRecNeighborhood] = useState("");
  const [recNotes, setRecNotes] = useState("");
  const [recSubmitting, setRecSubmitting] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setName(profile.name);
    setPhoto(profile.photo_url);
    setCity([profile.city]);
    setFood(profile.food_prefs);
    setDiet(profile.dietary);
    setEnergy([profile.energy_level]);
    setConv([profile.conv_style]);
    setLanguages(profile.languages);
  }, [profile]);

  async function pickPhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (result.canceled || !session) return;
    try {
      setUploading(true);
      const url = await uploadAvatar(session.user.id, {
        uri: result.assets[0].uri,
        mimeType: result.assets[0].mimeType ?? undefined,
      });
      setPhoto(url);
      await update.mutateAsync({ photo_url: url });
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    if (!city[0] || !energy[0] || !conv[0]) return;
    await update.mutateAsync({
      name: name.trim(),
      city: city[0],
      food_prefs: food,
      dietary: diet,
      energy_level: energy[0],
      conv_style: conv[0],
      languages,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  async function handleRecommend() {
    if (!recName.trim() || !recCity.trim()) {
      Alert.alert("Missing Fields", "Please enter at least the restaurant name and city.");
      return;
    }

    try {
      setRecSubmitting(true);
      await recommendRestaurant.mutateAsync({
        name: recName.trim(),
        city: recCity.trim(),
        neighborhood: recNeighborhood.trim() || undefined,
        notes: recNotes.trim() || undefined,
      });

      Alert.alert("Thank you!", "Your recommendation has been submitted successfully.");
      setRecName("");
      setRecCity("");
      setRecNeighborhood("");
      setRecNotes("");
      setShowRecommend(false);
    } catch (err) {
      Alert.alert("Submission Failed", (err as Error).message);
    } finally {
      setRecSubmitting(false);
    }
  }

  return (
    <Screen>
      <View className="gap-6">
        <View className="flex-row items-center justify-between">
          <Text className="font-serif text-3xl text-ink">Your profile</Text>
          <View className="flex-row items-center gap-2">
            {profile && profile.is_premium && (
              <View className="flex-row items-center gap-1 rounded-full bg-yellow-100 px-3 py-1 border border-yellow-300">
                <Ionicons name="star" size={12} color="#D97706" />
                <Text className="text-xs font-semibold text-amber-800">Premium</Text>
              </View>
            )}
            <StreakBadge count={streak?.streak_count ?? 0} />
            {profile && profile.plus_one_tokens > 0 && (
              <View className="flex-row items-center gap-1 rounded-full bg-amber-100 px-3 py-1 border border-amber-200">
                <Text className="text-xs font-semibold text-amber-800">
                  +{profile.plus_one_tokens} +1 Token{profile.plus_one_tokens > 1 ? "s" : ""}
                </Text>
              </View>
            )}
          </View>
        </View>

        {trust && trust.trust_score < 100 && (
          <View className="flex-row items-center gap-2 rounded-2xl bg-clay/10 px-4 py-2">
            <Text className="text-xs text-clay">
              Trust score {trust.trust_score}/100
              {trust.no_show_count > 0 &&
                ` · ${trust.no_show_count} missed check-in${trust.no_show_count > 1 ? "s" : ""}`}
            </Text>
          </View>
        )}

        <BadgeList badges={badges ?? []} />

        <View className="items-center gap-3">
          <Pressable
            onPress={pickPhoto}
            className="h-28 w-28 items-center justify-center overflow-hidden rounded-full border border-ink/10 bg-white"
          >
            {photo ? (
              <Image source={{ uri: photo }} className="h-28 w-28" />
            ) : (
              <Text className="text-ink/40">Add</Text>
            )}
          </Pressable>
          <Button
            label={uploading ? "Uploading…" : "Change photo"}
            variant="ghost"
            onPress={pickPhoto}
            loading={uploading}
          />
        </View>

        <Field label="Name" value={name} onChangeText={setName} />

        <View className="gap-3">
          <Text className="text-sm font-medium text-ink/70">City</Text>
          <View className="flex-row flex-wrap gap-2">
            <ChipGroup
              options={CITY_OPTIONS}
              values={city}
              onChange={setCity}
              multi={false}
            />
          </View>
        </View>

        <View className="gap-3">
          <Text className="text-sm font-medium text-ink/70">Cuisines</Text>
          <View className="flex-row flex-wrap gap-2">
            <ChipGroup options={CUISINES} values={food} onChange={setFood} />
          </View>
        </View>

        <View className="gap-3">
          <Text className="text-sm font-medium text-ink/70">Dietary</Text>
          <View className="flex-row flex-wrap gap-2">
            <ChipGroup options={DIETARY} values={diet} onChange={setDiet} />
          </View>
        </View>

        <View className="gap-3">
          <Text className="text-sm font-medium text-ink/70">Energy</Text>
          <View className="flex-row flex-wrap gap-2">
            <ChipGroup
              options={ENERGY_OPTIONS}
              values={energy}
              onChange={setEnergy}
              multi={false}
            />
          </View>
        </View>

        <View className="gap-3">
          <Text className="text-sm font-medium text-ink/70">Conversation</Text>
          <View className="flex-row flex-wrap gap-2">
            <ChipGroup
              options={CONV_OPTIONS}
              values={conv}
              onChange={setConv}
              multi={false}
            />
          </View>
        </View>

        <View className="gap-3">
          <Text className="text-sm font-medium text-ink/70">Languages</Text>
          <View className="flex-row flex-wrap gap-2">
            <ChipGroup
              options={LANGUAGE_OPTIONS}
              values={languages}
              onChange={setLanguages}
            />
          </View>
        </View>

        {/* Premium Subscription block */}
        {profile && (
          profile.is_premium ? (
            <View className="gap-3 rounded-2xl border border-yellow-300 bg-yellow-50/20 p-5">
              <View className="flex-row items-center gap-2">
                <Ionicons name="star" size={22} color="#D97706" />
                <Text className="font-serif text-lg text-ink font-semibold">Premium Membership</Text>
              </View>
              <Text className="text-sm text-ink/75 leading-5">
                Your premium status is active. Enjoy priority matching, early access to tables, and custom preferences!
              </Text>
              
              <View className="flex-row items-center justify-between border-t border-yellow-300/30 pt-3 mt-1">
                <View className="flex-1 pr-4">
                  <Text className="text-sm font-semibold text-ink">Prefer Window Seats</Text>
                  <Text className="text-xs text-ink/50 leading-4 mt-0.5">
                    We will prioritize seating you at window tables when available.
                  </Text>
                </View>
                <Pressable
                  onPress={() => toggleWindowSeat.mutate()}
                  disabled={toggleWindowSeat.isPending}
                  className={`rounded-full px-4 py-2 border ${
                    profile.prefers_window_seat 
                      ? "bg-amber-100 border-amber-300" 
                      : "bg-white border-ink/10"
                  }`}
                >
                  <Text className={`text-xs font-bold ${profile.prefers_window_seat ? "text-amber-800" : "text-ink/60"}`}>
                    {profile.prefers_window_seat ? "Preferred" : "Off"}
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <View className="gap-4 rounded-2xl border border-amber-300 bg-amber-50/10 p-5">
              <View className="flex-row items-center gap-2">
                <Ionicons name="star-outline" size={22} color="#D97706" />
                <Text className="font-serif text-lg text-ink font-semibold">Unlock Premium</Text>
              </View>
              
              <View className="gap-2">
                <View className="flex-row items-start gap-2">
                  <Ionicons name="flash-outline" size={16} color="#D97706" style={{ marginTop: 2 }} />
                  <Text className="text-sm text-ink/70 flex-1 leading-5">
                    <Text className="font-bold text-ink">Early Access</Text>: Book popular restaurant tables 24 hours before everyone else.
                  </Text>
                </View>
                <View className="flex-row items-start gap-2">
                  <Ionicons name="heart-outline" size={16} color="#D97706" style={{ marginTop: 2 }} />
                  <Text className="text-sm text-ink/70 flex-1 leading-5">
                    <Text className="font-bold text-ink">Priority Matching</Text>: We pair you with highly-rated diners and mutual interests first.
                  </Text>
                </View>
                <View className="flex-row items-start gap-2">
                  <Ionicons name="restaurant-outline" size={16} color="#D97706" style={{ marginTop: 2 }} />
                  <Text className="text-sm text-ink/70 flex-1 leading-5">
                    <Text className="font-bold text-ink">Window Seating</Text>: Set custom seating preferences for your bookings.
                  </Text>
                </View>
              </View>

              <Button
                label={subscribePremium.isPending ? "Redirecting to checkout..." : "Upgrade to Premium ($9.99/mo)"}
                variant="primary"
                loading={subscribePremium.isPending}
                onPress={() => {
                  subscribePremium.mutate(undefined, {
                    onSuccess: async (url) => {
                      const supported = await Linking.canOpenURL(url);
                      if (supported) {
                        await Linking.openURL(url);
                      } else {
                        Alert.alert("Cannot open Stripe Checkout");
                      }
                    },
                    onError: (err) => Alert.alert("Failed to start checkout", err.message),
                  });
                }}
              />
              <Text className="text-center text-xs text-ink/50">
                You'll be redirected to Stripe to complete payment securely.
              </Text>
            </View>
          )
        )}

        {/* Favorite Restaurants Section */}
        <View className="gap-3 rounded-2xl border border-ink/10 bg-white p-5">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              <Ionicons name="heart-outline" size={22} color="#EF4444" />
              <Text className="font-serif text-lg text-ink">Favorite Restaurants</Text>
            </View>
          </View>

          {favorites && favorites.length > 0 ? (
            <View className="gap-2 mt-1">
              {favorites.map((fav: FavoriteRestaurant) => (
                <View key={fav.id} className="flex-row items-center justify-between border-b border-ink/5 pb-2">
                  <View className="flex-1 pr-4">
                    <Text className="text-sm font-semibold text-ink">
                      {fav.restaurant?.name}
                    </Text>
                    <Text className="text-xs text-ink/50" numberOfLines={1}>
                      {fav.restaurant?.neighborhood || "Neighborhood TBA"} · {fav.restaurant?.cuisine?.join(", ")}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => router.push({ pathname: "/stories" })}
                    className="p-1"
                  >
                    <Ionicons name="chevron-forward" size={16} color="#8C7F73" />
                  </Pressable>
                </View>
              ))}
            </View>
          ) : (
            <Text className="text-sm text-ink/50 italic leading-5">
              You haven't favorited any restaurants yet. Heart a restaurant on event pages to see them here!
            </Text>
          )}

          {/* Suggest a Restaurant CTA */}
          <View className="mt-2 border-t border-ink/5 pt-3">
            {showRecommend ? (
              <View className="gap-3">
                <Text className="text-sm font-semibold text-ink">Suggest a New Restaurant</Text>
                
                <View className="gap-1">
                  <Text className="text-xs text-ink/50">Restaurant Name *</Text>
                  <TextInput
                    value={recName}
                    onChangeText={setRecName}
                    placeholder="e.g. L'Artusi"
                    className="rounded-lg border border-ink/10 bg-cream/30 p-2.5 text-sm text-ink"
                  />
                </View>

                <View className="gap-1">
                  <Text className="text-xs text-ink/50">City *</Text>
                  <TextInput
                    value={recCity}
                    onChangeText={setRecCity}
                    placeholder="e.g. New York"
                    className="rounded-lg border border-ink/10 bg-cream/30 p-2.5 text-sm text-ink"
                  />
                </View>

                <View className="gap-1">
                  <Text className="text-xs text-ink/50">Neighborhood (Optional)</Text>
                  <TextInput
                    value={recNeighborhood}
                    onChangeText={setRecNeighborhood}
                    placeholder="e.g. West Village"
                    className="rounded-lg border border-ink/10 bg-cream/30 p-2.5 text-sm text-ink"
                  />
                </View>

                <View className="gap-1">
                  <Text className="text-xs text-ink/50">Why do you recommend it? (Optional)</Text>
                  <TextInput
                    value={recNotes}
                    onChangeText={setRecNotes}
                    placeholder="e.g. Incredible carbonara, perfect for solo diners!"
                    multiline
                    numberOfLines={2}
                    className="rounded-lg border border-ink/10 bg-cream/30 p-2.5 text-sm text-ink min-h-[50px] textAlignVertical-top"
                  />
                </View>

                <View className="flex-row gap-2 mt-1">
                  <View className="flex-1">
                    <Button
                      label="Submit"
                      onPress={handleRecommend}
                      loading={recSubmitting}
                    />
                  </View>
                  <View className="flex-1">
                    <Button
                      label="Cancel"
                      variant="ghost"
                      onPress={() => setShowRecommend(false)}
                    />
                  </View>
                </View>
              </View>
            ) : (
              <Button
                label="Suggest a Restaurant"
                variant="secondary"
                onPress={() => setShowRecommend(true)}
              />
            )}
          </View>
        </View>

        {/* City Expansion Voting Banner */}
        <View className="gap-3 rounded-2xl border border-ink/10 bg-white p-5">
          <View className="flex-row items-center gap-2">
            <Ionicons name="map-outline" size={22} color="#C2410C" />
            <Text className="font-serif text-lg text-ink">City Expansion Voting</Text>
          </View>
          <Text className="text-sm text-ink/60 leading-5">
            Want Table for One in another city? Pledge your interest and help us decide which city to launch next!
          </Text>
          <Button
            label="Vote for Next City"
            variant="secondary"
            onPress={() => router.push("/voting")}
          />
        </View>

        <View className="gap-3 pt-2">
          <Button label="Save changes" onPress={save} loading={update.isPending} />
          {saved && (
            <Text className="text-center text-sm text-sage">Saved!</Text>
          )}
          <Button label="Sign out" variant="ghost" onPress={signOut} />
        </View>
      </View>
    </Screen>
  );
}
