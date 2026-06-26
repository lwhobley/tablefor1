import { useState } from "react";
import { Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Screen } from "../../components/Screen";
import { Button } from "../../components/Button";
import { ChipGroup } from "../../components/Chip";
import { StepHeader } from "../../components/StepHeader";
import { CUISINES, DIETARY } from "../../components/preferences";
import { useAuth } from "../../lib/auth";
import { useProfile, useUpdateProfile } from "../../lib/queries";

export default function OnboardingFood() {
  const router = useRouter();
  const { session } = useAuth();
  const { data: profile } = useProfile(session?.user.id);
  const update = useUpdateProfile(session?.user.id);
  const [food, setFood] = useState<string[]>(profile?.food_prefs ?? []);
  const [diet, setDiet] = useState<string[]>(profile?.dietary ?? []);

  async function next() {
    await update.mutateAsync({ food_prefs: food, dietary: diet });
    router.push("/(onboarding)/personality");
  }

  return (
    <Screen>
      <View className="flex-1 gap-8">
        <StepHeader
          step={3}
          total={5}
          title="What do you love to eat?"
          subtitle="Pick a few cuisines you'd happily order off."
        />

        <View className="gap-3">
          <Text className="text-sm font-medium text-ink/70">Cuisines</Text>
          <View className="flex-row flex-wrap gap-2">
            <ChipGroup options={CUISINES} values={food} onChange={setFood} />
          </View>
        </View>

        <View className="gap-3">
          <Text className="text-sm font-medium text-ink/70">Dietary</Text>
          <View className="flex-row flex-wrap gap-2">
            <ChipGroup options={DIETARY} values={diet} onChange={setDiet} />
          </View>
        </View>

        <View className="mt-auto">
          <Button
            label="Continue"
            onPress={next}
            loading={update.isPending}
            disabled={food.length === 0}
          />
        </View>
      </View>
    </Screen>
  );
}
