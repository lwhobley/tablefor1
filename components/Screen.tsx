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
    <View className="w-full max-w-3xl flex-1 self-center bg-cream px-4 pb-8 pt-3 sm:px-6">
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
