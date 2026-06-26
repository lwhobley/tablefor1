import { useState } from "react";
import { Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Screen } from "../../components/Screen";
import { Button } from "../../components/Button";
import { ChipGroup } from "../../components/Chip";
import { StepHeader } from "../../components/StepHeader";
import { CITY_OPTIONS } from "../../components/preferences";
import { useAuth } from "../../lib/auth";
import { useProfile, useUpdateProfile } from "../../lib/queries";
import { markOnboardingComplete } from "../../lib/onboarding";

export default function OnboardingCity() {
  const router = useRouter();
  const { session } = useAuth();
  const { data: profile } = useProfile(session?.user.id);
  const update = useUpdateProfile(session?.user.id);
  const [city, setCity] = useState<string[]>(profile?.city ? [profile.city] : []);

  async function finish() {
    if (!city[0]) return;
    await update.mutateAsync({ city: city[0] });
    await markOnboardingComplete();
    router.replace("/(tabs)/home");
  }

  return (
    <Screen>
      <View className="flex-1 gap-8">
        <StepHeader
          step={5}
          total={5}
          title="Where do you dine?"
          subtitle="We'll show events near you first."
        />

        <View className="gap-3">
          <Text className="text-sm font-medium text-ink/70">City</Text>
          <View className="flex-row flex-wrap gap-2">
            <ChipGroup
              options={CITY_OPTIONS}
              values={city}
              onChange={setCity}
              multi={false}
            />
          </View>
        </View>

        <View className="mt-auto">
          <Button
            label="Finish onboarding"
            onPress={finish}
            loading={update.isPending}
            disabled={city.length === 0}
          />
        </View>
      </View>
    </Screen>
  );
}
