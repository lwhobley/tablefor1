import { useState } from "react";
import { Platform, Text, View } from "react-native";
import { Screen } from "../../../components/Screen";
import { Button } from "../../../components/Button";
import { PartnerNav } from "../../../components/PartnerNav";
import { supabase } from "../../../lib/supabase";

export default function StripeConnect() {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setError(null);
    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke("create-connect-link");
    setSubmitting(false);
    if (error || !data?.url) {
      setError(error?.message ?? "Could not start Stripe onboarding");
      return;
    }
    if (Platform.OS === "web" && typeof window !== "undefined") {
      window.location.href = data.url;
    } else {
      // Native: open the Stripe Connect URL in the system browser. We don't
      // pull in expo-web-browser here to keep the dependency surface tight
      // for the web MVP; native partner support comes with Phase 2 polish.
      setError("Open this link in your browser: " + data.url);
    }
  }

  return (
    <Screen>
      <View className="gap-2 pb-2">
        <Text className="font-serif text-3xl text-ink">Connect Stripe</Text>
      </View>
      <PartnerNav />

      <View className="gap-4">
        <Text className="text-base text-ink/70">
          We use Stripe Connect Express to send payouts directly to your
          business bank account. Onboarding is hosted by Stripe and takes
          about two minutes.
        </Text>
        <Text className="text-sm text-ink/60">
          You'll be redirected to Stripe and returned to your dashboard once
          you're done.
        </Text>
        {error && <Text className="text-sm text-rust">{error}</Text>}
        <Button
          label="Continue to Stripe"
          onPress={start}
          loading={submitting}
        />
      </View>
    </Screen>
  );
}
