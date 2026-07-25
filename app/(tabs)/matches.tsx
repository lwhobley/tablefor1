import { View, Text, FlatList, ActivityIndicator, Pressable, Image } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/lib/auth";
import { useMyMatches, type MatchWithDiners } from "@/lib/queries";
import { isMysteryRevealed } from "@/lib/mystery";
import { Screen } from "@/components/Screen";
import { Button } from "@/components/Button";
import { Ionicons } from "@expo/vector-icons";

function MatchCard({ match }: { match: MatchWithDiners }) {
  const router = useRouter();
  const dinerNames = match.diners.map((d) => d.name).join(" · ");
  const eventDate = new Date(match.event.event_date);
  const isPast = eventDate < new Date();
  const isRevealed = !!match.revealed_at;

  return (
    <Pressable
      onPress={() => router.push(`/matches/${match.id}`)}
      className="gap-3 rounded-xl border border-ink/10 bg-white p-4 active:bg-cream"
    >
      {/* Restaurant and status */}
      <View className="flex-row items-start justify-between">
        <View className="flex-1">
          <Text className="font-semibold text-ink">
            {isMysteryRevealed(match.event)
              ? match.event.restaurant?.name ?? "Restaurant TBA"
              : "Mystery Dinner"}
          </Text>
          <Text className="text-xs text-ink/60">
            {isMysteryRevealed(match.event)
              ? match.event.restaurant?.neighborhood ?? match.event.city
              : "Location revealed before dinner"}
          </Text>
        </View>
        <View className="rounded-full bg-sage/10 px-3 py-1">
          <Text className="text-xs font-medium text-sage">
            {isRevealed ? "Matched" : "Pending"}
          </Text>
        </View>
      </View>

      {/* Date and time */}
      <View className="flex-row items-center gap-2">
        <Ionicons name="calendar-outline" size={14} color="#8C7F73" />
        <Text className="text-sm text-ink/70">
          {eventDate.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          })} at{" "}
          {eventDate.toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </Text>
      </View>

      {/* Diners */}
      {isRevealed ? (
        <View>
          <View className="flex-row gap-2 mb-2">
            {match.diners.slice(0, 3).map((d) => (
              <View
                key={d.id}
                className="h-10 w-10 rounded-full bg-cream items-center justify-center border-2 border-white"
              >
                {d.photo_url ? (
                  <Image
                    source={{ uri: d.photo_url }}
                    className="h-10 w-10 rounded-full"
                  />
                ) : (
                  <Ionicons
                    name="person-circle"
                    size={40}
                    color="#C2410C"
                  />
                )}
              </View>
            ))}
            {match.diners.length > 3 && (
              <View className="h-10 w-10 rounded-full bg-rust/20 items-center justify-center">
                <Text className="text-xs font-bold text-rust">
                  +{match.diners.length - 3}
                </Text>
              </View>
            )}
          </View>
          <Text className="text-xs text-ink/60">{dinerNames}</Text>
        </View>
      ) : (
        <Text className="text-sm text-ink/70">
          Profiles reveal 24 hours before dinner
        </Text>
      )}

      {/* Action buttons */}
      <View className="mt-2 flex-row gap-2">
        {isRevealed && !isPast && (
          <Button
            label="Message"
            variant="secondary"
            onPress={() => router.push(`/matches/${match.id}`)}
          />
        )}
        {isPast && (
          <Button
            label="Leave feedback"
            variant="secondary"
            onPress={() => router.push(`/feedback/${match.id}`)}
          />
        )}
      </View>
    </Pressable>
  );
}

function EmptyState() {
  const router = useRouter();
  return (
    <View className="flex-1 items-center justify-center px-4">
      <View className="mb-6 h-16 w-16 items-center justify-center rounded-full bg-cream">
        <Ionicons name="people-outline" size={32} color="#C2410C" />
      </View>
      <Text className="mb-2 font-serif text-xl text-ink">No matches yet</Text>
      <Text className="mb-6 text-center text-sm text-ink/70">
        Book a seat at a table and you'll be matched with other diners 24 hours before dinner
      </Text>
      <Button
        label="Browse tables"
        onPress={() => router.push("/(tabs)/home")}
      />
    </View>
  );
}

function ReconnectCTA() {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push("/matches/reconnect")}
      className="mb-4 flex-row items-center justify-between rounded-2xl border border-rust/20 bg-rust/5 p-4 active:bg-rust/10"
    >
      <View className="flex-row items-center gap-3">
        <Ionicons name="sparkles-outline" size={22} color="#C2410C" />
        <View>
          <Text className="font-semibold text-ink">Reconnect with Sparks</Text>
          <Text className="text-xs text-ink/60">Schedule 1-on-1 dinners with past sparks</Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={18} color="#C2410C" />
    </Pressable>
  );
}

export default function Matches() {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const { data: matches, isLoading } = useMyMatches(userId);

  return (
    <Screen scroll={false}>
      {/* Header */}
      <View className="gap-2 pb-4">
        <Text className="text-sm text-ink/50">Your matches</Text>
        <Text className="font-serif text-3xl text-ink">Dinner groups</Text>
      </View>

      <ReconnectCTA />

      {/* List */}
      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#C2410C" />
        </View>
      ) : (matches ?? []).length === 0 ? (
        <EmptyState />
      ) : (
        <FlatList
          data={matches}
          keyExtractor={(m) => m.id}
          renderItem={({ item }) => <MatchCard match={item} />}
          ItemSeparatorComponent={() => <View className="h-3" />}
          contentContainerStyle={{ paddingBottom: 24 }}
        />
      )}
    </Screen>
  );
}
