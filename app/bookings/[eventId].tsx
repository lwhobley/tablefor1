// Landing page after Stripe Checkout redirects back on success. The webhook is
// the source of truth for confirmation, so this screen just reassures the user
// and links onward — it reads the event for the recap but doesn't itself flip
// any booking state.

import { useLocalSearchParams, useRouter } from "expo-router";
import { View, Text, ActivityIndicator } from "react-native";
import { useEventDetails } from "@/lib/queries";
import { Screen } from "@/components/Screen";
import { Button } from "@/components/Button";
import { Ionicons } from "@expo/vector-icons";

export default function BookingConfirmed() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const router = useRouter();
  const { data: event, isLoading } = useEventDetails(eventId);

  if (isLoading) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#C2410C" />
        </View>
      </Screen>
    );
  }

  const eventDate = event ? new Date(event.event_date) : null;

  return (
    <Screen>
      <View className="flex-1 items-center justify-center gap-6 px-4">
        <View className="h-20 w-20 items-center justify-center rounded-full bg-sage/15">
          <Ionicons name="checkmark-circle" size={56} color="#5A7D5A" />
        </View>

        <View className="items-center gap-2">
          <Text className="font-serif text-3xl text-ink">You're booked!</Text>
          <Text className="text-center text-ink/70">
            Your seat is reserved
            {event?.restaurant?.name ? ` at ${event.restaurant.name}` : ""}.
          </Text>
        </View>

        {eventDate && (
          <View className="w-full gap-2 rounded-2xl bg-white p-5">
            <View className="flex-row items-center gap-2">
              <Ionicons name="calendar-outline" size={16} color="#8C7F73" />
              <Text className="text-ink">
                {eventDate.toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                })}{" "}
                at{" "}
                {eventDate.toLocaleTimeString("en-US", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </Text>
            </View>
            <Text className="text-sm text-ink/60">
              We'll match you with your dinner group 24 hours before the event —
              you'll get an email and can message them right here in the app.
            </Text>
          </View>
        )}

        <View className="w-full gap-2">
          <Button
            label="View my bookings"
            onPress={() => router.replace("/(tabs)/bookings")}
          />
          <Button
            label="Browse more tables"
            variant="ghost"
            onPress={() => router.replace("/(tabs)/home")}
          />
        </View>
      </View>
    </Screen>
  );
}
