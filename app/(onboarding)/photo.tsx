import { useState } from "react";
import { Image, Pressable, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { Screen } from "../../components/Screen";
import { Button } from "../../components/Button";
import { StepHeader } from "../../components/StepHeader";
import { useAuth } from "../../lib/auth";
import { useProfile, useUpdateProfile } from "../../lib/queries";
import { uploadAvatar } from "../../lib/uploadAvatar";

export default function OnboardingPhoto() {
  const router = useRouter();
  const { session } = useAuth();
  const { data: profile } = useProfile(session?.user.id);
  const update = useUpdateProfile(session?.user.id);
  const [photo, setPhoto] = useState<string | null>(profile?.photo_url ?? null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pick() {
    setError(null);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (result.canceled || !session) return;
    const asset = result.assets[0];
    try {
      setUploading(true);
      const url = await uploadAvatar(session.user.id, {
        uri: asset.uri,
        mimeType: asset.mimeType ?? undefined,
      });
      setPhoto(url);
      await update.mutateAsync({ photo_url: url });
    } catch (e: any) {
      setError(e.message ?? "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <Screen>
      <View className="flex-1 gap-8">
        <StepHeader
          step={2}
          total={5}
          title="Add a photo"
          subtitle="Your matches see this 24 hours before the dinner."
        />

        <View className="items-center gap-4">
          <Pressable
            onPress={pick}
            className="h-40 w-40 items-center justify-center overflow-hidden rounded-full border border-dashed border-ink/20 bg-white"
          >
            {photo ? (
              <Image source={{ uri: photo }} className="h-40 w-40" />
            ) : (
              <Text className="text-ink/40">Tap to upload</Text>
            )}
          </Pressable>
          <Button
            label={photo ? "Change photo" : "Choose photo"}
            variant="secondary"
            loading={uploading}
            onPress={pick}
          />
          {error && <Text className="text-sm text-rust">{error}</Text>}
        </View>

        <View className="mt-auto gap-3">
          <Button
            label="Continue"
            onPress={() => router.push("/(onboarding)/food")}
            disabled={uploading}
          />
          <Button
            label="Skip for now"
            variant="ghost"
            onPress={() => router.push("/(onboarding)/food")}
          />
        </View>
      </View>
    </Screen>
  );
}
