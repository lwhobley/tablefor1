import { useEffect, useState } from "react";
import {
  Alert,
  ImageBackground,
  Linking,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Screen } from "../../components/Screen";
import { Button } from "../../components/Button";
import { ChipGroup } from "../../components/Chip";
import {
  AVAILABILITY_OPTIONS,
  CITY_OPTIONS,
  INTEREST_OPTIONS,
  VIBE_OPTIONS,
} from "../../components/preferences";
import { useAuth } from "../../lib/auth";
import {
  useDiningPassport,
  useFavoriteRestaurants,
  useProfile,
  useProfileVerification,
  useSubscribePremium,
  useTrustScore,
  useUpdateProfile,
} from "../../lib/queries";

const clubArtwork = require("../../assets/images/intro_dish_two.png");

function Stepper({
  label,
  value,
  suffix,
  step,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  suffix: string;
  step: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <View className="flex-1 gap-2 rounded-lg border border-ink/10 bg-white p-3">
      <Text className="text-xs font-semibold text-muted">{label}</Text>
      <View className="flex-row items-center justify-between">
        <Pressable
          accessibilityLabel={`Decrease ${label}`}
          onPress={() => onChange(Math.max(min, value - step))}
          className="h-9 w-9 items-center justify-center rounded-full bg-ink/5"
        >
          <Ionicons name="remove" size={18} color="#17201C" />
        </Pressable>
        <Text className="text-base font-bold text-ink">{value}{suffix}</Text>
        <Pressable
          accessibilityLabel={`Increase ${label}`}
          onPress={() => onChange(Math.min(max, value + step))}
          className="h-9 w-9 items-center justify-center rounded-full bg-ink/5"
        >
          <Ionicons name="add" size={18} color="#17201C" />
        </Pressable>
      </View>
    </View>
  );
}

function ClubLink({
  icon,
  title,
  detail,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  detail: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center gap-3 border-b border-ink/10 py-4 active:opacity-65"
    >
      <View className="h-10 w-10 items-center justify-center rounded-full bg-sage/15">
        <Ionicons name={icon} size={19} color="#1D5A4A" />
      </View>
      <View className="flex-1">
        <Text className="font-semibold text-ink">{title}</Text>
        <Text className="text-xs leading-4 text-muted">{detail}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color="#68736D" />
    </Pressable>
  );
}

export default function ClubScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.user.id;
  const { data: profile } = useProfile(userId);
  const { data: passport } = useDiningPassport(userId);
  const { data: favorites } = useFavoriteRestaurants(userId);
  const { data: trust } = useTrustScore(userId);
  const { data: verification } = useProfileVerification(userId);
  const updateProfile = useUpdateProfile(userId);
  const subscribePremium = useSubscribePremium(userId);

  const [interests, setInterests] = useState<string[]>([]);
  const [vibes, setVibes] = useState<string[]>([]);
  const [availability, setAvailability] = useState<string[]>([]);
  const [travelCity, setTravelCity] = useState<string[]>([]);
  const [budget, setBudget] = useState(150);
  const [distance, setDistance] = useState(25);

  useEffect(() => {
    if (!profile) return;
    setInterests(profile.interests ?? []);
    setVibes(profile.preferred_vibes ?? []);
    setAvailability(profile.availability ?? []);
    setTravelCity(profile.travel_city ? [profile.travel_city] : []);
    setBudget(Math.round((profile.budget_max_cents || 15000) / 100));
    setDistance(profile.max_distance_km || 25);
  }, [profile]);

  const savePreferences = async () => {
    try {
      await updateProfile.mutateAsync({
        interests,
        preferred_vibes: vibes,
        availability,
        travel_city: travelCity[0] ?? null,
        budget_max_cents: budget * 100,
        max_distance_km: distance,
      });
      Alert.alert("Preferences saved", "Future tables and match explanations will use your updates.");
    } catch (error) {
      Alert.alert("Couldn't save", (error as Error).message);
    }
  };

  const joinPremium = async () => {
    try {
      const url = await subscribePremium.mutateAsync();
      await Linking.openURL(url);
    } catch (error) {
      Alert.alert("Couldn't open Premium", (error as Error).message);
    }
  };

  return (
    <Screen scroll={false}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>
        <View className="mb-6 overflow-hidden rounded-lg bg-ink">
          <ImageBackground source={clubArtwork} resizeMode="cover" style={{ height: 210 }}>
            <View className="flex-1 justify-end bg-black/45 p-5">
              <Text className="text-xs font-bold uppercase text-white/75">Your membership</Text>
              <Text className="font-serif text-3xl text-white">The Table for 2 Club</Text>
              <Text className="mt-1 max-w-lg text-sm leading-5 text-white/80">
                Better matches, safer dinners, and a record of every table you have shared.
              </Text>
            </View>
          </ImageBackground>
        </View>

        <View className="mb-7 flex-row gap-2">
          <View className="flex-1 items-center gap-1 border-r border-ink/10 py-2">
            <Text className="font-serif text-2xl text-ink">{passport?.length ?? 0}</Text>
            <Text className="text-xs text-muted">Dinners</Text>
          </View>
          <View className="flex-1 items-center gap-1 border-r border-ink/10 py-2">
            <Text className="font-serif text-2xl text-ink">{favorites?.length ?? 0}</Text>
            <Text className="text-xs text-muted">Favorites</Text>
          </View>
          <View className="flex-1 items-center gap-1 py-2">
            <Text className="font-serif text-2xl text-ink">{trust?.trust_score ?? 100}</Text>
            <Text className="text-xs text-muted">Trust score</Text>
          </View>
        </View>

        <View className="mb-8 gap-4">
          <View className="gap-1">
            <Text className="font-serif text-2xl text-ink">Your matching profile</Text>
            <Text className="text-sm leading-5 text-muted">
              These signals explain why a table fits and help balance your dinner group.
            </Text>
          </View>

          <View className="gap-2">
            <Text className="text-xs font-bold uppercase text-muted">Interests</Text>
            <View className="flex-row flex-wrap gap-2">
              <ChipGroup options={INTEREST_OPTIONS} values={interests} onChange={setInterests} />
            </View>
          </View>

          <View className="gap-2">
            <Text className="text-xs font-bold uppercase text-muted">Dinner vibe</Text>
            <View className="flex-row flex-wrap gap-2">
              <ChipGroup options={VIBE_OPTIONS} values={vibes} onChange={setVibes} />
            </View>
          </View>

          <View className="gap-2">
            <Text className="text-xs font-bold uppercase text-muted">Availability</Text>
            <View className="flex-row flex-wrap gap-2">
              <ChipGroup options={AVAILABILITY_OPTIONS} values={availability} onChange={setAvailability} />
            </View>
          </View>

          <View className="flex-row gap-3">
            <Stepper label="Dinner budget" value={budget} suffix=" USD" step={25} min={25} max={500} onChange={setBudget} />
            <Stepper label="Travel radius" value={distance} suffix=" km" step={5} min={5} max={100} onChange={setDistance} />
          </View>

          <View className="gap-2">
            <View className="flex-row items-center justify-between">
              <Text className="text-xs font-bold uppercase text-muted">Travel mode</Text>
              {travelCity.length > 0 && (
                <Pressable onPress={() => setTravelCity([])}>
                  <Text className="text-xs font-semibold text-rust">Turn off</Text>
                </Pressable>
              )}
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View className="flex-row gap-2 pb-1">
                <ChipGroup options={CITY_OPTIONS} values={travelCity} onChange={setTravelCity} multi={false} />
              </View>
            </ScrollView>
            <Text className="text-xs text-muted">
              {travelCity[0] ? `Discovering tables in ${travelCity[0]}.` : `Showing tables near ${profile?.city ?? "home"}.`}
            </Text>
          </View>

          <Button label="Save matching profile" loading={updateProfile.isPending} onPress={savePreferences} />
        </View>

        <View className="mb-8">
          <Text className="mb-1 font-serif text-2xl text-ink">Member tools</Text>
          <ClubLink icon="map-outline" title="Dining passport" detail="Restaurants, cuisines, neighborhoods, and memories" onPress={() => router.push("/passport")} />
          <ClubLink icon="shield-checkmark-outline" title="Trust and safety" detail={verification?.status === "verified" ? "Identity verified" : "Verification, reports, and blocked diners"} onPress={() => router.push("/safety")} />
          <ClubLink icon="sparkles-outline" title="Reconnect" detail="Invite a mutual Spark to another dinner" onPress={() => router.push("/matches/reconnect")} />
          <ClubLink icon="earth-outline" title="Bring Table for 2 to a city" detail="Vote for the next community launch" onPress={() => router.push("/voting")} />
        </View>

        <View className={`gap-4 rounded-lg p-5 ${profile?.is_premium ? "bg-forest" : "bg-ink"}`}>
          <View className="flex-row items-start justify-between gap-4">
            <View className="flex-1 gap-1">
              <Text className="text-xs font-bold uppercase text-white/60">Table for 2 Premium</Text>
              <Text className="font-serif text-2xl text-white">
                {profile?.is_premium ? "Your best tables, unlocked" : "Make every dinner count"}
              </Text>
            </View>
            <Ionicons name="diamond-outline" size={26} color="#FFFFFF" />
          </View>
          <View className="gap-2">
            {["Signature Tables and early access", "Advanced matching and Dinner Roulette", "Private tables, travel planning, and concierge"].map((benefit) => (
              <View key={benefit} className="flex-row items-center gap-2">
                <Ionicons name="checkmark-circle" size={16} color="#FFFFFF" />
                <Text className="flex-1 text-sm text-white/80">{benefit}</Text>
              </View>
            ))}
          </View>
          {profile?.is_premium ? (
            <Button label="Ask the dining concierge" variant="secondary" onPress={() => router.push("/concierge")} />
          ) : (
            <Button label="Join Premium" variant="secondary" loading={subscribePremium.isPending} onPress={joinPremium} />
          )}
        </View>
      </ScrollView>
    </Screen>
  );
}
