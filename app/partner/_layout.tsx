import { useEffect } from "react";
import { Slot, useRouter, useSegments } from "expo-router";
import { ActivityIndicator, Text, View } from "react-native";
import { Screen } from "../../components/Screen";
import { Button } from "../../components/Button";
import { useAuth } from "../../lib/auth";
import { usePartnerRestaurant } from "../../lib/partnerQueries";

// Partner subtree gates itself independently from the diner side. The
// main app gate in app/_layout.tsx skips anything under /partner so this
// runs without interference.
export default function PartnerLayout() {
  const { session, loading, signOut } = useAuth();
  const { data: restaurant, isLoading: restaurantLoading } = usePartnerRestaurant(
    !!session,
  );
  const segments = useSegments();
  const router = useRouter();
  const onLogin = segments[segments.length - 1] === "login";

  useEffect(() => {
    if (loading) return;
    if (!session && !onLogin) router.replace("/partner/login");
    if (session && onLogin && restaurant) router.replace("/partner/dashboard");
  }, [loading, session, onLogin, restaurant, router]);

  if (loading || (session && restaurantLoading && !onLogin)) {
    return (
      <Screen scroll={false}>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      </Screen>
    );
  }

  // Signed in but no restaurant on file → soft block. We never want a
  // logged-in diner to land in the partner portal by accident.
  if (session && !restaurant && !onLogin) {
    return (
      <Screen>
        <View className="flex-1 justify-center gap-4">
          <Text className="font-serif text-3xl text-ink">No venue on file</Text>
          <Text className="text-base text-ink/60">
            We don't have a restaurant registered under{" "}
            <Text className="font-semibold text-ink">{session.user.email}</Text>.
            Email hello@tablefor2.app and we'll get you set up.
          </Text>
          <Button label="Sign out" variant="ghost" onPress={signOut} />
        </View>
      </Screen>
    );
  }

  return <Slot />;
}
