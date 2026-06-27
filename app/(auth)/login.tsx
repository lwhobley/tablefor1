import { useState } from "react";
import { Text, View } from "react-native";
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
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });
      if (error) setError(error.message);
    }

    setSubmitting(false);
  }

  const isValid = email.includes("@") && password.length >= 6;

  return (
    <Screen>
      <View className="flex-1 justify-center gap-8">
        <View className="gap-2">
          <Text className="font-serif text-4xl text-ink">Table for One</Text>
          <Text className="text-base text-ink/60">
            Curated dinners with new friends.
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
            placeholder="••••••••"
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
