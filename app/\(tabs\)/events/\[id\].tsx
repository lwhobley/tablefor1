import { useLocalSearchParams, useRouter } from "expo-router";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  Pressable,
  Alert,
} from "react-native";
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

  const handleBook = async () => {
    if (!userId) {
      Alert.alert("Not signed in");
      return;
    }

    try {
      createBooking.mutate(
        {
          eventId: id!,
          amountCents: event!.price_cents,
        },
        {
          onSuccess: (booking) => {
            router.push({
              pathname: "/checkout/[bookingId]",
              params: { bookingId: booking.id, eventId: id },
            });
          },
        }
      );
    } catch (err) {
      Alert.alert("Error", (err as Error).message);
    }
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
        <View className="flex-1 items-center justify-center">
          <Text className="text-lg text-ink">Event not found</Text>
          <Button
            title="Back"
            variant="secondary"
            onPress={() => router.back()}
            style={{ marginTop: 16 }}
          />
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
    <Screen>
      <ScrollView className="flex-1 px-4 py-6">
        {/* Restaurant header */}
        <View className="mb-8">
          <Text className="text-4xl font-bold text-ink mb-2">
            {event.restaurant?.name}
          </Text>
          <View className="flex-row items-center gap-2 mb-2">
            <Ionicons name="location-outline" size={18} color="#8C7F73" />
            <Text className="text-ink/70">
              {event.restaurant?.neighborhood}
            </Text>
          </View>
          {event.restaurant?.cuisine && event.restaurant.cuisine.length > 0 && (
            <Text className="text-ink/70">
              {event.restaurant.cuisine.join(", ")}
            </Text>
          )}
        </View>

        {/* Event details grid */}
        <View className="mb-8 bg-cream p-4 rounded-lg">
          <View className="flex-row justify-between mb-4">
            <View>
              <Text className="text-ink/60 text-sm font-medium mb-1">Date</Text>
              <Text className="text-ink font-semibold">{formattedDate}</Text>
            </View>
            <View>
              <Text className="text-ink/60 text-sm font-medium mb-1">Time</Text>
              <Text className="text-ink font-semibold">{formattedTime}</Text>
            </View>
            <View>
              <Text className="text-ink/60 text-sm font-medium mb-1">
                Format
              </Text>
              <Text className="text-ink font-semibold capitalize">
                {event.format}
              </Text>
            </View>
          </View>

          <View className="flex-row justify-between border-t border-ink/15 pt-4">
            <View>
              <Text className="text-ink/60 text-sm font-medium mb-1">
                Group Size
              </Text>
              <Text className="text-ink font-semibold">
                {event.group_size} people
              </Text>
            </View>
            <View>
              <Text className="text-ink/60 text-sm font-medium mb-1">Price</Text>
              <Text className="text-ink font-semibold">
                ${(event.price_cents / 100).toFixed(2)}
              </Text>
            </View>
            <View>
              <Text className="text-ink/60 text-sm font-medium mb-1">
                Spots Left
              </Text>
              <Text
                className={`font-semibold ${
                  isFull ? "text-clay" : "text-sage"
                }`}
              >
                {spotsLeft}
              </Text>
            </View>
          </View>
        </View>

        {/* Status badge */}
        {event.confirmed_covers > 0 && (
          <View className="mb-6 bg-sage/10 px-4 py-3 rounded-lg border border-sage/30">
            <Text className="text-sage font-medium">
              {event.confirmed_covers} diner{event.confirmed_covers !== 1 ? "s" : ""} already booked
            </Text>
          </View>
        )}

        {/* Description */}
        {event.description && (
          <View className="mb-8">
            <Text className="text-lg font-bold text-ink mb-2">About</Text>
            <Text className="text-ink/70 leading-6">{event.description}</Text>
          </View>
        )}

        {/* Info section */}
        <View className="mb-8 bg-clay/5 p-4 rounded-lg border border-clay/20">
          <Text className="text-ink font-semibold mb-2">How it works</Text>
          <Text className="text-sm text-ink/70 mb-2">
            • Book your spot for this exclusive dinner
          </Text>
          <Text className="text-sm text-ink/70 mb-2">
            • Get matched with other solo diners 24 hours before
          </Text>
          <Text className="text-sm text-ink/70">
            • Enjoy dinner with your carefully matched group
          </Text>
        </View>

        {/* Book button */}
        <View className="mb-8">
          <Button
            title={isFull ? "Event Full" : "Book Now"}
            disabled={isFull || createBooking.isPending}
            loading={createBooking.isPending}
            onPress={handleBook}
            className="py-4"
          />
          <Button
            title="Back"
            variant="ghost"
            onPress={() => router.back()}
            className="mt-2 py-4"
          />
        </View>
      </ScrollView>
    </Screen>
  );
}
