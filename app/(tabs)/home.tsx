import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  ImageBackground,
  Pressable,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "../../components/Screen";
import { StreakBadge } from "../../components/StreakBadge";
import { MysteryBadge } from "../../components/MysteryBadge";
import { getEventArtwork, storyArtwork } from "../../components/event-artwork";
import { useAuth } from "../../lib/auth";
import {
  useProfile,
  useUpcomingEvents,
  useStreak,
  useMyWaitlistNotifications,
  useRouletteOptInStatus,
  useOptInRoulette,
  useOptOutRoulette,
  type EventWithRestaurant,
  type WaitlistNotification,
} from "../../lib/queries";
import { isMysteryRevealed, priceTier } from "../../lib/mystery";

function formatLabel(format: string) {
  return format.replaceAll("_", " ");
}

function EventCard({ event, isPremium }: { event: EventWithRestaurant; isPremium: boolean }) {
  const router = useRouter();
  const publishedTime = event.published_at ? new Date(event.published_at).getTime() : 0;
  const earlyAccessLimit = publishedTime + (event.early_access_hours || 24) * 60 * 60 * 1000;
  const isEarlyAccess = Date.now() < earlyAccessLimit;
  const isLocked = isEarlyAccess && !isPremium;
  const revealed = isMysteryRevealed(event);
  const date = new Date(event.event_date);
  const dateLabel = date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const timeLabel = date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  const location = revealed
    ? event.restaurant?.neighborhood ?? event.city
    : "Location revealed before dinner";

  return (
    <Pressable
      onPress={() => router.push(`/events/${event.id}`)}
      accessibilityRole="button"
      accessibilityLabel={`View ${event.restaurant?.name ?? "mystery dinner"}`}
      className="overflow-hidden rounded-lg border border-ink/10 bg-white active:opacity-90"
    >
      <ImageBackground
        source={getEventArtwork(event)}
        resizeMode="cover"
        style={{ height: 184 }}
      >
        <View className="flex-1 justify-between p-3">
          <View className="flex-row items-start justify-between gap-2">
            <View className="rounded-full bg-black/70 px-3 py-1.5">
              <Text className="text-[10px] font-bold uppercase text-white">
                {formatLabel(event.format)}
              </Text>
            </View>
            <View className="items-end gap-2">
              {event.is_mystery && !revealed && <MysteryBadge event={event} />}
              {isEarlyAccess && (
                <View className="flex-row items-center gap-1 rounded-full bg-white/95 px-2.5 py-1">
                  <Ionicons
                    name={isLocked ? "lock-closed" : "lock-open"}
                    size={11}
                    color={isLocked ? "#B5462D" : "#1D5A4A"}
                  />
                  <Text className="text-[10px] font-bold text-ink">
                    {isLocked ? "Premium first" : "Early access"}
                  </Text>
                </View>
              )}
            </View>
          </View>
          <View className="self-start rounded-md bg-black/65 px-3 py-2">
            <Text className="text-xs font-semibold text-white">{dateLabel}</Text>
            <Text className="text-[11px] text-white/80">{timeLabel}</Text>
          </View>
        </View>
      </ImageBackground>

      <View className="gap-3 p-4">
        <View className="flex-row items-start justify-between gap-4">
          <View className="flex-1 gap-1">
            <Text className="font-serif text-xl text-ink">
              {revealed
                ? event.restaurant?.name ?? "Restaurant TBA"
                : `Mystery Dinner ${priceTier(event.price_cents)}`}
            </Text>
            <View className="flex-row items-center gap-1.5">
              <Ionicons name="location-outline" size={14} color="#68736D" />
              <Text className="flex-1 text-sm text-muted">{location}</Text>
            </View>
          </View>
          <Text className="text-base font-bold text-ink">
            ${(event.price_cents / 100).toFixed(0)}
          </Text>
        </View>

        <View className="flex-row items-center gap-4 border-t border-ink/10 pt-3">
          <View className="flex-row items-center gap-1.5">
            <Ionicons name="people-outline" size={15} color="#1D5A4A" />
            <Text className="text-xs font-medium text-ink">Table of {event.group_size}</Text>
          </View>
          <View className="flex-row items-center gap-1.5">
            <Ionicons name="restaurant-outline" size={15} color="#1D5A4A" />
            <Text className="text-xs font-medium text-ink">
              {event.spots_left ?? event.group_size} seats left
            </Text>
          </View>
          <Ionicons name="arrow-forward" size={17} color="#B5462D" style={{ marginLeft: "auto" }} />
        </View>
      </View>
    </Pressable>
  );
}

function WaitlistBanner({ entry }: { entry: WaitlistNotification }) {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push(`/events/${entry.event_id}`)}
      className="flex-row items-center gap-3 rounded-lg border border-rust/25 bg-white p-4 active:opacity-90"
    >
      <View className="h-10 w-10 items-center justify-center rounded-full bg-rust/10">
        <Ionicons name="flash" size={19} color="#B5462D" />
      </View>
      <View className="flex-1">
        <Text className="font-semibold text-ink">A seat just opened</Text>
        <Text className="text-sm leading-5 text-muted">
          {entry.event.restaurant?.name ?? "A waitlisted dinner"} is available now.
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color="#68736D" />
    </Pressable>
  );
}

function EmptyState({ city }: { city: string | null | undefined }) {
  return (
    <View className="items-center gap-3 px-6 py-16">
      <View className="h-14 w-14 items-center justify-center rounded-full bg-sage/15">
        <Ionicons name="restaurant-outline" size={26} color="#1D5A4A" />
      </View>
      <Text className="font-serif text-xl text-ink">The next table is being set</Text>
      <Text className="text-center text-sm leading-5 text-muted">
        New experiences in {city ?? "your city"} will appear here as soon as they open.
      </Text>
    </View>
  );
}

function RouletteBanner({ profile, userId }: { profile: any; userId: string | undefined }) {
  const router = useRouter();
  const dateString = new Date().toISOString().split("T")[0];
  const { data: optIn } = useRouletteOptInStatus(userId, dateString);
  const optInRoulette = useOptInRoulette(userId);
  const optOutRoulette = useOptOutRoulette(userId);

  if (!profile) return null;
  const isPremium = !!profile.is_premium;

  const handleToggle = async () => {
    if (optIn?.status === "matched") {
      router.push("/bookings");
      return;
    }
    if (!isPremium) {
      Alert.alert(
        "Premium Feature",
        "Upgrade to Premium to join Dinner Roulette and get matched with open tables.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Upgrade", onPress: () => router.push("/profile") },
        ],
      );
      return;
    }
    try {
      if (optIn) {
        await optOutRoulette.mutateAsync(dateString);
        Alert.alert("Opted Out", "You opted out of Dinner Roulette for tonight.");
      } else {
        await optInRoulette.mutateAsync({ city: profile.city, date: dateString });
        Alert.alert("You're In", "We'll search for an open table and match you by 5 PM.");
      }
    } catch (err) {
      Alert.alert("Error", (err as Error).message);
    }
  };

  return (
    <Pressable
      onPress={handleToggle}
      className="rounded-lg bg-ink p-4 active:opacity-90"
    >
      <View className="flex-row items-center gap-3">
        <View className="h-11 w-11 items-center justify-center rounded-full bg-white/10">
          <Ionicons
            name={optIn?.status === "matched" ? "checkmark" : optIn ? "hourglass" : "shuffle"}
            size={21}
            color="#FFFFFF"
          />
        </View>
        <View className="flex-1 gap-0.5">
          <View className="flex-row items-center gap-2">
            <Text className="font-semibold text-white">
              {optIn?.status === "matched"
                ? "Your roulette table is ready"
                : optIn
                  ? "Roulette search is active"
                  : "Tonight's Dinner Roulette"}
            </Text>
            {!isPremium && (
              <View className="rounded-full bg-clay px-2 py-0.5">
                <Text className="text-[9px] font-bold uppercase text-ink">Premium</Text>
              </View>
            )}
          </View>
          <Text className="text-xs leading-4 text-white/65">
            {optIn?.status === "matched"
              ? "Tap to see the booking."
              : optIn
                ? "We're looking for the right open seat."
                : "Feeling spontaneous? Let us choose the table."}
          </Text>
        </View>
        <View className="rounded-full bg-white px-3 py-1.5">
          <Text className="text-xs font-bold text-ink">
            {optIn ? (optIn.status === "matched" ? "View" : "Leave") : "Join"}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

function StoriesCTA() {
  const router = useRouter();
  return (
    <Pressable onPress={() => router.push("/stories")} className="overflow-hidden rounded-lg active:opacity-90">
      <ImageBackground source={storyArtwork} resizeMode="cover" style={{ height: 128 }}>
        <View className="flex-1 flex-row items-end justify-between bg-black/50 p-4">
          <View className="flex-1 gap-1 pr-4">
            <Text className="text-xs font-bold uppercase text-white/75">From the community</Text>
            <Text className="font-serif text-xl text-white">Dinner Stories</Text>
            <Text className="text-xs text-white/75">See what happens after strangers share a table.</Text>
          </View>
          <View className="h-9 w-9 items-center justify-center rounded-full bg-white">
            <Ionicons name="arrow-forward" size={18} color="#17201C" />
          </View>
        </View>
      </ImageBackground>
    </Pressable>
  );
}

export default function Home() {
  const { session } = useAuth();
  const { data: profile } = useProfile(session?.user.id);
  const { data: streak } = useStreak(session?.user.id);
  const { data: events, isLoading } = useUpcomingEvents(profile?.city);
  const { data: waitlistNotifications } = useMyWaitlistNotifications(session?.user.id);

  return (
    <Screen scroll={false}>
      <View className="gap-4 pb-5">
        <View className="flex-row items-center justify-between gap-3">
          <View className="flex-row items-center gap-3">
            <View className="h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-sage/20">
              {profile?.photo_url ? (
                <Image source={{ uri: profile.photo_url }} className="h-11 w-11" />
              ) : (
                <Ionicons name="person" size={20} color="#1D5A4A" />
              )}
            </View>
            <View>
              <Text className="text-xs font-semibold uppercase text-muted">Welcome back</Text>
              <Text className="text-base font-semibold text-ink">{profile?.name ?? "Friend"}</Text>
            </View>
          </View>
          <StreakBadge count={streak?.streak_count ?? 0} />
        </View>

        <View className="gap-1">
          <View className="flex-row items-end justify-between gap-3">
            <Text className="flex-1 font-serif text-3xl text-ink">Upcoming tables</Text>
            {profile?.city && (
              <View className="mb-1 flex-row items-center gap-1 rounded-full bg-sage/15 px-2.5 py-1">
                <Ionicons name="location" size={11} color="#1D5A4A" />
                <Text className="text-xs font-semibold text-forest">{profile.city}</Text>
              </View>
            )}
          </View>
          <Text className="text-sm text-muted">Curated places, thoughtful matches, one shared table.</Text>
        </View>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#1D5A4A" />
        </View>
      ) : (
        <FlatList
          data={events ?? []}
          keyExtractor={(event) => event.id}
          renderItem={({ item }) => <EventCard event={item} isPremium={!!profile?.is_premium} />}
          ItemSeparatorComponent={() => <View className="h-4" />}
          ListHeaderComponent={
            <View className="gap-3 pb-5">
              {(waitlistNotifications ?? []).map((entry: WaitlistNotification) => (
                <WaitlistBanner key={entry.id} entry={entry} />
              ))}
              <RouletteBanner profile={profile} userId={session?.user.id} />
              <StoriesCTA />
              <View className="flex-row items-center justify-between pt-2">
                <Text className="text-xs font-bold uppercase text-muted">Available experiences</Text>
                <Text className="text-xs text-muted">{events?.length ?? 0} tables</Text>
              </View>
            </View>
          }
          ListEmptyComponent={<EmptyState city={profile?.city} />}
          contentContainerStyle={{ paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </Screen>
  );
}
