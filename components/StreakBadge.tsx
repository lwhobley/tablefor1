import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

type Props = {
  count: number;
};

export function StreakBadge({ count }: Props) {
  if (count < 1) return null;

  const color = count >= 5 ? "#D97706" : count >= 3 ? "#C2410C" : "#8C7F73";
  const label =
    count >= 5
      ? "On fire"
      : count >= 3
        ? "Hot streak"
        : `${count} dinner${count > 1 ? "s" : ""}`;

  return (
    <View className="flex-row items-center gap-1 rounded-full bg-amber-50 px-3 py-1">
      <Ionicons name="flame" size={14} color={color} />
      <Text style={{ color }} className="text-xs font-semibold">
        {label} ({count})
      </Text>
    </View>
  );
}
