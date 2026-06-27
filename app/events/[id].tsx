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
        <View>
          <ActivityIndicator size="large" color="#C2410C" />
        </View>
      </Screen>
    );
  }

  if (error || !event) {
    return (
      <Screen>
        <View>
          <Text>Event not found</Text>
          <Button
            label="Back"
            variant="secondary"
            onPress={() => router.back()}
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
      <ScrollView>
        {/* Restaurant header */}
        <View>
          <Text>
            {event.restaurant?.name}
          </Text>
          <View>
            <Ionicons name="location-outline" size={18} color="#8C7F73" />
            <Text>
              {event.restaurant?.neighborhood}
            </Text>
          </View>
          {event.restaurant?.cuisine && event.restaurant.cuisine.length > 0 && (
            <Text>
              {event.restaurant.cuisine.join(", ")}
            </Text>
          )}
        </View>

        {/* Event details grid */}
        <View>
          <View>
            <View>
              <Text>Date</Text>
              <Text>{formattedDate}</Text>
            </View>
            <View>
              <Text>Time</Text>
              <Text>{formattedTime}</Text>
            </View>
            <View>
              <Text>
                Format
              </Text>
              <Text>
                {event.format}
              </Text>
            </View>
          </View>

          <View>
            <View>
              <Text>
                Group Size
              </Text>
              <Text>
                {event.group_size} people
              </Text>
            </View>
            <View>
              <Text>Price</Text>
              <Text>
                ${(event.price_cents / 100).toFixed(2)}
              </Text>
            </View>
            <View>
              <Text>
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
          <View>
            <Text>
              {event.confirmed_covers} diner{event.confirmed_covers !== 1 ? "s" : ""} already booked
            </Text>
          </View>
        )}

        {/* Description */}
        {event.description && (
          <View>
            <Text>About</Text>
            <Text>{event.description}</Text>
          </View>
        )}

        {/* Info section */}
        <View>
          <Text>How it works</Text>
          <Text>
            • Book your spot for this exclusive dinner
          </Text>
          <Text>
            • Get matched with other solo diners 24 hours before
          </Text>
          <Text>
            • Enjoy dinner with your carefully matched group
          </Text>
        </View>

        {/* Book button */}
        <View>
          <Button
            label={isFull ? "Event Full" : "Book Now"}
            disabled={isFull || createBooking.isPending}
            loading={createBooking.isPending}
            onPress={handleBook}
           
          />
          <Button
            label="Back"
            variant="ghost"
            onPress={() => router.back()}
           
          />
        </View>
      </ScrollView>
    </Screen>
  );
}
