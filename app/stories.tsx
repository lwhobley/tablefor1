import { ActivityIndicator, Alert, FlatList, Image, Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "../components/Screen";
import { useAuth } from "../lib/auth";
import { useDinnerStories, useDeleteDinnerStory } from "../lib/queries";

export default function StoriesScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.user?.id;
  const { data: stories, isLoading } = useDinnerStories();
  const deleteStory = useDeleteDinnerStory(userId);

  async function handleDelete(storyId: string, eventId: string) {
    Alert.alert("Delete Story", "Are you sure you want to delete this story?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteStory.mutateAsync({ storyId, eventId });
          } catch (err) {
            Alert.alert("Error", (err as Error).message);
          }
        },
      },
    ]);
  }

  if (isLoading) {
    return (
      <Screen>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#1D5A4A" />
        </View>
      </Screen>
    );
  }

  return (
    <Screen scroll={false}>
      <View className="flex-1">
        <View className="gap-4 pb-5">
          <View className="flex-row items-center gap-3">
            <Pressable
              onPress={() => router.back()}
              accessibilityLabel="Go back"
              className="h-10 w-10 items-center justify-center rounded-full bg-white active:opacity-60"
            >
              <Ionicons name="arrow-back" size={21} color="#17201C" />
            </Pressable>
            <View className="flex-1">
              <Text className="text-xs font-bold uppercase text-forest">From tables around the city</Text>
              <Text className="font-serif text-3xl text-ink">Dinner Stories</Text>
            </View>
          </View>
          <Text className="max-w-xl text-sm leading-5 text-muted">
            The meals, conversations, and small moments that turned a reservation into something memorable.
          </Text>
        </View>

        {stories && stories.length > 0 ? (
          <FlatList
            data={stories}
            keyExtractor={(story) => story.id}
            contentContainerStyle={{ paddingBottom: 32 }}
            ItemSeparatorComponent={() => <View className="h-5" />}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => {
              const eventDate = item.event ? new Date(item.event.event_date) : null;
              const formattedDate = eventDate
                ? eventDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })
                : "";

              return (
                <View className="overflow-hidden rounded-lg border border-ink/10 bg-white">
                  <View className="w-full bg-ink/5" style={{ aspectRatio: 4 / 3 }}>
                    <Image source={{ uri: item.photo_url }} className="h-full w-full" resizeMode="cover" />
                    {item.is_featured && (
                      <View className="absolute left-3 top-3 flex-row items-center gap-1 rounded-full bg-black/70 px-2.5 py-1">
                        <Ionicons name="sparkles" size={11} color="#FFFFFF" />
                        <Text className="text-[10px] font-bold uppercase text-white">Community favorite</Text>
                      </View>
                    )}
                  </View>

                  <View className="gap-4 p-4">
                    <View className="flex-row items-center gap-3">
                      <View className="h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-sage/15">
                        {item.user?.photo_url ? (
                          <Image source={{ uri: item.user.photo_url }} className="h-10 w-10" />
                        ) : (
                          <Ionicons name="restaurant" size={17} color="#1D5A4A" />
                        )}
                      </View>
                      <View className="flex-1">
                        <Text className="text-sm font-semibold text-ink">
                          {item.user?.name ?? item.author_name ?? "Table for 2 Community"}
                        </Text>
                        <Text className="text-xs text-muted">
                          {item.event?.city ?? "Community table"} / {formattedDate}
                        </Text>
                      </View>
                      {item.user_id === userId && (
                        <Pressable
                          onPress={() => handleDelete(item.id, item.event_id)}
                          accessibilityLabel="Delete story"
                          className="h-9 w-9 items-center justify-center rounded-full bg-ink/5 active:opacity-50"
                        >
                          <Ionicons name="trash-outline" size={17} color="#B5462D" />
                        </Pressable>
                      )}
                    </View>

                    {item.caption && (
                      <Text className="font-serif text-lg leading-6 text-ink">{item.caption}</Text>
                    )}

                    <View className="flex-row items-start gap-2 border-t border-ink/10 pt-3">
                      <Ionicons name="location-outline" size={15} color="#1D5A4A" />
                      <Text className="flex-1 text-xs leading-4 text-muted">
                        <Text className="font-semibold text-ink">
                          {item.event?.restaurant?.name ?? "Mystery Restaurant"}
                        </Text>
                        {" / "}
                        {item.event?.restaurant?.cuisine?.join(", ") ?? "Cuisine revealed at the table"}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            }}
          />
        ) : (
          <View className="flex-1 items-center justify-center gap-3 p-8">
            <View className="h-14 w-14 items-center justify-center rounded-full bg-sage/15">
              <Ionicons name="images-outline" size={26} color="#1D5A4A" />
            </View>
            <Text className="font-serif text-xl text-ink">No stories yet</Text>
            <Text className="text-center text-sm leading-5 text-muted">
              The first post-dinner memory shared by the community will appear here.
            </Text>
          </View>
        )}
      </View>
    </Screen>
  );
}
