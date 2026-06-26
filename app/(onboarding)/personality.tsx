import { useState } from "react";
import { Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Screen } from "../../components/Screen";
import { Button } from "../../components/Button";
import { ChipGroup } from "../../components/Chip";
import { StepHeader } from "../../components/StepHeader";
import {
  CONV_OPTIONS,
  ENERGY_OPTIONS,
  LANGUAGE_OPTIONS,
} from "../../components/preferences";
import { useAuth } from "../../lib/auth";
import { useProfile, useUpdateProfile } from "../../lib/queries";
import type { ConvStyle, EnergyLevel } from "../../lib/supabase";

export default function OnboardingPersonality() {
  const router = useRouter();
  const { session } = useAuth();
  const { data: profile } = useProfile(session?.user.id);
  const update = useUpdateProfile(session?.user.id);
  const [energy, setEnergy] = useState<EnergyLevel[]>(
    profile?.energy_level ? [profile.energy_level] : ["balanced"],
  );
  const [conv, setConv] = useState<ConvStyle[]>(
    profile?.conv_style ? [profile.conv_style] : ["balanced"],
  );
  const [languages, setLanguages] = useState<string[]>(
    profile?.languages ?? ["en"],
  );

  async function next() {
    await update.mutateAsync({
      energy_level: energy[0]!,
      conv_style: conv[0]!,
      languages,
    });
    router.push("/(onboarding)/city");
  }

  return (
    <Screen>
      <View className="flex-1 gap-8">
        <StepHeader
          step={4}
          total={5}
          title="How do you show up?"
          subtitle="We use this to balance the energy at your table."
        />

        <View className="gap-3">
          <Text className="text-sm font-medium text-ink/70">Energy level</Text>
          <View className="flex-row flex-wrap gap-2">
            <ChipGroup
              options={ENERGY_OPTIONS}
              values={energy}
              onChange={setEnergy}
              multi={false}
            />
          </View>
        </View>

        <View className="gap-3">
          <Text className="text-sm font-medium text-ink/70">
            Conversation style
          </Text>
          <View className="flex-row flex-wrap gap-2">
            <ChipGroup
              options={CONV_OPTIONS}
              values={conv}
              onChange={setConv}
              multi={false}
            />
          </View>
        </View>

        <View className="gap-3">
          <Text className="text-sm font-medium text-ink/70">Languages</Text>
          <View className="flex-row flex-wrap gap-2">
            <ChipGroup
              options={LANGUAGE_OPTIONS}
              values={languages}
              onChange={setLanguages}
            />
          </View>
        </View>

        <View className="mt-auto">
          <Button
            label="Continue"
            onPress={next}
            loading={update.isPending}
            disabled={energy.length === 0 || conv.length === 0}
          />
        </View>
      </View>
    </Screen>
  );
}
