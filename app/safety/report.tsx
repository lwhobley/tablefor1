import { useState } from "react";
import { Alert, Pressable, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Screen } from "../../components/Screen";
import { Button } from "../../components/Button";
import { ChipGroup } from "../../components/Chip";
import { useAuth } from "../../lib/auth";
import { useSubmitSafetyReport } from "../../lib/queries";

const CATEGORIES = [
  { value: "safety_concern", label: "Safety concern" },
  { value: "inappropriate_behavior", label: "Inappropriate behavior" },
  { value: "harassment", label: "Harassment" },
  { value: "no_show", label: "No-show" },
  { value: "profile_issue", label: "Profile issue" },
  { value: "other", label: "Other" },
];

export default function ReportConcern() {
  const router = useRouter();
  const params = useLocalSearchParams<{ subjectId?: string; subjectName?: string; matchId?: string }>();
  const { session } = useAuth();
  const submit = useSubmitSafetyReport(session?.user.id);
  const [category, setCategory] = useState<string[]>([]);
  const [details, setDetails] = useState("");

  const send = async () => {
    if (!category[0] || details.trim().length < 10) {
      Alert.alert("Add a little more detail", "Choose a category and enter at least 10 characters.");
      return;
    }
    try {
      await submit.mutateAsync({ subjectId: params.subjectId, matchId: params.matchId, category: category[0], details: details.trim() });
      Alert.alert("Report submitted", "Your report is private. Our team will review it as soon as possible.", [{ text: "Done", onPress: () => router.replace("/safety") }]);
    } catch (error) {
      Alert.alert("Couldn't submit report", (error as Error).message);
    }
  };

  return (
    <Screen>
      <View className="gap-6">
        <View className="flex-row items-center gap-3">
          <Pressable onPress={() => router.back()} className="h-10 w-10 items-center justify-center rounded-full bg-white"><Ionicons name="arrow-back" size={20} color="#17201C" /></Pressable>
          <View><Text className="text-xs font-bold uppercase text-muted">Private and confidential</Text><Text className="font-serif text-3xl text-ink">Report a concern</Text></View>
        </View>
        {params.subjectName && <View className="rounded-lg bg-rust/5 p-4"><Text className="text-sm text-ink">Reporting a concern involving <Text className="font-semibold">{params.subjectName}</Text></Text></View>}
        <View className="gap-2"><Text className="text-sm font-semibold text-ink">What happened?</Text><View className="flex-row flex-wrap gap-2"><ChipGroup options={CATEGORIES} values={category} onChange={setCategory} multi={false} /></View></View>
        <View className="gap-2"><Text className="text-sm font-semibold text-ink">Details</Text><TextInput multiline value={details} onChangeText={setDetails} maxLength={4000} placeholder="Tell us what happened and when. Include anything that will help us review it." placeholderTextColor="#68736D" textAlignVertical="top" className="min-h-40 rounded-lg border border-ink/15 bg-white p-4 text-ink" /><Text className="text-right text-xs text-muted">{details.length}/4000</Text></View>
        <Button label="Submit report" loading={submit.isPending} onPress={send} />
      </View>
    </Screen>
  );
}
