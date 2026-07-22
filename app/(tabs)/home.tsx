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
import {
  getEventArtwork,
  homeHeroArtwork,
  rouletteArtwork,
  storyArtwork,
} from "../../components/event-artwork";
import { useAuth } from "../../lib/auth";
import {
  useProfile,
  useUpcomingEvents,
  useStreak,
  useMyWaitlistNotifications,
  useRouletteOptInStatus,
  useOptInRoulette,
  useOptOutRoulette,
  useCycleRouletteOption,
  type EventWithRestaurant,
  type WaitlistNotification,
} from "../../lib/queries";
import { isMysteryRevealed, priceTier } from "../../lib/mystery";
import { getEventMatchFit } from "../../lib/matchValue";
import type { Profile } from "../../lib/supabase";

function formatLabel(format: string) {
  return format.replaceAll("_", " ");
}

function EventCard({
  event,
  profile,
  artworkIndex,
}: {
  event: EventWithRestaurant;
  profile: Profile | undefined;
  artworkIndex: number;
}) {
  const router = useRouter();
  const isPremium = !!profile?.is_premium;
  const fit = getEventMatchFit(profile, event);
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
        source={getEventArtwork(event, artworkIndex)}
        resizeMode="cover"
        imageStyle={{ width: "100%", height: "100%", objectFit: "cover" }}
        style={{ height: 184 }}
      >
        <View className="flex-1 justify-between p-3">
          <View className="flex-row items-start justify-between gap-2">
            <View className="gap-2">
              <View className="self-start rounded-full bg-black/70 px-3 py-1.5">
                <Text className="text-[10px] font-bold uppercase text-white">
                  {formatLabel(event.format)}
                </Text>
              </View>
              {event.is_signature && (
                <View className="self-start flex-row items-center gap-1 rounded-full bg-white/95 px-2.5 py-1">
                  <Ionicons name="diamond" size={10} color="#B5462D" />
                  <Text className="text-[10px] font-bold text-rust">Signature Table</Text>
                </View>
              )}
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
            <Text className="text-xs font-bold uppercase text-rust">
              {event.theme ?? formatLabel(event.format)}
            </Text>
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

        <View className="flex-row items-center gap-2 rounded-md bg-sage/10 px-3 py-2">
          <View className="h-8 w-8 items-center justify-center rounded-full bg-forest">
            <Text className="text-[11px] font-bold text-white">{fit.score}%</Text>
          </View>
          <View className="flex-1">
            <Text className="text-xs font-semibold text-forest">Why it fits you</Text>
            <Text className="text-xs text-muted">{fit.reasons[0]}</Text>
          </View>
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

function RouletteBanner({
  profile,
  userId,
  events,
}: {
  profile: Profile | undefined;
  userId: string | undefined;
  events: EventWithRestaurant[];
}) {
  const router = useRouter();
  const dateString = new Date().toISOString().split("T")[0];
  const { data: optIn } = useRouletteOptInStatus(userId, dateString);
  const optInRoulette = useOptInRoulette(userId);
  const optOutRoulette = useOptOutRoulette(userId);
  const cycleOption = useCycleRouletteOption(userId);

  if (!profile) return null;
  const isPremium = !!profile.is_premium;
  const optionWindowEnd = Date.now() + 14 * 24 * 60 * 60 * 1000;
  const options = events.filter((event) => {
    const eventTime = new Date(event.event_date).getTime();
    return eventTime >= Date.now() && eventTime <= optionWindowEnd && (event.spots_left ?? 0) > 0;
  });

  const isActiveOptIn = optIn?.status === "pending";
  const candidateIndex = Math.max(
    0,
    options.findIndex((event) => event.id === optIn?.preferred_event_id),
  );
  const candidate = options[candidateIndex];
  const nextCandidate = options.length > 1 ? options[(candidateIndex + 1) % options.length] : undefined;

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
        if (isActiveOptIn && optIn) {
          await optOutRoulette.mutateAsync({ optInId: optIn.id, date: dateString });
          Alert.alert("Opted Out", "You opted out of Dinner Roulette for tonight.");
        } else {
          if (optIn?.status === "expired") {
            await optOutRoulette.mutateAsync({ optInId: optIn.id, date: dateString });
          }
          await optInRoulette.mutateAsync({
          city: profile.travel_city || profile.city,
          date: dateString,
          preferredEventId: options[0]?.id,
        });
        Alert.alert("You're In", "We'll search upcoming open seats and prioritize the table shown in Roulette.");
      }
    } catch (err) {
      Alert.alert("Error", (err as Error).message);
    }
  };

  const handleCycle = async () => {
    if (!optIn || !nextCandidate) return;
    try {
      await cycleOption.mutateAsync({
        optInId: optIn.id,
        date: dateString,
        currentEventId: candidate?.id,
        nextEventId: nextCandidate.id,
        passedEventIds: optIn.passed_event_ids ?? [],
      });
    } catch (err) {
      Alert.alert("Couldn't load another option", (err as Error).message);
    }
  };

  return (
    <ImageBackground
      source={rouletteArtwork}
      resizeMode="cover"
      imageStyle={{ borderRadius: 8, width: "100%", height: "100%", objectFit: "cover" }}
      className="overflow-hidden rounded-lg"
    >
      <View className="gap-4 rounded-lg bg-black/70 p-4">
      <View className="flex-row items-center gap-3">
        <View className="h-11 w-11 items-center justify-center rounded-full bg-white/10">
          <Ionicons
              name={optIn?.status === "matched" ? "checkmark" : isActiveOptIn ? "hourglass" : "shuffle"}
            size={21}
            color="#FFFFFF"
          />
        </View>
        <View className="flex-1 gap-0.5">
          <View className="flex-row items-center gap-2">
            <Text className="font-semibold text-white">
              {optIn?.status === "matched"
                ? "Your roulette table is ready"
                  : isActiveOptIn
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
                : isActiveOptIn
                ? "We're looking for the right open seat."
                : "Feeling spontaneous? Let us choose the table."}
          </Text>
        </View>
          {(!isActiveOptIn || optIn?.status === "matched") && (
            <Pressable onPress={handleToggle} className="rounded-full bg-white px-3 py-2 active:opacity-75">
              <Text className="text-xs font-bold text-ink">{optIn?.status === "matched" ? "View" : "Join"}</Text>
          </Pressable>
        )}
      </View>

      {optIn?.status === "pending" && candidate && (
        <View className="gap-3 border-t border-white/15 pt-4">
          <View className="flex-row items-start justify-between gap-3">
            <View className="flex-1 gap-1">
              <Text className="text-[10px] font-bold uppercase text-white/55">Current option</Text>
              <Text className="font-serif text-lg text-white">
                {candidate.theme ?? candidate.restaurant?.name ?? "Curated dinner"}
              </Text>
              <Text className="text-xs text-white/65">
                {new Date(candidate.event_date).toLocaleDateString(undefined, {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                  })} | {candidate.restaurant?.neighborhood ?? candidate.city} | ${(candidate.price_cents / 100).toFixed(0)}
              </Text>
            </View>
            <Pressable
              accessibilityLabel="View current Roulette option"
              onPress={() => router.push(`/events/${candidate.id}`)}
              className="h-10 w-10 items-center justify-center rounded-full bg-white/10 active:bg-white/20"
            >
              <Ionicons name="open-outline" size={18} color="#FFFFFF" />
            </Pressable>
          </View>

          <View className="flex-row gap-2">
            <Pressable
              onPress={handleCycle}
              disabled={!nextCandidate || cycleOption.isPending}
              className="flex-1 flex-row items-center justify-center gap-2 rounded-lg bg-white px-3 py-3 active:opacity-80 disabled:opacity-40"
            >
              {cycleOption.isPending ? (
                <ActivityIndicator size="small" color="#17201C" />
              ) : (
                <Ionicons name="shuffle" size={17} color="#17201C" />
              )}
              <Text className="text-sm font-bold text-ink">Next option</Text>
            </Pressable>
            <Pressable
              onPress={handleToggle}
              disabled={optOutRoulette.isPending}
              className="items-center justify-center rounded-lg border border-white/20 px-4 py-3 active:bg-white/10"
            >
              <Text className="text-sm font-semibold text-white/75">Leave</Text>
            </Pressable>
          </View>
        </View>
      )}

      {optIn?.status === "pending" && !candidate && (
        <View className="flex-row items-center gap-3 border-t border-white/15 pt-4">
          <Text className="flex-1 text-xs leading-4 text-white/65">
            No open alternatives are posted for the next two weeks yet. Your search will stay active.
          </Text>
          <Pressable
            onPress={handleToggle}
            disabled={optOutRoulette.isPending}
            className="rounded-lg border border-white/20 px-4 py-3 active:bg-white/10"
          >
            <Text className="text-sm font-semibold text-white/75">Leave</Text>
          </Pressable>
        </View>
      )}
      </View>
    </ImageBackground>
  );
}

function StoriesCTA() {
  const router = useRouter();
  return (
    <Pressable onPress={() => router.push("/stories")} className="overflow-hidden rounded-lg active:opacity-90">
      <ImageBackground
        source={storyArtwork}
        resizeMode="cover"
        imageStyle={{ width: "100%", height: "100%", objectFit: "cover" }}
        style={{ height: 128 }}
      >
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
  const activeCity = profile?.travel_city || profile?.city;
  const { data: events, isLoading } = useUpcomingEvents(activeCity);
  const { data: waitlistNotifications } = useMyWaitlistNotifications(session?.user.id);

  return (
    <Screen scroll={false}>
      <View className="pb-5">
        <ImageBackground
          source={homeHeroArtwork}
          resizeMode="cover"
          imageStyle={{ borderRadius: 8, width: "100%", height: "100%", objectFit: "cover" }}
          style={{ height: 220 }}
          className="overflow-hidden rounded-lg"
        >
          <View className="flex-1 justify-between rounded-lg bg-black/45 p-4">
            <View className="flex-row items-center justify-between gap-3">
              <View className="flex-row items-center gap-3">
                <View className="h-11 w-11 items-center justify-center overflow-hidden rounded-full border border-white/30 bg-white/20">
                  {profile?.photo_url ? (
                    <Image source={{ uri: profile.photo_url }} className="h-11 w-11" />
                  ) : (
                    <Ionicons name="person" size={20} color="#FFFFFF" />
                  )}
                </View>
                <View>
                  <Text className="text-xs font-semibold uppercase text-white/70">Welcome back</Text>
                  <Text className="text-base font-semibold text-white">{profile?.name ?? "Friend"}</Text>
                </View>
              </View>
              <StreakBadge count={streak?.streak_count ?? 0} />
            </View>

            <View className="gap-2">
              {activeCity && (
                <View className="self-start flex-row items-center gap-1 rounded-full bg-white/90 px-2.5 py-1">
                  <Ionicons
                    name={profile?.travel_city ? "airplane" : "location"}
                    size={11}
                    color="#1D5A4A"
                  />
                  <Text className="text-xs font-semibold text-forest">{activeCity}</Text>
                </View>
              )}
              <Text className="font-serif text-3xl text-white">Upcoming tables</Text>
              <Text className="max-w-md text-sm leading-5 text-white/80">
                Curated places, thoughtful matches, one shared table.
              </Text>
            </View>
          </View>
        </ImageBackground>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#1D5A4A" />
        </View>
      ) : (
        <FlatList
          data={events ?? []}
          keyExtractor={(event) => event.id}
          renderItem={({ item, index }) => (
            <EventCard event={item} profile={profile} artworkIndex={index} />
          )}
          ItemSeparatorComponent={() => <View className="h-4" />}
          ListHeaderComponent={
            <View className="gap-3 pb-5">
              {(waitlistNotifications ?? []).map((entry: WaitlistNotification) => (
                <WaitlistBanner key={entry.id} entry={entry} />
              ))}
              <RouletteBanner profile={profile} userId={session?.user.id} events={events ?? []} />
              <StoriesCTA />
              <View className="flex-row items-center justify-between pt-2">
                <Text className="text-xs font-bold uppercase text-muted">Available experiences</Text>
                <Text className="text-xs text-muted">{events?.length ?? 0} tables</Text>
              </View>
            </View>
          }
          ListEmptyComponent={<EmptyState city={activeCity} />}
          contentContainerStyle={{ paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </Screen>
  );
}
