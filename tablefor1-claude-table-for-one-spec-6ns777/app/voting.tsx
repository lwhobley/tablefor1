import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Screen } from "../components/Screen";
import { Button } from "../components/Button";
import { useAuth } from "../lib/auth";
import { useExpansionCities, useCastCityVote, useRemoveCityVote } from "../lib/queries";
import { Ionicons } from "@expo/vector-icons";

export default function VotingScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.user?.id;

  const { data: cities, isLoading } = useExpansionCities(userId);
  const castVote = useCastCityVote(userId);
  const removeVote = useRemoveCityVote(userId);

  async function handleToggleVote(city: string, hasVoted: boolean) {
    if (!userId) {
      Alert.alert("Not signed in", "Please sign in to pledge interest.");
      return;
    }

    try {
      if (hasVoted) {
        await removeVote.mutateAsync({ city });
      } else {
        await castVote.mutateAsync({ city });
      }
    } catch (err) {
      Alert.alert("Error", (err as Error).message);
    }
  }

  if (isLoading) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#C2410C" />
        </View>
      </Screen>
    );
  }

  return (
    <Screen scroll={false}>
      <View className="flex-1">
        {/* Header */}
        <View className="flex-row items-center gap-3 pb-6 border-b border-ink/5">
          <Pressable onPress={() => router.back()} className="p-1 active:opacity-50">
            <Ionicons name="arrow-back" size={24} color="#1F1B16" />
          </Pressable>
          <View>
            <Text className="font-serif text-2xl text-ink">City Expansion</Text>
            <Text className="text-xs text-ink/50">Pledge to bring Table for One to your city</Text>
          </View>
        </View>

        <ScrollView className="flex-1 mt-4" contentContainerStyle={{ paddingBottom: 32 }}>
          <Text className="text-sm text-ink/70 leading-5 mb-6">
            We launch in new cities when we hit our target threshold of local pledges. Cast your vote for the next destination!
          </Text>

          {cities && cities.length > 0 ? (
            <View className="gap-4">
              {cities.map((item: any) => {
                const percentage = Math.min(
                  100,
                  Math.round((item.current_pledges / item.target_pledges) * 100)
                );

                return (
                  <View
                    key={item.city}
                    className="gap-4 rounded-2xl border border-ink/10 bg-white p-5"
                  >
                    <View className="flex-row items-center justify-between">
                      <Text className="font-serif text-xl text-ink font-semibold">
                        {item.city}
                      </Text>
                      {item.has_voted && (
                        <View className="flex-row items-center gap-1 rounded-full bg-sage/10 px-2.5 py-1">
                          <Ionicons name="checkmark-circle" size={14} color="#166534" />
                          <Text className="text-xs font-semibold text-emerald-800">Pledged</Text>
                        </View>
                      )}
                    </View>

                    {item.description && (
                      <Text className="text-sm text-ink/60 leading-5">
                        {item.description}
                      </Text>
                    )}

                    {/* Progress Bar */}
                    <View className="gap-1.5">
                      <View className="flex-row justify-between items-center">
                        <Text className="text-xs font-semibold text-ink/50">Progress</Text>
                        <Text className="text-xs font-bold text-ink">
                          {item.current_pledges} / {item.target_pledges} ({percentage}%)
                        </Text>
                      </View>
                      <View className="h-2 w-full bg-ink/5 rounded-full overflow-hidden">
                        <View
                          className="h-full bg-rust rounded-full"
                          style={{ width: `${percentage}%` }}
                        />
                      </View>
                    </View>

                    {/* Action Button */}
                    <Button
                      label={item.has_voted ? "Remove Pledge" : "Pledge Interest"}
                      variant={item.has_voted ? "ghost" : "secondary"}
                      loading={castVote.isPending || removeVote.isPending}
                      onPress={() => handleToggleVote(item.city, item.has_voted)}
                    />
                  </View>
                );
              })}
            </View>
          ) : (
            <View className="mt-8 gap-2 items-center justify-center p-8 bg-clay/5 rounded-2xl border border-clay/10">
              <Ionicons name="map-outline" size={40} color="#8C7F73" />
              <Text className="font-semibold text-ink">No candidate cities</Text>
              <Text className="text-sm text-ink/50 text-center">
                We aren't voting on new expansion cities at this time. Check back later!
              </Text>
            </View>
          )}
        </ScrollView>
      </View>
    </Screen>
  );
}
