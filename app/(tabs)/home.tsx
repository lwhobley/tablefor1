import { ActivityIndicator, FlatList, Text, View } from "react-native";
import { Screen } from "../../components/Screen";
import { useAuth } from "../../lib/auth";
import { useProfile, useUpcomingEvents } from "../../lib/queries";
import type { EventRow } from "../../lib/supabase";

function EventCard({ event }: { event: EventRow }) {
  const date = new Date(event.starts_at);
  const dateLabel = date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const timeLabel = date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  return (
    <View className="gap-2 rounded-2xl border border-ink/10 bg-white p-5">
      <Text className="text-xs uppercase tracking-widest text-rust">
        {event.format.replace("_", " ")}
      </Text>
      <Text className="font-serif text-2xl text-ink">
        {dateLabel} · {timeLabel}
      </Text>
      <Text className="text-sm text-ink/60">
        {event.city} · table of {event.group_size}
      </Text>
      <Text className="mt-1 text-sm text-ink/60">
        ${(event.price_cents / 100).toFixed(0)} per seat
      </Text>
    </View>
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

export default function Home() {
  const { session } = useAuth();
  const { data: profile } = useProfile(session?.user.id);
  const { data: events, isLoading } = useUpcomingEvents(profile?.city);

  return (
    <Screen scroll={false}>
      <View className="gap-2 pb-4">
        <Text className="text-sm text-ink/50">
          Hi {profile?.name ?? "friend"} ·
          {profile?.city ? ` ${profile.city}` : " welcome"}
        </Text>
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
          renderItem={({ item }) => <EventCard event={item} />}
          ItemSeparatorComponent={() => <View className="h-3" />}
          ListEmptyComponent={<EmptyState city={profile?.city} />}
          contentContainerStyle={{ paddingBottom: 24 }}
        />
      )}
    </Screen>
  );
}
