import { ActivityIndicator, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Screen } from "../../../components/Screen";
import { SwipeCard } from "../../../components/SwipeCard";
import { Button } from "../../../components/Button";
import { useAuth } from "../../../lib/auth";
import {
  useEventAttendees,
  useMyVibeChecks,
  useSwipeVibeCheck,
} from "../../../lib/queries";
import type { Profile, VibeCheck } from "../../../lib/supabase";

export default function VibeCheckScreen() {
  const { id: eventId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.user.id;

  const { data: attendees, isLoading } = useEventAttendees(eventId, userId);
  const { data: myChecks } = useMyVibeChecks(eventId, userId);
  const swipe = useSwipeVibeCheck(userId);

  const checkedIds = new Set(
    (myChecks ?? []).map((c: VibeCheck) => c.target_user_id),
  );
  const unchecked = (attendees ?? []).filter((p: Profile) => !checkedIds.has(p.id));

  function handleSwipe(direction: "like" | "pass") {
    const target = unchecked[0];
    if (!target || !eventId) return;
    swipe.mutate({ eventId, targetUserId: target.id, direction });
  }

  if (isLoading) {
    return (
      <Screen scroll={false}>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      </Screen>
    );
  }

  if (unchecked.length === 0) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center gap-4">
          <Text className="font-serif text-2xl text-ink">All done!</Text>
          <Text className="text-center text-sm text-ink/60">
            You've vibed on everyone attending this dinner. Your preferences
            will boost the match algorithm.
          </Text>
          <Button label="Back to event" onPress={() => router.back()} />
        </View>
      </Screen>
    );
  }

  const current = unchecked[0];
  const remaining = unchecked.length;

  return (
    <Screen>
      <View className="gap-4">
        <View className="flex-row items-center justify-between">
          <Text className="font-serif text-2xl text-ink">Vibe Check</Text>
          <Text className="text-sm text-ink/40">{remaining} left</Text>
        </View>
        <Text className="text-sm text-ink/60">
          Signal who you'd love to sit next to. Mutual vibes boost your match.
        </Text>
        <SwipeCard
          profile={current}
          onLike={() => handleSwipe("like")}
          onPass={() => handleSwipe("pass")}
        />
      </View>
    </Screen>
  );
}
