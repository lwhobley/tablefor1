import { useLocalSearchParams, useRouter } from "expo-router";
import { View, Text, ActivityIndicator, Alert, Linking } from "react-native";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/Button";
import { Screen } from "@/components/Screen";

export default function Checkout() {
  const { bookingId, eventId } = useLocalSearchParams<{
    bookingId: string;
    eventId: string;
  }>();
  const router = useRouter();
  const { session } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!bookingId || !session?.user?.id) {
      setError("Invalid session");
      setLoading(false);
      return;
    }

    const createCheckoutSession = async () => {
      try {
        const { data, error: err } = await supabase.functions.invoke(
          "create-checkout-session",
          {
            body: {
              booking_id: bookingId,
              event_id: eventId,
            },
          }
        );

        if (err) throw err;
        if (!data?.url) throw new Error("No checkout URL returned");

        setCheckoutUrl(data.url);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    };

    createCheckoutSession();
  }, [bookingId, eventId, session?.user?.id]);

  const handleProceedToPayment = async () => {
    if (!checkoutUrl) return;
    const supported = await Linking.canOpenURL(checkoutUrl);
    if (supported) {
      await Linking.openURL(checkoutUrl);
    } else {
      Alert.alert("Cannot open Stripe Checkout");
    }
  };

  if (loading) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center gap-4">
          <ActivityIndicator size="large" color="#C2410C" />
          <Text className="text-ink">Preparing checkout...</Text>
        </View>
      </Screen>
    );
  }

  if (error || !checkoutUrl) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center gap-3 px-4">
          <Text className="text-lg font-semibold text-ink">Payment Error</Text>
          <Text className="mb-3 text-center text-ink/70">
            {error ?? "Could not create checkout session"}
          </Text>
          <View className="w-full gap-2">
            <Button label="Try Again" onPress={() => router.back()} />
            <Button
              label="Back to Events"
              variant="ghost"
              onPress={() => router.push("/(tabs)/home")}
            />
          </View>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View className="flex-1 items-center justify-center gap-6 px-4">
        <View className="w-full gap-4 rounded-2xl bg-white p-6">
          <Text className="text-center font-serif text-2xl text-ink">
            Ready to book?
          </Text>
          <Text className="text-center text-ink/70">
            You're about to pay for your seat at this exclusive dinner. You'll
            be matched with other diners 24 hours before the event.
          </Text>

          <View className="gap-2">
            <Button label="Proceed to Payment" onPress={handleProceedToPayment} />
            <Button
              label="Cancel"
              variant="secondary"
              onPress={() => router.back()}
            />
          </View>
        </View>

        <Text className="text-center text-xs text-ink/50">
          Payments processed securely by Stripe
        </Text>
      </View>
    </Screen>
  );
}
