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
    if (typeof window === "undefined") return;

    // Check query string and hash fragment for errors Supabase may embed.
    const searchParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const urlError =
      searchParams.get("error_description") ??
      hashParams.get("error_description") ??
      searchParams.get("error") ??
      hashParams.get("error");
    if (urlError) {
      setError(decodeURIComponent(urlError));
      return;
    }

    // Whether the URL contains a PKCE code to exchange.
    const hasCode = !!searchParams.get("code");

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "SIGNED_IN" && session) {
          router.replace("/(tabs)/home");
          return;
        }
        // INITIAL_SESSION fires synchronously on subscription — if there's
        // already a live session (e.g. user revisits callback), go home.
        if (event === "INITIAL_SESSION" && session) {
          router.replace("/(tabs)/home");
          return;
        }
        // Supabase fires SIGNED_OUT when exchangeCodeForSession fails
        // (expired code, PKCE verifier mismatch, already used, etc.).
        if (event === "SIGNED_OUT" && hasCode) {
          setError("Link expired or already used. Request a new one.");
        }
      }
    );

    // Final fallback — if Supabase emits nothing within 10 s something is
    // wrong (e.g. network error during exchange).
    const timer = setTimeout(
      () => setError("Sign-in timed out. Please try again."),
      10000,
    );

    return () => { subscription.unsubscribe(); clearTimeout(timer); };
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
