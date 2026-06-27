import { useState } from "react";
import { View, Text, FlatList, ActivityIndicator, Pressable, Alert } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/lib/auth";
import { useUserBookings, useCancelBooking } from "@/lib/queries";
import { Screen } from "@/components/Screen";
import { Button } from "@/components/Button";
import { Ionicons } from "@expo/vector-icons";

type FilterType = "upcoming" | "past";

function BookingCard({ booking, onCancel }: { booking: any; onCancel: () => void }) {
  const router = useRouter();
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
    booking.status === "pending" &&
    !isPast &&
    !isWithin48h;

  return (
    <Pressable
      onPress={() => router.push(`/events/${booking.event_id}`)}
     
    >
      {/* Header with restaurant and status */}
      <View>
        <View>
          <Text>
            {booking.event.restaurant?.name ?? "Restaurant TBA"}
          </Text>
          <Text>
            {booking.event.restaurant?.neighborhood ?? booking.event.city}
          </Text>
        </View>
        <Text className={`text-xs font-medium capitalize ${statusColor}`}>
          {booking.status}
        </Text>
      </View>

      {/* Date and time */}
      <View>
        <Ionicons name="calendar-outline" size={14} color="#8C7F73" />
        <Text>
          {dateLabel} at {timeLabel}
        </Text>
      </View>

      {/* Group and price */}
      <View>
        <Text>Table of {booking.event.group_size}</Text>
        <Text>${(booking.amount_cents / 100).toFixed(2)}</Text>
      </View>

      {/* Actions */}
      {canCancel && (
        <Pressable
          onPress={(e) => {
            e.stopPropagation?.();
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
         
        >
          <Text>
            Cancel booking
          </Text>
        </Pressable>
      )}

      {isPast && booking.status === "confirmed" && (
        <Button
          label="Leave feedback"
          variant="secondary"
         
          onPress={() => router.push(`/feedback/${booking.id}`)}
        />
      )}
    </Pressable>
  );
}

function EmptyState() {
  const router = useRouter();
  return (
    <View>
      <View>
        <Ionicons name="bookmark-outline" size={32} color="#C2410C" />
      </View>
      <Text>No bookings yet</Text>
      <Text>
        Browse upcoming tables and book your seat at an exclusive dinner
      </Text>
      <Button
        label="Browse tables"
        onPress={() => router.push("/(tabs)/home")}
      />
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
  const filtered = (bookings ?? []).filter((b: any) => {
    const eventDate = new Date(b.event.event_date);
    const isPast = eventDate < now;
    return filter === "upcoming" ? !isPast : isPast;
  });

  return (
    <Screen scroll={false}>
      {/* Header */}
      <View>
        <Text>Your bookings</Text>
        <Text>My dinners</Text>
      </View>

      {/* Filters */}
      <View>
        {(["upcoming", "past"] as const).map((f) => (
          <Pressable
            key={f}
            onPress={() => setFilter(f)}
            className={`px-4 py-2 rounded-full border ${
              filter === f
                ? "border-rust bg-rust"
                : "border-ink/15 bg-white"
            }`}
          >
            <Text
              className={`capitalize font-medium text-sm ${
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
        <View>
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
                cancelBooking.mutate(item.id);
              }}
            />
          )}
          ItemSeparatorComponent={() => <View />}
          contentContainerStyle={{ paddingBottom: 24 }}
        />
      )}
    </Screen>
  );
}
