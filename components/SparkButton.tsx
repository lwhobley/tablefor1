import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

type Props = {
  sparked: boolean | null;
  isMutual: boolean;
  onSpark: () => void;
  disabled?: boolean;
};

export function SparkButton({ sparked, isMutual, onSpark, disabled }: Props) {
  if (isMutual) {
    return (
      <View className="flex-row items-center gap-1 rounded-full bg-amber-100 px-3 py-1.5">
        <Ionicons name="flash" size={14} color="#D97706" />
        <Text className="text-xs font-semibold text-amber-700">Mutual Spark!</Text>
      </View>
    );
  }

  if (sparked === true) {
    return (
      <View className="flex-row items-center gap-1 rounded-full bg-rust/10 px-3 py-1.5">
        <Ionicons name="flash" size={14} color="#C2410C" />
        <Text className="text-xs text-rust">Sparked</Text>
      </View>
    );
  }

  return (
    <Pressable
      onPress={onSpark}
      disabled={disabled}
      className="flex-row items-center gap-1 rounded-full border border-ink/20 px-3 py-1.5 active:bg-ink/5"
    >
      <Ionicons name="flash-outline" size={14} color="#8C7F73" />
      <Text className="text-xs text-ink/60">Spark</Text>
    </Pressable>
  );
}
