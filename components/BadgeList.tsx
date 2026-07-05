import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { TAG_OPTIONS } from "./preferences";
import type { BadgeCount } from "../lib/supabase";

function tagLabel(tag: BadgeCount["tag"]): string {
  return TAG_OPTIONS.find((o) => o.value === tag)?.label ?? tag;
}

export function BadgeList({ badges }: { badges: BadgeCount[] }) {
  if (badges.length === 0) return null;

  return (
    <View className="gap-2">
      <Text className="text-sm font-medium text-ink/70">Reputation</Text>
      <View className="flex-row flex-wrap gap-2">
        {badges.slice(0, 5).map((b) => (
          <View
            key={b.tag}
            className="flex-row items-center gap-1 rounded-full bg-sage/15 px-3 py-1.5"
          >
            <Ionicons name="ribbon-outline" size={14} color="#4D7C58" />
            <Text className="text-xs font-medium text-sage">
              {tagLabel(b.tag)} · {b.count}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
