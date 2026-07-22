import { Redirect } from "expo-router";

// The auth gate in app/_layout.tsx handles the real routing once the session
// loads. This file just gives Expo Router a concrete entry route.
export default function Index() {
  return <Redirect href="/(tabs)/home" />;
}
