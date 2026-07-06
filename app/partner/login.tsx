import { useState } from "react";
import { Text, View } from "react-native";
import Constants from "expo-constants";
import { Screen } from "../../components/Screen";
import { Field } from "../../components/Field";
import { Button } from "../../components/Button";
import { supabase } from "../../lib/supabase";

function redirectUrl() {
  if (typeof window !== "undefined") {
    return `${window.location.origin}/partner/dashboard`;
  }
  return Constants.linkingUri ?? "tablefor2://partner/dashboard";
}

export default function PartnerLogin() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
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
          <Text className="text-xs uppercase tracking-widest text-rust">
            Partner portal
          </Text>
          <Text className="font-serif text-4xl text-ink">Welcome back</Text>
          <Text className="text-base text-ink/60">
            Sign in with the email you registered your venue under.
          </Text>
        </View>

        {sent ? (
          <View className="gap-3 rounded-2xl bg-sage/15 p-5">
            <Text className="text-base font-semibold text-ink">
              Check your inbox
            </Text>
            <Text className="text-sm text-ink/70">
              We sent a magic link to {email}. Tap it on this device to land in
              your dashboard.
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
              label="Business email"
              value={email}
              onChangeText={setEmail}
              placeholder="venue@yourrestaurant.com"
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
