import { useLocalSearchParams, useRouter } from "expo-router";
import {
  View,
  Text,
  ActivityIndicator,
  ScrollView,
  Pressable,
  Alert,
} from "react-native";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useMatchDetail, useSubmitFeedback } from "@/lib/queries";
import { Screen } from "@/components/Screen";
import { Button } from "@/components/Button";
import { Ionicons } from "@expo/vector-icons";

export default function Feedback() {
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.user?.id;

  const { data: match, isLoading } = useMatchDetail(matchId);
  const submitFeedback = useSubmitFeedback(userId);

  const [rating, setRating] = useState<"1" | "2" | "3" | "4" | "5" | null>(null);
  const [showedUp, setShowedUp] = useState(true);
  const [reconnect, setReconnect] = useState(false);
  const [notes, setNotes] = useState("");

  const handleSubmit = async () => {
    if (!rating) {
      Alert.alert("Please select a rating");
      return;
    }

    try {
      submitFeedback.mutate(
        {
          match_id: matchId!,
          rating,
          showed_up: showedUp,
          reconnect,
          notes: notes || undefined,
        },
        {
          onSuccess: () => {
            Alert.alert("Thank you!", "Your feedback has been submitted.", [
              {
                text: "Back to bookings",
                onPress: () => router.push("/(tabs)/bookings"),
              },
            ]);
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

  if (!match) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center">
          <Text className="text-lg text-ink">Feedback not available</Text>
          <Button label="Back" onPress={() => router.back()} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen scroll={false}>
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 24 }}>
        {/* Header */}
        <View className="mb-6">
          <Text className="font-serif text-3xl text-ink mb-2">
            How was dinner?
          </Text>
          <Text className="text-ink/60">
            Your feedback helps us improve and match you better
          </Text>
        </View>

        {/* Rating selector */}
        <View className="mb-8">
          <Text className="font-semibold text-ink mb-4">Overall experience</Text>
          <View className="flex-row gap-3 justify-between">
            {(["1", "2", "3", "4", "5"] as const).map((r) => (
              <Pressable
                key={r}
                onPress={() => setRating(r)}
                className={`h-16 w-16 items-center justify-center rounded-2xl border-2 ${
                  rating === r
                    ? "border-rust bg-rust"
                    : "border-ink/15 bg-white"
                }`}
              >
                <View className="items-center">
                  <Text
                    className={`text-xl font-bold ${
                      rating === r ? "text-white" : "text-ink"
                    }`}
                  >
                    {r}
                  </Text>
                  {r === "5" && (
                    <Ionicons
                      name="star"
                      size={12}
                      color={rating === r ? "white" : "#C2410C"}
                    />
                  )}
                </View>
              </Pressable>
            ))}
          </View>
          <View className="flex-row justify-between mt-2">
            <Text className="text-xs text-ink/60">Not great</Text>
            <Text className="text-xs text-ink/60">Amazing!</Text>
          </View>
        </View>

        {/* Showed up toggle */}
        <View className="mb-6 gap-3">
          <Text className="font-semibold text-ink">Did you show up?</Text>
          <View className="flex-row gap-3">
            {[
              { label: "Yes", value: true },
              { label: "No", value: false },
            ].map((opt) => (
              <Pressable
                key={opt.label}
                onPress={() => setShowedUp(opt.value)}
                className={`flex-1 p-4 rounded-lg border-2 ${
                  showedUp === opt.value
                    ? "border-rust bg-rust/10"
                    : "border-ink/15 bg-white"
                }`}
              >
                <Text
                  className={`text-center font-medium ${
                    showedUp === opt.value ? "text-rust" : "text-ink"
                  }`}
                >
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Reconnect toggle */}
        <View className="mb-8 gap-3 bg-sage/5 p-4 rounded-lg border border-sage/20">
          <View className="flex-row items-center justify-between">
            <View className="flex-1">
              <Text className="font-semibold text-ink mb-1">
                Stay connected?
              </Text>
              <Text className="text-sm text-ink/60">
                Keep messaging your group after dinner
              </Text>
            </View>
            <Pressable
              onPress={() => setReconnect(!reconnect)}
              className={`h-10 w-16 rounded-full items-center justify-center ${
                reconnect ? "bg-sage" : "bg-ink/20"
              }`}
            >
              <View
                className={`h-8 w-8 rounded-full bg-white transform transition-all ${
                  reconnect ? "translate-x-3" : "-translate-x-3"
                }`}
              />
            </Pressable>
          </View>
        </View>

        {/* Notes */}
        <View className="mb-8">
          <Text className="font-semibold text-ink mb-2">
            Additional comments (optional)
          </Text>
          <View className="border border-ink/15 rounded-lg p-3">
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Tell us what you'd like to share..."
              placeholderTextColor="#8C7F73"
              multiline
              numberOfLines={4}
              maxLength={500}
              className="text-ink"
            />
            <Text className="text-xs text-ink/60 mt-2 text-right">
              {notes.length} / 500
            </Text>
          </View>
        </View>

        {/* Submit button */}
        <Button
          label={submitFeedback.isPending ? "Submitting..." : "Submit feedback"}
          disabled={!rating || submitFeedback.isPending}
          onPress={handleSubmit}
        />
      </ScrollView>
    </Screen>
  );
}

// Import TextInput
import { TextInput } from "react-native";
