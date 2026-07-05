import { useState } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { Screen } from "../../components/Screen";
import { Field } from "../../components/Field";
import { Button } from "../../components/Button";
import { StepHeader } from "../../components/StepHeader";
import { useAuth } from "../../lib/auth";
import { useProfile, useUpdateProfile } from "../../lib/queries";

export default function OnboardingName() {
  const router = useRouter();
  const { session } = useAuth();
  const { data: profile } = useProfile(session?.user.id);
  const update = useUpdateProfile(session?.user.id);
  const [name, setName] = useState(profile?.name ?? "");

  async function next() {
    await update.mutateAsync({ name: name.trim() });
    router.push("/(onboarding)/photo");
  }

  return (
    <Screen>
      <View className="flex-1 gap-8">
        <StepHeader step={1} total={5} title="What should we call you?" />
        <Field
          label="First name"
          value={name}
          onChangeText={setName}
          placeholder="Alex"
          autoCapitalize="words"
        />
        <View className="mt-auto">
          <Button
            label="Continue"
            onPress={next}
            loading={update.isPending}
            disabled={name.trim().length < 1}
          />
        </View>
      </View>
    </Screen>
  );
}
