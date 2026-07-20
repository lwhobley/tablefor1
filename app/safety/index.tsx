import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Screen } from "../../components/Screen";
import { Button } from "../../components/Button";
import { useAuth } from "../../lib/auth";
import {
  useBlockedUsers,
  useProfileVerification,
  useRequestProfileVerification,
  useSafetyReports,
  useTrustScore,
} from "../../lib/queries";

export default function SafetyCenter() {
  const router = useRouter();
  const { session } = useAuth();
  const userId = session?.user.id;
  const { data: verification } = useProfileVerification(userId);
  const { data: trust } = useTrustScore(userId);
  const { data: reports } = useSafetyReports(userId);
  const { data: blocked } = useBlockedUsers(userId);
  const requestVerification = useRequestProfileVerification(userId);

  const verify = async () => {
    try {
      await requestVerification.mutateAsync();
      Alert.alert("Request received", "We will review your profile and notify you when verification is complete.");
    } catch (error) {
      Alert.alert("Couldn't request verification", (error as Error).message);
    }
  };

  return (
    <Screen scroll={false}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 28 }}>
        <View className="mb-6 flex-row items-center gap-3">
          <Pressable onPress={() => router.back()} className="h-10 w-10 items-center justify-center rounded-full bg-white">
            <Ionicons name="arrow-back" size={20} color="#17201C" />
          </Pressable>
          <View>
            <Text className="text-xs font-bold uppercase text-muted">Member care</Text>
            <Text className="font-serif text-3xl text-ink">Trust and Safety</Text>
          </View>
        </View>

        <View className="mb-7 gap-4 rounded-lg bg-forest p-5">
          <View className="flex-row items-center justify-between">
            <Ionicons name="shield-checkmark" size={31} color="#FFFFFF" />
            <Text className="font-serif text-3xl text-white">{trust?.trust_score ?? 100}</Text>
          </View>
          <View>
            <Text className="font-semibold text-white">Your trust standing</Text>
            <Text className="mt-1 text-sm leading-5 text-white/70">Built from confirmed attendance and table check-ins, never private feedback notes.</Text>
          </View>
        </View>

        <View className="mb-7 gap-3 border-b border-ink/10 pb-7">
          <View className="flex-row items-start gap-3">
            <View className="h-10 w-10 items-center justify-center rounded-full bg-sage/15">
              <Ionicons name={verification?.status === "verified" ? "checkmark-circle" : "finger-print-outline"} size={20} color="#1D5A4A" />
            </View>
            <View className="flex-1 gap-1">
              <Text className="font-semibold text-ink">Profile verification</Text>
              <Text className="text-sm leading-5 text-muted">
                {verification?.status === "verified" ? "Your verified badge is visible to dinner matches." : verification?.status === "pending" ? "Your verification request is under review." : "Request a review to add a trust signal to your match profile."}
              </Text>
            </View>
          </View>
          {!verification && <Button label="Request verification" variant="secondary" loading={requestVerification.isPending} onPress={verify} />}
        </View>

        <View className="mb-7">
          <Text className="font-serif text-xl text-ink">Safety controls</Text>
          <Pressable onPress={() => router.push("/safety/report")} className="flex-row items-center gap-3 border-b border-ink/10 py-4">
            <Ionicons name="flag-outline" size={20} color="#B5462D" />
            <View className="flex-1"><Text className="font-semibold text-ink">Report a concern</Text><Text className="text-xs text-muted">Private review by the Table for 2 team</Text></View>
            <Ionicons name="chevron-forward" size={18} color="#68736D" />
          </Pressable>
          <View className="flex-row items-center gap-3 border-b border-ink/10 py-4">
            <Ionicons name="ban-outline" size={20} color="#B5462D" />
            <View className="flex-1"><Text className="font-semibold text-ink">Blocked diners</Text><Text className="text-xs text-muted">{blocked?.length ?? 0} blocked · manage from a diner profile</Text></View>
          </View>
        </View>

        <View className="gap-3">
          <Text className="font-serif text-xl text-ink">Your reports</Text>
          {(reports ?? []).length === 0 ? <Text className="text-sm text-muted">No safety reports submitted.</Text> : (reports ?? []).map((report: any) => (
            <View key={report.id} className="flex-row items-start justify-between gap-3 rounded-lg border border-ink/10 bg-white p-4">
              <View className="flex-1"><Text className="font-semibold capitalize text-ink">{report.category.replaceAll("_", " ")}</Text><Text className="mt-1 text-xs text-muted">Submitted {new Date(report.created_at).toLocaleDateString()}</Text></View>
              <View className="rounded-full bg-sage/10 px-2.5 py-1"><Text className="text-xs font-semibold capitalize text-forest">{report.status}</Text></View>
            </View>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}
