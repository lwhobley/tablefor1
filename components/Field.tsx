import { Text, TextInput, View } from "react-native";

export function Field({
  label,
  value,
  onChangeText,
  placeholder,
  autoCapitalize = "sentences",
  keyboardType = "default",
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  keyboardType?: "default" | "email-address";
}) {
  return (
    <View className="gap-2">
      <Text className="text-sm font-medium text-ink/70">{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#A89888"
        autoCapitalize={autoCapitalize}
        keyboardType={keyboardType}
        className="h-12 rounded-2xl border border-ink/10 bg-white px-4 text-base text-ink"
      />
    </View>
  );
}
