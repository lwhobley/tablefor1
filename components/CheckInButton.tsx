import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { uploadCheckinSelfie } from "../lib/uploadCheckin";
import { useCheckIn } from "../lib/queries";

export function CheckInButton({
  bookingId,
  userId,
  alreadyCheckedIn,
}: {
  bookingId: string;
  userId: string;
  alreadyCheckedIn: boolean;
}) {
  const checkIn = useCheckIn(userId);
  const [uploading, setUploading] = useState(false);

  if (alreadyCheckedIn) {
    return (
      <View className="flex-row items-center gap-1 self-start rounded-full bg-sage/15 px-3 py-1.5">
        <Ionicons name="checkmark-circle" size={14} color="#4D7C58" />
        <Text className="text-xs font-medium text-sage">Checked in</Text>
      </View>
    );
  }

  async function handleCheckIn() {
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled) return;
    try {
      setUploading(true);
      const selfieUrl = await uploadCheckinSelfie(userId, bookingId, {
        uri: result.assets[0].uri,
        mimeType: result.assets[0].mimeType ?? undefined,
      });
      checkIn.mutate(
        { bookingId, selfieUrl },
        {
          onError: (err) => Alert.alert("Couldn't check in", (err as Error).message),
        },
      );
    } catch (err) {
      Alert.alert("Couldn't check in", (err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  const busy = uploading || checkIn.isPending;

  return (
    <Pressable
      onPress={handleCheckIn}
      disabled={busy}
      className="flex-row items-center gap-2 self-start rounded-full border border-rust bg-rust/10 px-4 py-2 active:bg-rust/20"
    >
      {busy ? (
        <ActivityIndicator size="small" color="#C2410C" />
      ) : (
        <Ionicons name="camera-outline" size={16} color="#C2410C" />
      )}
      <Text className="text-sm font-medium text-rust">
        {busy ? "Checking in…" : "Check in with a selfie"}
      </Text>
    </Pressable>
  );
}
