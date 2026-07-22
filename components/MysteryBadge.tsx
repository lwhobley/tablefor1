import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { revealCountdownLabel, type MysteryEvent } from "../lib/mystery";

export function MysteryBadge({ event }: { event: MysteryEvent }) {
  return (
    <View className="flex-row items-center gap-1 rounded-full bg-ink/10 px-3 py-1">
      <Ionicons name="help-circle-outline" size={14} color="#1F1B16" />
      <Text className="text-xs font-medium text-ink/70">
        {revealCountdownLabel(event)}
      </Text>
    </View>
  );
}
