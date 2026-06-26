import { useState } from "react";
import { Text, View } from "react-native";
import Constants from "expo-constants";
import { Screen } from "../../components/Screen";
import { Field } from "../../components/Field";
import { Button } from "../../components/Button";
import { supabase } from "../../lib/supabase";

function redirectUrl() {
  const fromEnv = process.env.EXPO_PUBLIC_AUTH_REDIRECT_URL;
  if (fromEnv) return fromEnv;
  if (typeof window !== "undefined") {
    return `${window.location.origin}/auth/callback`;
  }
  return Constants.linkingUri ?? "tablefor1://auth/callback";
}

export default function Login() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit() {
    setError(null);
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: redirectUrl() },
    });
    setSubmitting(false);
    if (error) {
      setError(error.message);
      return;
    }
    setSent(true);
  }

  return (
    <Screen>
      <View className="flex-1 justify-center gap-8">
        <View className="gap-2">
          <Text className="font-serif text-4xl text-ink">Table for One</Text>
          <Text className="text-base text-ink/60">
            Curated dinners with new friends. Sign in with a magic link.
          </Text>
        </View>

        {sent ? (
          <View className="gap-3 rounded-2xl bg-sage/15 p-5">
            <Text className="text-base font-semibold text-ink">
              Check your inbox
            </Text>
            <Text className="text-sm text-ink/70">
              We sent a magic link to {email}. Tap it on this device to finish
              signing in.
            </Text>
            <Button
              label="Use a different email"
              variant="ghost"
              onPress={() => setSent(false)}
            />
          </View>
        ) : (
          <View className="gap-4">
            <Field
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              autoCapitalize="none"
              keyboardType="email-address"
            />
            {error && <Text className="text-sm text-rust">{error}</Text>}
            <Button
              label="Send magic link"
              onPress={onSubmit}
              loading={submitting}
              disabled={!email.includes("@")}
            />
          </View>
        )}
      </View>
    </Screen>
  );
}
