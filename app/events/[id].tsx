import { useLocalSearchParams, useRouter } from "expo-router";
import { View, Text, ScrollView, ActivityIndicator, Alert } from "react-native";
import { useAuth } from "@/lib/auth";
import { useEventDetails, useCreateBooking } from "@/lib/queries";
import { Button } from "@/components/Button";
import { Screen } from "@/components/Screen";
import { Ionicons } from "@expo/vector-icons";

export default function EventDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.user?.id;

  const { data: event, isLoading, error } = useEventDetails(id);
  const createBooking = useCreateBooking(userId);

  const handleBook = () => {
    if (!userId) {
      Alert.alert("Not signed in");
      return;
    }

    createBooking.mutate(
      { eventId: id!, amountCents: event!.price_cents },
      {
        onSuccess: (booking) => {
          router.push({
            pathname: "/checkout/[bookingId]",
            params: { bookingId: booking.id, eventId: id },
          });
        },
        onError: (err) => {
          Alert.alert("Couldn't book", (err as Error).message);
        },
      }
    );
  };

  if (isLoading) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#C2410C" />
        </View>
      </Screen>
    );
  }

  if (error || !event) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center gap-4">
          <Text className="text-lg text-ink">Event not found</Text>
          <Button label="Back" variant="secondary" onPress={() => router.back()} />
        </View>
      </Screen>
    );
  }

  const spotsLeft = Math.max(0, event.group_size - event.confirmed_covers);
  const isFull = spotsLeft === 0;
  const eventDate = new Date(event.event_date);
  const formattedDate = eventDate.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
  const formattedTime = eventDate.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <Screen scroll={false}>
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 24 }}>
        {/* Restaurant header */}
        <View className="mb-8 gap-2">
          <Text className="font-serif text-4xl text-ink">
            {event.restaurant?.name}
          </Text>
          <View className="flex-row items-center gap-2">
            <Ionicons name="location-outline" size={18} color="#8C7F73" />
            <Text className="text-ink/70">{event.restaurant?.neighborhood}</Text>
          </View>
          {event.restaurant?.cuisine && event.restaurant.cuisine.length > 0 && (
            <Text className="text-ink/70">
              {event.restaurant.cuisine.join(", ")}
            </Text>
          )}
        </View>

        {/* Event details grid */}
        <View className="mb-8 rounded-2xl bg-white p-4">
          <View className="mb-4 flex-row justify-between">
            <View>
              <Text className="mb-1 text-sm font-medium text-ink/60">Date</Text>
              <Text className="font-semibold text-ink">{formattedDate}</Text>
            </View>
            <View>
              <Text className="mb-1 text-sm font-medium text-ink/60">Time</Text>
              <Text className="font-semibold text-ink">{formattedTime}</Text>
            </View>
            <View>
              <Text className="mb-1 text-sm font-medium text-ink/60">Format</Text>
              <Text className="font-semibold capitalize text-ink">
                {event.format.replace("_", " ")}
              </Text>
            </View>
          </View>

          <View className="flex-row justify-between border-t border-ink/10 pt-4">
            <View>
              <Text className="mb-1 text-sm font-medium text-ink/60">
                Group Size
              </Text>
              <Text className="font-semibold text-ink">
                {event.group_size} people
              </Text>
            </View>
            <View>
              <Text className="mb-1 text-sm font-medium text-ink/60">Price</Text>
              <Text className="font-semibold text-ink">
                ${(event.price_cents / 100).toFixed(2)}
              </Text>
            </View>
            <View>
              <Text className="mb-1 text-sm font-medium text-ink/60">
                Spots Left
              </Text>
              <Text
                className={`font-semibold ${isFull ? "text-clay" : "text-sage"}`}
              >
                {spotsLeft}
              </Text>
            </View>
          </View>
        </View>

        {/* Status badge */}
        {event.confirmed_covers > 0 && (
          <View className="mb-6 rounded-lg border border-sage/30 bg-sage/10 px-4 py-3">
            <Text className="font-medium text-sage">
              {event.confirmed_covers} diner
              {event.confirmed_covers !== 1 ? "s" : ""} already booked
            </Text>
          </View>
        )}

        {/* Description */}
        {event.description && (
          <View className="mb-8 gap-2">
            <Text className="text-lg font-bold text-ink">About</Text>
            <Text className="leading-6 text-ink/70">{event.description}</Text>
          </View>
        )}

        {/* Info section */}
        <View className="mb-8 gap-2 rounded-lg border border-clay/20 bg-clay/5 p-4">
          <Text className="font-semibold text-ink">How it works</Text>
          <Text className="text-sm text-ink/70">
            • Book your spot for this exclusive dinner
          </Text>
          <Text className="text-sm text-ink/70">
            • Get matched with other solo diners 24 hours before
          </Text>
          <Text className="text-sm text-ink/70">
            • Enjoy dinner with your carefully matched group
          </Text>
        </View>

        {/* Book button */}
        <View className="gap-2">
          <Button
            label={isFull ? "Event Full" : "Book Now"}
            disabled={isFull || createBooking.isPending}
            loading={createBooking.isPending}
            onPress={handleBook}
          />
          <Button label="Back" variant="ghost" onPress={() => router.back()} />
        </View>
      </ScrollView>
    </Screen>
  );
}
