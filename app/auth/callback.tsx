import { useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Screen } from "../../components/Screen";
import { supabase } from "../../lib/supabase";

// Handles the magic-link redirect on web. Supabase JS auto-detects the
// session from the URL because `detectSessionInUrl: true` is enabled on web;
// we just need to land users somewhere while it processes.
export default function AuthCallback() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.auth.getSession();
      if (cancelled) return;
      if (error) {
        setError(error.message);
        return;
      }
      if (data.session) {
        router.replace("/(tabs)/home");
      } else {
        router.replace("/(auth)/login");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <Screen scroll={false}>
      <View className="flex-1 items-center justify-center gap-4">
        <ActivityIndicator />
        <Text className="text-ink/60">Signing you in…</Text>
        {error && <Text className="text-sm text-rust">{error}</Text>}
      </View>
    </Screen>
  );
}
