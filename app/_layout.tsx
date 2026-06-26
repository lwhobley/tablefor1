import "../global.css";
import { useEffect } from "react";
import { Slot, useRouter, useSegments } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StatusBar } from "expo-status-bar";

import { AuthProvider, useAuth } from "../lib/auth";
import { isOnboarded } from "../lib/onboarding";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
});

function AuthGate() {
  const { session, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const inAuthGroup = segments[0] === "(auth)";
    const inOnboarding = segments[0] === "(onboarding)";
    // The magic-link landing lives at /auth/callback (outside the group)
    // so Supabase can finish detecting the session in the URL before we
    // route the user anywhere.
    const onCallback = segments[0] === "auth" && segments[1] === "callback";

    if (!session) {
      if (!inAuthGroup && !onCallback) router.replace("/(auth)/login");
      return;
    }
    const needsOnboarding = !isOnboarded(session);
    if (needsOnboarding && !inOnboarding) {
      router.replace("/(onboarding)/name");
    } else if (!needsOnboarding && (inAuthGroup || inOnboarding)) {
      router.replace("/(tabs)/home");
    }
  }, [session, loading, segments, router]);

  return <Slot />;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <StatusBar style="dark" />
            <AuthGate />
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
