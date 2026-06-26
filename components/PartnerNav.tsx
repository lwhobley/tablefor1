import { Pressable, Text, View } from "react-native";
import { useRouter, usePathname } from "expo-router";

const ITEMS = [
  { href: "/partner/dashboard", label: "Dashboard" },
  { href: "/partner/availability", label: "Availability" },
  { href: "/partner/events", label: "Events" },
  { href: "/partner/settings", label: "Settings" },
] as const;

export function PartnerNav() {
  const pathname = usePathname();
  const router = useRouter();
  return (
    <View className="flex-row flex-wrap gap-2 pb-4">
      {ITEMS.map((item) => {
        const active = pathname.startsWith(item.href);
        return (
          <Pressable
            key={item.href}
            onPress={() => router.push(item.href as any)}
            className={`h-9 items-center justify-center rounded-full border px-4 ${
              active ? "border-rust bg-rust" : "border-ink/15 bg-white"
            }`}
          >
            <Text
              className={`text-sm font-medium ${
                active ? "text-white" : "text-ink"
              }`}
            >
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
