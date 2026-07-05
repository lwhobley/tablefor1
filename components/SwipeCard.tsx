import { Pressable, Text, View, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { Profile } from "../lib/supabase";

type Props = {
  profile: Profile;
  onLike: () => void;
  onPass: () => void;
};

export function SwipeCard({ profile, onLike, onPass }: Props) {
  return (
    <View className="gap-4 rounded-3xl border border-ink/10 bg-white p-6">
      {profile.photo_url ? (
        <Image
          source={{ uri: profile.photo_url }}
          className="h-64 w-full rounded-2xl"
          resizeMode="cover"
        />
      ) : (
        <View className="h-64 w-full items-center justify-center rounded-2xl bg-cream">
          <Ionicons name="person" size={64} color="#8C7F73" />
        </View>
      )}

      <View className="gap-1">
        <Text className="font-serif text-2xl text-ink">{profile.name}</Text>
        {profile.bio && (
          <Text className="text-sm text-ink/60" numberOfLines={3}>
            {profile.bio}
          </Text>
        )}
      </View>

      <View className="flex-row gap-2">
        <View className="rounded-full bg-sage/15 px-3 py-1">
          <Text className="text-xs text-ink/70">
            {profile.energy_level.replace("_", " ")}
          </Text>
        </View>
        <View className="rounded-full bg-sage/15 px-3 py-1">
          <Text className="text-xs text-ink/70">{profile.conv_style}</Text>
        </View>
        {profile.food_prefs.slice(0, 2).map((pref) => (
          <View key={pref} className="rounded-full bg-clay/15 px-3 py-1">
            <Text className="text-xs text-ink/70">{pref}</Text>
          </View>
        ))}
      </View>

      <View className="flex-row justify-center gap-6 pt-2">
        <Pressable
          onPress={onPass}
          className="h-16 w-16 items-center justify-center rounded-full border-2 border-ink/20 active:bg-ink/5"
        >
          <Ionicons name="close" size={28} color="#8C7F73" />
        </Pressable>
        <Pressable
          onPress={onLike}
          className="h-16 w-16 items-center justify-center rounded-full border-2 border-rust bg-rust/10 active:bg-rust/20"
        >
          <Ionicons name="heart" size={28} color="#C2410C" />
        </Pressable>
      </View>
    </View>
  );
}
