import { useState } from "react";
import { Image, Text, View, Alert } from "react-native";
import * as Linking from "expo-linking";
import { Screen } from "../../components/Screen";
import { Field } from "../../components/Field";
import { Button } from "../../components/Button";
import { supabase } from "../../lib/supabase";

export default function Login() {
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

  return (
    <Screen>
      <View className="flex-1 justify-center gap-8">
        <View className="items-start gap-3">
          <Image
            source={require("../../assets/images/table_for_2_logo.png")}
            style={{ width: 190, height: 104, resizeMode: "contain" }}
          />
          <Text className="text-base text-ink/60">
            {mode === "signin"
              ? "Curated dinners with new friends."
              : "Create your account with email confirmation."}
          </Text>
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
          {error && <Text className="text-sm text-rust">{error}</Text>}
          <Button
            label={mode === "signin" ? "Sign in" : "Create account"}
            onPress={onSubmit}
            loading={submitting}
            disabled={!isValid}
          />
          <Button
            label={
              mode === "signin"
                ? "No account? Create one"
                : "Have an account? Sign in"
            }
            variant="ghost"
            onPress={() => {
              setError(null);
              setMode(mode === "signin" ? "signup" : "signin");
            }}
          />
        </View>
      </View>
    </Screen>
  );
}
