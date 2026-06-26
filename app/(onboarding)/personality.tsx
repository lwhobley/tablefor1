import { useState } from "react";
import { Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Screen } from "../../components/Screen";
import { Button } from "../../components/Button";
import { ChipGroup } from "../../components/Chip";
import { StepHeader } from "../../components/StepHeader";
import { CONV_OPTIONS, ENERGY_OPTIONS } from "../../components/preferences";
import { useAuth } from "../../lib/auth";
import { useProfile, useUpdateProfile } from "../../lib/queries";
import type { Profile } from "../../lib/supabase";

export default function OnboardingPersonality() {
  const router = useRouter();
  const { session } = useAuth();
  const { data: profile } = useProfile(session?.user.id);
  const update = useUpdateProfile(session?.user.id);
  const [energy, setEnergy] = useState<string[]>(
    profile?.energy_level ? [profile.energy_level] : [],
  );
  const [conv, setConv] = useState<string[]>(
    profile?.conv_style ? [profile.conv_style] : [],
  );
  const [languages, setLanguages] = useState<string[]>(profile?.languages ?? []);

  async function next() {
    await update.mutateAsync({
      energy_level: energy[0] as Profile["energy_level"],
      conv_style: conv[0] as Profile["conv_style"],
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
              options={ENERGY_OPTIONS.map((o) => o.value)}
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
              options={CONV_OPTIONS.map((o) => o.value)}
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
              options={["English", "Spanish", "French", "Mandarin", "Japanese"]}
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
