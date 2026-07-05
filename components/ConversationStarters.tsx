import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export function ConversationStarters({ starters }: { starters: string[] }) {
  if (starters.length === 0) return null;

  return (
    <View className="mb-4 gap-3 rounded-2xl border border-clay/20 bg-clay/5 p-4">
      <View className="flex-row items-center gap-2">
        <Ionicons name="chatbubbles-outline" size={18} color="#C2410C" />
        <Text className="font-semibold text-ink">Conversation starters</Text>
      </View>
      {starters.map((s, i) => (
        <Text key={i} className="text-sm leading-5 text-ink/70">
          • {s}
        </Text>
      ))}
    </View>
  );
}
