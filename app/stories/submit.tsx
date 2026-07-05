import { useState } from "react";
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { Screen } from "../../components/Screen";
import { Button } from "../../components/Button";
import { useAuth } from "../../lib/auth";
import { useEventDetails, useCreateDinnerStory } from "../../lib/queries";
import { uploadStoryPhoto } from "../../lib/uploadStory";
import { Ionicons } from "@expo/vector-icons";

export default function SubmitStoryScreen() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.user?.id;

  const { data: event, isLoading: eventLoading } = useEventDetails(eventId);
  const createStory = useCreateDinnerStory(userId);

  const [photo, setPhoto] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function pickPhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (!result.canceled) {
      setPhoto(result.assets[0].uri);
    }
  }

  async function handleSubmit() {
    if (!userId || !eventId) return;
    if (!photo) {
      Alert.alert("Photo Required", "Please choose a photo to share your dinner story.");
      return;
    }

    try {
      setSubmitting(true);
      // 1. Upload photo to stories bucket
      const publicUrl = await uploadStoryPhoto(userId, eventId, { uri: photo });

      // 2. Insert dinner story row
      await createStory.mutateAsync({
        eventId,
        photoUrl: publicUrl,
        caption: caption.trim(),
      });

      Alert.alert("Success", "Your dinner story has been shared!", [
        {
          text: "OK",
          onPress: () => {
            router.back();
            // Redirect to stories feed
            router.push("/stories");
          },
        },
      ]);
    } catch (err) {
      Alert.alert("Error", (err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (eventLoading) {
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
            <Text className="font-serif text-2xl text-ink">Share a Story</Text>
            <Text className="text-xs text-ink/50">
              Share the vibe at {event?.restaurant?.name ?? "your dinner"}
            </Text>
          </View>
        </View>

        <ScrollView className="flex-1 mt-4" contentContainerStyle={{ paddingBottom: 32 }}>
          {/* Photo Picker Area */}
          <Pressable
            onPress={pickPhoto}
            className="aspect-square w-full items-center justify-center overflow-hidden rounded-2xl border border-dashed border-ink/20 bg-white"
          >
            {photo ? (
              <Image source={{ uri: photo }} className="h-full w-full" />
            ) : (
              <View className="items-center gap-2 p-6">
                <View className="h-12 w-12 items-center justify-center rounded-full bg-rust/10">
                  <Ionicons name="camera-outline" size={24} color="#C2410C" />
                </View>
                <Text className="font-semibold text-ink">Select Dinner Photo</Text>
                <Text className="text-xs text-ink/50 text-center">
                  Take a photo of the food, the table, or your new friends!
                </Text>
              </View>
            )}
          </Pressable>

          {photo && (
            <Pressable onPress={pickPhoto} className="mt-2 self-center p-2 active:opacity-50">
              <Text className="text-xs font-semibold text-rust">Choose a different photo</Text>
            </Pressable>
          )}

          {/* Caption Input */}
          <View className="mt-6 gap-2">
            <Text className="text-sm font-semibold text-ink">Caption</Text>
            <TextInput
              value={caption}
              onChangeText={setCaption}
              placeholder="What made this dinner special? (e.g. 'Great drinks and even better stories!')"
              placeholderTextColor="#8C7F73"
              multiline
              maxLength={200}
              className="min-h-[80px] rounded-xl border border-ink/10 bg-white p-3 text-sm text-ink"
              textAlignVertical="top"
            />
          </View>

          {/* Submit Action */}
          <View className="mt-8 gap-2">
            <Button
              label={submitting ? "Uploading Story..." : "Post Story"}
              disabled={submitting || !photo}
              loading={submitting}
              onPress={handleSubmit}
            />
            <Button label="Cancel" variant="ghost" onPress={() => router.back()} />
          </View>
        </ScrollView>
      </View>
    </Screen>
  );
}
