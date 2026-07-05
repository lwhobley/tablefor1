import { ActivityIndicator, Image, Pressable, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "../../../components/Screen";
import { Button } from "../../../components/Button";
import { useAuth } from "../../../lib/auth";
import {
  useMatchDetail,
  useMatchSparks,
  useSendSpark,
  useMyGivenTags,
  useToggleDinerTag,
  isMutualSpark,
} from "../../../lib/queries";
import { TAG_OPTIONS } from "../../../components/preferences";
import type { Profile, Spark, DinerTag } from "../../../lib/supabase";

function DinerSparkCard({
  profile,
  sparked,
  mutual,
  onSpark,
}: {
  profile: Profile;
  sparked: boolean | null;
  mutual: boolean;
  onSpark: () => void;
}) {
  return (
    <View className="flex-row items-center gap-4 rounded-2xl border border-ink/10 bg-white p-4">
      {profile.photo_url ? (
        <Image
          source={{ uri: profile.photo_url }}
          className="h-14 w-14 rounded-full"
        />
      ) : (
        <View className="h-14 w-14 items-center justify-center rounded-full bg-cream">
          <Ionicons name="person" size={24} color="#8C7F73" />
        </View>
      )}
      <View className="flex-1 gap-0.5">
        <Text className="text-base font-medium text-ink">{profile.name}</Text>
        {mutual && (
          <View className="flex-row items-center gap-1">
            <Ionicons name="flash" size={12} color="#D97706" />
            <Text className="text-xs text-amber-700">Mutual spark! You can message now.</Text>
          </View>
        )}
      </View>
      {mutual ? (
        <View className="h-10 w-10 items-center justify-center rounded-full bg-amber-100">
          <Ionicons name="flash" size={20} color="#D97706" />
        </View>
      ) : sparked === true ? (
        <View className="h-10 w-10 items-center justify-center rounded-full bg-rust/10">
          <Ionicons name="flash" size={20} color="#C2410C" />
        </View>
      ) : (
        <Pressable
          onPress={onSpark}
          className="h-10 w-10 items-center justify-center rounded-full border border-ink/20 active:bg-ink/5"
        >
          <Ionicons name="flash-outline" size={20} color="#8C7F73" />
        </Pressable>
      )}
    </View>
  );
}

function DinerTagRow({
  dinerId,
  givenTags,
  onToggle,
}: {
  dinerId: string;
  givenTags: DinerTag["tag"][];
  onToggle: (tag: DinerTag["tag"], currentlyGiven: boolean) => void;
}) {
  return (
    <View className="-mt-1 flex-row flex-wrap gap-2 rounded-2xl border border-ink/10 bg-white p-3">
      {TAG_OPTIONS.map((opt) => {
        const given = givenTags.includes(opt.value);
        return (
          <Pressable
            key={opt.value}
            onPress={() => onToggle(opt.value, given)}
            className={`h-8 items-center justify-center rounded-full border px-3 ${
              given ? "border-rust bg-rust" : "border-ink/15 bg-white"
            }`}
          >
            <Text
              className={`text-xs font-medium ${given ? "text-white" : "text-ink/70"}`}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function SparksScreen() {
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.user.id;

  const { data: match, isLoading } = useMatchDetail(matchId);
  const { data: sparks } = useMatchSparks(matchId, userId);
  const { data: givenTags } = useMyGivenTags(matchId, userId);
  const sendSpark = useSendSpark(userId);
  const toggleTag = useToggleDinerTag(userId);

  if (isLoading || !match) {
    return (
      <Screen scroll={false}>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      </Screen>
    );
  }

  const otherDiners = match.diners.filter((d: Profile) => d.id !== userId);
  const allSparks: Spark[] = sparks ?? [];

  function didISpark(targetId: string): boolean | null {
    const s = allSparks.find(
      (sp: Spark) => sp.user_id === userId && sp.target_user_id === targetId,
    );
    return s ? s.sparked : null;
  }

  return (
    <Screen>
      <View className="gap-6">
        <View className="gap-2">
          <Text className="font-serif text-3xl text-ink">Post-Dinner Sparks</Text>
          <Text className="text-sm text-ink/60">
            Who would you love to dine with again? Mutual sparks unlock
            permanent messaging.
          </Text>
        </View>

        <View className="gap-3">
          {otherDiners.map((diner: Profile) => {
            const mySparkSent = didISpark(diner.id);
            const mutual = isMutualSpark(allSparks, userId!, diner.id);
            const dinerGivenTags = (givenTags ?? [])
              .filter((t: DinerTag) => t.ratee_id === diner.id)
              .map((t: DinerTag) => t.tag);
            return (
              <View key={diner.id} className="gap-2">
                <DinerSparkCard
                  profile={diner}
                  sparked={mySparkSent}
                  mutual={mutual}
                  onSpark={() =>
                    sendSpark.mutate({
                      matchId: matchId!,
                      targetUserId: diner.id,
                      sparked: true,
                    })
                  }
                />
                <DinerTagRow
                  dinerId={diner.id}
                  givenTags={dinerGivenTags}
                  onToggle={(tag, currentlyGiven) =>
                    toggleTag.mutate({
                      matchId: matchId!,
                      rateeId: diner.id,
                      tag,
                      currentlyGiven,
                    })
                  }
                />
              </View>
            );
          })}
        </View>

        <Button label="Done" variant="ghost" onPress={() => router.back()} />
      </View>
    </Screen>
  );
}
