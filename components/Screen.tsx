import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export function Screen({
  children,
  scroll = true,
}: {
  children: React.ReactNode;
  scroll?: boolean;
}) {
  const Body = (
    <View className="w-full flex-1 bg-cream px-4 pb-8 pt-3 sm:px-6">
      <View className="flex-row h-1.5 w-full rounded-full overflow-hidden mb-3">
        <View className="flex-1 bg-teal" />
        <View className="w-16 bg-gold-medium" />
        <View className="flex-1 bg-teal-dark" />
      </View>
      {children}
    </View>
  );
  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
      >
        {scroll ? (
          <ScrollView
            contentContainerStyle={{ flexGrow: 1 }}
            keyboardShouldPersistTaps="handled"
          >
            {Body}
          </ScrollView>
        ) : (
          Body
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
