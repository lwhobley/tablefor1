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
    // Check for an error in the redirect URL (e.g. expired link).
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const urlError = params.get("error_description") ?? params.get("error");
      if (urlError) {
        setError(urlError);
        return;
      }
    }

    // With PKCE flow the magic link carries a ?code= that must be exchanged
    // for a session. detectSessionInUrl handles the exchange asynchronously
    // and fires onAuthStateChange with SIGNED_IN when it completes.
    // Calling getSession() immediately returns null (exchange not done yet),
    // so we wait for the auth state event instead.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "SIGNED_IN" && session) {
          router.replace("/(tabs)/home");
        } else if (event === "INITIAL_SESSION") {
          // Already have a session (e.g. user re-visits callback while logged in)
          if (session) router.replace("/(tabs)/home");
        }
      }
    );

    // Timeout fallback: if nothing fires in 8s, the link may have expired
    const timer = setTimeout(() => {
      setError("Link expired or already used. Request a new one.");
    }, 8000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timer);
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
