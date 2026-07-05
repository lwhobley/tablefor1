import { ActivityIndicator, FlatList, Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Screen } from "../../components/Screen";
import { useAuth } from "../../lib/auth";
import {
  useProfile,
  useUpcomingEvents,
  useStreak,
  useMyWaitlistNotifications,
  type EventWithRestaurant,
  type WaitlistNotification,
} from "../../lib/queries";
import { StreakBadge } from "../../components/StreakBadge";
import { MysteryBadge } from "../../components/MysteryBadge";
import { isMysteryRevealed, priceTier } from "../../lib/mystery";
import { Ionicons } from "@expo/vector-icons";

function EventCard({ event, isPremium }: { event: EventWithRestaurant; isPremium: boolean }) {
  const router = useRouter();
  
  const publishedTime = event.published_at ? new Date(event.published_at).getTime() : 0;
  const earlyAccessLimit = publishedTime + (event.early_access_hours || 24) * 60 * 60 * 1000;
  const isEarlyAccess = new Date().getTime() < earlyAccessLimit;
  const isLocked = isEarlyAccess && !isPremium;

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
  const revealed = isMysteryRevealed(event);
  return (
    <Pressable
      onPress={() => router.push(`/events/${event.id}`)}
      className="gap-2 rounded-2xl border border-ink/10 bg-white p-5 active:bg-cream"
    >
      <View className="flex-row items-center justify-between">
        <Text className="text-xs uppercase tracking-widest text-rust">
          {event.format.replace("_", " ")}
        </Text>
        <View className="flex-row items-center gap-1.5">
          {isEarlyAccess && (
            <View className={`flex-row items-center gap-1 rounded-full px-2.5 py-0.5 border ${isLocked ? "bg-amber-100 border-amber-300" : "bg-sage/10 border-sage/20"}`}>
              <Ionicons name={isLocked ? "lock-closed-outline" : "lock-open-outline"} size={10} color={isLocked ? "#D97706" : "#166534"} />
              <Text className={`text-[10px] font-bold uppercase tracking-wider ${isLocked ? "text-amber-800" : "text-emerald-800"}`}>
                {isLocked ? "Early Access" : "Unlocked"}
              </Text>
            </View>
          )}
          {event.is_mystery && !revealed && <MysteryBadge event={event} />}
        </View>
      </View>
      <Text className="font-serif text-2xl text-ink">
        {revealed
          ? event.restaurant?.name ?? "Restaurant TBA"
          : `Mystery Dinner ${priceTier(event.price_cents)}`}
      </Text>
      <Text className="text-sm text-ink/60">
        {dateLabel} · {timeLabel}
      </Text>
      <Text className="text-sm text-ink/60">
        {revealed
          ? (event.restaurant?.neighborhood ?? event.city)
          : (event.restaurant?.cuisine?.join(", ") ?? "Cuisine TBA")}
        {" · "}table of {event.group_size}
      </Text>
      <Text className="mt-1 text-sm text-ink/60">
        ${(event.price_cents / 100).toFixed(0)} per seat
      </Text>
    </Pressable>
  );
}

function WaitlistBanner({ entry }: { entry: WaitlistNotification }) {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push(`/events/${entry.event_id}`)}
      className="mb-3 flex-row items-center gap-3 rounded-2xl border border-rust/30 bg-rust/10 p-4 active:bg-rust/20"
    >
      <Ionicons name="flash-outline" size={20} color="#C2410C" />
      <View className="flex-1">
        <Text className="font-semibold text-ink">A spot opened up!</Text>
        <Text className="text-sm text-ink/60">
          {entry.event.restaurant?.name ?? "A dinner"} on your waitlist has a
          free seat — book it before it's gone.
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color="#8C7F73" />
    </Pressable>
  );
}

function EmptyState({ city }: { city: string | null | undefined }) {
  return (
    <View className="mt-8 gap-3 rounded-2xl bg-clay/10 p-6">
      <Text className="font-serif text-xl text-ink">No tables booked yet</Text>
      <Text className="text-sm text-ink/60">
        We're curating dinners in {city ?? "your city"} now. You'll see new
        events here as soon as they open up.
      </Text>
    </View>
  );
}

function StoriesCTA() {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push("/stories")}
      className="mb-3 flex-row items-center justify-between rounded-2xl border border-amber-300 bg-amber-50/50 p-4 active:bg-amber-100/50"
    >
      <View className="flex-row items-center gap-3">
        <Ionicons name="images-outline" size={22} color="#D97706" />
        <View>
          <Text className="font-semibold text-ink">Dinner Stories</Text>
          <Text className="text-xs text-ink/60">See what other tables are eating</Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={18} color="#D97706" />
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
      <View className="gap-2 pb-4">
        <View className="flex-row items-center justify-between">
          <Text className="text-sm text-ink/50">
            Hi {profile?.name ?? "friend"} ·
            {profile?.city ? ` ${profile.city}` : " welcome"}
          </Text>
          <StreakBadge count={streak?.streak_count ?? 0} />
        </View>
        <Text className="font-serif text-3xl text-ink">Upcoming tables</Text>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      ) : (
        <FlatList
          data={events ?? []}
          keyExtractor={(e) => e.id}
          renderItem={({ item }) => <EventCard event={item} isPremium={!!profile?.is_premium} />}
          ItemSeparatorComponent={() => <View className="h-3" />}
          ListHeaderComponent={
            <View>
              {(waitlistNotifications ?? []).map((entry: WaitlistNotification) => (
                <WaitlistBanner key={entry.id} entry={entry} />
              ))}
              <StoriesCTA />
            </View>
          }
          ListEmptyComponent={<EmptyState city={profile?.city} />}
          contentContainerStyle={{ paddingBottom: 24 }}
        />
      )}
    </Screen>
  );
}
