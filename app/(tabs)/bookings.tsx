import { useState } from "react";
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  Pressable,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/lib/auth";
import { useUserBookings, useCancelBooking, useMyStoryForEvent, type UserBooking } from "@/lib/queries";
import { Screen } from "@/components/Screen";
import { Button } from "@/components/Button";
import { MysteryBadge } from "@/components/MysteryBadge";
import { isMysteryRevealed, priceTier } from "@/lib/mystery";
import { Ionicons } from "@expo/vector-icons";

type FilterType = "upcoming" | "past";

function BookingCard({
  booking,
  onCancel,
}: {
  booking: UserBooking;
  onCancel: () => void;
}) {
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.user?.id;
  const { data: myStory } = useMyStoryForEvent(booking.event_id, userId);

  const eventDate = new Date(booking.event.event_date);
  const isPast = eventDate < new Date();
  const isWithin48h =
    !isPast &&
    (eventDate.getTime() - new Date().getTime()) / (1000 * 60 * 60) < 48;

  const dateLabel = eventDate.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const timeLabel = eventDate.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const statusColor =
    booking.status === "confirmed"
      ? "text-sage"
      : booking.status === "cancelled"
        ? "text-clay"
        : "text-clay/60";

  const canCancel =
    booking.status === "pending" && !isPast && !isWithin48h;
  const revealed = isMysteryRevealed(booking.event);

  return (
    <Pressable
      onPress={() => router.push(`/events/${booking.event_id}`)}
      className="gap-3 rounded-xl border border-ink/10 bg-white p-4 active:bg-cream"
    >
      {/* Header with restaurant and status */}
      <View className="flex-row items-start justify-between">
        <View className="flex-1 gap-1">
          <Text className="font-semibold text-ink">
            {revealed
              ? booking.event.restaurant?.name ?? "Restaurant TBA"
              : `Mystery Dinner ${priceTier(booking.event.price_cents)}`}
          </Text>
          <Text className="text-xs text-ink/60">
            {revealed
              ? booking.event.restaurant?.neighborhood ?? booking.event.city
              : "Revealed closer to the date"}
          </Text>
          {booking.event.is_mystery && !revealed && (
            <MysteryBadge event={booking.event} />
          )}
        </View>
        <Text className={`text-xs font-medium capitalize ${statusColor}`}>
          {booking.status}
        </Text>
      </View>

      {/* Date and time */}
      <View className="flex-row items-center gap-2">
        <Ionicons name="calendar-outline" size={14} color="#8C7F73" />
        <Text className="text-sm text-ink/70">
          {dateLabel} at {timeLabel}
        </Text>
      </View>

      {/* Group and price */}
      <View className="flex-row justify-between">
        <Text className="text-sm text-ink/60">
          Table of {booking.event.group_size}
        </Text>
        <Text className="text-sm text-ink/60">
          ${(booking.amount_cents / 100).toFixed(2)}
        </Text>
      </View>

      {/* Actions */}
      {canCancel && (
        <Pressable
          onPress={() => {
            Alert.alert(
              "Cancel booking?",
              "You can cancel up to 48 hours before the event",
              [
                { text: "Keep booking", style: "cancel" },
                {
                  text: "Cancel booking",
                  onPress: onCancel,
                  style: "destructive",
                },
              ]
            );
          }}
          className="mt-1 rounded-lg border border-clay/30 bg-clay/10 px-3 py-2"
        >
          <Text className="text-center text-sm font-medium text-clay">
            Cancel booking
          </Text>
        </Pressable>
      )}

      {isPast && booking.status === "confirmed" && (
        <View className="gap-2 mt-1">
          <Button
            label="Leave feedback"
            variant="secondary"
            onPress={() => router.push(`/feedback/${booking.id}`)}
          />
          <Button
            label={myStory ? "View Story Feed" : "Share Story"}
            variant={myStory ? "ghost" : "secondary"}
            onPress={() => {
              if (myStory) {
                router.push("/stories");
              } else {
                router.push({
                  pathname: "/stories/submit",
                  params: { eventId: booking.event_id },
                });
              }
            }}
          />
        </View>
      )}
    </Pressable>
  );
}

function EmptyState() {
  const router = useRouter();
  return (
    <View className="flex-1 items-center justify-center px-4">
      <View className="mb-6 h-16 w-16 items-center justify-center rounded-full bg-white">
        <Ionicons name="bookmark-outline" size={32} color="#C2410C" />
      </View>
      <Text className="mb-2 font-serif text-xl text-ink">No bookings yet</Text>
      <Text className="mb-6 text-center text-sm text-ink/60">
        Browse upcoming tables and book your seat at an exclusive dinner
      </Text>
      <Button label="Browse tables" onPress={() => router.push("/(tabs)/home")} />
    </View>
  );
}

export default function Bookings() {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const { data: bookings, isLoading } = useUserBookings(userId);
  const cancelBooking = useCancelBooking(userId);
  const [filter, setFilter] = useState<FilterType>("upcoming");

  const now = new Date();
  const filtered = (bookings ?? []).filter((b: UserBooking) => {
    const eventDate = new Date(b.event.event_date);
    const isPast = eventDate < now;
    return filter === "upcoming" ? !isPast : isPast;
  });

  return (
    <Screen scroll={false}>
      {/* Header */}
      <View className="gap-2 pb-4">
        <Text className="text-sm text-ink/50">Your bookings</Text>
        <Text className="font-serif text-3xl text-ink">My dinners</Text>
      </View>

      {/* Filters */}
      <View className="mb-4 flex-row gap-2">
        {(["upcoming", "past"] as const).map((f) => (
          <Pressable
            key={f}
            onPress={() => setFilter(f)}
            className={`rounded-full border px-4 py-2 ${
              filter === f ? "border-rust bg-rust" : "border-ink/15 bg-white"
            }`}
          >
            <Text
              className={`text-sm font-medium capitalize ${
                filter === f ? "text-white" : "text-ink"
              }`}
            >
              {f}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* List */}
      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#C2410C" />
        </View>
      ) : filtered.length === 0 ? (
        <EmptyState />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(b) => b.id}
          renderItem={({ item }) => (
            <BookingCard
              booking={item}
              onCancel={() => {
                cancelBooking.mutate(item.id, {
                  onError: (err) =>
                    Alert.alert("Couldn't cancel", (err as Error).message),
                });
              }}
            />
          )}
          ItemSeparatorComponent={() => <View className="h-3" />}
          contentContainerStyle={{ paddingBottom: 24 }}
        />
      )}
    </Screen>
  );
}
