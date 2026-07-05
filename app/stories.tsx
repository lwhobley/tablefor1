import { ActivityIndicator, Alert, FlatList, Image, Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Screen } from "../components/Screen";
import { useAuth } from "../lib/auth";
import { useDinnerStories, useDeleteDinnerStory } from "../lib/queries";
import { Ionicons } from "@expo/vector-icons";

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
          <ActivityIndicator size="large" color="#C2410C" />
        </View>
      </Screen>
    );
  }

  return (
    <Screen scroll={false}>
      <View className="flex-1">
        {/* Header */}
        <View className="flex-row items-center justify-between pb-4 border-b border-ink/5">
          <View className="flex-row items-center gap-3">
            <Pressable onPress={() => router.back()} className="p-1 active:opacity-50">
              <Ionicons name="arrow-back" size={24} color="#1F1B16" />
            </Pressable>
            <View>
              <Text className="font-serif text-2xl text-ink">Dinner Stories</Text>
              <Text className="text-xs text-ink/50">BeReal for dining with solo matches</Text>
            </View>
          </View>
        </View>

        {/* Stories list */}
        {stories && stories.length > 0 ? (
          <FlatList
            data={stories}
            keyExtractor={(s) => s.id}
            contentContainerStyle={{ paddingTop: 16, paddingBottom: 32 }}
            ItemSeparatorComponent={() => <View className="h-6" />}
            renderItem={({ item }) => {
              const eventDate = item.event ? new Date(item.event.event_date) : null;
              const formattedDate = eventDate
                ? eventDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })
                : "";

              return (
                <View className="overflow-hidden rounded-2xl border border-ink/10 bg-white">
                  {/* User Profile Info */}
                  <View className="flex-row items-center justify-between p-4">
                    <View className="flex-row items-center gap-3">
                      <View className="h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-ink/5 bg-ink/5">
                        {item.user?.photo_url ? (
                          <Image source={{ uri: item.user.photo_url }} className="h-10 w-10" />
                        ) : (
                          <Ionicons name="person" size={18} color="#8C7F73" />
                        )}
                      </View>
                      <View>
                        <Text className="font-semibold text-ink text-sm">
                          {item.user?.name ?? "Anonymous Diner"}
                        </Text>
                        <Text className="text-xs text-ink/50">
                          {item.event?.city ?? "Explore Location"}
                        </Text>
                      </View>
                    </View>

                    {item.user_id === userId && (
                      <Pressable
                        onPress={() => handleDelete(item.id, item.event_id)}
                        className="p-1 active:opacity-50"
                      >
                        <Ionicons name="trash-outline" size={18} color="#EF4444" />
                      </Pressable>
                    )}
                  </View>

                  {/* Story Image */}
                  <View className="aspect-square w-full bg-ink/5">
                    <Image
                      source={{ uri: item.photo_url }}
                      className="h-full w-full"
                      resizeMode="cover"
                    />
                  </View>

                  {/* Caption & Event Info */}
                  <View className="p-4 gap-2">
                    {item.caption && (
                      <Text className="text-ink text-sm leading-5">
                        {item.caption}
                      </Text>
                    )}

                    <View className="flex-row items-center gap-1.5 border-t border-ink/5 pt-3">
                      <Ionicons name="restaurant-outline" size={14} color="#8C7F73" />
                      <Text className="text-xs text-ink/60 leading-4">
                        Dined at{" "}
                        <Text className="font-semibold text-ink">
                          {item.event?.restaurant?.name ?? "Mystery Restaurant"}
                        </Text>{" "}
                        ({item.event?.restaurant?.cuisine?.join(", ") ?? "Cuisine TBA"}) · {formattedDate}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            }}
          />
        ) : (
          <View className="flex-1 items-center justify-center p-8">
            <Ionicons name="images-outline" size={48} color="#8C7F73" />
            <Text className="font-semibold text-ink mt-3">No stories yet</Text>
            <Text className="text-sm text-ink/50 text-center mt-1">
              Be the first to share a post-dinner photo from your table!
            </Text>
          </View>
        )}
      </View>
    </Screen>
  );
}
