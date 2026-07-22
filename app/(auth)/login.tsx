import { useState } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import * as Linking from "expo-linking";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from "react-native-safe-area-context";
import { Field } from "../../components/Field";
import { Button } from "../../components/Button";
import { supabase } from "../../lib/supabase";

const authArtwork = require("../../assets/images/table_for_2_logo.png");

export default function Login() {
  const { width, height } = useWindowDimensions();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit() {
    setError(null);
    setSubmitting(true);

    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) setError(error.message);
    } else {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: Linking.createURL("/auth/callback"),
        },
      });
      if (error) {
        setError(error.message);
      } else if (data?.user && !data?.session) {
        Alert.alert(
          "Check your email",
          "We sent a confirmation link to your inbox. Open it to confirm your account, then your welcome note will follow after you sign in."
        );
      }
    }

    setSubmitting(false);
  }

  const isValid = email.includes("@") && password.length >= 6;
  const authHeroHeight = Math.min(width * (945 / 1680), 460);
  const isWide = width >= 900;

  return (
    <SafeAreaView className="flex-1 bg-ink" edges={["top", "bottom"]}>
      <StatusBar style="light" />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View className={`w-full flex-1 bg-pearl ${isWide ? "flex-row-reverse" : ""}`}>
            <View
              className="relative bg-ink"
              style={isWide ? { flex: 1, minHeight: height } : undefined}
            >
              <Image
                source={authArtwork}
                resizeMode="cover"
                style={
                  isWide
                    ? { width: "100%", height: "100%", objectFit: "cover" }
                    : { width: "100%", height: authHeroHeight, objectFit: "cover" }
                }
              />
            </View>

            <View
              className="w-full self-center gap-5 bg-pearl px-5 pb-8 pt-6 sm:px-8"
              style={isWide ? { width: 520, minHeight: height, justifyContent: "center" } : undefined}
            >
              <View className="gap-1">
                <Text className="font-serif text-3xl text-ink">
                  {mode === "signin" ? "Welcome back" : "Take your seat"}
                </Text>
                <Text className="text-sm leading-5 text-muted">
                  {mode === "signin"
                    ? "Your next shared table is waiting."
                    : "Join the community gathering around better dinners."}
                </Text>
              </View>

              <View className="flex-row rounded-lg bg-ink/5 p-1">
                {(["signin", "signup"] as const).map((option) => {
                  const selected = mode === option;
                  return (
                    <Pressable
                      key={option}
                      onPress={() => {
                        setError(null);
                        setMode(option);
                      }}
                      accessibilityRole="tab"
                      accessibilityState={{ selected }}
                      className={`h-10 flex-1 items-center justify-center rounded-md ${
                        selected ? "bg-white" : "bg-transparent"
                      }`}
                    >
                      <Text className={`text-sm font-semibold ${selected ? "text-ink" : "text-muted"}`}>
                        {option === "signin" ? "Sign in" : "Create account"}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <View className="gap-4">
                <Field
                  label="Email"
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@example.com"
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
                <Field
                  label="Password"
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Enter password"
                  secureTextEntry
                />
                {error && (
                  <View className="rounded-md bg-rust/10 px-3 py-2.5">
                    <Text className="text-sm text-rust">{error}</Text>
                  </View>
                )}
                <Button
                  label={mode === "signin" ? "Sign in" : "Create account"}
                  onPress={onSubmit}
                  loading={submitting}
                  disabled={!isValid}
                />
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
